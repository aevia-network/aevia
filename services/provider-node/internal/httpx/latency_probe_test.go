package httpx_test

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestLatencyProbeHEADReturnsTimings locks the wire contract that the
// frontend RTT library (and mirror hop tracker in Fase 2.1) depends on.
//
// Contract:
//   - HEAD /latency-probe returns 204 No Content
//   - Server-Timing header carries two monotonic-wall-clock ns values:
//     server_recv_ns (when handler ran) and server_send_ns (just before flush)
//   - server_send_ns >= server_recv_ns
func TestLatencyProbeHEADReturnsTimings(t *testing.T) {
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

	req, err := http.NewRequest(http.MethodHead, "http://"+ln.Addr().String()+"/latency-probe", nil)
	if err != nil {
		t.Fatalf("build req: %v", err)
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("HEAD: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status=%d want 204", resp.StatusCode)
	}
	st := resp.Header.Get("Server-Timing")
	if st == "" {
		t.Fatalf("Server-Timing header missing")
	}
	recvNS, sendNS := parseServerTiming(t, st)
	if recvNS == 0 || sendNS == 0 {
		t.Fatalf("timings zero: recv=%d send=%d", recvNS, sendNS)
	}
	if sendNS < recvNS {
		t.Fatalf("send %d before recv %d", sendNS, recvNS)
	}
	// sanity — should be recent (within 10 seconds of now)
	now := time.Now().UnixNano()
	if recvNS < now-10*int64(time.Second) || recvNS > now+int64(time.Second) {
		t.Fatalf("recv timestamp out of range: %d vs now=%d", recvNS, now)
	}
}

// TestLatencyProbeGETAlsoWorks covers the /trust grafo path which uses
// GET (fetch default). Shape identical to HEAD.
func TestLatencyProbeGETAlsoWorks(t *testing.T) {
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

	resp, err := http.Get("http://" + ln.Addr().String() + "/latency-probe")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status=%d want 204", resp.StatusCode)
	}
	if resp.Header.Get("Server-Timing") == "" {
		t.Fatalf("Server-Timing header missing on GET")
	}
}

func parseServerTiming(t *testing.T, v string) (recvNS, sendNS int64) {
	t.Helper()
	for _, metric := range strings.Split(v, ",") {
		parts := strings.Split(strings.TrimSpace(metric), ";")
		if len(parts) == 0 {
			continue
		}
		name := parts[0]
		var dur string
		for _, p := range parts[1:] {
			p = strings.TrimSpace(p)
			if strings.HasPrefix(p, "dur=") {
				dur = strings.TrimPrefix(p, "dur=")
			}
		}
		if dur == "" {
			continue
		}
		n, err := strconv.ParseInt(dur, 10, 64)
		if err != nil {
			continue
		}
		switch name {
		case "server_recv_ns":
			recvNS = n
		case "server_send_ns":
			sendNS = n
		}
	}
	return recvNS, sendNS
}
