package por_test

import (
	"bytes"
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/por"
)

// TestSubmitSettlementSelectorIsStable fixes the function selector at a
// known value. If the Solidity signature ever changes (e.g., adding a
// parameter), this test fails loudly so the Go and Solidity sides stay
// in lock-step.
func TestSubmitSettlementSelectorIsStable(t *testing.T) {
	got := por.SubmitSettlementSelector()
	// keccak256("submitSettlement(bytes32,address[],uint256[],uint256)")[:4]
	// Computed once and pinned here.
	want := [4]byte{0x48, 0xdb, 0x47, 0x1d}

	if got != want {
		t.Fatalf("selector drifted: got=%x want=%x\n"+
			"If the Solidity signature changed, update both this test and the contract.",
			got, want)
	}
}

func TestEncodeSubmitSettlementSingleProvider(t *testing.T) {
	var merkleRoot [32]byte
	copy(merkleRoot[:], bytes.Repeat([]byte{0xAA}, 32))

	var addrA [20]byte
	copy(addrA[:], bytes.Repeat([]byte{0x11}, 20))

	providers := [][20]byte{addrA}
	bytesServed := []uint64{1000}
	totalRewards := big.NewInt(1_000_000) // 1 cUSDC at 6 decimals

	data, err := por.EncodeSubmitSettlement(merkleRoot, providers, bytesServed, totalRewards)
	if err != nil {
		t.Fatalf("EncodeSubmitSettlement: %v", err)
	}

	// Calldata shape:
	//   4 bytes selector
	//   32 bytes merkleRoot
	//   32 bytes offsetProviders = 0x80 (4 header words × 32)
	//   32 bytes offsetBytes     = 0xc0 (header + providers tail = 4+2)
	//   32 bytes totalRewards
	//   32 bytes providers len (=1)
	//   32 bytes providers[0] (left-padded addrA)
	//   32 bytes bytesServed len (=1)
	//   32 bytes bytesServed[0] (=1000)
	// Total: 4 + 8×32 = 260 bytes.
	if len(data) != 260 {
		t.Fatalf("calldata len = %d, want 260", len(data))
	}

	// Selector in first 4 bytes.
	if data[0] != 0x48 || data[1] != 0xdb || data[2] != 0x47 || data[3] != 0x1d {
		t.Fatalf("selector prefix mismatch: %x", data[:4])
	}

	// offsetProviders = 0x80.
	if offset := bigWordAt(t, data, 4+32); offset.Uint64() != 0x80 {
		t.Fatalf("offsetProviders = 0x%x, want 0x80", offset)
	}
	// offsetBytes = 0xc0 (0x80 + 32 + 32).
	if offset := bigWordAt(t, data, 4+32+32); offset.Uint64() != 0xc0 {
		t.Fatalf("offsetBytes = 0x%x, want 0xc0", offset)
	}
	// totalRewards at head[3].
	if rewards := bigWordAt(t, data, 4+32+32+32); rewards.Cmp(big.NewInt(1_000_000)) != 0 {
		t.Fatalf("totalRewards = %s, want 1000000", rewards)
	}
	// providers length.
	if l := bigWordAt(t, data, 4+4*32); l.Uint64() != 1 {
		t.Fatalf("providers len = %s, want 1", l)
	}
	// bytesServed[0] = 1000.
	if b := bigWordAt(t, data, 4+4*32+32+32+32); b.Uint64() != 1000 {
		t.Fatalf("bytesServed[0] = %s, want 1000", b)
	}
}

func TestEncodeSubmitSettlementRejectsLengthMismatch(t *testing.T) {
	var root [32]byte
	_, err := por.EncodeSubmitSettlement(root, [][20]byte{{}, {}}, []uint64{1}, big.NewInt(1))
	if err == nil {
		t.Fatal("encoder accepted mismatched lengths")
	}
}

func TestEncodeSubmitSettlementRejectsNegativeRewards(t *testing.T) {
	var root [32]byte
	_, err := por.EncodeSubmitSettlement(root, [][20]byte{{}}, []uint64{1}, big.NewInt(-1))
	if err == nil {
		t.Fatal("encoder accepted negative totalRewards")
	}
}

func TestEncodeSubmitSettlementRejectsNilRewards(t *testing.T) {
	var root [32]byte
	_, err := por.EncodeSubmitSettlement(root, [][20]byte{{}}, []uint64{1}, nil)
	if err == nil {
		t.Fatal("encoder accepted nil totalRewards")
	}
}

// bigWordAt reads a 32-byte word starting at offset as a big-endian
// big.Int. Helper for readable assertions against calldata.
func bigWordAt(t *testing.T, data []byte, offset int) *big.Int {
	t.Helper()
	if offset+32 > len(data) {
		t.Fatalf("offset %d out of range (len=%d)", offset, len(data))
	}
	v := new(big.Int).SetBytes(data[offset : offset+32])
	return v
}

// TestEncodeSubmitSettlementMultiProviderLayoutStable prints a deterministic
// hex snapshot — if the layout ever changes, this test fails with a diff
// operators can compare against forge calldata.
func TestEncodeSubmitSettlementMultiProviderLayoutStable(t *testing.T) {
	var root [32]byte
	copy(root[:], bytes.Repeat([]byte{0x01}, 32))

	a := [20]byte{0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01}
	b := [20]byte{0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02}

	data, err := por.EncodeSubmitSettlement(root, [][20]byte{a, b}, []uint64{500, 300}, big.NewInt(800))
	if err != nil {
		t.Fatalf("EncodeSubmitSettlement: %v", err)
	}
	// Snapshot: 4 (selector) + 10 words = 4 + 320 = 324 bytes total for
	// 2 providers (4 head + 1 length + 2 providers + 1 length + 2 bytes).
	if len(data) != 4+32*10 {
		t.Fatalf("len = %d, want %d", len(data), 4+32*10)
	}
	// Spot-check providers[0]: left-padded a.
	pad := make([]byte, 12)
	wantA := append(pad, a[:]...)
	off := 4 + 4*32 + 32
	if !bytes.Equal(data[off:off+32], wantA) {
		t.Fatalf("providers[0] layout:\n got=%s\nwant=%s", hex.EncodeToString(data[off:off+32]), hex.EncodeToString(wantA))
	}
}
