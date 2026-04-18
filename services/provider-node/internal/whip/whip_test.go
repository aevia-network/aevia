package whip_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

func TestNewServerSmoke(t *testing.T) {
	s, err := whip.NewServer(whip.Options{})
	if err != nil {
		t.Fatalf("NewServer: %v", err)
	}
	if len(s.ActiveSessions()) != 0 {
		t.Fatalf("fresh server has %d sessions, want 0", len(s.ActiveSessions()))
	}
}

func TestHandleIngestRejectsWrongContentType(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{})
	mux := http.NewServeMux()
	s.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/whip", strings.NewReader("hello"))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
}

func TestHandleIngestRejectsEmptyBody(t *testing.T) {
	s, _ := whip.NewServer(whip.Options{})
	mux := http.NewServeMux()
	s.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/whip", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/sdp")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

// TestWHIPFullHandshakeWithPionClient is the first empirical proof that
// the server speaks the WHIP protocol: a real pion PeerConnection acting
// as the creator generates a valid SDP offer, POSTs it at the server,
// and the server replies with an answer our client accepts.
func TestWHIPFullHandshakeWithPionClient(t *testing.T) {
	server, err := whip.NewServer(whip.Options{})
	if err != nil {
		t.Fatalf("NewServer: %v", err)
	}
	mux := http.NewServeMux()
	server.Register(mux)
	httpTestServer := httptest.NewServer(mux)
	t.Cleanup(httpTestServer.Close)

	// Build a pion PeerConnection that acts as the WHIP client (creator).
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		t.Fatalf("creator RegisterDefaultCodecs: %v", err)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))
	clientPC, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("creator NewPeerConnection: %v", err)
	}
	t.Cleanup(func() { _ = clientPC.Close() })

	// Add a video track so the offer includes an m=video line — realistic
	// minimum for a WHIP creator.
	track, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "video", "aevia-e2e")
	if err != nil {
		t.Fatalf("NewTrackLocalStaticRTP: %v", err)
	}
	if _, err := clientPC.AddTrack(track); err != nil {
		t.Fatalf("AddTrack: %v", err)
	}

	offer, err := clientPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("CreateOffer: %v", err)
	}
	gather := webrtc.GatheringCompletePromise(clientPC)
	if err := clientPC.SetLocalDescription(offer); err != nil {
		t.Fatalf("SetLocalDescription: %v", err)
	}
	<-gather
	offerSDP := clientPC.LocalDescription().SDP

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, httpTestServer.URL+"/whip", bytes.NewReader([]byte(offerSDP)))
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.Header.Set("Content-Type", "application/sdp")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /whip: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	if resp.Header.Get("Content-Type") != "application/sdp" {
		t.Fatalf("Content-Type = %q, want application/sdp", resp.Header.Get("Content-Type"))
	}
	if loc := resp.Header.Get("Location"); !strings.HasPrefix(loc, "/whip/") {
		t.Fatalf("Location header = %q, want /whip/ prefix", loc)
	}
	if sessID := resp.Header.Get("X-Aevia-Session-ID"); sessID == "" {
		t.Fatal("X-Aevia-Session-ID empty")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read answer: %v", err)
	}
	if !strings.Contains(string(body), "v=0") {
		t.Fatalf("answer body does not look like SDP: %q", body)
	}

	// Apply the answer on the creator side — a genuinely-valid answer is
	// the strongest proof the server spoke WHIP correctly.
	answer := webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: string(body)}
	if err := clientPC.SetRemoteDescription(answer); err != nil {
		t.Fatalf("SetRemoteDescription(answer): %v", err)
	}

	// Session should now be in server's active list.
	if active := server.ActiveSessions(); len(active) != 1 {
		t.Fatalf("active sessions = %d, want 1", len(active))
	}
}
