package wallet_test

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Leeaandrob/aevia/services/coordinator/internal/wallet"
)

// Known test vector — derived from private key
// 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
const (
	testHexKey  = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	testAddress = "0xFCAd0B19bB29D4674531d6f115237E16AfCE377c"
)

func TestLoadFromHexDerivesExpectedAddress(t *testing.T) {
	w, err := wallet.LoadFromHex(testHexKey, big.NewInt(84532))
	if err != nil {
		t.Fatalf("LoadFromHex: %v", err)
	}
	if got := w.Address().Hex(); got != testAddress {
		t.Fatalf("address = %s, want %s", got, testAddress)
	}
	if cid := w.ChainID(); cid.Cmp(big.NewInt(84532)) != 0 {
		t.Fatalf("chainID = %s, want 84532", cid)
	}
}

func TestLoadFromHexAcceptsPrefix(t *testing.T) {
	w1, err := wallet.LoadFromHex(testHexKey, big.NewInt(1))
	if err != nil {
		t.Fatalf("no prefix: %v", err)
	}
	w2, err := wallet.LoadFromHex("0x"+testHexKey, big.NewInt(1))
	if err != nil {
		t.Fatalf("with prefix: %v", err)
	}
	if w1.Address() != w2.Address() {
		t.Fatalf("prefix affects address derivation: %s vs %s", w1.Address(), w2.Address())
	}
}

func TestLoadFromHexRejectsEmptyKey(t *testing.T) {
	if _, err := wallet.LoadFromHex("", big.NewInt(1)); err == nil {
		t.Fatal("LoadFromHex(\"\") returned nil error")
	}
}

func TestLoadFromHexRejectsInvalidChainID(t *testing.T) {
	for _, cid := range []*big.Int{nil, big.NewInt(0), big.NewInt(-1)} {
		if _, err := wallet.LoadFromHex(testHexKey, cid); err == nil {
			t.Errorf("chainID=%v accepted", cid)
		}
	}
}

func TestSignTxProducesValidSignedTx(t *testing.T) {
	w, err := wallet.LoadFromHex(testHexKey, big.NewInt(84532))
	if err != nil {
		t.Fatalf("LoadFromHex: %v", err)
	}

	to := common.HexToAddress("0x735C363a6df4651ABD8b1081F0b73fdAd98a4a93")
	tx, err := w.SignTx(wallet.TxParams{
		Nonce:    7,
		To:       to,
		Data:     []byte{0x48, 0xdb, 0x47, 0x1d},
		GasLimit: 250_000,
		MaxFee:   big.NewInt(2_000_000),
		Priority: big.NewInt(100_000),
	})
	if err != nil {
		t.Fatalf("SignTx: %v", err)
	}

	// Recover sender from the signature: must be the wallet's address.
	signer := types.LatestSignerForChainID(big.NewInt(84532))
	recovered, err := types.Sender(signer, tx)
	if err != nil {
		t.Fatalf("Sender: %v", err)
	}
	if recovered != w.Address() {
		t.Fatalf("recovered %s, want %s", recovered.Hex(), w.Address().Hex())
	}

	if tx.Type() != types.DynamicFeeTxType {
		t.Fatalf("tx type = %d, want DynamicFeeTx", tx.Type())
	}
	if tx.To() == nil || *tx.To() != to {
		t.Fatalf("tx.To = %v", tx.To())
	}
	if tx.Nonce() != 7 || tx.Gas() != 250_000 {
		t.Fatalf("tx fields wrong: nonce=%d gas=%d", tx.Nonce(), tx.Gas())
	}
}

func TestSignTxRejectsBadParams(t *testing.T) {
	w, err := wallet.LoadFromHex(testHexKey, big.NewInt(1))
	if err != nil {
		t.Fatalf("LoadFromHex: %v", err)
	}
	cases := []struct {
		name string
		p    wallet.TxParams
	}{
		{"zero gas limit", wallet.TxParams{Nonce: 1, GasLimit: 0, MaxFee: big.NewInt(1), Priority: big.NewInt(1)}},
		{"nil max fee", wallet.TxParams{Nonce: 1, GasLimit: 1, MaxFee: nil, Priority: big.NewInt(1)}},
		{"zero max fee", wallet.TxParams{Nonce: 1, GasLimit: 1, MaxFee: big.NewInt(0), Priority: big.NewInt(1)}},
		{"negative priority", wallet.TxParams{Nonce: 1, GasLimit: 1, MaxFee: big.NewInt(1), Priority: big.NewInt(-1)}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := w.SignTx(tc.p); err == nil {
				t.Fatal("SignTx accepted bad params")
			}
		})
	}
}

func TestSignTxIsDeterministicForSameInputs(t *testing.T) {
	w, err := wallet.LoadFromHex(testHexKey, big.NewInt(84532))
	if err != nil {
		t.Fatalf("LoadFromHex: %v", err)
	}
	p := wallet.TxParams{
		Nonce:    0,
		To:       common.HexToAddress("0xdead"),
		Data:     []byte("hello"),
		GasLimit: 100_000,
		MaxFee:   big.NewInt(1_000_000),
		Priority: big.NewInt(10_000),
	}
	a, _ := w.SignTx(p)
	b, _ := w.SignTx(p)
	if a.Hash() != b.Hash() {
		t.Fatalf("tx hash differs for same inputs: %s vs %s", a.Hash(), b.Hash())
	}
}
