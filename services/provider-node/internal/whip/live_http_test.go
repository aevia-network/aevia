package whip

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLiveRouterRejectsAttachOfEmptySessionID(t *testing.T) {
	r := NewLiveRouter()
	if err := r.AttachSession("", &LivePinSink{}); err == nil {
		t.Fatal("AttachSession(\"\") returned nil error")
	}
}

func TestLiveRouterRejectsAttachOfNilSink(t *testing.T) {
	r := NewLiveRouter()
	if err := r.AttachSession("s1", nil); err == nil {
		t.Fatal("AttachSession(nil sink) returned nil error")
	}
}

func TestLiveRouterDetachIsIdempotent(t *testing.T) {
	r := NewLiveRouter()
	r.DetachSession("never-existed") // must not panic
}

func TestLivePlaylistReturns404ForUnknownSession(t *testing.T) {
	r := NewLiveRouter()
	mux := http.NewServeMux()
	r.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/live/unknown/playlist.m3u8", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestLivePlaylistReflectsSegmentCount(t *testing.T) {
	sink, _ := NewLivePinSink(newPinStore(t), "s_play")
	_ = sink.OnInitSegment([]byte("init-fmp4"))
	for i := uint32(0); i < 3; i++ {
		_ = sink.OnMediaSegment(i, []byte{byte(i), 0xAA}, 180000)
	}

	r := NewLiveRouter()
	if err := r.AttachSession("s_play", sink); err != nil {
		t.Fatalf("AttachSession: %v", err)
	}
	mux := http.NewServeMux()
	r.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/live/s_play/playlist.m3u8", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/vnd.apple.mpegurl" {
		t.Fatalf("Content-Type = %q", ct)
	}

	body := rec.Body.String()
	must := []string{
		"#EXTM3U",
		"#EXT-X-VERSION:9",
		"#EXT-X-TARGETDURATION:6",
		"#EXT-X-MAP:URI=\"/live/s_play/init.mp4\"",
		"/live/s_play/segment/0",
		"/live/s_play/segment/1",
		"/live/s_play/segment/2",
	}
	for _, tag := range must {
		if !strings.Contains(body, tag) {
			t.Errorf("playlist missing %q\n---\n%s", tag, body)
		}
	}
	// Live (session open) MUST NOT carry EXT-X-ENDLIST — hls.js keeps
	// polling for new segments as long as that tag is absent.
	if strings.Contains(body, "#EXT-X-ENDLIST") {
		t.Errorf("live playlist contains #EXT-X-ENDLIST (should only appear post-finalize)")
	}
}

func TestLiveInitSegmentServes(t *testing.T) {
	sink, _ := NewLivePinSink(newPinStore(t), "s_init")
	_ = sink.OnInitSegment([]byte("FMP4-INIT-BYTES"))

	r := NewLiveRouter()
	_ = r.AttachSession("s_init", sink)
	mux := http.NewServeMux()
	r.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/live/s_init/init.mp4", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Body.String() != "FMP4-INIT-BYTES" {
		t.Fatalf("body mismatch: %q", rec.Body.String())
	}
}

func TestLiveSegmentServesByIndex(t *testing.T) {
	sink, _ := NewLivePinSink(newPinStore(t), "s_seg")
	_ = sink.OnInitSegment([]byte("init"))
	_ = sink.OnMediaSegment(0, []byte("seg-0-body"), 180000)
	_ = sink.OnMediaSegment(1, []byte("seg-1-body"), 180000)

	r := NewLiveRouter()
	_ = r.AttachSession("s_seg", sink)
	mux := http.NewServeMux()
	r.Register(mux)

	for i, want := range []string{"seg-0-body", "seg-1-body"} {
		req := httptest.NewRequest(http.MethodGet, "/live/s_seg/segment/"+string(rune('0'+i)), nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("segment %d: status %d", i, rec.Code)
		}
		if rec.Body.String() != want {
			t.Fatalf("segment %d body = %q, want %q", i, rec.Body.String(), want)
		}
	}

	// Out-of-range request → 404.
	req := httptest.NewRequest(http.MethodGet, "/live/s_seg/segment/10", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("out-of-range seg status = %d, want 404", rec.Code)
	}
}
