package content_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

func TestBuildFixtureManifestIsDeterministic(t *testing.T) {
	m1, err := content.BuildFixtureManifest("baf9k")
	if err != nil {
		t.Fatalf("m1: %v", err)
	}
	m2, err := content.BuildFixtureManifest("baf9k")
	if err != nil {
		t.Fatalf("m2: %v", err)
	}
	if m1.CID != m2.CID {
		t.Fatalf("fixture CID not deterministic: %s vs %s", m1.CID, m2.CID)
	}
	if m1.Root != m2.Root {
		t.Fatalf("fixture root not deterministic: %s vs %s", m1.Root, m2.Root)
	}
}

func TestBuildFixtureManifestPassesVerify(t *testing.T) {
	m, err := content.BuildFixtureManifest("baf9k")
	if err != nil {
		t.Fatalf("BuildFixtureManifest: %v", err)
	}
	if err := m.Verify(); err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if m.SegmentCount != content.DefaultSegmentCount {
		t.Fatalf("segment_count = %d, want %d", m.SegmentCount, content.DefaultSegmentCount)
	}
}

func TestFixtureManifestLeafMatchesSegmentSHA256(t *testing.T) {
	const cid = "baf9k"
	m, err := content.BuildFixtureManifest(cid)
	if err != nil {
		t.Fatalf("BuildFixtureManifest: %v", err)
	}
	for i := 0; i < m.SegmentCount; i++ {
		leafFromManifest, err := m.LeafAt(i)
		if err != nil {
			t.Fatalf("LeafAt(%d): %v", i, err)
		}
		leafComputed := manifest.HashLeaf(content.FixtureBytes(cid, i, content.FixtureSegmentSize))
		if string(leafFromManifest) != string(leafComputed) {
			t.Fatalf("leaf %d mismatch: manifest=%x computed=%x", i, leafFromManifest, leafComputed)
		}
	}
}

func TestServeManifestReturnsExpectedShape(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/baf9k/manifest.json", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}

	parsed, err := manifest.ParseManifest(rec.Body.Bytes())
	if err != nil {
		t.Fatalf("ParseManifest: %v (body=%q)", err, rec.Body.String())
	}
	if err := parsed.Verify(); err != nil {
		t.Fatalf("Verify: %v", err)
	}

	etag := rec.Header().Get("ETag")
	if !strings.Contains(etag, parsed.CID) {
		t.Fatalf("ETag %q does not contain CID %q", etag, parsed.CID)
	}
	if got := rec.Header().Get("X-Aevia-Manifest-CID"); got != parsed.CID {
		t.Fatalf("X-Aevia-Manifest-CID = %q, want %q", got, parsed.CID)
	}
}

func TestServeManifestDifferentCIDsProduceDifferentManifests(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	fetch := func(cid string) *manifest.Manifest {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/content/"+cid+"/manifest.json", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status for %q = %d", cid, rec.Code)
		}
		m, err := manifest.ParseManifest(rec.Body.Bytes())
		if err != nil {
			t.Fatalf("parse %q: %v", cid, err)
		}
		return m
	}
	a := fetch("aaaaa")
	b := fetch("bbbbb")
	if a.CID == b.CID {
		t.Fatal("distinct CIDs produced identical manifests")
	}
}
