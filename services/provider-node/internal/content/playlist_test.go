package content_test

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/content"
)

func TestPlaylistRenderContainsRequiredTags(t *testing.T) {
	out := content.PlaylistSpec{CID: "baf123"}.Render()

	mustContain := []string{
		"#EXTM3U",
		"#EXT-X-VERSION:6",
		"#EXT-X-TARGETDURATION:6",
		"#EXT-X-MEDIA-SEQUENCE:0",
		"#EXT-X-PLAYLIST-TYPE:VOD",
		"#EXT-X-ENDLIST",
	}
	for _, tag := range mustContain {
		if !strings.Contains(out, tag) {
			t.Errorf("playlist missing %q", tag)
		}
	}
}

func TestPlaylistRenderHasDefaultTenSegments(t *testing.T) {
	out := content.PlaylistSpec{CID: "baf123"}.Render()
	extinfRe := regexp.MustCompile(`(?m)^#EXTINF:`)
	got := len(extinfRe.FindAllString(out, -1))
	if got != content.DefaultSegmentCount {
		t.Fatalf("#EXTINF count = %d, want %d", got, content.DefaultSegmentCount)
	}
	// All segments referenced as segment/0 ... segment/N-1.
	for i := 0; i < content.DefaultSegmentCount; i++ {
		line := "segment/" + strconv.Itoa(i)
		if !strings.Contains(out, line) {
			t.Errorf("playlist missing reference %q", line)
		}
	}
}

func TestPlaylistRenderHonorsCustomCount(t *testing.T) {
	out := content.PlaylistSpec{CID: "baf", SegmentCount: 3, SegmentDuration: 2}.Render()
	if !strings.Contains(out, "#EXT-X-TARGETDURATION:2") {
		t.Errorf("custom duration not honored")
	}
	extinfRe := regexp.MustCompile(`(?m)^#EXTINF:`)
	got := len(extinfRe.FindAllString(out, -1))
	if got != 3 {
		t.Fatalf("#EXTINF count = %d, want 3", got)
	}
}

func TestPlaylistEndsWithEndlistAfterAllSegments(t *testing.T) {
	out := content.PlaylistSpec{CID: "baf"}.Render()
	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
	last := lines[len(lines)-1]
	if last != "#EXT-X-ENDLIST" {
		t.Fatalf("last line = %q, want #EXT-X-ENDLIST", last)
	}
}

func TestServePlaylistReturnsExpectedContentType(t *testing.T) {
	mux := http.NewServeMux()
	content.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/content/baf9k/index.m3u8", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/vnd.apple.mpegurl" {
		t.Fatalf("Content-Type = %q, want application/vnd.apple.mpegurl", got)
	}
	if !strings.Contains(rec.Body.String(), "#EXTM3U") {
		t.Fatal("response body missing #EXTM3U")
	}
}
