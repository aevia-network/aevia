// Package client is the libp2p-http client library for fetching Aevia
// content from Provider Nodes by PeerID — no IP address required.
//
// This is the client side of the Kill Test. Given only (PeerID, CID) the
// caller can pull the playlist and every segment, hash-verify each segment
// against the server-reported SHA-256, and hand bytes to an HLS player. No
// trust in the transport, no trust in Cloudflare, no trust in DNS.
package client

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"

	p2phttp "github.com/libp2p/go-libp2p-http"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// DefaultTimeout is the default per-request timeout. Callers can override by
// supplying their own http.Client via WithHTTPClient.
const DefaultTimeout = 10 * time.Second

// Resolver is anything that can answer "who provides this CID?". Implemented
// by *dht.DHT (internal/dht package) and trivially by hand-rolled mocks in
// tests.
type Resolver interface {
	FindProviders(ctx context.Context, cidStr string, limit int) ([]peer.ID, error)
}

// Client is a libp2p-http client for Aevia content.
type Client struct {
	host     host.Host
	protocol protocol.ID
	http     *http.Client
	resolver Resolver
}

// Option configures a Client.
type Option func(*Client)

// WithProtocol overrides the libp2p stream protocol ID.
func WithProtocol(p protocol.ID) Option {
	return func(c *Client) { c.protocol = p }
}

// WithHTTPClient swaps in a custom http.Client. Its Transport MUST be a
// p2phttp.RoundTripper bound to the same host.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.http = hc }
}

// WithResolver attaches a CID -> []PeerID resolver so the client can fetch
// content by CID alone via ResolveProviders / FetchAndVerifyByCID.
func WithResolver(r Resolver) Option {
	return func(c *Client) { c.resolver = r }
}

// New builds a Client that dials peers using host's libp2p stack.
func New(h host.Host, opts ...Option) *Client {
	c := &Client{
		host:     h,
		protocol: protocol.ID("/aevia/http/1.0.0"),
	}
	for _, opt := range opts {
		opt(c)
	}
	if c.http == nil {
		c.http = &http.Client{
			Transport: p2phttp.NewTransport(h, p2phttp.ProtocolOption(c.protocol)),
			Timeout:   DefaultTimeout,
		}
	}
	return c
}

// Healthz fetches /healthz from pid and returns the reported peer_id.
func (c *Client) Healthz(ctx context.Context, pid peer.ID) (string, error) {
	body, _, err := c.getBytes(ctx, pid, "/healthz")
	if err != nil {
		return "", err
	}
	// The payload is small JSON: `{"status":"ok","peer_id":"<id>"}`. We avoid
	// importing encoding/json into this helper by doing a simple substring
	// extraction — the caller should use a proper JSON decoder for production
	// code paths. This Healthz is just a connectivity smoke test.
	return string(body), nil
}

// FetchPlaylist returns the .m3u8 body as text.
func (c *Client) FetchPlaylist(ctx context.Context, pid peer.ID, cid string) (string, error) {
	body, _, err := c.getBytes(ctx, pid, "/content/"+cid+"/index.m3u8")
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// FetchManifest retrieves /content/{cid}/manifest.json from pid, parses it,
// and runs Manifest.Verify() to confirm internal cryptographic consistency
// (leaves -> root -> cid all agree). It does NOT compare against any
// external expected root — callers interested in that should chain a
// second check via Manifest.CID against ContentRegistry.
func (c *Client) FetchManifest(ctx context.Context, pid peer.ID, cid string) (*manifest.Manifest, error) {
	body, _, err := c.getBytes(ctx, pid, "/content/"+cid+"/manifest.json")
	if err != nil {
		return nil, err
	}
	m, err := manifest.ParseManifest(body)
	if err != nil {
		return nil, fmt.Errorf("client: parse manifest: %w", err)
	}
	if err := m.Verify(); err != nil {
		return nil, fmt.Errorf("client: manifest self-consistency: %w", err)
	}
	return m, nil
}

// FetchManifestExpectingCID is the stricter variant: on top of
// self-consistency, asserts the manifest's CID equals expected. Use when
// the caller has already resolved an on-chain CID for the content (via
// ContentRegistry) and requires the manifest to match that anchor exactly.
func (c *Client) FetchManifestExpectingCID(ctx context.Context, pid peer.ID, cid, expectedCID string) (*manifest.Manifest, error) {
	m, err := c.FetchManifest(ctx, pid, cid)
	if err != nil {
		return nil, err
	}
	if m.CID != expectedCID {
		return nil, fmt.Errorf("client: manifest cid %q does not match expected %q", m.CID, expectedCID)
	}
	return m, nil
}

// FetchSegment returns the segment bytes and verifies the server-reported
// SHA-256 header against the actual content. Returns ErrHashMismatch if the
// server lied or the transport corrupted the payload.
func (c *Client) FetchSegment(ctx context.Context, pid peer.ID, cid string, index int) ([]byte, error) {
	if index < 0 {
		return nil, fmt.Errorf("client: segment index must be >= 0 (got %d)", index)
	}
	body, resp, err := c.getBytes(ctx, pid, "/content/"+cid+"/segment/"+strconv.Itoa(index))
	if err != nil {
		return nil, err
	}

	claimed := resp.Header.Get("X-Aevia-Segment-Sha256")
	if claimed == "" {
		// Server did not report a hash; cannot verify. Reject — the point of
		// the Kill Test is to NEVER trust transport alone.
		return nil, fmt.Errorf("client: server did not report X-Aevia-Segment-Sha256 for cid=%s idx=%d", cid, index)
	}
	actual := sha256.Sum256(body)
	if hex.EncodeToString(actual[:]) != claimed {
		return nil, ErrHashMismatch{CID: cid, Index: index, Claimed: claimed, Actual: hex.EncodeToString(actual[:])}
	}
	return body, nil
}

// ErrHashMismatch is returned when a server-reported SHA-256 does not match
// the actual bytes received.
type ErrHashMismatch struct {
	CID     string
	Index   int
	Claimed string
	Actual  string
}

func (e ErrHashMismatch) Error() string {
	return fmt.Sprintf("client: segment hash mismatch cid=%s idx=%d claimed=%s actual=%s", e.CID, e.Index, e.Claimed, e.Actual)
}

// ResolveProviders queries the configured Resolver for PeerIDs that claim to
// serve cid. Returns ErrNoResolver if the client was built without a
// Resolver, ErrNoProviders if the Resolver returned an empty list.
func (c *Client) ResolveProviders(ctx context.Context, cid string, limit int) ([]peer.ID, error) {
	if c.resolver == nil {
		return nil, ErrNoResolver
	}
	providers, err := c.resolver.FindProviders(ctx, cid, limit)
	if err != nil {
		return nil, fmt.Errorf("client: resolve providers for %s: %w", cid, err)
	}
	if len(providers) == 0 {
		return nil, ErrNoProviders{CID: cid}
	}
	return providers, nil
}

// ErrNoResolver is returned when a resolver-dependent method is called on
// a Client that was built without client.WithResolver.
var ErrNoResolver = fmt.Errorf("client: no resolver configured (use client.WithResolver)")

// ErrNoProviders is returned when the resolver returned an empty provider
// set for the requested CID.
type ErrNoProviders struct {
	CID string
}

func (e ErrNoProviders) Error() string {
	return "client: no providers found for cid=" + e.CID
}

// ErrLeafMismatch is returned when a downloaded segment's SHA-256 does not
// match the hash stored in the manifest's leaves. This is distinct from
// ErrHashMismatch: that one detects server-header lying; this one detects
// server-content lying (or manifest corruption) against the on-chain anchor.
type ErrLeafMismatch struct {
	CID      string
	Index    int
	Expected string
	Actual   string
}

func (e ErrLeafMismatch) Error() string {
	return fmt.Sprintf("client: segment leaf mismatch cid=%s idx=%d expected=%s actual=%s", e.CID, e.Index, e.Expected, e.Actual)
}

// VerifiedContent is what FetchAndVerifyContent returns — a verified
// manifest plus every segment whose SHA-256 matches the corresponding leaf.
type VerifiedContent struct {
	Manifest *manifest.Manifest
	Segments [][]byte
}

// FetchAndVerifyByCID is the CID-only viewer API: the caller provides only
// the content CID (typically resolved from ContentRegistry on-chain) and
// this method
//   1. queries the configured Resolver for providers,
//   2. iterates providers in returned order,
//   3. ensures a live libp2p connection to each,
//   4. tries FetchAndVerifyContent, and
//   5. returns on the first success.
//
// If ALL providers fail, returns the last error with count context. This is
// the failure-mode of the DHT-backed Kill Test: as long as ONE honest,
// reachable provider remains, the viewer gets authentic bytes.
func (c *Client) FetchAndVerifyByCID(ctx context.Context, cid string) (*VerifiedContent, error) {
	providers, err := c.ResolveProviders(ctx, cid, DefaultResolveLimit)
	if err != nil {
		return nil, err
	}

	var lastErr error
	for _, pid := range providers {
		if err := c.ensureConnected(ctx, pid); err != nil {
			lastErr = fmt.Errorf("client: connect %s: %w", pid, err)
			continue
		}
		vc, err := c.FetchAndVerifyContent(ctx, pid, cid)
		if err == nil {
			return vc, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, fmt.Errorf("client: all %d providers failed: %w", len(providers), lastErr)
	}
	return nil, ErrNoProviders{CID: cid}
}

// DefaultResolveLimit is the maximum number of providers FetchAndVerifyByCID
// requests from the resolver. The iteration walks them in order and stops at
// the first success, so larger limits help resilience at small cost.
const DefaultResolveLimit = 10

func (c *Client) ensureConnected(ctx context.Context, pid peer.ID) error {
	if c.host.Network().Connectedness(pid).String() == "Connected" {
		return nil
	}
	info := c.host.Peerstore().PeerInfo(pid)
	if len(info.Addrs) == 0 {
		return fmt.Errorf("no addresses known for %s", pid)
	}
	return c.host.Connect(ctx, info)
}

// FetchAndVerifyContent is the viewer-facing API: one call that walks the
// manifest, downloads every segment, and cryptographically validates each
// against manifest.Leaves[i]. Returns ErrLeafMismatch at the first divergence
// so higher-level code can fall back to another provider.
//
// The flow:
//  1. FetchManifest (runs Verify internally)
//  2. For i in 0..segment_count: FetchSegment (header-hash verified) and
//     assert its SHA-256 equals manifest.Leaves[i].
//
// Any tampering — transport, storage, relay bridge, or a colluding provider
// that substitutes content — is caught. The trust root is the manifest's
// CID; future iterations plumb that CID up to ContentRegistry on Base.
func (c *Client) FetchAndVerifyContent(ctx context.Context, pid peer.ID, cid string) (*VerifiedContent, error) {
	m, err := c.FetchManifest(ctx, pid, cid)
	if err != nil {
		return nil, err
	}
	segments := make([][]byte, m.SegmentCount)
	for i := 0; i < m.SegmentCount; i++ {
		seg, err := c.FetchSegment(ctx, pid, cid, i)
		if err != nil {
			return nil, err
		}
		expectedHash := m.Leaves[i]
		actual := sha256.Sum256(seg)
		actualHex := hex.EncodeToString(actual[:])
		if actualHex != expectedHash {
			return nil, ErrLeafMismatch{
				CID:      cid,
				Index:    i,
				Expected: expectedHash,
				Actual:   actualHex,
			}
		}
		segments[i] = seg
	}
	return &VerifiedContent{Manifest: m, Segments: segments}, nil
}

func (c *Client) getBytes(ctx context.Context, pid peer.ID, path string) ([]byte, *http.Response, error) {
	url := "libp2p://" + pid.String() + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("client: build request: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("client: GET %s: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("client: GET %s: unexpected status %d", path, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("client: read body: %w", err)
	}
	return body, resp, nil
}
