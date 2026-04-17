// Package content serves HLS media segments addressed by CID.
//
// Milestone 1 uses deterministic fixture bytes so upstream iterations (HLS
// playlist, Kill Test integration) can exercise the path before storage is
// wired. BadgerDB-backed pinning storage replaces FixtureBytes in Milestone
// 3 without touching the handler surface.
package content

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"net/http"
	"strconv"
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

// HandlerRegistrar is the minimum surface from httpx.Server (or a raw
// *http.ServeMux) that this package needs. The signature matches
// *http.ServeMux.HandleFunc exactly so both implementations satisfy it.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Register wires the /content/{cid}/... handlers into r.
func Register(r HandlerRegistrar) {
	r.HandleFunc("GET /content/{cid}/segment/{n}", serveSegment)
}

func serveSegment(w http.ResponseWriter, r *http.Request) {
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

	payload := FixtureBytes(cid, idx, FixtureSegmentSize)
	sum := sha256.Sum256(payload)

	w.Header().Set("Content-Type", "video/mp2t")
	w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
	w.Header().Set("X-Aevia-Segment-Sha256", hex.EncodeToString(sum[:]))
	_, _ = w.Write(payload)
}
