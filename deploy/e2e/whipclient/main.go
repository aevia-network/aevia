// whipclient — end-to-end WHIP smoke test against a running Aevia
// provider-node. Sends synthetic H.264 samples via pion, fetches the HLS
// playlist + fMP4 segments, and validates the byte shape.
//
// Exit code: 0 on success, 1 on any failure with diagnostic to stderr.
package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

func main() {
	whipURL := flag.String("whip-url", "http://127.0.0.1:8080/whip", "WHIP ingest endpoint")
	baseURL := flag.String("base-url", "http://127.0.0.1:8080", "HTTP base for /live + /healthz lookups")
	did := flag.String("did", "", "X-Aevia-DID header value (leave empty if auth disabled)")
	duration := flag.Duration("duration", 18*time.Second, "how long to stream before validating")
	requireSegment := flag.Bool("require-segment", true, "fail if segment 0 is missing")
	flag.Parse()

	if err := run(*whipURL, *baseURL, *did, *duration, *requireSegment); err != nil {
		fmt.Fprintf(os.Stderr, "whipclient: FAIL: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("whipclient: PASS")
}

func run(whipURL, baseURL, did string, duration time.Duration, requireSegment bool) error {
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return fmt.Errorf("register codecs: %w", err)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))

	pc, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return fmt.Errorf("new peer connection: %w", err)
	}
	defer pc.Close()

	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "aevia-e2e",
	)
	if err != nil {
		return fmt.Errorf("new track: %w", err)
	}
	if _, err := pc.AddTrack(track); err != nil {
		return fmt.Errorf("add track: %w", err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return fmt.Errorf("create offer: %w", err)
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		return fmt.Errorf("set local desc: %w", err)
	}
	<-gather

	sessionID, answerSDP, err := postWHIP(whipURL, did, pc.LocalDescription().SDP)
	if err != nil {
		return fmt.Errorf("POST /whip: %w", err)
	}
	fmt.Printf("whipclient: session %s established\n", sessionID)

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer, SDP: answerSDP,
	}); err != nil {
		return fmt.Errorf("set remote desc: %w", err)
	}
	// Wait for ICE to reach connected before streaming samples, otherwise
	// WriteSample bytes are dropped on the floor.
	if err := waitICEConnected(pc, 15*time.Second); err != nil {
		return fmt.Errorf("ICE: %w", err)
	}

	pumpCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pumpDone := make(chan struct{})
	go func() {
		defer close(pumpDone)
		pumpSamples(pumpCtx, track)
	}()

	time.Sleep(duration)
	cancel()
	<-pumpDone

	if err := checkPlaylist(baseURL, sessionID, requireSegment); err != nil {
		return err
	}
	if err := checkInit(baseURL, sessionID); err != nil {
		return err
	}
	if requireSegment {
		if err := checkSegment(baseURL, sessionID, 0); err != nil {
			return err
		}
	}
	return nil
}

// pumpSamples drives the track with synthetic H.264 access units. Each
// sample is a keyframe-or-P pair of NALs; we send a keyframe every 5
// seconds so the segmenter can cut a fMP4 boundary within the run.
func pumpSamples(ctx context.Context, track *webrtc.TrackLocalStaticSample) {
	const fps = 15
	frameDur := time.Second / fps
	tick := time.NewTicker(frameDur)
	defer tick.Stop()

	var frame uint64
	start := time.Now()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
		isKey := frame%(5*fps) == 0
		nal := buildNAL(isKey)
		_ = track.WriteSample(media.Sample{Data: nal, Duration: frameDur})
		frame++
		// Fail-safe: if we're still running well past 30s, stop anyway.
		if time.Since(start) > 60*time.Second {
			return
		}
	}
}

// buildNAL returns a minimal H.264 access unit with 4-byte start codes
// so pion's H.264 packetizer can split into RTP fragments correctly.
// On keyframes we include SPS + PPS + IDR; P-frames are a single slice
// stub. Content is invalid at the image level but well-formed at the
// NALU framing level — which is what the ingest pipeline inspects.
func buildNAL(keyframe bool) []byte {
	if keyframe {
		return []byte{
			0x00, 0x00, 0x00, 0x01,
			0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40,
			0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92,
			0x00, 0x00, 0x00, 0x01,
			0x68, 0xCE, 0x38, 0x80,
			0x00, 0x00, 0x00, 0x01,
			0x65, 0x88, 0x82, 0x00, 0x00,
		}
	}
	return []byte{
		0x00, 0x00, 0x00, 0x01,
		0x41, 0x9A, 0x00, 0x00, 0x00,
	}
}

func postWHIP(url, did, sdp string) (string, string, error) {
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(sdp))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/sdp")
	if did != "" {
		req.Header.Set("X-Aevia-DID", did)
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated {
		return "", "", fmt.Errorf("status=%d body=%s", resp.StatusCode, body)
	}
	id := resp.Header.Get("X-Aevia-Session-ID")
	if id == "" {
		return "", "", fmt.Errorf("no X-Aevia-Session-ID header")
	}
	return id, string(body), nil
}

func waitICEConnected(pc *webrtc.PeerConnection, timeout time.Duration) error {
	connected := make(chan struct{}, 1)
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		if state == webrtc.ICEConnectionStateConnected || state == webrtc.ICEConnectionStateCompleted {
			select {
			case connected <- struct{}{}:
			default:
			}
		}
	})
	if s := pc.ICEConnectionState(); s == webrtc.ICEConnectionStateConnected || s == webrtc.ICEConnectionStateCompleted {
		return nil
	}
	select {
	case <-connected:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("ICE not connected after %s (state=%s)", timeout, pc.ICEConnectionState())
	}
}

func checkPlaylist(baseURL, sessionID string, requireSegment bool) error {
	url := fmt.Sprintf("%s/live/%s/playlist.m3u8", baseURL, sessionID)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("GET playlist: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("playlist status=%d body=%s", resp.StatusCode, body)
	}
	text := string(body)
	if !strings.Contains(text, "#EXTM3U") {
		return fmt.Errorf("playlist missing #EXTM3U: %q", text)
	}
	if !strings.Contains(text, "#EXT-X-MAP:URI=") {
		return fmt.Errorf("playlist missing #EXT-X-MAP: %q", text)
	}
	if requireSegment && !strings.Contains(text, "/segment/0") {
		return fmt.Errorf("playlist missing /segment/0 entry: %q", text)
	}
	fmt.Printf("whipclient: playlist ok (%d bytes)\n", len(body))
	return nil
}

func checkInit(baseURL, sessionID string) error {
	url := fmt.Sprintf("%s/live/%s/init.mp4", baseURL, sessionID)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("GET init: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("init status=%d body=%s", resp.StatusCode, string(body))
	}
	if !hasFtyp(body) {
		return fmt.Errorf("init.mp4 has no ftyp box (first 16 bytes: %x)", body[:min(16, len(body))])
	}
	fmt.Printf("whipclient: init.mp4 ok (%d bytes, ftyp present)\n", len(body))
	return nil
}

func checkSegment(baseURL, sessionID string, idx int) error {
	url := fmt.Sprintf("%s/live/%s/segment/%d", baseURL, sessionID, idx)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("GET segment %d: %w", idx, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("segment %d status=%d body=%s", idx, resp.StatusCode, string(body))
	}
	if !hasStyp(body) {
		return fmt.Errorf("segment %d has no styp box (first 16 bytes: %x)", idx, body[:min(16, len(body))])
	}
	fmt.Printf("whipclient: segment %d ok (%d bytes, styp present)\n", idx, len(body))
	return nil
}

// hasFtyp checks whether the first MP4 box in b is "ftyp" (required by
// fMP4 init segments per ISO/IEC 14496-12).
func hasFtyp(b []byte) bool {
	if len(b) < 8 {
		return false
	}
	return bytes.Equal(b[4:8], []byte("ftyp"))
}

// hasStyp checks for a "styp" box anywhere in the first 64 bytes — CMAF
// media segments per ISO/IEC 23000-19 start with styp.
func hasStyp(b []byte) bool {
	limit := 64
	if len(b) < limit {
		limit = len(b)
	}
	return bytes.Contains(b[:limit], []byte("styp"))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
