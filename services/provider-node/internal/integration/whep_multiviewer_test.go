package integration_test

import (
	"bytes"
	"context"
	"fmt"
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

// TestWhepMultiViewerFanout drives N concurrent WHEP viewers against a
// single WHIP publisher and asserts every one of them receives RTP.
// The existing TestWhepSFU covers a single viewer; this test adds the
// concurrency dimension that matches Leandro's 3-viewer QA session
// 2026-04-19 (creator + 2 viewers on the same live).
//
// Regressions this guards against:
//
//   (A) SFU hub forgets subscribers when a second viewer attaches
//       (races in EnsureHubFor / AddTrack ordering)
//   (B) WHEP answer SDP drops video m-line on the 2nd+ viewer
//   (C) `Location` header collisions break downstream resource
//       addressing (noted — see limitation at the bottom of the test)
//
// Limitation: the current WHEP server returns a LITERAL
// `Location: /whep/{sessionID}/viewer` for every POST — not a
// per-viewer UUID. This test verifies RTP fan-out is correct anyway,
// and logs a TODO so the Location spec-compliance work (per-viewer
// resource IDs, required for DELETE cleanup to work end-to-end) is
// visible. When per-viewer IDs land, promote the Location assertion
// below from a t.Log to a t.Errorf.
func TestWhepMultiViewerFanout(t *testing.T) {
	const numViewers = 3
	const minPackets = 25

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

	// Publisher: same shape as TestWhepSFU.
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
		"video", "aevia-multiviewer-test",
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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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

	// Wait for hub.
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

	// Spawn N concurrent viewers. Each gets its own PC and its own
	// independent WHEP handshake against the same sessionID.
	type viewer struct {
		idx       int
		pc        *webrtc.PeerConnection
		rtpCount  atomic.Int64
		location  string
		connected chan struct{}
	}

	viewers := make([]*viewer, numViewers)
	for i := 0; i < numViewers; i++ {
		viewers[i] = &viewer{idx: i, connected: make(chan struct{}, 1)}
	}

	var spawnWg sync.WaitGroup
	spawnWg.Add(numViewers)
	spawnErr := make(chan error, numViewers)

	for i := 0; i < numViewers; i++ {
		v := viewers[i]
		go func() {
			defer spawnWg.Done()
			me := &webrtc.MediaEngine{}
			if err := me.RegisterDefaultCodecs(); err != nil {
				spawnErr <- err
				return
			}
			api := webrtc.NewAPI(webrtc.WithMediaEngine(me))
			pc, err := api.NewPeerConnection(iceCfg)
			if err != nil {
				spawnErr <- err
				return
			}
			v.pc = pc
			t.Cleanup(func() { _ = pc.Close() })

			_, err = pc.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo,
				webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly})
			if err != nil {
				spawnErr <- err
				return
			}

			pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
				for {
					if _, _, err := track.ReadRTP(); err != nil {
						return
					}
					v.rtpCount.Add(1)
				}
			})
			pc.OnICEConnectionStateChange(func(s webrtc.ICEConnectionState) {
				if s == webrtc.ICEConnectionStateConnected || s == webrtc.ICEConnectionStateCompleted {
					select {
					case v.connected <- struct{}{}:
					default:
					}
				}
			})

			vOffer, err := pc.CreateOffer(nil)
			if err != nil {
				spawnErr <- err
				return
			}
			vGather := webrtc.GatheringCompletePromise(pc)
			if err := pc.SetLocalDescription(vOffer); err != nil {
				spawnErr <- err
				return
			}
			<-vGather

			whepReq, _ := http.NewRequestWithContext(ctx, http.MethodPost,
				httpSrv.URL+"/whep/"+sessionID,
				bytes.NewReader([]byte(pc.LocalDescription().SDP)))
			whepReq.Header.Set("Content-Type", "application/sdp")
			whepResp, err := http.DefaultClient.Do(whepReq)
			if err != nil {
				spawnErr <- err
				return
			}
			defer whepResp.Body.Close()
			if whepResp.StatusCode != http.StatusCreated {
				body, _ := io.ReadAll(whepResp.Body)
				spawnErr <- &viewerError{idx: v.idx, status: whepResp.StatusCode, body: string(body)}
				return
			}
			v.location = whepResp.Header.Get("Location")
			ansSDP, _ := io.ReadAll(whepResp.Body)

			if err := pc.SetRemoteDescription(webrtc.SessionDescription{
				Type: webrtc.SDPTypeAnswer, SDP: string(ansSDP),
			}); err != nil {
				spawnErr <- err
				return
			}
		}()
	}
	spawnWg.Wait()
	close(spawnErr)
	for e := range spawnErr {
		t.Fatalf("viewer spawn: %v", e)
	}

	// Wait for every viewer to connect.
	for _, v := range viewers {
		select {
		case <-v.connected:
		case <-time.After(12 * time.Second):
			t.Fatalf("viewer[%d] ICE did not connect within 12s (state=%s)",
				v.idx, v.pc.ICEConnectionState())
		}
	}

	// All viewers must receive RTP within 10s.
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		all := true
		for _, v := range viewers {
			if v.rtpCount.Load() < minPackets {
				all = false
				break
			}
		}
		if all {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	for _, v := range viewers {
		n := v.rtpCount.Load()
		if n < minPackets {
			t.Errorf("viewer[%d] received only %d RTP packets in 10s — SFU fan-out broken under N=%d concurrent viewers",
				v.idx, n, numViewers)
		} else {
			t.Logf("viewer[%d] received %d RTP packets", v.idx, n)
		}
	}

	// Location header inspection. Currently the server returns a
	// literal "/whep/{sessionID}/viewer" for all viewers — not
	// spec-compliant and breaks per-viewer DELETE cleanup. Log the
	// distinct count but do NOT fail yet; flip to t.Errorf when the
	// per-viewer UUID fix lands (TODO: provider-node whep.go:209).
	locationSet := make(map[string]int)
	for _, v := range viewers {
		locationSet[v.location]++
	}
	if len(locationSet) < numViewers {
		t.Logf("TODO: WHEP Location headers not unique across %d viewers — seen %d distinct. "+
			"Spec requires per-viewer resource URI; current impl breaks DELETE. "+
			"Fix in provider-node/internal/whep/whep.go line 209.",
			numViewers, len(locationSet))
	}
}

type viewerError struct {
	idx    int
	status int
	body   string
}

func (e *viewerError) Error() string {
	return fmt.Sprintf("viewer[%d] WHEP status=%d body=%s", e.idx, e.status, e.body)
}
