// Package content serves HLS media segments addressed by CID.
//
// Milestones 1-4 used deterministic fixture bytes so upstream iterations
// (HLS playlist, Kill Test integration) could exercise the path before
// persistent storage existed. Milestone 5 adds a Source plug-in point:
// when a Source (typically pinning.ContentStore) is attached, handlers
// serve actually-pinned bytes and fall back to fixture output only when
// the CID is not in the pin set. That keeps legacy tests green while
// letting real operators serve real content.
package content

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// FixtureSegmentSize is the deterministic payload length used by every
// fixture segment served from this package.
const FixtureSegmentSize = 4096

// FixtureBytes returns a byte buffer that is fully determined by the pair
// (cid, segmentIndex). Any two calls with equal inputs produce identical
// output — critical for integration tests that assert byte equality across
// plain HTTP and libp2p transports.
func FixtureBytes(cid string, segmentIndex, size int) []byte {
	if size <= 0 {
		return nil
	}
	seg := make([]byte, 8)
	binary.BigEndian.PutUint64(seg, uint64(segmentIndex))
	out := make([]byte, 0, size)
	var counter uint64
	for len(out) < size {
		h := sha256.New()
		h.Write([]byte(cid))
		h.Write(seg)
		ctr := make([]byte, 8)
		binary.BigEndian.PutUint64(ctr, counter)
		h.Write(ctr)
		out = append(out, h.Sum(nil)...)
		counter++
	}
	return out[:size]
}

// SegmentSHA256 returns the hex-encoded SHA-256 of a fixture segment.
func SegmentSHA256(cid string, segmentIndex, size int) string {
	sum := sha256.Sum256(FixtureBytes(cid, segmentIndex, size))
	return hex.EncodeToString(sum[:])
}

// Source is the plug-in point for real content lookup. Implemented by
// pinning.ContentStore in production; nil means "fixture only".
type Source interface {
	GetManifest(cid string) (*manifest.Manifest, error)
	GetSegment(cid string, index int) ([]byte, error)
}

// ErrNotPinned is what a Source should return when a CID is not in the
// local pin set. Handlers catch it and either fall back to fixture output
// or return 404 depending on configuration.
var ErrNotPinned = errors.New("content: cid not in local pin set")

// HandlerRegistrar is the minimum surface from httpx.Server (or a raw
// *http.ServeMux) that this package needs. The signature matches
// *http.ServeMux.HandleFunc exactly so both implementations satisfy it.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Handlers carries the content handler surface. The zero value is valid
// (fixture-only); attach a Source via WithSource to serve pinned bytes.
type Handlers struct {
	source Source
	// FixtureFallback controls behavior when a CID is not found in the
	// source. true = serve deterministic fixture bytes (preserves legacy
	// test semantics). false = return 404. Default is true for backward
	// compatibility; production deployments flip it off.
	FixtureFallback bool
}

// NewHandlers builds a fixture-only Handlers suitable for legacy callers.
func NewHandlers() *Handlers {
	return &Handlers{FixtureFallback: true}
}

// WithSource attaches a Source and returns h for chaining. Pass nil to
// detach.
func (h *Handlers) WithSource(s Source) *Handlers {
	h.source = s
	return h
}

// WithFixtureFallback toggles the fallback behavior. Returns h for chaining.
func (h *Handlers) WithFixtureFallback(b bool) *Handlers {
	h.FixtureFallback = b
	return h
}

// Register wires the /content/{cid}/... handlers into r.
func (h *Handlers) Register(r HandlerRegistrar) {
	r.HandleFunc("GET /content/{cid}/segment/{n}", h.serveSegment)
	r.HandleFunc("GET /content/{cid}/index.m3u8", h.servePlaylist)
	r.HandleFunc("GET /content/{cid}/manifest.json", h.serveManifest)
}

// Register is the package-level shortcut preserved from M1-M4. Equivalent
// to NewHandlers().Register(r) — fixture-only, with fallback on.
func Register(r HandlerRegistrar) {
	NewHandlers().Register(r)
}

func (h *Handlers) serveSegment(w http.ResponseWriter, r *http.Request) {
	cid := r.PathValue("cid")
	if cid == "" {
		http.Error(w, "missing cid", http.StatusBadRequest)
		return
	}
	idx, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || idx < 0 {
		http.Error(w, "invalid segment index", http.StatusBadRequest)
		return
	}

	payload, err := h.resolveSegment(cid, idx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	sum := sha256.Sum256(payload)
	w.Header().Set("Content-Type", "video/mp2t")
	w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
	w.Header().Set("X-Aevia-Segment-Sha256", hex.EncodeToString(sum[:]))
	_, _ = w.Write(payload)
}

func (h *Handlers) resolveSegment(cid string, idx int) ([]byte, error) {
	if h.source != nil {
		b, err := h.source.GetSegment(cid, idx)
		if err == nil {
			return b, nil
		}
		if !isNotFound(err) {
			return nil, err
		}
	}
	if !h.FixtureFallback {
		return nil, ErrNotPinned
	}
	return FixtureBytes(cid, idx, FixtureSegmentSize), nil
}

// isNotFound recognises both the storage.ErrNotFound value and the
// ErrNotPinned value so a Source implementation backed by BadgerDB
// signals absence via either.
func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrNotPinned) || errors.Is(err, storage.ErrNotFound)
}
