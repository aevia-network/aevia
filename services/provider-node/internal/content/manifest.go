package content

import (
	"net/http"
	"strconv"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// BuildFixtureManifest assembles the canonical Manifest for a fixture CID.
// Every Provider Node in the network deriving from the same fixture seed
// produces byte-identical manifests — a property that keeps the ContentRegistry
// anchor deterministic during M2 dev, before live capture pipelines write
// real manifests in M5+.
func BuildFixtureManifest(cid string) (*manifest.Manifest, error) {
	payloads := make([][]byte, DefaultSegmentCount)
	for i := 0; i < DefaultSegmentCount; i++ {
		payloads[i] = FixtureBytes(cid, i, FixtureSegmentSize)
	}
	return manifest.BuildFromPayloads(payloads, DefaultSegmentDuration)
}

func serveManifest(w http.ResponseWriter, r *http.Request) {
	cid := r.PathValue("cid")
	if cid == "" {
		http.Error(w, "missing cid", http.StatusBadRequest)
		return
	}
	m, err := BuildFixtureManifest(cid)
	if err != nil {
		http.Error(w, "build manifest: "+err.Error(), http.StatusInternalServerError)
		return
	}
	body, err := m.CanonicalJSON()
	if err != nil {
		http.Error(w, "canonical json: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.Header().Set("ETag", `"`+m.CID+`"`)
	w.Header().Set("X-Aevia-Manifest-CID", m.CID)
	_, _ = w.Write(body)
}
