package httpx_test

import (
	"context"
	"io"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/httpx"
)

// TestShutdownWaitsForInflightRequest proves that Shutdown does not drop
// a request currently being served. We register a slow handler, kick off a
// request, then trigger Shutdown while the handler is still running. The
// expected behavior: Shutdown waits, the handler completes, the client
// receives the full body, and Shutdown returns nil.
func TestShutdownWaitsForInflightRequest(t *testing.T) {
	serverHost := newHost(t)
	srv := httpx.NewServer(serverHost)

	// Slow handler: sleeps 300ms before responding.
	handlerStarted := make(chan struct{})
	srv.HandleFunc("GET /slow", func(w http.ResponseWriter, _ *http.Request) {
		close(handlerStarted)
		time.Sleep(300 * time.Millisecond)
		_, _ = w.Write([]byte("ok"))
	})

	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	addr := tcpListener.Addr().String()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.ServeHTTPOn(ctx, tcpListener) }()
	time.Sleep(50 * time.Millisecond)

	// Kick off the slow request.
	var clientBody []byte
	var clientErr error
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := http.Get("http://" + addr + "/slow")
		if err != nil {
			clientErr = err
			return
		}
		defer resp.Body.Close()
		clientBody, clientErr = io.ReadAll(resp.Body)
	}()

	// Wait for handler to start, then trigger Shutdown.
	select {
	case <-handlerStarted:
	case <-time.After(1 * time.Second):
		t.Fatal("handler never started")
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer shutdownCancel()
	start := time.Now()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	dur := time.Since(start)

	wg.Wait()
	if clientErr != nil {
		t.Fatalf("client error: %v", clientErr)
	}
	if string(clientBody) != "ok" {
		t.Fatalf("client body = %q, want ok", clientBody)
	}
	if dur < 200*time.Millisecond {
		t.Fatalf("Shutdown returned in %v — faster than handler could finish", dur)
	}
	if dur > 1*time.Second {
		t.Fatalf("Shutdown took %v — too slow, should be ~300ms", dur)
	}
}

// TestShutdownHonorsContextDeadline ensures Shutdown returns promptly when
// its context deadline expires, even if handlers are still running.
func TestShutdownHonorsContextDeadline(t *testing.T) {
	serverHost := newHost(t)
	srv := httpx.NewServer(serverHost)

	srv.HandleFunc("GET /stubborn", func(_ http.ResponseWriter, _ *http.Request) {
		// Handler that refuses to finish within the test's patience window.
		time.Sleep(5 * time.Second)
	})

	tcpListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	addr := tcpListener.Addr().String()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = srv.ServeHTTPOn(ctx, tcpListener) }()
	time.Sleep(50 * time.Millisecond)

	// Fire-and-forget a slow request so Shutdown has something to wait on.
	go func() {
		_, _ = http.Get("http://" + addr + "/stubborn")
	}()
	time.Sleep(50 * time.Millisecond)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer shutdownCancel()

	start := time.Now()
	err = srv.Shutdown(shutdownCtx)
	dur := time.Since(start)

	if err != context.DeadlineExceeded {
		t.Fatalf("Shutdown err = %v, want context.DeadlineExceeded", err)
	}
	if dur > 500*time.Millisecond {
		t.Fatalf("Shutdown took %v — should have returned near the 200ms deadline", dur)
	}
}
