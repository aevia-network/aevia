package content_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
)

func TestFixtureBytesIsDeterministic(t *testing.T) {
	a := content.FixtureBytes("baf123", 7, 1024)
	b := content.FixtureBytes("baf123", 7, 1024)
	if !bytes.Equal(a, b) {
		t.Fatal("FixtureBytes not deterministic for equal inputs")
	}
}

func TestFixtureBytesDiffersPerSegment(t *testing.T) {
	a := content.FixtureBytes("baf123", 0, 1024)
	b := content.FixtureBytes("baf123", 1, 1024)
	if bytes.Equal(a, b) {
		t.Fatal("segments 0 and 1 produced identical fixture payloads")
	}
}

func TestFixtureBytesDiffersPerCID(t *testing.T) {
	a := content.FixtureBytes("baf111", 0, 1024)
	b := content.FixtureBytes("baf222", 0, 1024)
	if bytes.Equal(a, b) {
		t.Fatal("different CIDs produced identical fixture payloads")
	}
}

func TestFixtureBytesRespectsSize(t *testing.T) {
	for _, size := range []int{1, 33, 1024, 4096, 8193} {
		out := content.FixtureBytes("cid", 0, size)
		if len(out) != size {
			t.Fatalf("size=%d len(out)=%d", size, len(out))
		}
	}
}

func TestServeSegmentReturnsDeterministicBytesAndHeader(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/baf9k/segment/42", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "video/mp2t" {
		t.Fatalf("Content-Type = %q, want video/mp2t", ct)
	}
	if got := rec.Body.Len(); got != content.FixtureSegmentSize {
		t.Fatalf("body len = %d, want %d", got, content.FixtureSegmentSize)
	}
	expected := content.FixtureBytes("baf9k", 42, content.FixtureSegmentSize)
	if !bytes.Equal(rec.Body.Bytes(), expected) {
		t.Fatal("served bytes do not equal FixtureBytes for same inputs")
	}
	wantHash := content.SegmentSHA256("baf9k", 42, content.FixtureSegmentSize)
	if got := rec.Header().Get("X-Aevia-Segment-Sha256"); got != wantHash {
		t.Fatalf("X-Aevia-Segment-Sha256 = %q, want %q", got, wantHash)
	}
}

func TestServeSegmentRejectsNegativeIndex(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/baf9k/segment/-1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestServeSegmentRejectsNonNumericIndex(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/baf9k/segment/abc", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
