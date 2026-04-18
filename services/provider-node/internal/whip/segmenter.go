package whip

import (
	"bytes"
	"errors"
	"fmt"
	"sync"

	"github.com/Eyevinn/mp4ff/avc"
	"github.com/Eyevinn/mp4ff/mp4"
)

// CMAF segmenter parameters.
const (
	// VideoTimescale is the 90 kHz clock H.264/MPEG standards use
	// per RFC 6184 §5.1 — required for CMAF timestamp conversions.
	VideoTimescale = 90_000
	// TargetSegmentDuration is the HLS target, in seconds. 6s matches
	// Cloudflare Stream's default and keeps LL-HLS EXT-X-PART math tidy
	// (2s parts × 3 per segment).
	TargetSegmentDuration = 6
)

// CMAFSegmenter aggregates H.264 video frames into fragmented-MP4
// media segments + a single init segment. Callers push frames via
// OnVideoFrame (it satisfies FrameSink for video); segments land in
// the sink.
//
// Audio/Opus multiplexing lands in M8.5 when the apps/video live
// playback needs sync — M8 MVP proves the ingest-to-segment pipe
// works end-to-end for video, which is the harder format.
type CMAFSegmenter struct {
	sink SegmentSink

	mu                sync.Mutex
	sps               []byte
	pps               []byte
	initEmitted       bool
	segmentStartTS    uint32
	segmentHasKey     bool
	segmentSampleBufs [][]byte
	segmentDurations  []uint32
	nextSegmentIndex  uint32
	totalSegments     uint32
	sequenceNumber    uint32
}

// SegmentSink receives the init segment once, then each media segment
// as it closes. Implementations pin to BadgerDB (M8-i4), append to a
// live Merkle (M8-i4), or forward via HTTP (M8-i6 LL-HLS playout).
type SegmentSink interface {
	OnInitSegment(bytes []byte) error
	OnMediaSegment(index uint32, bytes []byte, durationTicks uint32) error
}

// NewCMAFSegmenter binds the sink and returns an idle segmenter. The
// init segment is emitted when the first keyframe arrives (we can't
// build an InitSegment without SPS/PPS, which pion sends inline in
// the first IDR bundle).
func NewCMAFSegmenter(sink SegmentSink) (*CMAFSegmenter, error) {
	if sink == nil {
		return nil, errors.New("segmenter: sink is nil")
	}
	return &CMAFSegmenter{sink: sink, sequenceNumber: 1}, nil
}

// OnVideoFrame satisfies FrameSink for video. Audio frames are ignored
// in the M8 MVP segmenter.
func (s *CMAFSegmenter) OnVideoFrame(f VideoFrame) {
	if err := s.ingestFrame(f); err != nil {
		// Non-fatal: malformed NAL or missing SPS/PPS. The stream
		// self-heals when the next keyframe bundle arrives.
		_ = err
	}
}

// OnAudioFrame is a no-op in M8 MVP. Retained to satisfy the FrameSink
// contract so the segmenter can plug directly into whip.ReadTrack for
// both kinds.
func (s *CMAFSegmenter) OnAudioFrame(_ AudioFrame) {}

// Close flushes any pending frames into a final segment and marks the
// segmenter as finalised. Safe to call once.
func (s *CMAFSegmenter) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.segmentSampleBufs) > 0 {
		return s.flushLocked()
	}
	return nil
}

// TotalSegments exposes how many media segments have been emitted,
// for tests and the playlist writer.
func (s *CMAFSegmenter) TotalSegments() uint32 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.totalSegments
}

func (s *CMAFSegmenter) ingestFrame(f VideoFrame) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Split the NAL buffer into individual units and capture SPS/PPS.
	for _, unit := range splitNALUnits(f.NAL) {
		if len(unit) == 0 {
			continue
		}
		switch unit[0] & 0x1F {
		case 7: // SPS
			s.sps = append(s.sps[:0], unit...)
		case 8: // PPS
			s.pps = append(s.pps[:0], unit...)
		}
	}

	// Emit init once we have both SPS + PPS.
	if !s.initEmitted && len(s.sps) > 0 && len(s.pps) > 0 {
		initBytes, err := s.buildInitSegment()
		if err != nil {
			return fmt.Errorf("build init: %w", err)
		}
		if err := s.sink.OnInitSegment(initBytes); err != nil {
			return fmt.Errorf("sink OnInitSegment: %w", err)
		}
		s.initEmitted = true
	}

	// Before init is out, we cannot emit segments yet.
	if !s.initEmitted {
		return nil
	}

	// Segment boundary: if current frame is a keyframe AND accumulated
	// duration >= target, flush the previous segment and start a fresh
	// one rooted at this keyframe.
	if len(s.segmentSampleBufs) == 0 {
		s.segmentStartTS = f.Timestamp
	}
	elapsed := f.Timestamp - s.segmentStartTS
	if f.Keyframe && elapsed >= TargetSegmentDuration*VideoTimescale && len(s.segmentSampleBufs) > 0 {
		if err := s.flushLocked(); err != nil {
			return err
		}
		s.segmentStartTS = f.Timestamp
	}

	// Per-sample duration — we don't know the next timestamp yet, so
	// stamp the previous sample's duration from (thisTS - prevTS) lazily.
	if len(s.segmentSampleBufs) > 0 {
		prevStartInSegment := uint32(0)
		for _, d := range s.segmentDurations {
			prevStartInSegment += d
		}
		prevSampleTS := s.segmentStartTS + prevStartInSegment
		s.segmentDurations[len(s.segmentDurations)-1] = f.Timestamp - prevSampleTS
	}

	// Strip 4-byte start codes pion keeps between NALs; CMAF wants
	// length-prefixed NALs inside each sample.
	sample := encodeAVCCSample(f.NAL)
	s.segmentSampleBufs = append(s.segmentSampleBufs, sample)
	s.segmentDurations = append(s.segmentDurations, 0) // placeholder, set on next frame

	if f.Keyframe {
		s.segmentHasKey = true
	}
	return nil
}

func (s *CMAFSegmenter) flushLocked() error {
	if len(s.segmentSampleBufs) == 0 {
		return nil
	}
	if !s.segmentHasKey {
		// Discard segments that happen to have no keyframe — they would
		// be un-seekable garbage for cold viewers.
		s.segmentSampleBufs = s.segmentSampleBufs[:0]
		s.segmentDurations = s.segmentDurations[:0]
		return nil
	}

	// Last sample duration — we use the target segment duration as a
	// reasonable stand-in since we don't have the next frame's TS yet.
	n := len(s.segmentDurations)
	if s.segmentDurations[n-1] == 0 {
		s.segmentDurations[n-1] = uint32(VideoTimescale / 30) // ~33ms at 30fps
	}

	segBytes, totalTicks, err := s.buildMediaSegment()
	if err != nil {
		return fmt.Errorf("build media segment: %w", err)
	}

	idx := s.nextSegmentIndex
	s.nextSegmentIndex++
	s.totalSegments++
	s.sequenceNumber++

	s.segmentSampleBufs = s.segmentSampleBufs[:0]
	s.segmentDurations = s.segmentDurations[:0]
	s.segmentHasKey = false

	if err := s.sink.OnMediaSegment(idx, segBytes, totalTicks); err != nil {
		return fmt.Errorf("sink OnMediaSegment: %w", err)
	}
	return nil
}

func (s *CMAFSegmenter) buildInitSegment() ([]byte, error) {
	// Parse SPS to get video dimensions.
	spsParsed, err := avc.ParseSPSNALUnit(s.sps, false)
	if err != nil {
		return nil, fmt.Errorf("parse SPS: %w", err)
	}

	init := mp4.CreateEmptyInit()
	init.AddEmptyTrack(VideoTimescale, "video", "und")
	trak := init.Moov.Traks[0]
	if err := trak.SetAVCDescriptor("avc1", [][]byte{s.sps}, [][]byte{s.pps}, true); err != nil {
		return nil, fmt.Errorf("SetAVCDescriptor: %w", err)
	}
	trak.Mdia.Minf.Stbl.Stsd.AvcX.Width = uint16(spsParsed.Width)
	trak.Mdia.Minf.Stbl.Stsd.AvcX.Height = uint16(spsParsed.Height)

	var buf bytes.Buffer
	if err := init.Encode(&buf); err != nil {
		return nil, fmt.Errorf("encode init: %w", err)
	}
	return buf.Bytes(), nil
}

func (s *CMAFSegmenter) buildMediaSegment() ([]byte, uint32, error) {
	seg := mp4.NewMediaSegment()
	frag, err := mp4.CreateFragment(s.sequenceNumber, 1 /* trackID */)
	if err != nil {
		return nil, 0, fmt.Errorf("CreateFragment: %w", err)
	}
	seg.AddFragment(frag)

	var totalTicks uint32
	for i, sample := range s.segmentSampleBufs {
		dur := s.segmentDurations[i]
		fs := mp4.FullSample{
			Sample: mp4.Sample{
				Dur:  dur,
				Size: uint32(len(sample)),
			},
			Data: sample,
		}
		// Mark keyframes for seekability; the first sample of a segment
		// must be a sync sample.
		if i == 0 {
			fs.Flags = 0 // default: IsSync
		} else {
			fs.Flags = mp4.NonSyncSampleFlags
		}
		frag.AddFullSample(fs)
		totalTicks += dur
	}

	var buf bytes.Buffer
	if err := seg.Encode(&buf); err != nil {
		return nil, 0, fmt.Errorf("encode media segment: %w", err)
	}
	return buf.Bytes(), totalTicks, nil
}

// splitNALUnits parses a buffer that may contain one or more Annex-B
// NAL units (separated by 0x00000001 start codes) and returns each
// NAL body (without the start code).
func splitNALUnits(buf []byte) [][]byte {
	var out [][]byte
	offset := 0
	for offset < len(buf) {
		next := findStartCode(buf[offset:])
		if next < 0 {
			if len(buf[offset:]) > 0 {
				out = append(out, buf[offset:])
			}
			break
		}
		if next > 0 {
			out = append(out, buf[offset:offset+next])
		}
		offset += next + 4
	}
	return out
}

// encodeAVCCSample converts Annex-B concatenated NALs into AVCC length-
// prefixed format, which is what CMAF expects inside fMP4 sample data.
func encodeAVCCSample(annexB []byte) []byte {
	nals := splitNALUnits(annexB)
	if len(nals) == 0 {
		nals = [][]byte{annexB}
	}
	out := make([]byte, 0, len(annexB)+4*len(nals))
	for _, n := range nals {
		if len(n) == 0 {
			continue
		}
		out = append(out,
			byte(len(n)>>24),
			byte(len(n)>>16),
			byte(len(n)>>8),
			byte(len(n)),
		)
		out = append(out, n...)
	}
	return out
}
