package whip

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/bluenviron/gohlslib/v2"
	"github.com/bluenviron/gohlslib/v2/pkg/codecs"
)

// HLSMuxer wraps gohlslib.Muxer with our pion-frame pipeline + env
// config for variant selection. Replaces the hand-rolled
// CMAFSegmenter + parts code that surfaced strict-conformance bugs
// (tfdt offsets, sample-size mismatch, NAL reorder) visible to
// VLC / ffplay on prod inspection.
//
// Why gohlslib: battle-tested library extracted from MediaMTX
// (production streaming server, 100k+ deployments), MIT license,
// produces playlists + segments that decode cleanly on every
// player we tested (VLC, ffplay, hls.js, native Safari/iOS).
// Spec compliance we used to debug by hand — tfdt, mfhd, trun,
// sample byte-range, start-code emulation — is handled internally.
//
// Variant selection via AEVIA_HLS_VARIANT:
//
//	mpegts (default)     — classic .ts segments, widest compat, ~6s latency
//	fmp4                 — CMAF fragmented-mp4 without parts
//	low-latency          — LL-HLS with EXT-X-PART, sub-3s latency
//
// Default mpegts because Fase 3.2 chunk relay + CMAF debugging
// showed the complexity tax of fmp4 strict-conformance outweighs
// the latency win for our use case (WHEP covers <500ms; HLS is a
// fallback path where 6s is acceptable). Operators can flip to
// low-latency via env without a code change.
type HLSMuxer struct {
	mux       *gohlslib.Muxer
	videoTrk  *gohlslib.Track
	sessionID string

	// spsCache / ppsCache carry the H.264 parameter sets — sourced
	// from the WHIP offer's sprop-parameter-sets at construction, OR
	// opportunistically captured from inline STAP-A aggregations in
	// the RTP stream. Injected ahead of every IDR AU whose NALs
	// don't already carry them, so MPEG-TS / fmp4 output is
	// self-decodable by strict decoders (ffprobe, VLC, ffplay).
	// Evidence gathered 2026-04-19: Chrome WebRTC does emit SPS+PPS
	// inline alongside each IDR via STAP-A under packetization-mode=1
	// (nal_census proved 20 IDR ↔ 20 SPS ↔ 20 PPS 1:1), so this cache
	// primarily serves robustness — a future encoder that ships
	// params once at start and never again would still work.
	spsCache []byte
	ppsCache []byte

	mu          sync.Mutex
	currentAU   [][]byte
	currentPTS  uint32
	firstPTS    uint32
	firstPTSSet bool
	startTime   time.Time
	frameCount  uint64
}

// NewHLSMuxer constructs + starts a gohlslib muxer for a session.
// ClockRate pins at the 90 kHz H.264 standard (our input is pion
// RTP with H.264 payload — VideoTimescale is the matching value).
//
// sps / pps are the H.264 parameter sets lifted from the WHIP offer's
// sprop-parameter-sets fmtp field. Pass nil if unavailable (mirror
// origins, dev CLI clients that encode inline SPS/PPS). When set,
// they are pre-populated on the gohlslib Codec so the very first
// segment carries valid params; they are ALSO injected in front of
// each IDR AU inside OnVideoFrame for cases where gohlslib's
// internal SPS/PPS cache gets reset.
func NewHLSMuxer(sessionID string, sps, pps []byte) (*HLSMuxer, error) {
	variant := parseVariantEnv()
	videoTrack := &gohlslib.Track{
		Codec: &codecs.H264{
			SPS: sps,
			PPS: pps,
		},
		ClockRate: VideoTimescale,
	}

	mux := &gohlslib.Muxer{
		Tracks:  []*gohlslib.Track{videoTrack},
		Variant: variant,
		// SegmentCount=7 (default) is fine for live; 3-segment
		// buffer on the player side means ~18s of rewind. Keep
		// SegmentMinDuration=1s default so gohlslib chooses the
		// natural IDR boundary for segment start.
	}
	if err := mux.Start(); err != nil {
		return nil, fmt.Errorf("hls muxer start: %w", err)
	}

	return &HLSMuxer{
		mux:       mux,
		videoTrk:  videoTrack,
		sessionID: sessionID,
		spsCache:  append([]byte(nil), sps...),
		ppsCache:  append([]byte(nil), pps...),
		startTime: time.Now(),
	}, nil
}

// parseVariantEnv reads AEVIA_HLS_VARIANT and maps it to a
// gohlslib MuxerVariant. Unknown values fall back to MPEG-TS —
// never error out on a misconfigured env var, the muxer must
// boot regardless.
func parseVariantEnv() gohlslib.MuxerVariant {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("AEVIA_HLS_VARIANT"))) {
	case "fmp4":
		return gohlslib.MuxerVariantFMP4
	case "low-latency", "lowlatency", "ll", "ll-hls":
		return gohlslib.MuxerVariantLowLatency
	default:
		return gohlslib.MuxerVariantMPEGTS
	}
}

// OnVideoFrame satisfies FrameSink. pion's H264 depacketizer emits
// a buffer that may concatenate MULTIPLE NALs separated by the
// 00 00 00 01 Annex-B start code (STAP-A aggregation packets, or
// multi-slice pictures). gohlslib's WriteH264 expects the Access Unit
// as a `[][]byte` where each element is ONE NAL — without this split
// the segmenter reads `au[0][0]&0x1F` and only sees the FIRST NAL's
// type. If that first NAL is SPS (type 7) instead of IDR (type 5),
// randomAccess stays false forever → no IDR detected → no segment
// boundary → the multivariant playlist handler blocks on cond.Wait()
// indefinitely. This is why /hls/index.m3u8 hung in our first prod
// test while /playlist.m3u8 (legacy sink) still produced chunks.
//
// We batch NALs sharing the same RTP timestamp (= same Access Unit)
// and flush when the timestamp advances or the muxer closes.
func (m *HLSMuxer) OnVideoFrame(f VideoFrame) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.firstPTSSet {
		m.firstPTS = f.Timestamp
		m.currentPTS = f.Timestamp
		m.firstPTSSet = true
	}

	if f.Timestamp != m.currentPTS && len(m.currentAU) > 0 {
		m.flushCurrentAULocked()
	}

	for _, nalu := range splitAnnexBNALs(f.NAL) {
		nalCopy := make([]byte, len(nalu))
		copy(nalCopy, nalu)
		m.currentAU = append(m.currentAU, nalCopy)
	}
	m.currentPTS = f.Timestamp
}

// splitAnnexBNALs breaks a buffer on 00 00 00 01 start codes and
// returns each contained NAL without the delimiter. If the buffer
// carries a single NAL (no delimiter inside), a one-element slice
// pointing at the input is returned — no allocation.
//
// pion's codecs.H264Packet{IsAVC:false} emits STAP-A aggregations
// as `NAL1 || 00 00 00 01 || NAL2 || 00 00 00 01 || NAL3`, i.e. the
// delimiters sit BETWEEN NALs with no leading start code. This
// matches what isKeyframe() in frames.go already assumes.
func splitAnnexBNALs(buf []byte) [][]byte {
	if len(buf) == 0 {
		return nil
	}
	out := make([][]byte, 0, 3)
	for offset := 0; offset < len(buf); {
		rel := findStartCode(buf[offset:])
		if rel < 0 {
			out = append(out, buf[offset:])
			break
		}
		if rel > 0 {
			out = append(out, buf[offset:offset+rel])
		}
		offset += rel + 4
	}
	return out
}

func (m *HLSMuxer) flushCurrentAULocked() {
	if len(m.currentAU) == 0 {
		return
	}
	// Scan the AU twice:
	//  (1) classify NAL types + opportunistically capture inline
	//      SPS/PPS. Chrome WebRTC aggregates SPS+PPS+IDR via STAP-A
	//      on the first keyframe but may omit params on later IDRs —
	//      cache whatever we see so subsequent IDRs inherit them.
	//  (2) detect IDR-without-params → inject cached pair so the
	//      segment is self-decodable.
	hasIDR, hasSPS, hasPPS := false, false, false
	for _, nal := range m.currentAU {
		if len(nal) == 0 {
			continue
		}
		switch nal[0] & 0x1F {
		case 5:
			hasIDR = true
		case 7:
			hasSPS = true
			if len(m.spsCache) == 0 {
				m.spsCache = append(m.spsCache[:0], nal...)
			}
		case 8:
			hasPPS = true
			if len(m.ppsCache) == 0 {
				m.ppsCache = append(m.ppsCache[:0], nal...)
			}
		}
	}
	au := m.currentAU
	if hasIDR && (!hasSPS || !hasPPS) && len(m.spsCache) > 0 && len(m.ppsCache) > 0 {
		prepended := make([][]byte, 0, len(au)+2)
		if !hasSPS {
			prepended = append(prepended, append([]byte(nil), m.spsCache...))
		}
		if !hasPPS {
			prepended = append(prepended, append([]byte(nil), m.ppsCache...))
		}
		au = append(prepended, au...)
	}

	// PTS to gohlslib is in ClockRate (90k) ticks, relative to the
	// first frame we observed. Subtracting firstPTS with uint32
	// arithmetic handles RTP wraparound naturally.
	relPTS := int64(int32(m.currentPTS - m.firstPTS))
	ntp := m.startTime.Add(time.Duration(relPTS) * time.Second / time.Duration(VideoTimescale))

	_ = m.mux.WriteH264(m.videoTrk, ntp, relPTS, au)
	m.frameCount++
	m.currentAU = m.currentAU[:0]
}

// OnAudioFrame is a no-op until we wire Opus as a gohlslib Track.
// Video-only matches our current FrameSink shape; audio ships with
// the M9 multi-codec work.
func (m *HLSMuxer) OnAudioFrame(_ AudioFrame) {}

// Close drains any pending AU and shuts the muxer down. Idempotent.
func (m *HLSMuxer) Close() error {
	m.mu.Lock()
	m.flushCurrentAULocked()
	m.mu.Unlock()
	m.mux.Close()
	return nil
}

// FrameCount returns the number of flushed Access Units. Exposed
// for /healthz + log observability of the stream health.
func (m *HLSMuxer) FrameCount() uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.frameCount
}

// Handler returns the HTTP handler that serves playlist + segments.
// Mount under `/live/{sessionID}/` with http.StripPrefix — gohlslib
// handles relative paths (e.g. "/index.m3u8", "/segment123.ts").
func (m *HLSMuxer) Handler() http.Handler {
	return http.HandlerFunc(m.mux.Handle)
}
