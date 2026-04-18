package integration_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	webrtc "github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

// TestWhipSignatureVerify covers the three outcomes of the EIP-191
// signature gate added in whip.handleIngest:
//
//  1. signed offer, DID matches the recovered signer → 201
//  2. unsigned offer, server not requiring signatures → 201 (back-compat)
//  3. signed offer, DID claims a different address than the signer → 401
//
// Runs against a fully wired httptest server with pion negotiating a
// real SDP exchange, so the test catches regressions in the end-to-end
// handler path, not just the RecoverEIP191 unit layer.
func TestWhipSignatureVerify(t *testing.T) {
	t.Run("signed offer with matching DID is accepted", func(t *testing.T) {
		key, _ := ethcrypto.GenerateKey()
		did := didFromKey(key)
		srv := newSigServer(t, whip.Options{RequireSignatures: true})
		defer srv.Close()

		offerSDP := newCreatorOffer(t)
		sig := signOfferEIP191(t, key, offerSDP)
		code, _ := postWHIP(t, srv.URL, offerSDP, did, sig)
		if code != http.StatusCreated {
			t.Fatalf("want 201, got %d", code)
		}
	})

	t.Run("unsigned offer with signatures optional is accepted", func(t *testing.T) {
		srv := newSigServer(t, whip.Options{}) // RequireSignatures: false
		defer srv.Close()

		offerSDP := newCreatorOffer(t)
		code, _ := postWHIP(t, srv.URL, offerSDP, "", "") // no headers
		if code != http.StatusCreated {
			t.Fatalf("want 201 (back-compat), got %d", code)
		}
	})

	t.Run("signed offer with DID mismatch is rejected 401", func(t *testing.T) {
		keySigner, _ := ethcrypto.GenerateKey()
		keyClaimed, _ := ethcrypto.GenerateKey()
		didClaimed := didFromKey(keyClaimed) // claim address B
		srv := newSigServer(t, whip.Options{RequireSignatures: true})
		defer srv.Close()

		offerSDP := newCreatorOffer(t)
		sig := signOfferEIP191(t, keySigner, offerSDP) // sign with A
		code, body := postWHIP(t, srv.URL, offerSDP, didClaimed, sig)
		if code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d — body=%s", code, body)
		}
	})

	t.Run("signatures-required but header missing is rejected 401", func(t *testing.T) {
		key, _ := ethcrypto.GenerateKey()
		did := didFromKey(key)
		srv := newSigServer(t, whip.Options{RequireSignatures: true})
		defer srv.Close()

		offerSDP := newCreatorOffer(t)
		code, _ := postWHIP(t, srv.URL, offerSDP, did, "")
		if code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", code)
		}
	})
}

// --- helpers ---------------------------------------------------------

func newSigServer(t *testing.T, opts whip.Options) *httptest.Server {
	t.Helper()
	whipSrv, err := whip.NewServer(opts)
	if err != nil {
		t.Fatalf("whip.NewServer: %v", err)
	}
	mux := http.NewServeMux()
	whipSrv.Register(mux)
	return httptest.NewServer(mux)
}

func didFromKey(key *ecdsa.PrivateKey) string {
	pub := key.Public().(*ecdsa.PublicKey)
	addr := ethcrypto.PubkeyToAddress(*pub)
	return "did:pkh:eip155:84532:0x" + hex.EncodeToString(addr.Bytes())
}

// signOfferEIP191 signs the raw bytes of sdp as a wallet would
// (EIP-191 prefix + length + message, keccak256, secp256k1). Returns
// 0x-prefixed 65-byte hex string with v ∈ {27,28} — the format our
// ParseHexSignature helper expects.
func signOfferEIP191(t *testing.T, key *ecdsa.PrivateKey, sdp string) string {
	t.Helper()
	prefixed := []byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(sdp), sdp))
	hash := ethcrypto.Keccak256(prefixed)
	sig, err := ethcrypto.Sign(hash, key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if sig[64] < 27 {
		sig[64] += 27
	}
	return "0x" + hex.EncodeToString(sig)
}

func newCreatorOffer(t *testing.T) string {
	t.Helper()
	me := &webrtc.MediaEngine{}
	if err := me.RegisterDefaultCodecs(); err != nil {
		t.Fatalf("codecs: %v", err)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me))
	pc, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("pc: %v", err)
	}
	t.Cleanup(func() { _ = pc.Close() })

	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000},
		"video", "aevia-sig-test",
	)
	if err != nil {
		t.Fatalf("track: %v", err)
	}
	if _, err := pc.AddTrack(track); err != nil {
		t.Fatalf("add track: %v", err)
	}
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("offer: %v", err)
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatalf("set local: %v", err)
	}
	<-gather
	return pc.LocalDescription().SDP
}

func postWHIP(t *testing.T, baseURL, sdp, did, sigHex string) (int, string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/whip", bytes.NewReader([]byte(sdp)))
	req.Header.Set("Content-Type", "application/sdp")
	if did != "" {
		req.Header.Set("X-Aevia-DID", did)
	}
	if sigHex != "" {
		req.Header.Set("X-Aevia-Signature", sigHex)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /whip: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body)
}
