package chain_test

import (
	"math/big"
	"testing"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/chain"
)

func TestEffectiveFeesHappyPath(t *testing.T) {
	base := big.NewInt(1_000_000_000) // 1 gwei
	tip := big.NewInt(100_000_000)    // 0.1 gwei
	maxFee, prio := chain.EffectiveFees(base, tip)

	want := big.NewInt(2_100_000_000) // 2*base + tip
	if maxFee.Cmp(want) != 0 {
		t.Fatalf("maxFee = %s, want %s", maxFee, want)
	}
	if prio.Cmp(tip) != 0 {
		t.Fatalf("priority = %s, want %s", prio, tip)
	}
}

func TestEffectiveFeesHandlesNils(t *testing.T) {
	maxFee, prio := chain.EffectiveFees(nil, nil)
	if maxFee.Sign() != 0 {
		t.Fatalf("nil inputs: maxFee = %s, want 0", maxFee)
	}
	if prio.Sign() != 0 {
		t.Fatalf("nil inputs: prio = %s, want 0", prio)
	}
}

func TestEffectiveFeesDoesNotMutateInputs(t *testing.T) {
	base := big.NewInt(123)
	tip := big.NewInt(45)
	_, _ = chain.EffectiveFees(base, tip)
	if base.Int64() != 123 {
		t.Fatalf("base mutated to %s", base)
	}
	if tip.Int64() != 45 {
		t.Fatalf("tip mutated to %s", tip)
	}
}

func TestDialRejectsEmptyURL(t *testing.T) {
	if _, err := chain.Dial(nil, ""); err == nil {
		t.Fatal("Dial(\"\") returned nil error")
	}
}
