package mirror

import (
	"testing"
)

// TestH264SeqAwareDepacketizerSingleNALPassthrough verifies that
// single-NAL payloads (types 1..23) skip the gap-detection branch and
// are emitted verbatim by pion.
func TestH264SeqAwareDepacketizerSingleNALPassthrough(t *testing.T) {
	d := newH264SeqAwareDepacketizer()
	// NAL type 5 = IDR (a single-NAL packet, not FU-A). Pion emits it
	// with an Annex-B start-code prefix so length > 1.
	payload := []byte{0x65, 0xDE, 0xAD, 0xBE, 0xEF}
	nal, ok, dropped := d.Depacketize(100, payload)
	if !ok {
		t.Fatalf("ok=false for single-NAL payload")
	}
	if dropped {
		t.Fatalf("single-NAL payload flagged as dropped")
	}
	if len(nal) == 0 {
		t.Fatalf("empty NAL emitted for single-NAL payload")
	}
	if d.DropCount() != 0 {
		t.Fatalf("DropCount=%d after clean single-NAL, want 0", d.DropCount())
	}
}

// TestH264SeqAwareDepacketizerCompleteFUASequence builds a 3-fragment
// FU-A (start+middle+end) with contiguous sequence numbers and asserts
// pion emits the complete NAL on the END fragment. No drops.
func TestH264SeqAwareDepacketizerCompleteFUASequence(t *testing.T) {
	d := newH264SeqAwareDepacketizer()

	// FU-A bytes:
	//   indicator byte (type=28)   — F|NRI bits preserved, low 5 bits = 28
	//   header byte                — S(1)|E(1)|R(1)|NAL-type(5)
	fuaStart := []byte{0x7C, 0x85, 0xAA, 0xBB} // S=1, E=0, NAL=5 (IDR)
	fuaMid := []byte{0x7C, 0x05, 0xCC, 0xDD}   // S=0, E=0
	fuaEnd := []byte{0x7C, 0x45, 0xEE, 0xFF}   // S=0, E=1

	if _, ok, dropped := d.Depacketize(50, fuaStart); !ok || dropped {
		t.Fatalf("start frag ok=%v dropped=%v", ok, dropped)
	}
	if _, ok, dropped := d.Depacketize(51, fuaMid); !ok || dropped {
		t.Fatalf("mid frag ok=%v dropped=%v", ok, dropped)
	}
	nal, ok, dropped := d.Depacketize(52, fuaEnd)
	if !ok || dropped {
		t.Fatalf("end frag ok=%v dropped=%v", ok, dropped)
	}
	if len(nal) == 0 {
		t.Fatalf("end frag emitted empty NAL — pion should have returned the reassembled access unit")
	}
	if d.DropCount() != 0 {
		t.Fatalf("DropCount=%d after clean FU-A, want 0", d.DropCount())
	}
}

// TestH264SeqAwareDepacketizerDropsOnMidFUAGap is the regression: when
// a FU-A middle fragment arrives with a sequence gap the depacketizer
// MUST reset its internal buffer and drop the fragment. Without this
// the reassembled NAL contains garbage and the downstream FrameSink
// feeds a corrupt access unit into the HLS muxer.
func TestH264SeqAwareDepacketizerDropsOnMidFUAGap(t *testing.T) {
	d := newH264SeqAwareDepacketizer()

	fuaStart := []byte{0x7C, 0x85, 0x01, 0x02}
	fuaMid := []byte{0x7C, 0x05, 0x03, 0x04}
	fuaEnd := []byte{0x7C, 0x45, 0x05, 0x06}

	// Feed start at seq=200.
	if _, ok, dropped := d.Depacketize(200, fuaStart); !ok || dropped {
		t.Fatalf("start frag setup failed: ok=%v dropped=%v", ok, dropped)
	}
	// Simulate a LOST middle fragment: skip to seq=202 directly with
	// another middle FU-A byte pattern.
	nal, ok, dropped := d.Depacketize(202, fuaMid)
	if !ok {
		t.Fatalf("mid frag after gap: ok=false (want true with dropped=true)")
	}
	if !dropped {
		t.Fatalf("mid frag after gap: dropped=false (should have been flagged as gap)")
	}
	if nal != nil {
		t.Fatalf("mid frag after gap: NAL should be nil, got %d bytes", len(nal))
	}
	if d.DropCount() != 1 {
		t.Fatalf("DropCount=%d after one gap, want 1", d.DropCount())
	}

	// After the reset the END fragment should also be dropped or
	// harmless: with a fresh depacketizer, an FU-A END without a
	// start is a no-op — pion swallows it quietly. The critical
	// invariant is that NO corrupt NAL reaches the sink.
	_, _, _ = d.Depacketize(203, fuaEnd)
	// DropCount must not have grown on this END (not a middle-gap path).
	if d.DropCount() != 1 {
		t.Fatalf("DropCount=%d after END post-reset, want still 1", d.DropCount())
	}

	// Recover with a fresh FU-A start → middle → end at contiguous seq,
	// verify the next complete NAL flows through without a drop.
	if _, ok, dropped := d.Depacketize(300, fuaStart); !ok || dropped {
		t.Fatalf("recovery start failed: ok=%v dropped=%v", ok, dropped)
	}
	if _, ok, dropped := d.Depacketize(301, fuaMid); !ok || dropped {
		t.Fatalf("recovery mid failed: ok=%v dropped=%v", ok, dropped)
	}
	recovered, ok, dropped := d.Depacketize(302, fuaEnd)
	if !ok || dropped {
		t.Fatalf("recovery end failed: ok=%v dropped=%v", ok, dropped)
	}
	if len(recovered) == 0 {
		t.Fatalf("recovery emitted empty NAL")
	}
	if d.DropCount() != 1 {
		t.Fatalf("DropCount=%d after recovery, want 1 (unchanged)", d.DropCount())
	}
}

// TestH264SeqAwareDepacketizerSequenceWraparound verifies the modulo
// arithmetic: seq=65535 followed by seq=0 is NOT a gap (wraparound).
func TestH264SeqAwareDepacketizerSequenceWraparound(t *testing.T) {
	d := newH264SeqAwareDepacketizer()
	fuaStart := []byte{0x7C, 0x85, 0xAA}
	fuaMid := []byte{0x7C, 0x05, 0xBB}

	// Seed lastSeq at 65535 via a non-FU-A single NAL so the first
	// FU-A arrives with the expected wrap.
	if _, ok, _ := d.Depacketize(65535, []byte{0x65, 0xFF}); !ok {
		t.Fatalf("seed packet failed")
	}
	// FU-A start at seq=0 — this isn't a middle, so the gap check is
	// skipped regardless of wraparound, but we include it for realism.
	if _, ok, dropped := d.Depacketize(0, fuaStart); !ok || dropped {
		t.Fatalf("start after wrap: ok=%v dropped=%v", ok, dropped)
	}
	// Mid at seq=1 should NOT trigger the gap path (1 == 0+1 mod 65536).
	if _, ok, dropped := d.Depacketize(1, fuaMid); !ok || dropped {
		t.Fatalf("mid after wrap: ok=%v dropped=%v (wraparound miscomputed as gap)", ok, dropped)
	}
	if d.DropCount() != 0 {
		t.Fatalf("DropCount=%d after wraparound, want 0", d.DropCount())
	}
}

// TestIsFUA classifies each NAL type correctly.
func TestIsFUA(t *testing.T) {
	cases := []struct {
		name    string
		payload []byte
		want    bool
	}{
		{"empty", nil, false},
		{"single byte NAL=5", []byte{0x65}, false},
		{"FU-A indicator", []byte{0x7C, 0x85}, true},
		{"STAP-A", []byte{0x78}, false}, // type 24
		{"NAL type 6", []byte{0x06}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isFUA(tc.payload); got != tc.want {
				t.Fatalf("isFUA(%v) = %v, want %v", tc.payload, got, tc.want)
			}
		})
	}
}
