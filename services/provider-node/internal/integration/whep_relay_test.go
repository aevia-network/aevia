package integration_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pion/rtp"
	webrtc "github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whep"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// TestWhepSFU exercises the full WHIP→hub→WHEP fan-out path. A creator
// publishes synthetic RTP; a viewer subscribes via /whep/{sessionID}
// and we assert at least 30 RTP packets egress within 10s — enough to
// catch any plumbing regression (TeeReadTrack misses writes, hub
// disconnects on AddTrack, SDP negotiation loses video m-line, etc).
func TestWhepSFU(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := storage.Open(storage.Options{Path: tmpDir, Silent: true})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	cs := pinning.NewContentStore(store)

	whipSrv, err := whip.NewServer(whip.Options{})
	if err != nil {
		t.Fatalf("whip.NewServer: %v", err)
	}
	liveRouter := whip.NewLiveRouter()

	whipSrv.OnSession(func(sess *whip.Session) {
		sink, err := whip.NewLivePinSink(cs, sess.ID)
		if err != nil {
			t.Errorf("NewLivePinSink: %v", err)
			return
		}
		seg, err := whip.NewCMAFSegmenter(sink)
		if err != nil {
			t.Errorf("NewCMAFSegmenter: %v", err)
			return
		}
		_ = liveRouter.AttachSession(sess.ID, sink)
		sess.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
			hub, err := sess.EnsureHubFor(track)
			if err != nil {
				t.Errorf("EnsureHubFor: %v", err)
				return
			}
			go func() { _ = whip.TeeReadTrack(track, hub, seg) }()
		})
	})

	whepSrv, err := whep.New(whep.Options{WhipServer: whipSrv})
	if err != nil {
		t.Fatalf("whep.New: %v", err)
	}

	mux := http.NewServeMux()
	whipSrv.Register(mux)
	liveRouter.Register(mux)
	whepSrv.Register(mux)

	httpSrv := httptest.NewServer(mux)
	t.Cleanup(httpSrv.Close)

	// Creator PC — publishes an H.264 track.
	creatorME := &webrtc.MediaEngine{}
	if err := creatorME.RegisterDefaultCodecs(); err != nil {
		t.Fatalf("creator codecs: %v", err)
	}
	creatorAPI := webrtc.NewAPI(webrtc.WithMediaEngine(creatorME))
	iceCfg := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
	}
	creatorPC, err := creatorAPI.NewPeerConnection(iceCfg)
	if err != nil {
		t.Fatalf("creator pc: %v", err)
	}
	t.Cleanup(func() { _ = creatorPC.Close() })

	pubTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000},
		"video", "aevia-whep-test",
	)
	if err != nil {
		t.Fatalf("pub track: %v", err)
	}
	if _, err := creatorPC.AddTrack(pubTrack); err != nil {
		t.Fatalf("add pub track: %v", err)
	}

	offer, err := creatorPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("create offer: %v", err)
	}
	gather := webrtc.GatheringCompletePromise(creatorPC)
	if err := creatorPC.SetLocalDescription(offer); err != nil {
		t.Fatalf("set local desc: %v", err)
	}
	<-gather

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, httpSrv.URL+"/whip",
		bytes.NewReader([]byte(creatorPC.LocalDescription().SDP)))
	req.Header.Set("Content-Type", "application/sdp")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /whip: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("WHIP status=%d body=%s", resp.StatusCode, body)
	}
	sessionID := resp.Header.Get("X-Aevia-Session-ID")
	answerSDP, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	_ = creatorPC.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer, SDP: string(answerSDP),
	})

	// Synthetic publisher — write raw RTP packets into pubTrack. These
	// bytes don't need to decode, they only need to flow end-to-end.
	stopPub := make(chan struct{})
	var pubWg sync.WaitGroup
	pubWg.Add(1)
	go func() {
		defer pubWg.Done()
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		seq := uint16(1)
		ts := uint32(1)
		for {
			select {
			case <-stopPub:
				return
			case <-ticker.C:
				pkt := &rtp.Packet{
					Header: rtp.Header{
						Version:        2,
						PayloadType:    96,
						SequenceNumber: seq,
						Timestamp:      ts,
						SSRC:           0xC0FFEE,
					},
					Payload: []byte{0x41, 0x9A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00},
				}
				_ = pubTrack.WriteRTP(pkt)
				seq++
				ts += 3000
			}
		}
	}()
	t.Cleanup(func() {
		close(stopPub)
		pubWg.Wait()
	})

	// Wait for hub to materialise — it appears once the first RTP
	// packet arrives at the remote track's ReadRTP loop.
	var hubReady bool
	for i := 0; i < 50; i++ {
		sess, err := whipSrv.GetSession(sessionID)
		if err == nil && sess.VideoHub() != nil {
			hubReady = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !hubReady {
		t.Fatalf("video hub never appeared for session %s", sessionID)
	}

	// Viewer PC — subscribe via WHEP.
	viewerME := &webrtc.MediaEngine{}
	if err := viewerME.RegisterDefaultCodecs(); err != nil {
		t.Fatalf("viewer codecs: %v", err)
	}
	viewerAPI := webrtc.NewAPI(webrtc.WithMediaEngine(viewerME))
	viewerPC, err := viewerAPI.NewPeerConnection(iceCfg)
	if err != nil {
		t.Fatalf("viewer pc: %v", err)
	}
	t.Cleanup(func() { _ = viewerPC.Close() })

	_, err = viewerPC.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionRecvonly,
	})
	if err != nil {
		t.Fatalf("viewer add transceiver: %v", err)
	}

	var rtpCount atomic.Int64
	viewerPC.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		for {
			if _, _, err := track.ReadRTP(); err != nil {
				return
			}
			rtpCount.Add(1)
		}
	})

	vOffer, err := viewerPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("viewer offer: %v", err)
	}
	vGather := webrtc.GatheringCompletePromise(viewerPC)
	if err := viewerPC.SetLocalDescription(vOffer); err != nil {
		t.Fatalf("viewer set local: %v", err)
	}
	<-vGather

	whepReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, httpSrv.URL+"/whep/"+sessionID,
		bytes.NewReader([]byte(viewerPC.LocalDescription().SDP)))
	whepReq.Header.Set("Content-Type", "application/sdp")
	whepResp, err := http.DefaultClient.Do(whepReq)
	if err != nil {
		t.Fatalf("POST /whep: %v", err)
	}
	defer whepResp.Body.Close()
	if whepResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(whepResp.Body)
		t.Fatalf("WHEP status=%d body=%s", whepResp.StatusCode, body)
	}
	whepAnswerSDP, _ := io.ReadAll(whepResp.Body)
	iceConnected := make(chan struct{}, 1)
	viewerPC.OnICEConnectionStateChange(func(s webrtc.ICEConnectionState) {
		if s == webrtc.ICEConnectionStateConnected || s == webrtc.ICEConnectionStateCompleted {
			select {
			case iceConnected <- struct{}{}:
			default:
			}
		}
	})
	if err := viewerPC.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer, SDP: string(whepAnswerSDP),
	}); err != nil {
		t.Fatalf("viewer set remote: %v", err)
	}
	select {
	case <-iceConnected:
	case <-time.After(12 * time.Second):
		t.Fatalf("viewer ICE did not connect within 12s (state=%s)", viewerPC.ICEConnectionState())
	}

	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if rtpCount.Load() >= 30 {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	n := rtpCount.Load()
	if n < 30 {
		t.Fatalf("WHEP viewer received only %d RTP packets in 10s — SFU fan-out broken", n)
	}
	t.Logf("WHEP SFU fan-out green: viewer received %d RTP packets", n)
}
