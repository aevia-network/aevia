// Package dhtproxy lets browsers (and any HTTP-only client) query the
// Aevia Kademlia DHT without implementing libp2p themselves. A Relay
// Node exposes POST /dht/resolve; the browser sends {cid} and receives
// {providers: [{peerID, multiaddrs[]}]} back.
//
// This is the M8 shortcut that sidesteps js-libp2p's Safari gaps: the
// browser just does fetch() against a well-known Relay Node, relying
// on the Relay for the libp2p-side FindProviders call. A future M10
// can add js-libp2p in a Web Worker for power users.
package dhtproxy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/libp2p/go-libp2p/core/peer"

	aeviadht "github.com/Leeaandrob/aevia/services/provider-node/internal/dht"
)

// Resolver is the subset of dht.DHT methods the proxy needs. Exposed as
// an interface so tests can inject a fake.
type Resolver interface {
	FindProviders(ctx context.Context, cidStr string, limit int) ([]peer.ID, error)
	// PeerAddrs optionally returns addresses for a PeerID (pulled from
	// the libp2p peerstore). Implementations may return nil on miss.
	PeerAddrs(pid peer.ID) []string
}

// Server exposes the /dht/resolve endpoint.
type Server struct {
	resolver Resolver
	timeout  time.Duration
	maxLimit int
}

// New builds a dhtproxy server backed by the given Resolver.
func New(resolver Resolver) (*Server, error) {
	if resolver == nil {
		return nil, errors.New("dhtproxy: resolver is nil")
	}
	return &Server{
		resolver: resolver,
		timeout:  5 * time.Second,
		maxLimit: 20,
	}, nil
}

// HandlerRegistrar matches *http.ServeMux.HandleFunc.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Register attaches the /dht/resolve route to r.
func (s *Server) Register(r HandlerRegistrar) {
	r.HandleFunc("POST /dht/resolve", s.handleResolve)
}

// resolveRequest is the JSON body browsers POST.
type resolveRequest struct {
	CID   string `json:"cid"`
	Limit int    `json:"limit,omitempty"`
}

// resolveResponse is what we return.
type resolveResponse struct {
	CID       string             `json:"cid"`
	Providers []providerResponse `json:"providers"`
}

type providerResponse struct {
	PeerID     string   `json:"peer_id"`
	Multiaddrs []string `json:"multiaddrs"`
}

func (s *Server) handleResolve(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		http.Error(w, "dhtproxy: Content-Type must be application/json", http.StatusUnsupportedMediaType)
		return
	}

	var req resolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "dhtproxy: decode: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.CID == "" {
		http.Error(w, "dhtproxy: cid is required", http.StatusBadRequest)
		return
	}
	if req.Limit <= 0 || req.Limit > s.maxLimit {
		req.Limit = s.maxLimit
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.timeout)
	defer cancel()

	providers, err := s.resolver.FindProviders(ctx, req.CID, req.Limit)
	if err != nil {
		http.Error(w, "dhtproxy: find providers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp := resolveResponse{CID: req.CID, Providers: make([]providerResponse, 0, len(providers))}
	for _, pid := range providers {
		resp.Providers = append(resp.Providers, providerResponse{
			PeerID:     pid.String(),
			Multiaddrs: s.resolver.PeerAddrs(pid),
		})
	}

	body, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, "dhtproxy: marshal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	// Short-lived cache: DHT records are 24h but viewers want fresh
	// provider lists when one dies.
	w.Header().Set("Cache-Control", "public, max-age=15")
	_, _ = w.Write(body)
}

// AdaptDHT wraps an *aeviadht.DHT with the address-lookup the proxy
// needs. Callers of this package in production use this helper; tests
// inject a hand-rolled Resolver.
func AdaptDHT(d *aeviadht.DHT) Resolver {
	return &dhtAdapter{d: d}
}

type dhtAdapter struct {
	d *aeviadht.DHT
}

func (a *dhtAdapter) FindProviders(ctx context.Context, cidStr string, limit int) ([]peer.ID, error) {
	return a.d.FindProviders(ctx, cidStr, limit)
}

func (a *dhtAdapter) PeerAddrs(pid peer.ID) []string {
	host := a.d.Host()
	if host == nil {
		return nil
	}
	addrs := host.Peerstore().Addrs(pid)
	out := make([]string, 0, len(addrs))
	for _, ma := range addrs {
		out = append(out, fmt.Sprintf("%s/p2p/%s", ma, pid))
	}
	return out
}
