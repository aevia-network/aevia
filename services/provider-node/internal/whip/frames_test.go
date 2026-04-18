package whip

import (
	"testing"
)

// TestIsKeyframeDetectsIDR asserts NAL type 5 (IDR) is recognised whether
// it is the sole NAL or part of a SPS+PPS+IDR bundle.
func TestIsKeyframeDetectsIDR(t *testing.T) {
	cases := []struct {
		name string
		nal  []byte
		want bool
	}{
		{"lone IDR", []byte{0x65, 0x88, 0x82, 0x00}, true}, // nal_unit_type = 5
		{"lone P-frame", []byte{0x41, 0x9a, 0x00}, false},  // nal_unit_type = 1
		{"SPS only", []byte{0x67, 0x42, 0x00, 0x1e}, false},
		{"PPS only", []byte{0x68, 0xce, 0x38, 0x80}, false},
		{"empty", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isKeyframe(tc.nal); got != tc.want {
				t.Fatalf("isKeyframe = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsKeyframeFindsIDRInBundle(t *testing.T) {
	// SPS + start code + PPS + start code + IDR — common at track start.
	buf := []byte{
		0x67, 0x42, 0x00, 0x1e, // SPS (NAL type 7)
		0x00, 0x00, 0x00, 0x01,
		0x68, 0xce, 0x38, 0x80, // PPS (NAL type 8)
		0x00, 0x00, 0x00, 0x01,
		0x65, 0x88, 0x82, 0x00, // IDR (NAL type 5)
	}
	if !isKeyframe(buf) {
		t.Fatal("bundled SPS+PPS+IDR not detected as keyframe")
	}
}

func TestFindStartCode(t *testing.T) {
	buf := []byte{0xAA, 0xBB, 0x00, 0x00, 0x00, 0x01, 0xCC, 0xDD}
	if got := findStartCode(buf); got != 2 {
		t.Fatalf("findStartCode = %d, want 2", got)
	}
	if got := findStartCode([]byte{0xAA, 0xBB}); got != -1 {
		t.Fatalf("findStartCode = %d, want -1", got)
	}
}

func TestBuildSyntheticRTPPopulatesFields(t *testing.T) {
	pkt := buildSyntheticRTP(42, 90_000, true, []byte{0x65, 0x88})
	if pkt.SequenceNumber != 42 {
		t.Fatalf("seq = %d, want 42", pkt.SequenceNumber)
	}
	if pkt.Timestamp != 90_000 {
		t.Fatalf("ts = %d", pkt.Timestamp)
	}
	if !pkt.Marker {
		t.Fatal("marker not set")
	}
	if pkt.PayloadType != 96 {
		t.Fatalf("payload type = %d, want 96", pkt.PayloadType)
	}
	if string(pkt.Payload) != string([]byte{0x65, 0x88}) {
		t.Fatalf("payload mismatch")
	}
}
