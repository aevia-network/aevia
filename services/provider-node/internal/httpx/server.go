// Package httpx serves HTTP handlers over a libp2p stream, using the same
// net/http mux that later milestones will also bind to a plain net.Listener.
//
// The pivot of the Aevia Provider Node architecture is that a single
// http.Handler must be addressable by three distinct clients:
//
//   1. a browser hitting https://provider.example/... (Provider Público path)
//   2. another Go node dialing via libp2p stream (Provider-to-Provider sync)
//   3. a Relay Node bridging HTTP↔libp2p for Providers behind NAT
//
// go-libp2p-gostream gives us a net.Listener backed by a libp2p stream
// protocol. Everything above it is ordinary net/http, so the same mux plugs
// into both transports.
package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/protocol"

	gostream "github.com/libp2p/go-libp2p-gostream"
)

// DefaultProtocol is the libp2p stream protocol ID for Aevia HTTP traffic.
const DefaultProtocol protocol.ID = "/aevia/http/1.0.0"

// Server wraps an http.ServeMux and exposes it over a libp2p stream listener.
type Server struct {
	host     host.Host
	mux      *http.ServeMux
	protocol protocol.ID

	mu       sync.Mutex
	running  *http.Server
	listener interface{ Close() error }
}

type ServerOption func(*Server)

func WithProtocol(p protocol.ID) ServerOption {
	return func(s *Server) { s.protocol = p }
}

// NewServer wires the default handlers and returns a Server that can be
// started against a libp2p stream.
func NewServer(h host.Host, opts ...ServerOption) *Server {
	s := &Server{
		host:     h,
		mux:      http.NewServeMux(),
		protocol: DefaultProtocol,
	}
	for _, opt := range opts {
		opt(s)
	}
	s.registerDefaults()
	return s
}

// Handle registers a handler for the given pattern. Go 1.22+ method patterns
// (for example "GET /content/{cid}") are supported.
func (s *Server) Handle(pattern string, h http.Handler) {
	s.mux.Handle(pattern, h)
}

// HandleFunc is a convenience over Handle.
func (s *Server) HandleFunc(pattern string, h http.HandlerFunc) {
	s.mux.HandleFunc(pattern, h)
}

// Protocol returns the libp2p stream protocol this server is bound to.
func (s *Server) Protocol() protocol.ID { return s.protocol }

// ServeLibp2p blocks, serving HTTP over the libp2p stream protocol. Returns
// when the context is cancelled or the underlying http.Server errors.
func (s *Server) ServeLibp2p(ctx context.Context) error {
	listener, err := gostream.Listen(s.host, s.protocol)
	if err != nil {
		return err
	}

	srv := &http.Server{
		Handler:           s.mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	s.mu.Lock()
	s.running = srv
	s.listener = listener
	s.mu.Unlock()

	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(listener) }()

	select {
	case <-ctx.Done():
		return s.Close()
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

// Close stops the server and releases the underlying stream listener.
func (s *Server) Close() error {
	s.mu.Lock()
	srv := s.running
	listener := s.listener
	s.running = nil
	s.listener = nil
	s.mu.Unlock()

	var firstErr error
	if srv != nil {
		if err := srv.Close(); err != nil {
			firstErr = err
		}
	}
	if listener != nil {
		if err := listener.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

type healthResponse struct {
	Status string `json:"status"`
	PeerID string `json:"peer_id"`
}

func (s *Server) registerDefaults() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{
			Status: "ok",
			PeerID: s.host.ID().String(),
		})
	})
}
