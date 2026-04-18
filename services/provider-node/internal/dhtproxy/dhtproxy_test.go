package dhtproxy_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	libp2pcrypto "github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/dhtproxy"
)

type fakeResolver struct {
	providers []peer.ID
	addrs     map[peer.ID][]string
}

func (f *fakeResolver) FindProviders(_ context.Context, _ string, _ int) ([]peer.ID, error) {
	return f.providers, nil
}

func (f *fakeResolver) PeerAddrs(pid peer.ID) []string { return f.addrs[pid] }

func fakePeerID(t *testing.T) peer.ID {
	t.Helper()
	priv, _, _ := libp2pcrypto.GenerateEd25519Key(bytesReader(t, 32))
	pid, _ := peer.IDFromPublicKey(priv.GetPublic())
	return pid
}

// bytesReader lets us get a deterministic RNG when one is needed.
func bytesReader(t *testing.T, n int) *bytesReaderT {
	t.Helper()
	buf := make([]byte, n)
	for i := range buf {
		buf[i] = byte(i + 1)
	}
	return &bytesReaderT{buf: buf}
}

type bytesReaderT struct{ buf []byte }

func (r *bytesReaderT) Read(p []byte) (int, error) {
	n := copy(p, r.buf)
	return n, nil
}

func TestDHTProxyResolveHappyPath(t *testing.T) {
	pidA := fakePeerID(t)
	resolver := &fakeResolver{
		providers: []peer.ID{pidA},
		addrs: map[peer.ID][]string{
			pidA: {"/ip4/1.2.3.4/tcp/4001/p2p/" + pidA.String()},
		},
	}
	srv, err := dhtproxy.New(resolver)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	mux := http.NewServeMux()
	srv.Register(mux)

	body, _ := json.Marshal(map[string]any{"cid": "bafkreitest"})
	req := httptest.NewRequest(http.MethodPost, "/dht/resolve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		CID       string `json:"cid"`
		Providers []struct {
			PeerID     string   `json:"peer_id"`
			Multiaddrs []string `json:"multiaddrs"`
		} `json:"providers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.CID != "bafkreitest" {
		t.Fatalf("cid = %s", resp.CID)
	}
	if len(resp.Providers) != 1 {
		t.Fatalf("providers = %d, want 1", len(resp.Providers))
	}
	if resp.Providers[0].PeerID != pidA.String() {
		t.Fatalf("peer_id = %s", resp.Providers[0].PeerID)
	}
	if len(resp.Providers[0].Multiaddrs) != 1 {
		t.Fatalf("multiaddrs count = %d", len(resp.Providers[0].Multiaddrs))
	}
}

func TestDHTProxyRejectsNonJSON(t *testing.T) {
	srv, _ := dhtproxy.New(&fakeResolver{})
	mux := http.NewServeMux()
	srv.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/dht/resolve", bytes.NewReader([]byte("cid=foo")))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
}

func TestDHTProxyRejectsEmptyCID(t *testing.T) {
	srv, _ := dhtproxy.New(&fakeResolver{})
	mux := http.NewServeMux()
	srv.Register(mux)

	body, _ := json.Marshal(map[string]any{"cid": ""})
	req := httptest.NewRequest(http.MethodPost, "/dht/resolve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDHTProxyRejectsNilResolver(t *testing.T) {
	if _, err := dhtproxy.New(nil); err == nil {
		t.Fatal("New(nil) returned nil error")
	}
}
