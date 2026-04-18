package httpx_test

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestHealthzIncludesGeo covers Fase 1.1 server-side plumbing:
// WithRegion + WithGeo options surface on /healthz JSON so viewers
// can rank providers geographically.
func TestHealthzIncludesGeo(t *testing.T) {
	h := newHost(t)
	srv := httpx.NewServer(h,
		httpx.WithRegion("BR-SP"),
		httpx.WithGeo(-23.55, -46.63),
	)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ServeHTTPOn(ctx, ln) }()

	// give the server a beat to come up
	time.Sleep(50 * time.Millisecond)

	resp, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var health struct {
		Status string   `json:"status"`
		PeerID string   `json:"peer_id"`
		Region string   `json:"region"`
		Lat    *float64 `json:"lat"`
		Lng    *float64 `json:"lng"`
	}
	if err := json.Unmarshal(body, &health); err != nil {
		t.Fatalf("decode: %v\nbody=%s", err, body)
	}
	if health.Status != "ok" {
		t.Fatalf("status=%s", health.Status)
	}
	if health.Region != "BR-SP" {
		t.Fatalf("region=%q want BR-SP", health.Region)
	}
	if health.Lat == nil || *health.Lat != -23.55 {
		t.Fatalf("lat=%v want -23.55", health.Lat)
	}
	if health.Lng == nil || *health.Lng != -46.63 {
		t.Fatalf("lng=%v want -46.63", health.Lng)
	}
}

// TestHealthzOmitsGeoWhenUnset ensures the healthz response doesn't
// leak empty region or null lat/lng when the options weren't passed.
func TestHealthzOmitsGeoWhenUnset(t *testing.T) {
	h := newHost(t)
	srv := httpx.NewServer(h)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = srv.ServeHTTPOn(ctx, ln) }()
	time.Sleep(50 * time.Millisecond)

	resp, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Fields with `omitempty` should be absent in the wire bytes.
	if contains(body, "\"region\"") {
		t.Fatalf("unset region leaked to response: %s", body)
	}
	if contains(body, "\"lat\"") || contains(body, "\"lng\"") {
		t.Fatalf("unset geo leaked to response: %s", body)
	}
}

func contains(body []byte, needle string) bool {
	for i := 0; i+len(needle) <= len(body); i++ {
		if string(body[i:i+len(needle)]) == needle {
			return true
		}
	}
	return false
}
