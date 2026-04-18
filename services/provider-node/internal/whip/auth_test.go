package whip_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

func TestAuthEmptyAllowlistAcceptsAll(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{})
	mux := http.NewServeMux()
	s.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/whip", strings.NewReader("v=0"))
	req.Header.Set("Content-Type", "application/sdp")
	// No X-Aevia-DID header — should be accepted because allowlist empty.
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// 500 is fine here (pion fails on bogus SDP) — we only want to assert
	// it's NOT 401 (the auth rejection path).
	if rec.Code == http.StatusUnauthorized {
		t.Fatalf("auth disabled but got 401")
	}
}

func TestAuthRejectsUnknownDID(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{
		AuthorisedDIDs: []string{"did:pkh:eip155:8453:0xabc"},
	})
	mux := http.NewServeMux()
	s.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/whip", strings.NewReader("v=0"))
	req.Header.Set("Content-Type", "application/sdp")
	req.Header.Set("X-Aevia-DID", "did:pkh:eip155:8453:0xwrong")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestAuthAcceptsListedDID(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{
		AuthorisedDIDs: []string{"did:pkh:eip155:8453:0xabc"},
	})
	mux := http.NewServeMux()
	s.Register(mux)

	// Build a real SDP via pion so the request progresses past the
	// auth gate — otherwise it fails at SDP parse.
	me := &webrtc.MediaEngine{}
	_ = me.RegisterDefaultCodecs()
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me))
	pc, _ := api.NewPeerConnection(webrtc.Configuration{})
	defer pc.Close()
	track, _ := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "v", "s")
	_, _ = pc.AddTrack(track)
	offer, _ := pc.CreateOffer(nil)
	gather := webrtc.GatheringCompletePromise(pc)
	_ = pc.SetLocalDescription(offer)
	<-gather

	httpSrv := httptest.NewServer(mux)
	defer httpSrv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, httpSrv.URL+"/whip", bytes.NewReader([]byte(pc.LocalDescription().SDP)))
	req.Header.Set("Content-Type", "application/sdp")
	req.Header.Set("X-Aevia-DID", "did:pkh:eip155:8453:0xabc")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want 201; body=%s", resp.StatusCode, body)
	}
}

// TestOnSessionCallbackFires proves the pipeline wiring happens. On
// new-session, registered callbacks are invoked with the Session handle
// before the SDP answer returns.
func TestOnSessionCallbackFires(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{})
	var fired atomic.Int32
	var capturedID atomic.Value
	s.OnSession(func(sess *whip.Session) {
		fired.Add(1)
		capturedID.Store(sess.ID)
	})
	mux := http.NewServeMux()
	s.Register(mux)
	httpSrv := httptest.NewServer(mux)
	defer httpSrv.Close()

	me := &webrtc.MediaEngine{}
	_ = me.RegisterDefaultCodecs()
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me))
	pc, _ := api.NewPeerConnection(webrtc.Configuration{})
	defer pc.Close()
	track, _ := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "v", "s")
	_, _ = pc.AddTrack(track)
	offer, _ := pc.CreateOffer(nil)
	gather := webrtc.GatheringCompletePromise(pc)
	_ = pc.SetLocalDescription(offer)
	<-gather

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, httpSrv.URL+"/whip", bytes.NewReader([]byte(pc.LocalDescription().SDP)))
	req.Header.Set("Content-Type", "application/sdp")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	if fired.Load() != 1 {
		t.Fatalf("OnSession fired %d times, want 1", fired.Load())
	}
	if capturedID.Load() == nil || capturedID.Load().(string) == "" {
		t.Fatal("session ID not captured")
	}
}
