package httpx_test

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	p2phttp "github.com/libp2p/go-libp2p-http"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestDualListenerHealthzAgreesOnBothTransports proves that a single
// http.ServeMux serves byte-identical /healthz responses over both a plain
// TCP listener and a libp2p stream listener simultaneously. This is the
// core dual-transport primitive that makes Provider Público and Provider
// NAT share the same handler surface — the foundation of the Kill Test.
func TestDualListenerHealthzAgreesOnBothTransports(t *testing.T) {
	serverHost := newHost(t)
	clientHost := newHost(t)
	connect(t, clientHost, serverHost)

	srv := httpx.NewServer(serverHost)
	t.Cleanup(func() { _ = srv.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	// Plain TCP listener.
	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	tcpAddr := tcpListener.Addr().String()

	tcpDone := make(chan error, 1)
	go func() { tcpDone <- srv.ServeHTTPOn(ctx, tcpListener) }()

	// libp2p stream listener.
	libp2pDone := make(chan error, 1)
	go func() { libp2pDone <- srv.ServeLibp2p(ctx) }()

	// Let both listeners register.
	time.Sleep(100 * time.Millisecond)

	// Fetch via plain TCP.
	tcpClient := &http.Client{Timeout: 5 * time.Second}
	tcpResp, err := tcpClient.Get("http://" + tcpAddr + "/healthz")
	if err != nil {
		t.Fatalf("TCP GET /healthz: %v", err)
	}
	defer tcpResp.Body.Close()
	tcpBody, err := io.ReadAll(tcpResp.Body)
	if err != nil {
		t.Fatalf("read TCP body: %v", err)
	}

	// Fetch via libp2p stream.
	libp2pTransport := p2phttp.NewTransport(clientHost, p2phttp.ProtocolOption(httpx.DefaultProtocol))
	libp2pClient := &http.Client{Transport: libp2pTransport, Timeout: 5 * time.Second}
	libp2pResp, err := libp2pClient.Get("libp2p://" + serverHost.ID().String() + "/healthz")
	if err != nil {
		t.Fatalf("libp2p GET /healthz: %v", err)
	}
	defer libp2pResp.Body.Close()
	libp2pBody, err := io.ReadAll(libp2pResp.Body)
	if err != nil {
		t.Fatalf("read libp2p body: %v", err)
	}

	// Status codes match.
	if tcpResp.StatusCode != http.StatusOK {
		t.Fatalf("TCP status = %d, want 200", tcpResp.StatusCode)
	}
	if libp2pResp.StatusCode != http.StatusOK {
		t.Fatalf("libp2p status = %d, want 200", libp2pResp.StatusCode)
	}

	// Bodies decode to the same structure with the same peer_id.
	var tcpPayload, libp2pPayload struct {
		Status string `json:"status"`
		PeerID string `json:"peer_id"`
	}
	if err := json.Unmarshal(tcpBody, &tcpPayload); err != nil {
		t.Fatalf("unmarshal tcp body: %v", err)
	}
	if err := json.Unmarshal(libp2pBody, &libp2pPayload); err != nil {
		t.Fatalf("unmarshal libp2p body: %v", err)
	}
	if tcpPayload != libp2pPayload {
		t.Fatalf("payload mismatch: tcp=%+v libp2p=%+v", tcpPayload, libp2pPayload)
	}
	if tcpPayload.PeerID != serverHost.ID().String() {
		t.Fatalf("peer_id = %q, want %q", tcpPayload.PeerID, serverHost.ID().String())
	}
}

func TestDualListenerCloseStopsBothTransports(t *testing.T) {
	serverHost := newHost(t)
	srv := httpx.NewServer(serverHost)

	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	tcpDone := make(chan error, 1)
	libp2pDone := make(chan error, 1)
	go func() { tcpDone <- srv.ServeHTTPOn(ctx, tcpListener) }()
	go func() { libp2pDone <- srv.ServeLibp2p(ctx) }()

	time.Sleep(50 * time.Millisecond)

	if err := srv.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	select {
	case err := <-tcpDone:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("tcp serve did not stop cleanly: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("tcp serve did not return within 2s after Close")
	}
	select {
	case err := <-libp2pDone:
		if err != nil && err != http.ErrServerClosed {
			t.Fatalf("libp2p serve did not stop cleanly: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("libp2p serve did not return within 2s after Close")
	}
}
