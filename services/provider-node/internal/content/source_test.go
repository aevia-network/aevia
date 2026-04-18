package content_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// fakeSource lets us test the handler wiring without standing up a
// BadgerDB. Keyed by cid; missing CIDs return ErrNotPinned.
type fakeSource struct {
	manifests map[string]*manifest.Manifest
	segments  map[string][][]byte
}

func (f *fakeSource) GetManifest(cid string) (*manifest.Manifest, error) {
	m, ok := f.manifests[cid]
	if !ok {
		return nil, content.ErrNotPinned
	}
	return m, nil
}

func (f *fakeSource) GetSegment(cid string, idx int) ([]byte, error) {
	segs, ok := f.segments[cid]
	if !ok || idx < 0 || idx >= len(segs) {
		return nil, content.ErrNotPinned
	}
	return segs[idx], nil
}

func TestHandlersServePinnedBytesWhenSourceMatches(t *testing.T) {
	payloads := [][]byte{[]byte("pinned-0"), []byte("pinned-1"), []byte("pinned-2")}
	m, err := manifest.BuildFromPayloads(payloads, 4)
	if err != nil {
		t.Fatalf("BuildFromPayloads: %v", err)
	}
	source := &fakeSource{
		manifests: map[string]*manifest.Manifest{m.CID: m},
		segments:  map[string][][]byte{m.CID: payloads},
	}

	mux := http.NewServeMux()
	content.NewHandlers().WithSource(source).Register(mux)

	// Segment lookup returns the pinned bytes, not fixture.
	req := httptest.NewRequest(http.MethodGet, "/content/"+m.CID+"/segment/1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("segment status = %d", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), payloads[1]) {
		t.Fatalf("served segment bytes != pinned bytes; got=%q want=%q", rec.Body.Bytes(), payloads[1])
	}

	// Manifest lookup returns the pinned manifest.
	req = httptest.NewRequest(http.MethodGet, "/content/"+m.CID+"/manifest.json", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("manifest status = %d", rec.Code)
	}
	parsed, err := manifest.ParseManifest(rec.Body.Bytes())
	if err != nil {
		t.Fatalf("ParseManifest: %v", err)
	}
	if parsed.CID != m.CID {
		t.Fatalf("manifest CID = %q, want %q", parsed.CID, m.CID)
	}
	if parsed.SegmentCount != len(payloads) {
		t.Fatalf("manifest SegmentCount = %d, want %d", parsed.SegmentCount, len(payloads))
	}

	// Playlist uses segment_count + segment_duration from the real manifest.
	req = httptest.NewRequest(http.MethodGet, "/content/"+m.CID+"/index.m3u8", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("playlist status = %d", rec.Code)
	}
	body := rec.Body.String()
	if !contains(body, "#EXT-X-TARGETDURATION:4") {
		t.Fatalf("playlist missing EXT-X-TARGETDURATION:4 (manifest duration): %s", body)
	}
	if !contains(body, "segment/"+strconv.Itoa(len(payloads)-1)) {
		t.Fatalf("playlist missing segment/%d reference", len(payloads)-1)
	}
}

func TestHandlersFallbackToFixtureWhenCIDMisses(t *testing.T) {
	source := &fakeSource{manifests: map[string]*manifest.Manifest{}, segments: map[string][][]byte{}}

	mux := http.NewServeMux()
	content.NewHandlers().WithSource(source).Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/bafunpinned/segment/2", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 with fixture fallback", rec.Code)
	}
	want := content.FixtureBytes("bafunpinned", 2, content.FixtureSegmentSize)
	if !bytes.Equal(rec.Body.Bytes(), want) {
		t.Fatal("fixture fallback did not produce expected bytes")
	}
}

func TestHandlersReturn404WhenFallbackDisabled(t *testing.T) {
	source := &fakeSource{manifests: map[string]*manifest.Manifest{}, segments: map[string][][]byte{}}

	mux := http.NewServeMux()
	content.NewHandlers().WithSource(source).WithFixtureFallback(false).Register(mux)

	for _, path := range []string{
		"/content/bafunpinned/segment/0",
		"/content/bafunpinned/manifest.json",
		"/content/bafunpinned/index.m3u8",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404", path, rec.Code)
		}
	}
}

func contains(haystack, needle string) bool {
	return bytes.Contains([]byte(haystack), []byte(needle))
}
