package integration_test

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
	"github.com/Leeaandrob/aevia/services/provider-node/storage"
)

// TestLLHLSPartialSegments exercises the Fase 0.3 plumbing end-to-end:
//
//  1. synthetic H.264 frames drive the segmenter for ~4s
//  2. at least one OnMediaPart fires on LivePinSink
//  3. playlist.m3u8 emits the LL-HLS tags
//     (EXT-X-VERSION:9, EXT-X-PART-INF, EXT-X-PART entries)
//  4. GET /live/{id}/segment/{n}/part/{p} returns fMP4 bytes starting
//     with moof or styp
func TestLLHLSPartialSegments(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := storage.Open(storage.Options{Path: tmpDir, Silent: true})
	if err != nil {
		t.Fatalf("storage.Open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	cs := pinning.NewContentStore(store)

	sessionID := "s_llhls_parts"
	sink, err := whip.NewLivePinSink(cs, sessionID)
	if err != nil {
		t.Fatalf("NewLivePinSink: %v", err)
	}

	seg, err := whip.NewCMAFSegmenter(sink)
	if err != nil {
		t.Fatalf("NewCMAFSegmenter: %v", err)
	}

	router := whip.NewLiveRouter()
	if err := router.AttachSession(sessionID, sink); err != nil {
		t.Fatalf("AttachSession: %v", err)
	}
	mux := http.NewServeMux()
	router.Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	// Drive the segmenter with 4s of 30fps synthetic frames rooted on
	// a keyframe — at least 2 parts (each PartTargetDuration=2s) land.
	sps := []byte{0x67, 0x42, 0xC0, 0x1F, 0xDA, 0x01, 0x40, 0x16, 0xE8, 0x40,
		0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0F, 0x23, 0xC6, 0x0C, 0x92}
	pps := []byte{0x68, 0xCE, 0x38, 0x80}
	idr := []byte{0x65, 0x88, 0x82, 0x00, 0x00}
	keyframe := annexBJoin(sps, pps, idr)
	pFrame := annexBJoin([]byte{0x41, 0x9A, 0x00, 0x00, 0x00})

	const fps = 30
	tickStep := uint32(whip.VideoTimescale / fps)
	var ts uint32
	seg.OnVideoFrame(whip.VideoFrame{NAL: keyframe, Timestamp: ts, Keyframe: true})
	ts += tickStep
	for i := 0; i < fps*4; i++ {
		seg.OnVideoFrame(whip.VideoFrame{NAL: pFrame, Timestamp: ts})
		ts += tickStep
	}

	// (a) at least 1 part recorded on sink
	parts := sink.PartsOf(0)
	if len(parts) == 0 {
		t.Fatalf("expected parts recorded for segment 0, got 0")
	}
	if !parts[0].Independent {
		t.Fatalf("part 0 must be INDEPENDENT (keyframe-rooted)")
	}

	// (b) playlist.m3u8 shape
	code, body := httpGET(t, srv.URL+"/live/"+sessionID+"/playlist.m3u8")
	if code != http.StatusOK {
		t.Fatalf("playlist status=%d body=%s", code, body)
	}
	if !strings.Contains(body, "#EXT-X-VERSION:9") {
		t.Fatalf("playlist missing EXT-X-VERSION:9:\n%s", body)
	}
	if !strings.Contains(body, "#EXT-X-PART-INF:PART-TARGET=2.0") {
		t.Fatalf("playlist missing EXT-X-PART-INF:\n%s", body)
	}
	wantPart := fmt.Sprintf("/live/%s/segment/0/part/0", sessionID)
	if !strings.Contains(body, "#EXT-X-PART:") || !strings.Contains(body, wantPart) {
		t.Fatalf("playlist missing EXT-X-PART for segment 0/part/0:\n%s", body)
	}

	// (c) GET /live/{id}/segment/0/part/0 returns fMP4 bytes
	code, partBody := httpGET(t, srv.URL+wantPart)
	if code != http.StatusOK {
		t.Fatalf("part status=%d", code)
	}
	if len(partBody) < 8 {
		t.Fatalf("part body too small (%d bytes)", len(partBody))
	}
	boxType := []byte(partBody)[4:8]
	if !bytes.Equal(boxType, []byte("moof")) && !bytes.Equal(boxType, []byte("styp")) {
		t.Fatalf("part box type = %q, want moof or styp", string(boxType))
	}
}

func annexBJoin(units ...[]byte) []byte {
	var out []byte
	for _, u := range units {
		out = append(out, 0x00, 0x00, 0x00, 0x01)
		out = append(out, u...)
	}
	return out
}
