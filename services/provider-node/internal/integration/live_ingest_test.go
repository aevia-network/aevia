package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// TestLiveIngestEndToEnd is the flagship M8 proof — it binds every M8
// component into one process and validates the ingest → segment → pin →
// serve pipeline without Cloudflare Stream.
//
// Topology:
//   - whip.Server accepts WHIP on /whip.
//   - whip.LiveRouter exposes HLS playlist + init + segments under /live.
//   - An OnSession callback wires each new session to a CMAFSegmenter
//     backed by a LivePinSink. Frames are injected synthetically here
//     to keep the test deterministic; the RTP→frame path is covered
//     separately by frames_test.go.
//   - A pion PeerConnection (the "creator") performs a real SDP handshake.
//
// Assertions:
//   1. POST /whip returns 201 with a valid SDP answer.
//   2. OnSession fires; we can attach the pipeline synchronously.
//   3. After injecting synthetic H.264 frames, segments are pinned.
//   4. GET /live/{id}/playlist.m3u8 returns a well-formed HLS playlist
//      listing the expected number of segments.
//   5. GET /live/{id}/init.mp4 returns fMP4 init bytes.
//   6. GET /live/{id}/segment/0 returns media segment bytes.
//   7. LivePinSink.Finalize() produces a verifiable manifest and the
//      content re-emerges under its canonical CID in ContentStore.
//
// When this test passes, Cloudflare Stream has a provable drop-in Go
// replacement for ingest + HLS playback.
func TestLiveIngestEndToEnd(t *testing.T) {
	store, err := storage.Open(storage.Options{Silent: true})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	contentStore := pinning.NewContentStore(store)

	whipServer, err := whip.NewServer(whip.Options{})
	if err != nil {
		t.Fatalf("whip.NewServer: %v", err)
	}
	liveRouter := whip.NewLiveRouter()

	// sinks captures the pipeline each session gets, keyed by sessionID.
	sinks := struct {
		sync.Mutex
		bySession map[string]*whip.LivePinSink
		segs      map[string]*whip.CMAFSegmenter
	}{
		bySession: make(map[string]*whip.LivePinSink),
		segs:      make(map[string]*whip.CMAFSegmenter),
	}

	whipServer.OnSession(func(sess *whip.Session) {
		sink, err := whip.NewLivePinSink(contentStore, sess.ID)
		if err != nil {
			t.Errorf("NewLivePinSink: %v", err)
			return
		}
		seg, err := whip.NewCMAFSegmenter(sink)
		if err != nil {
			t.Errorf("NewCMAFSegmenter: %v", err)
			return
		}
		if err := liveRouter.AttachSession(sess.ID, sink); err != nil {
			t.Errorf("AttachSession: %v", err)
			return
		}
		sinks.Lock()
		sinks.bySession[sess.ID] = sink
		sinks.segs[sess.ID] = seg
		sinks.Unlock()
	})

	mux := http.NewServeMux()
	whipServer.Register(mux)
	liveRouter.Register(mux)

	httpSrv := httptest.NewServer(mux)
	t.Cleanup(httpSrv.Close)

	// --- Creator (pion PeerConnection) performs WHIP handshake --------
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		t.Fatalf("creator RegisterDefaultCodecs: %v", err)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))
	pc, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("creator NewPeerConnection: %v", err)
	}
	t.Cleanup(func() { _ = pc.Close() })

	track, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "video", "aevia-e2e")
	if err != nil {
		t.Fatalf("NewTrackLocalStaticRTP: %v", err)
	}
	if _, err := pc.AddTrack(track); err != nil {
		t.Fatalf("AddTrack: %v", err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("CreateOffer: %v", err)
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatalf("SetLocalDescription: %v", err)
	}
	<-gather

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, httpSrv.URL+"/whip",
		bytes.NewReader([]byte(pc.LocalDescription().SDP)))
	req.Header.Set("Content-Type", "application/sdp")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /whip: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("WHIP status = %d, body=%s", resp.StatusCode, body)
	}
	sessionID := resp.Header.Get("X-Aevia-Session-ID")
	if sessionID == "" {
		t.Fatal("X-Aevia-Session-ID empty")
	}

	// Consume the answer so pion doesn't complain.
	answerBody, _ := io.ReadAll(resp.Body)
	_ = pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer, SDP: string(answerBody),
	})

	// --- Verify pipeline wired and inject synthetic H.264 frames -----
	sinks.Lock()
	seg := sinks.segs[sessionID]
	sinks.Unlock()
	if seg == nil {
		t.Fatal("pipeline not wired: no segmenter for session")
	}

	// Drive the segmenter with synthetic keyframes spaced 6s+ apart.
	// Need valid SPS/PPS/IDR bundles so the fMP4 init segment emits.
	spsPpsIDR := []byte{
		0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40,
		0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92,
		0x00, 0x00, 0x00, 0x01,
		0x68, 0xCE, 0x38, 0x80,
		0x00, 0x00, 0x00, 0x01,
		0x65, 0x88, 0x82, 0x00, 0x00,
	}
	const vt = whip.VideoTimescale
	// Segment 0: keyframe @ t=0, P-frames, next keyframe @ t=6s triggers flush
	seg.OnVideoFrame(whip.VideoFrame{NAL: spsPpsIDR, Timestamp: 0, Keyframe: true})
	for i := uint32(1); i <= 5; i++ {
		seg.OnVideoFrame(whip.VideoFrame{
			NAL: []byte{0x41, 0x9A, 0x00, 0x00, 0x00}, Timestamp: i * (vt / 2),
		})
	}
	seg.OnVideoFrame(whip.VideoFrame{NAL: spsPpsIDR, Timestamp: 6 * vt, Keyframe: true})
	// Segment 1: a few P-frames, then close with final flush.
	for i := uint32(1); i <= 3; i++ {
		seg.OnVideoFrame(whip.VideoFrame{
			NAL: []byte{0x41, 0x9A, 0x00, 0x00, 0x00}, Timestamp: 6*vt + i*(vt/2),
		})
	}
	if err := seg.Close(); err != nil {
		t.Fatalf("segmenter Close: %v", err)
	}

	if got := seg.TotalSegments(); got != 2 {
		t.Fatalf("segmenter TotalSegments = %d, want 2", got)
	}

	// --- Viewer fetches playlist + segments via HTTP -----------------
	playlistURL := httpSrv.URL + "/live/" + sessionID + "/playlist.m3u8"
	plResp, err := http.Get(playlistURL)
	if err != nil {
		t.Fatalf("GET playlist: %v", err)
	}
	defer plResp.Body.Close()
	if plResp.StatusCode != http.StatusOK {
		t.Fatalf("playlist status = %d", plResp.StatusCode)
	}
	plBody, _ := io.ReadAll(plResp.Body)
	plText := string(plBody)
	if !strings.Contains(plText, "#EXTM3U") {
		t.Fatalf("playlist missing #EXTM3U: %q", plText)
	}
	if !strings.Contains(plText, "/segment/0") || !strings.Contains(plText, "/segment/1") {
		t.Fatalf("playlist missing expected segments:\n%s", plText)
	}

	initResp, err := http.Get(httpSrv.URL + "/live/" + sessionID + "/init.mp4")
	if err != nil {
		t.Fatalf("GET init: %v", err)
	}
	defer initResp.Body.Close()
	if initResp.StatusCode != http.StatusOK {
		t.Fatalf("init status = %d", initResp.StatusCode)
	}
	initBytes, _ := io.ReadAll(initResp.Body)
	if len(initBytes) < 100 {
		t.Fatalf("init segment suspiciously small: %d bytes", len(initBytes))
	}
	if initResp.Header.Get("Content-Type") != "video/mp4" {
		t.Fatalf("init Content-Type = %q", initResp.Header.Get("Content-Type"))
	}

	segResp, err := http.Get(httpSrv.URL + "/live/" + sessionID + "/segment/0")
	if err != nil {
		t.Fatalf("GET segment 0: %v", err)
	}
	defer segResp.Body.Close()
	if segResp.StatusCode != http.StatusOK {
		t.Fatalf("segment 0 status = %d", segResp.StatusCode)
	}
	segBytes, _ := io.ReadAll(segResp.Body)
	if len(segBytes) < 100 {
		t.Fatalf("segment 0 suspiciously small: %d bytes", len(segBytes))
	}

	// --- Finalize: the session becomes a canonical VOD -----------------
	sinks.Lock()
	sink := sinks.bySession[sessionID]
	sinks.Unlock()

	manifest, err := sink.Finalize(whip.TargetSegmentDuration)
	if err != nil {
		t.Fatalf("Finalize: %v", err)
	}
	if err := manifest.Verify(); err != nil {
		t.Fatalf("finalized manifest Verify: %v", err)
	}
	if manifest.SegmentCount != 2 {
		t.Fatalf("finalized SegmentCount = %d, want 2", manifest.SegmentCount)
	}

	// Content is now queryable under its canonical CID (M5 path).
	storedSeg0, err := contentStore.GetSegment(manifest.CID, 0)
	if err != nil {
		t.Fatalf("GetSegment(canonical CID): %v", err)
	}
	if !bytes.Equal(storedSeg0, segBytes) {
		t.Fatal("canonical VOD segment differs from live HLS segment")
	}

	// --- Silence unused variable (json import avoidance) ---------------
	_ = json.Marshal
}
