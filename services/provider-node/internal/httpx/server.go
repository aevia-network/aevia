// Package httpx serves HTTP handlers over a libp2p stream, using the same
// net/http mux that can also be bound to a plain net.Listener.
//
// The pivot of the Aevia Provider Node architecture is that a single
// http.Handler must be addressable by three distinct clients:
//
//  1. a browser hitting https://provider.example/... (Provider Público path)
//  2. another Go node dialing via libp2p stream (Provider-to-Provider sync)
//  3. a Relay Node bridging HTTP↔libp2p for Providers behind NAT
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
	"strconv"
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
// ActiveSessionCounter is a narrow interface the Fase 2.2 /healthz
// extension uses to report how many WHIP sessions the node is serving.
// Exposed as an interface so the httpx layer stays free of imports on
// whip/mirror. Main.go supplies a thin wrapper around whip.Server.
type ActiveSessionCounter interface {
	ActiveSessionCount() int
}

// MirrorRanker is the Fase 2.2b plug-in that produces /mirrors/candidates
// responses. Kept as a narrow interface so the httpx package doesn't
// import the mirror package. Main.go wires a ranker + peer snapshot
// source on boot.
type MirrorRanker interface {
	// CandidateSnapshot returns the current candidate pool with per-peer
	// RTT/load/geo already populated. The httpx handler then applies
	// scoring and serialises.
	CandidateSnapshot() []MirrorCandidate
	// Score applies the ranker's formula to the snapshot using the given
	// viewer hint. Returns scored candidates sorted ascending.
	Score(candidates []MirrorCandidate, viewerRegion string) []ScoredMirrorCandidate
}

// MirrorCandidate mirrors mirror.Candidate without importing the mirror
// package into httpx. Fields 1:1 with mirror.Candidate.
type MirrorCandidate struct {
	PeerID         string
	HTTPSBase      string
	Region         string
	Lat            float64
	Lng            float64
	LatLngKnown    bool
	RTTEMAMs       float64
	ActiveSessions int
	ProbeLossPct   float64
}

// ScoredMirrorCandidate is the scored output shape.
type ScoredMirrorCandidate struct {
	MirrorCandidate
	Score      float64
	RTTTerm    float64
	LoadTerm   float64
	RegionTerm float64
	RTTSource  string
}

type Server struct {
	host     host.Host
	mux      *http.ServeMux
	protocol protocol.ID
	region   string
	lat      *float64
	lng      *float64

	sessionCounter ActiveSessionCounter
	mirrorRanker   MirrorRanker

	mu      sync.Mutex
	servers []*http.Server
}

type ServerOption func(*Server)

func WithProtocol(p protocol.ID) ServerOption {
	return func(s *Server) { s.protocol = p }
}

// WithRegion tags the node with a region string (e.g. "BR-SP",
// "EU-DE") that viewers consume via /healthz to pick a geographically
// closer provider. Empty string omits the field from the response.
func WithRegion(region string) ServerOption {
	return func(s *Server) { s.region = region }
}

// WithGeo attaches latitude/longitude in decimal degrees so viewers
// with their own coordinates can rank providers by great-circle
// distance. Call only when both values are known and sensible.
func WithGeo(lat, lng float64) ServerOption {
	return func(s *Server) {
		s.lat = &lat
		s.lng = &lng
	}
}

// WithActiveSessionCounter plumbs a Fase 2.2 active-sessions source
// into /healthz. Without this option, /healthz omits the field.
func WithActiveSessionCounter(c ActiveSessionCounter) ServerOption {
	return func(s *Server) { s.sessionCounter = c }
}

// WithMirrorRanker enables the /mirrors/candidates endpoint. Without
// this option the endpoint returns 501. The ranker is typically
// constructed in main.go wrapping mirror.Client + mirror.Ranker.
func WithMirrorRanker(r MirrorRanker) ServerOption {
	return func(s *Server) { s.mirrorRanker = r }
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
		Handler:           withCORS(s.mux),
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
	Status string   `json:"status"`
	PeerID string   `json:"peer_id"`
	Region string   `json:"region,omitempty"`
	Lat    *float64 `json:"lat,omitempty"`
	Lng    *float64 `json:"lng,omitempty"`
	// ActiveSessions is the count of live WHIP sessions this node is
	// currently ingesting OR mirroring. Fase 2.2 candidate ranking uses
	// it as the load term (β·load). Pointer so the field is omitted when
	// the httpx.Server wasn't wired with an ActiveSessionCounter.
	ActiveSessions *int `json:"active_sessions,omitempty"`
}

func (s *Server) registerDefaults() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		var active *int
		if s.sessionCounter != nil {
			n := s.sessionCounter.ActiveSessionCount()
			active = &n
		}
		resp := healthResponse{
			Status:         "ok",
			PeerID:         s.host.ID().String(),
			Region:         s.region,
			Lat:            s.lat,
			Lng:            s.lng,
			ActiveSessions: active,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	s.mux.HandleFunc("GET /mirrors/candidates", s.handleMirrorCandidates)

	// /latency-probe is a purpose-built RTT measurement endpoint —
	// HEAD-optimised, zero body, no JSON marshal, no DB lookup, no
	// peerstore read. Exists because /healthz encodes JSON and is
	// noisy on the network (~120 bytes body). Rapid-fire probes from
	// the viewer against this path converge on the *network* RTT,
	// not "RTT + handler overhead + JSON parse".
	//
	// Sends two Server-Timing metrics for client-side correlation:
	//   server_recv_ns: wall-clock nanoseconds when the handler ran
	//   server_send_ns: wall-clock nanoseconds just before flush
	// Client can compute one-way delay estimate when the clocks are
	// loosely synced (NTP), or just use HTTP RTT when not.
	//
	// Mirror code in Fase 2.1 consumes the same Server-Timing header
	// from mirror-to-origin probes, so origin/mirror hop RTT is
	// measurable with the same primitive.
	s.mux.HandleFunc("GET /latency-probe", handleLatencyProbe)
	s.mux.HandleFunc("HEAD /latency-probe", handleLatencyProbe)
}

func handleLatencyProbe(w http.ResponseWriter, _ *http.Request) {
	recvNS := time.Now().UnixNano()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set(
		"Server-Timing",
		"server_recv_ns;desc=\"server receive wall-clock ns\";dur="+strconv.FormatInt(recvNS, 10)+
			", server_send_ns;desc=\"server send wall-clock ns\";dur="+strconv.FormatInt(time.Now().UnixNano(), 10),
	)
	w.WriteHeader(http.StatusNoContent)
}

// withCORS wraps h with permissive CORS headers so browsers can reach the
// provider-node directly (WHIP POST, HLS GET, /dht/resolve POST). Exposes
// X-Aevia-Session-ID + Location so the JS client can read them from the
// WHIP response. For dev/testnet we allow any Origin; production tightens
// this to the known aevia.video + provider-node operator domains via
// a future `--cors-origin` flag.
func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Aevia-DID, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "X-Aevia-Session-ID, Location")
		w.Header().Set("Access-Control-Max-Age", "600")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}
