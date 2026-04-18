package pinning_test

import (
	"errors"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
)

func TestUsageStartsAtZero(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t))
	count, bytesUsed, err := cs.Usage()
	if err != nil {
		t.Fatalf("Usage: %v", err)
	}
	if count != 0 || bytesUsed != 0 {
		t.Fatalf("fresh store Usage = (%d, %d), want (0, 0)", count, bytesUsed)
	}
}

func TestUsageIncrementsOnPin(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t))
	payloads := [][]byte{[]byte("one"), []byte("two")}

	_, err := cs.PinPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("PinPayloads: %v", err)
	}

	count, bytesUsed, err := cs.Usage()
	if err != nil {
		t.Fatalf("Usage: %v", err)
	}
	if count != 1 {
		t.Fatalf("count = %d, want 1", count)
	}
	if bytesUsed == 0 {
		t.Fatal("bytesUsed = 0; want > 0 after pin")
	}
}

func TestUsageDecrementsOnUnpin(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t))

	m, err := cs.PinPayloads([][]byte{[]byte("a"), []byte("b")}, 6)
	if err != nil {
		t.Fatalf("PinPayloads: %v", err)
	}

	if err := cs.Unpin(m.CID); err != nil {
		t.Fatalf("Unpin: %v", err)
	}

	count, bytesUsed, err := cs.Usage()
	if err != nil {
		t.Fatalf("Usage: %v", err)
	}
	if count != 0 || bytesUsed != 0 {
		t.Fatalf("after unpin Usage = (%d, %d), want (0, 0)", count, bytesUsed)
	}
}

func TestQuotaRejectsExcessivePinCount(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t)).WithQuota(pinning.Quota{MaxPins: 1})

	if _, err := cs.PinPayloads([][]byte{[]byte("first")}, 6); err != nil {
		t.Fatalf("first pin: %v", err)
	}

	_, err := cs.PinPayloads([][]byte{[]byte("second")}, 6)
	if err == nil {
		t.Fatal("second pin accepted despite MaxPins=1")
	}
	var qe pinning.ErrQuotaExceeded
	if !errors.As(err, &qe) {
		t.Fatalf("err type = %T, want ErrQuotaExceeded", err)
	}
	if qe.Resource != "pins" {
		t.Fatalf("Resource = %q, want pins", qe.Resource)
	}
}

func TestQuotaRejectsExcessiveBytes(t *testing.T) {
	// MaxBytes small enough that even one pin's manifest JSON exceeds it.
	cs := pinning.NewContentStore(newMemStore(t)).WithQuota(pinning.Quota{MaxBytes: 10})

	_, err := cs.PinPayloads([][]byte{[]byte("this payload is well over ten bytes")}, 6)
	if err == nil {
		t.Fatal("pin accepted despite MaxBytes=10")
	}
	var qe pinning.ErrQuotaExceeded
	if !errors.As(err, &qe) {
		t.Fatalf("err type = %T, want ErrQuotaExceeded", err)
	}
	if qe.Resource != "bytes" {
		t.Fatalf("Resource = %q, want bytes", qe.Resource)
	}
}

func TestQuotaZeroMeansUnlimited(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t)).WithQuota(pinning.Quota{})
	for i := 0; i < 5; i++ {
		if _, err := cs.PinPayloads([][]byte{[]byte{byte(i)}}, 6); err != nil {
			t.Fatalf("pin %d: %v", i, err)
		}
	}
}

func TestRepinningSameCIDDoesNotInflateCount(t *testing.T) {
	cs := pinning.NewContentStore(newMemStore(t))
	payloads := [][]byte{[]byte("stable")}

	m, err := cs.PinPayloads(payloads, 6)
	if err != nil {
		t.Fatalf("pin 1: %v", err)
	}
	if _, err := cs.PinPayloads(payloads, 6); err != nil {
		t.Fatalf("pin 2 (same content): %v", err)
	}

	count, _, _ := cs.Usage()
	if count != 1 {
		t.Fatalf("re-pinning same CID bumped count to %d, want 1 (cid=%s)", count, m.CID)
	}
}
