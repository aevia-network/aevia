package whip

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// VODManifest is the JSON document served at
// GET /live/{sessionID}/manifest.json once a session has ended. It
// wraps the internal manifest.Manifest with session-scoped metadata
// (session ID + timestamps) so viewers can reconstruct a seekable
// HLS VOD playlist purely from DHT-discoverable data.
//
// A viewer's replay flow becomes:
//
//  1. Compute sessioncid.Of(sessionID) and POST /dht/resolve to any
//     Aevia relay.
//  2. Dial the returned provider's HTTPS endpoint.
//  3. Fetch GET /live/{sessionID}/manifest.json.
//  4. Fetch /live/{sessionID}/init.mp4 + /live/{sessionID}/segment/{N}
//     for each N in [0, segment_count). Emit HLS playlist locally with
//     EXT-X-ENDLIST for correctness.
//
// The server SHOULD also keep serving /live/{sessionID}/playlist.m3u8
// post-close with EXT-X-ENDLIST appended, so simpler clients skip
// step 4 entirely. Both paths terminate at the same bytes.
type VODManifest struct {
	Version         int      `json:"version"`
	SessionID       string   `json:"session_id"`
	CID             string   `json:"cid"`
	MerkleRoot      string   `json:"merkle_root"`
	SegmentCount    int      `json:"segment_count"`
	SegmentDuration int      `json:"segment_duration_secs"`
	SegmentCIDs     []string `json:"segment_cids"`
	StartedAt       string   `json:"started_at_iso"`
	EndedAt         string   `json:"ended_at_iso"`
}

// BuildVODManifest wraps the pinning.ContentStore manifest with
// session-scoped metadata. sessionID + startedAt + endedAt are tracked
// by LivePinSink; the embedded manifest fields (CID, root, leaves)
// come from manifest.BuildFromPayloads via PinPayloads.
//
// Each leaf hex is the same as a segment-addressable CIDv1(raw) would
// be — we expose both so the JSON is self-contained for replay.
func BuildVODManifest(sessionID string, m *manifest.Manifest, startedAt, endedAt time.Time) (*VODManifest, error) {
	if sessionID == "" {
		return nil, errors.New("vod-manifest: empty sessionID")
	}
	if m == nil {
		return nil, errors.New("vod-manifest: nil manifest")
	}
	segCids := make([]string, 0, len(m.Leaves))
	for _, leafHex := range m.Leaves {
		cid, err := leafHexToCID(leafHex)
		if err != nil {
			return nil, err
		}
		segCids = append(segCids, cid)
	}
	return &VODManifest{
		Version:         m.Version,
		SessionID:       sessionID,
		CID:             m.CID,
		MerkleRoot:      m.Root,
		SegmentCount:    m.SegmentCount,
		SegmentDuration: m.SegmentDuration,
		SegmentCIDs:     segCids,
		StartedAt:       startedAt.UTC().Format(time.RFC3339Nano),
		EndedAt:         endedAt.UTC().Format(time.RFC3339Nano),
	}, nil
}

// CanonicalJSON returns the deterministic JSON serialization. Same
// bytes as encoding/json.Marshal since all fields are tagged.
func (v *VODManifest) CanonicalJSON() ([]byte, error) {
	return json.Marshal(v)
}

// leafHexToCID takes the hex-encoded SHA-256 leaf from the manifest
// and returns its CIDv1(raw) form so viewers can fetch segments by
// CID via the pinning store endpoints.
func leafHexToCID(leafHex string) (string, error) {
	b, err := hex.DecodeString(leafHex)
	if err != nil {
		return "", err
	}
	return manifest.CIDv1Raw(b)
}
