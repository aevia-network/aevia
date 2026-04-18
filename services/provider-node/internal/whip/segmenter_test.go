package whip

import (
	"bytes"
	"testing"

	"github.com/Eyevinn/mp4ff/mp4"
)

// captureSink records every init + media segment produced by a
// CMAFSegmenter under test.
type captureSink struct {
	init     []byte
	segments [][]byte
	indices  []uint32
	durs     []uint32
}

func (c *captureSink) OnInitSegment(b []byte) error {
	c.init = append(c.init[:0], b...)
	return nil
}

func (c *captureSink) OnMediaSegment(idx uint32, b []byte, d uint32) error {
	c.segments = append(c.segments, append([]byte(nil), b...))
	c.indices = append(c.indices, idx)
	c.durs = append(c.durs, d)
	return nil
}

// Minimal H.264 SPS (720p) handcrafted to decode with mp4ff.avc.ParseSPSNALUnit.
// Built once via an offline SPS generator and pinned here; any change
// to the dimensions requires regenerating this byte string.
var minimalSPS = []byte{
	0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40,
	0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92,
}

// Minimal PPS — pion emits these from real encoders; we hand-craft
// something structurally valid.
var minimalPPS = []byte{0x68, 0xCE, 0x38, 0x80}

func spsPpsIDR() []byte {
	// Annex-B: SPS + start + PPS + start + IDR
	out := make([]byte, 0, len(minimalSPS)+len(minimalPPS)+16)
	out = append(out, minimalSPS...)
	out = append(out, 0x00, 0x00, 0x00, 0x01)
	out = append(out, minimalPPS...)
	out = append(out, 0x00, 0x00, 0x00, 0x01)
	// IDR body (NAL type 5) — payload bytes are placeholder; fMP4
	// doesn't care about decoder semantics, only byte layout.
	out = append(out, 0x65, 0x88, 0x82, 0x00, 0x00)
	return out
}

// plainPFrame synthesises a non-keyframe NAL (type 1). It does not
// include SPS/PPS.
func plainPFrame() []byte {
	return []byte{0x41, 0x9A, 0x00, 0x00, 0x00}
}

func TestSegmenterEmitsInitOnFirstKeyframe(t *testing.T) {
	sink := &captureSink{}
	seg, err := NewCMAFSegmenter(sink)
	if err != nil {
		t.Fatalf("NewCMAFSegmenter: %v", err)
	}

	seg.OnVideoFrame(VideoFrame{NAL: spsPpsIDR(), Timestamp: 0, Keyframe: true})

	if len(sink.init) == 0 {
		t.Fatal("init segment not emitted after first keyframe")
	}
	// Decode init segment round-trip to confirm it's well-formed fMP4.
	parsed, err := mp4.DecodeFile(bytes.NewReader(sink.init))
	if err != nil {
		t.Fatalf("re-parse init segment: %v", err)
	}
	if parsed.Init == nil {
		t.Fatal("parsed file has no Init")
	}
	if parsed.Init.Moov == nil || len(parsed.Init.Moov.Traks) != 1 {
		t.Fatalf("Moov/Traks shape unexpected: %+v", parsed.Init)
	}
}

func TestSegmenterClosesSegmentOnKeyframeAfterTargetDuration(t *testing.T) {
	sink := &captureSink{}
	seg, err := NewCMAFSegmenter(sink)
	if err != nil {
		t.Fatalf("NewCMAFSegmenter: %v", err)
	}

	// Initial keyframe (t=0)
	seg.OnVideoFrame(VideoFrame{NAL: spsPpsIDR(), Timestamp: 0, Keyframe: true})
	// A few P-frames within the 6s window.
	for i := uint32(1); i <= 5; i++ {
		seg.OnVideoFrame(VideoFrame{NAL: plainPFrame(), Timestamp: i * (VideoTimescale / 2)})
	}

	// Second keyframe AFTER 6s of elapsed ticks triggers flush of the
	// first segment.
	secondKeyTS := uint32(6 * VideoTimescale)
	seg.OnVideoFrame(VideoFrame{NAL: spsPpsIDR(), Timestamp: secondKeyTS, Keyframe: true})

	if got := seg.TotalSegments(); got != 1 {
		t.Fatalf("segments after second keyframe = %d, want 1", got)
	}
	if len(sink.segments) != 1 {
		t.Fatalf("sink got %d segments, want 1", len(sink.segments))
	}

	// Close should flush the pending second segment.
	if err := seg.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if got := seg.TotalSegments(); got != 2 {
		t.Fatalf("after close segments = %d, want 2", got)
	}
}

func TestSegmenterDiscardsSegmentsWithoutKeyframe(t *testing.T) {
	sink := &captureSink{}
	seg, _ := NewCMAFSegmenter(sink)

	// Feed SPS/PPS/IDR first so init emits.
	seg.OnVideoFrame(VideoFrame{NAL: spsPpsIDR(), Timestamp: 0, Keyframe: true})

	// Then artificially force a flush with only P-frames — should be
	// discarded as non-seekable.
	seg.mu.Lock()
	seg.segmentHasKey = false
	seg.segmentSampleBufs = [][]byte{encodeAVCCSample(plainPFrame())}
	seg.segmentDurations = []uint32{3000}
	err := seg.flushLocked()
	seg.mu.Unlock()

	if err != nil {
		t.Fatalf("flushLocked: %v", err)
	}
	if seg.TotalSegments() != 0 {
		t.Fatalf("keyless flush produced segments: %d", seg.TotalSegments())
	}
}

func TestSegmenterRejectsNilSink(t *testing.T) {
	if _, err := NewCMAFSegmenter(nil); err == nil {
		t.Fatal("NewCMAFSegmenter(nil) returned nil error")
	}
}

func TestEncodeAVCCSampleLengthPrefixes(t *testing.T) {
	// Two NALs separated by start code → AVCC with two 4-byte length
	// prefixes.
	in := []byte{0x65, 0xAA, 0x00, 0x00, 0x00, 0x01, 0x41, 0xBB}
	out := encodeAVCCSample(in)
	// Expect: [0 0 0 2 65 AA] [0 0 0 2 41 BB]
	want := []byte{0, 0, 0, 2, 0x65, 0xAA, 0, 0, 0, 2, 0x41, 0xBB}
	if !bytes.Equal(out, want) {
		t.Fatalf("AVCC encode = %x, want %x", out, want)
	}
}

func TestSplitNALUnits(t *testing.T) {
	in := []byte{0xAA, 0xBB, 0x00, 0x00, 0x00, 0x01, 0xCC, 0xDD, 0x00, 0x00, 0x00, 0x01, 0xEE}
	got := splitNALUnits(in)
	if len(got) != 3 {
		t.Fatalf("got %d NAL units, want 3: %x", len(got), got)
	}
}
