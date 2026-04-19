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

	mu           sync.Mutex
	currentAU    [][]byte
	currentPTS   uint32
	firstPTS     uint32
	firstPTSSet  bool
	startTime    time.Time
	frameCount   uint64
}

// NewHLSMuxer constructs + starts a gohlslib muxer for a session.
// ClockRate pins at the 90 kHz H.264 standard (our input is pion
// RTP with H.264 payload — VideoTimescale is the matching value).
func NewHLSMuxer(sessionID string) (*HLSMuxer, error) {
	variant := parseVariantEnv()
	videoTrack := &gohlslib.Track{
		Codec:     &codecs.H264{},
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

// OnVideoFrame satisfies FrameSink. pion's H264Packet depacketizer
// emits ONE NAL per RTP packet. gohlslib expects an Access Unit —
// the slice of NALs that compose a single video frame. We batch
// NALs sharing the same RTP timestamp and flush when the timestamp
// advances (next frame) or the muxer closes.
//
// This is the same batching strategy MediaMTX uses internally and
// the reason our prior hand-rolled CMAFSegmenter emitted corrupt
// bitstreams: it wrote NALs one at a time with independent
// sample durations, which violates the fmp4 AU expectation.
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

	// Copy the NAL so upstream buffer reuse doesn't corrupt the AU.
	nalCopy := make([]byte, len(f.NAL))
	copy(nalCopy, f.NAL)
	m.currentAU = append(m.currentAU, nalCopy)
	m.currentPTS = f.Timestamp
}

func (m *HLSMuxer) flushCurrentAULocked() {
	if len(m.currentAU) == 0 {
		return
	}
	// PTS to gohlslib is in ClockRate (90k) ticks, relative to the
	// first frame we observed. Subtracting firstPTS with uint32
	// arithmetic handles RTP wraparound naturally.
	relPTS := int64(int32(m.currentPTS - m.firstPTS))
	ntp := m.startTime.Add(time.Duration(relPTS) * time.Second / time.Duration(VideoTimescale))

	_ = m.mux.WriteH264(m.videoTrk, ntp, relPTS, m.currentAU)
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
