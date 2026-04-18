package whip

import (
	"bytes"
	"errors"
	"testing"
)

// partCaptureSink implements both SegmentSink and PartSink so the
// segmenter picks up parts via its type assertion.
type partCaptureSink struct {
	init     []byte
	segments [][]byte
	parts    []capturedPart
}

type capturedPart struct {
	SegmentIndex uint32
	PartIndex    uint32
	Bytes        []byte
	DurationT    uint32
	Independent  bool
}

func (c *partCaptureSink) OnInitSegment(b []byte) error {
	c.init = append([]byte(nil), b...)
	return nil
}

func (c *partCaptureSink) OnMediaSegment(index uint32, b []byte, _ uint32) error {
	c.segments = append(c.segments, append([]byte(nil), b...))
	return nil
}

func (c *partCaptureSink) OnMediaPart(segIdx, partIdx uint32, b []byte, dur uint32, indep bool) error {
	c.parts = append(c.parts, capturedPart{segIdx, partIdx, append([]byte(nil), b...), dur, indep})
	return nil
}

// TestPartSinkEmitsPartsEvery2Seconds drives the segmenter with
// ~30fps synthetic H.264 frames for 4s (well past the first
// PartTargetDuration = 2s window) and asserts that:
//
//   - at least one OnMediaPart fired
//   - the first part is Independent (starts on the keyframe)
//   - part bytes begin with a valid fMP4 moof box
func TestPartSinkEmitsPartsEvery2Seconds(t *testing.T) {
	sink := &partCaptureSink{}
	seg, err := NewCMAFSegmenter(sink)
	if err != nil {
		t.Fatalf("NewCMAFSegmenter: %v", err)
	}

	// Real SPS+PPS+IDR bundle so buildInitSegment succeeds — same
	// bytes the whipclient / integration tests use.
	sps := []byte{0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40,
		0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92}
	pps := []byte{0x68, 0xCE, 0x38, 0x80}
	idr := []byte{0x65, 0x88, 0x82, 0x00, 0x00}
	keyframe := concatNAL(sps, pps, idr)
	pFrame := concatNAL([]byte{0x41, 0x9A, 0x00, 0x00, 0x00})

	const fps = 30
	tickStep := uint32(VideoTimescale / fps)
	ts := uint32(0)

	// first frame = keyframe (sets independent=true for part 0)
	seg.OnVideoFrame(VideoFrame{NAL: keyframe, Timestamp: ts, Keyframe: true})
	ts += tickStep

	// feed 4 seconds of P-frames so at least 2 parts complete
	for i := 0; i < fps*4; i++ {
		seg.OnVideoFrame(VideoFrame{NAL: pFrame, Timestamp: ts})
		ts += tickStep
	}

	if len(sink.parts) == 0 {
		t.Fatalf("expected at least 1 OnMediaPart callback, got 0")
	}
	if !sink.parts[0].Independent {
		t.Fatalf("first part must be Independent (keyframe-rooted)")
	}
	if len(sink.parts[0].Bytes) == 0 {
		t.Fatalf("first part has empty bytes")
	}
	// fMP4 fragment starts with a moof box. The first 4 bytes are the
	// box size; bytes 4..8 are the box type. Check either "moof" or
	// "styp" at the start (mp4ff may prefix a styp).
	boxType := sink.parts[0].Bytes[4:8]
	if !bytes.Equal(boxType, []byte("moof")) && !bytes.Equal(boxType, []byte("styp")) {
		t.Fatalf("first part box type = %q, want moof or styp", string(boxType))
	}
}

// TestPartSinkOptional proves the segmenter keeps working with a
// pure SegmentSink (no PartSink) — legacy back-compat.
type classicSinkOnly struct {
	inits    int
	segments int
}

func (c *classicSinkOnly) OnInitSegment([]byte) error                  { c.inits++; return nil }
func (c *classicSinkOnly) OnMediaSegment(uint32, []byte, uint32) error { c.segments++; return nil }

func TestPartSinkOptional(t *testing.T) {
	sink := &classicSinkOnly{}
	seg, err := NewCMAFSegmenter(sink)
	if err != nil {
		t.Fatalf("NewCMAFSegmenter: %v", err)
	}
	if seg.partSink != nil {
		t.Fatalf("partSink should be nil when sink doesn't implement PartSink")
	}

	sps := []byte{0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40, 0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92}
	pps := []byte{0x68, 0xCE, 0x38, 0x80}
	idr := []byte{0x65, 0x88, 0x82, 0x00, 0x00}
	seg.OnVideoFrame(VideoFrame{NAL: concatNAL(sps, pps, idr), Timestamp: 0, Keyframe: true})
	if sink.inits != 1 {
		t.Fatalf("expected 1 init emission, got %d", sink.inits)
	}
}

// TestBuildPartSegmentRejectsEmpty asserts the helper refuses to
// build a zero-sample fragment.
func TestBuildPartSegmentRejectsEmpty(t *testing.T) {
	if _, _, err := buildPartSegment(1, nil, nil, true); err == nil {
		t.Fatalf("expected error on empty samples")
	}
	if _, _, err := buildPartSegment(1, [][]byte{{0x01}}, []uint32{}, true); err == nil {
		t.Fatalf("expected error on durations/samples mismatch")
	}
}

// concatNAL builds an Annex-B buffer from raw NAL unit bytes (without
// start codes) by prefixing each with 0x00000001.
func concatNAL(units ...[]byte) []byte {
	var out []byte
	for _, u := range units {
		out = append(out, 0x00, 0x00, 0x00, 0x01)
		out = append(out, u...)
	}
	return out
}

var _ = errors.New
