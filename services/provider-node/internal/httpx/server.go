// Package httpx serves HTTP handlers over a libp2p stream, using the same
// net/http mux that can also be bound to a plain net.Listener.
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
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/protocol"

	gostream "github.com/libp2p/go-libp2p-gostream"
)

// DefaultProtocol is the libp2p stream protocol ID for Aevia HTTP traffic.
const DefaultProtocol protocol.ID = "/aevia/http/1.0.0"

// Server wraps an http.ServeMux and serves it on any number of transports
// (libp2p stream, plain TCP, Unix socket, in-process pipe).
type Server struct {
	host     host.Host
	mux      *http.ServeMux
	protocol protocol.ID

	mu      sync.Mutex
	servers []*http.Server
}

type ServerOption func(*Server)

func WithProtocol(p protocol.ID) ServerOption {
	return func(s *Server) { s.protocol = p }
}

// NewServer wires the default handlers and returns a Server that can be
// started against a libp2p stream and/or a plain net.Listener.
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

// HandleFunc is a convenience over Handle. Signature matches
// *http.ServeMux.HandleFunc so any content.HandlerRegistrar user works with
// either implementation.
func (s *Server) HandleFunc(pattern string, h func(http.ResponseWriter, *http.Request)) {
	s.mux.HandleFunc(pattern, h)
}

// Handler returns the underlying ServeMux — useful for callers that want to
// spin up their own http.Server outside of ServeHTTPOn/ServeLibp2p.
func (s *Server) Handler() http.Handler { return s.mux }

// Protocol returns the libp2p stream protocol this server is bound to.
func (s *Server) Protocol() protocol.ID { return s.protocol }

// ServeLibp2p blocks serving the mux over a libp2p stream protocol.
func (s *Server) ServeLibp2p(ctx context.Context) error {
	listener, err := gostream.Listen(s.host, s.protocol)
	if err != nil {
		return err
	}
	return s.serveOn(ctx, listener)
}

// ServeHTTPOn blocks serving the mux over the given net.Listener. Caller owns
// the listener lifetime; Close() on the Server will close the underlying
// http.Server which in turn closes the listener.
func (s *Server) ServeHTTPOn(ctx context.Context, l net.Listener) error {
	return s.serveOn(ctx, l)
}

func (s *Server) serveOn(ctx context.Context, l net.Listener) error {
	srv := &http.Server{
		Handler:           s.mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	s.mu.Lock()
	s.servers = append(s.servers, srv)
	s.mu.Unlock()

	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(l) }()

	select {
	case <-ctx.Done():
		// Graceful path — let callers drive shutdown via Shutdown(). Here we
		// hard-close only if Shutdown wasn't called in time.
		return srv.Close()
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

// Shutdown stops accepting new connections on every transport and waits for
// in-flight requests to finish, up to ctx's deadline. Returns the first
// error encountered. After Shutdown returns, the Server is no longer usable.
func (s *Server) Shutdown(ctx context.Context) error {
	s.mu.Lock()
	servers := s.servers
	s.servers = nil
	s.mu.Unlock()

	var firstErr error
	for _, srv := range servers {
		if err := srv.Shutdown(ctx); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// Close hard-aborts every transport immediately, dropping in-flight requests.
// Prefer Shutdown for normal termination; Close is the fallback when a
// caller's shutdown deadline expires.
func (s *Server) Close() error {
	s.mu.Lock()
	servers := s.servers
	s.servers = nil
	s.mu.Unlock()

	var firstErr error
	for _, srv := range servers {
		if err := srv.Close(); err != nil && firstErr == nil {
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
