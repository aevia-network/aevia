package content

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

// Playlist defaults mirror Cloudflare Stream's HLS output: 10 segments, 6s
// each, VOD-type playlist. Real streams replace these with manifest metadata
// in Milestone 2.
const (
	DefaultSegmentCount    = 10
	DefaultSegmentDuration = 6
)

// PlaylistSpec controls how a fixture .m3u8 is rendered.
type PlaylistSpec struct {
	CID             string
	SegmentCount    int
	SegmentDuration int
}

// Render serializes the playlist text. Relative segment URLs (segment/<n>)
// are resolved by the HLS client against the playlist request URL, so a
// viewer fetching /content/<cid>/index.m3u8 transparently walks into
// /content/<cid>/segment/<n>.
func (p PlaylistSpec) Render() string {
	if p.SegmentCount <= 0 {
		p.SegmentCount = DefaultSegmentCount
	}
	if p.SegmentDuration <= 0 {
		p.SegmentDuration = DefaultSegmentDuration
	}

	var b strings.Builder
	fmt.Fprintln(&b, "#EXTM3U")
	fmt.Fprintln(&b, "#EXT-X-VERSION:6")
	fmt.Fprintf(&b, "#EXT-X-TARGETDURATION:%d\n", p.SegmentDuration)
	fmt.Fprintln(&b, "#EXT-X-MEDIA-SEQUENCE:0")
	fmt.Fprintln(&b, "#EXT-X-PLAYLIST-TYPE:VOD")
	for i := 0; i < p.SegmentCount; i++ {
		fmt.Fprintf(&b, "#EXTINF:%d.000,\n", p.SegmentDuration)
		fmt.Fprintf(&b, "segment/%d\n", i)
	}
	fmt.Fprintln(&b, "#EXT-X-ENDLIST")
	return b.String()
}

func (h *Handlers) servePlaylist(w http.ResponseWriter, r *http.Request) {
	cid := r.PathValue("cid")
	if cid == "" {
		http.Error(w, "missing cid", http.StatusBadRequest)
		return
	}

	// When a source is attached and the CID is pinned, render the playlist
	// from the real manifest (segment_count + segment_duration come from
	// the stored manifest). Otherwise fall back to fixture defaults.
	spec := PlaylistSpec{CID: cid}
	if h.source != nil {
		m, err := h.source.GetManifest(cid)
		if err == nil {
			spec.SegmentCount = m.SegmentCount
			spec.SegmentDuration = m.SegmentDuration
		} else if !isNotFound(err) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		} else if !h.FixtureFallback {
			http.Error(w, "cid not pinned", http.StatusNotFound)
			return
		}
	}
	body := spec.Render()
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write([]byte(body))
}
