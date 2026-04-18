package integration_test

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// TestLiveManifestLifecycle covers the VOD persistence loop added in
// Fase 0.2: a live session that ends correctly pins a manifest and
// exposes it at GET /live/{sessionID}/manifest.json.
//
// Sub-cases:
//
//	(a) Pre-Finalize: manifest.json → 404 (session still live)
//	(b) Post-Finalize: manifest.json → 200 JSON with segment_count,
//	    merkle_root (64 hex chars = 32 bytes), started_at_iso, ended_at_iso,
//	    segment_cids matching segment_count
//	(c) Playlist.m3u8 post-Finalize appends #EXT-X-ENDLIST
//
// Exercises the public API the VOD viewer page will consume once
// wired. No pion dependency — the test drives the sink directly
// through the standard SegmentSink interface.
func TestLiveManifestLifecycle(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := storage.Open(storage.Options{Path: tmpDir, Silent: true})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	cs := pinning.NewContentStore(store)

	sessionID := "s_manifest_lifecycle"
	sink, err := whip.NewLivePinSink(cs, sessionID)
	if err != nil {
		t.Fatalf("NewLivePinSink: %v", err)
	}

	router := whip.NewLiveRouter()
	if err := router.AttachSession(sessionID, sink); err != nil {
		t.Fatalf("AttachSession: %v", err)
	}

	mux := http.NewServeMux()
	router.Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	// --- push 3 synthetic segments through the sink ---------------------
	seg := func(n int) []byte {
		// fMP4 styp prefix so the bytes are syntactically sane; content
		// itself is irrelevant to the manifest layer.
		return append([]byte{0x00, 0x00, 0x00, 0x18, 's', 't', 'y', 'p', byte(n)},
			make([]byte, 32+n)...)
	}
	if err := sink.OnInitSegment([]byte("fake-init")); err != nil {
		t.Fatalf("OnInitSegment: %v", err)
	}
	for i := 0; i < 3; i++ {
		if err := sink.OnMediaSegment(uint32(i), seg(i), whip.VideoTimescale*6); err != nil {
			t.Fatalf("OnMediaSegment(%d): %v", i, err)
		}
	}

	// (a) Pre-Finalize manifest.json must be 404
	t.Run("pre-finalize manifest returns 404", func(t *testing.T) {
		code, _ := httpGET(t, srv.URL+"/live/"+sessionID+"/manifest.json")
		if code != http.StatusNotFound {
			t.Fatalf("want 404, got %d", code)
		}
	})

	// Session closes — triggers Finalize
	manifestObj, err := sink.Finalize(whip.TargetSegmentDuration)
	if err != nil {
		t.Fatalf("Finalize: %v", err)
	}

	// (b) Post-Finalize manifest.json → 200 + canonical JSON
	t.Run("post-finalize manifest returns valid JSON", func(t *testing.T) {
		code, body := httpGET(t, srv.URL+"/live/"+sessionID+"/manifest.json")
		if code != http.StatusOK {
			t.Fatalf("want 200, got %d", code)
		}
		var vod whip.VODManifest
		if err := json.Unmarshal([]byte(body), &vod); err != nil {
			t.Fatalf("decode: %v\nbody=%s", err, body)
		}
		if vod.SessionID != sessionID {
			t.Fatalf("session mismatch: %s != %s", vod.SessionID, sessionID)
		}
		if vod.SegmentCount != 3 {
			t.Fatalf("segment_count = %d, want 3", vod.SegmentCount)
		}
		if vod.CID != manifestObj.CID {
			t.Fatalf("cid mismatch: %s vs %s", vod.CID, manifestObj.CID)
		}
		// merkle_root must be 64 hex chars (32 bytes SHA-256)
		if len(vod.MerkleRoot) != 64 {
			t.Fatalf("merkle_root length = %d, want 64 (32-byte hex)", len(vod.MerkleRoot))
		}
		if _, err := hex.DecodeString(vod.MerkleRoot); err != nil {
			t.Fatalf("merkle_root not hex: %v", err)
		}
		if len(vod.SegmentCIDs) != vod.SegmentCount {
			t.Fatalf("segment_cids len %d != segment_count %d", len(vod.SegmentCIDs), vod.SegmentCount)
		}
		// started_at_iso + ended_at_iso must parse
		if _, err := time.Parse(time.RFC3339Nano, vod.StartedAt); err != nil {
			t.Fatalf("started_at_iso not RFC3339: %v", err)
		}
		if _, err := time.Parse(time.RFC3339Nano, vod.EndedAt); err != nil {
			t.Fatalf("ended_at_iso not RFC3339: %v", err)
		}
	})

	// (c) Playlist.m3u8 post-finalize has EXT-X-ENDLIST
	t.Run("finalized playlist has ENDLIST marker", func(t *testing.T) {
		code, body := httpGET(t, srv.URL+"/live/"+sessionID+"/playlist.m3u8")
		if code != http.StatusOK {
			t.Fatalf("want 200, got %d", code)
		}
		if !strings.Contains(body, "#EXT-X-ENDLIST") {
			t.Fatalf("playlist missing #EXT-X-ENDLIST:\n%s", body)
		}
	})
}

func httpGET(t *testing.T, url string) (int, string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body)
}
