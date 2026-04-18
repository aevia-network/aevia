package whip

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// LiveRouter attaches live-session-scoped HTTP routes to the content
// surface:
//
//	GET /live/{sessionID}/playlist.m3u8   — HLS media playlist (live)
//	GET /live/{sessionID}/init.mp4         — fMP4 init segment
//	GET /live/{sessionID}/segment/{n}.mp4  — fMP4 media segment
//
// M8 ships classic HLS (not LL-HLS EXT-X-PART) — hls.js plays it with
// ~10s latency. LL-HLS partial segments land in M8.5 for sub-3s.
type LiveRouter struct {
	mu   sync.Mutex
	pins map[string]*LivePinSink // sessionID -> sink
}

// NewLiveRouter returns an empty router. Sessions register via
// AttachSession as they start; the WHIP OnSession callback is the
// natural call site.
func NewLiveRouter() *LiveRouter {
	return &LiveRouter{pins: make(map[string]*LivePinSink)}
}

// AttachSession registers a live session so its playlist + segments
// become HTTP-reachable.
func (r *LiveRouter) AttachSession(sessionID string, sink *LivePinSink) error {
	if sessionID == "" {
		return errors.New("live: empty sessionID")
	}
	if sink == nil {
		return errors.New("live: nil sink")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.pins[sessionID]; exists {
		return fmt.Errorf("live: session %q already attached", sessionID)
	}
	r.pins[sessionID] = sink
	return nil
}

// DetachSession removes the session from the router. Idempotent.
func (r *LiveRouter) DetachSession(sessionID string) {
	r.mu.Lock()
	delete(r.pins, sessionID)
	r.mu.Unlock()
}

// ActiveSessionIDs is exposed for metrics endpoints + tests.
func (r *LiveRouter) ActiveSessionIDs() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, 0, len(r.pins))
	for id := range r.pins {
		out = append(out, id)
	}
	return out
}

// Register wires the live HTTP routes into the supplied registrar.
func (r *LiveRouter) Register(reg HandlerRegistrar) {
	reg.HandleFunc("GET /live/{sessionID}/playlist.m3u8", r.servePlaylist)
	reg.HandleFunc("GET /live/{sessionID}/init.mp4", r.serveInit)
	reg.HandleFunc("GET /live/{sessionID}/segment/{n}", r.serveSegment)
	reg.HandleFunc("GET /live/{sessionID}/segment/{n}/part/{p}", r.servePart)
	reg.HandleFunc("GET /live/{sessionID}/manifest.json", r.serveManifest)
}

func (r *LiveRouter) sink(id string) (*LivePinSink, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.pins[id]
	return s, ok
}

// servePlaylist generates a classic HLS media playlist from the sink's
// current snapshot. Presence of EXT-X-ENDLIST is CONDITIONAL on the
// session being finalised — absence means "live, keep polling".
func (r *LiveRouter) servePlaylist(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	sink, ok := r.sink(id)
	if !ok {
		http.Error(w, "live: unknown session", http.StatusNotFound)
		return
	}
	snap, err := sink.Snapshot()
	if err != nil {
		http.Error(w, "live: snapshot: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var b strings.Builder
	b.WriteString("#EXTM3U\n")
	// EXT-X-VERSION:9 is Apple's LL-HLS baseline — required once we
	// emit EXT-X-PART / EXT-X-PART-INF / EXT-X-SERVER-CONTROL.
	b.WriteString("#EXT-X-VERSION:9\n")
	b.WriteString(fmt.Sprintf("#EXT-X-TARGETDURATION:%d\n", TargetSegmentDuration))
	b.WriteString(fmt.Sprintf("#EXT-X-PART-INF:PART-TARGET=%.1f\n", float64(PartTargetDuration)))
	// 3 × PART-TARGET = one full segment's worth of hold-back is the
	// Apple spec recommendation for LL-HLS so players have room to
	// rebuffer without rebuffering to the live edge.
	b.WriteString(fmt.Sprintf("#EXT-X-SERVER-CONTROL:PART-HOLD-BACK=%.1f\n", float64(PartTargetDuration*3)))
	b.WriteString("#EXT-X-MEDIA-SEQUENCE:0\n")
	b.WriteString(fmt.Sprintf("#EXT-X-MAP:URI=\"/live/%s/init.mp4\"\n", id))

	for i := 0; i < snap.SegmentCount; i++ {
		b.WriteString(fmt.Sprintf("#EXTINF:%d.000,\n", TargetSegmentDuration))
		b.WriteString(fmt.Sprintf("/live/%s/segment/%d\n", id, i))
	}
	// Emit EXT-X-PART for the currently-building segment (index =
	// SegmentCount because segments[] grows on flush, so parts
	// accumulated so far belong to the NEXT segment). This is what
	// makes LL-HLS viewers start within PartTargetDuration seconds
	// of the creator going live.
	currentSegIdx := uint32(snap.SegmentCount)
	for _, p := range sink.PartsOf(currentSegIdx) {
		b.WriteString(fmt.Sprintf(
			"#EXT-X-PART:DURATION=%.3f,URI=\"/live/%s/segment/%d/part/%d\",INDEPENDENT=%s\n",
			partDurationSecs(p.DurationT), id, currentSegIdx, p.Index,
			yesNo(p.Independent),
		))
	}
	// Append EXT-X-ENDLIST when the session has finalised so hls.js
	// stops polling and treats the playlist as VOD. Finalised means
	// LivePinSink.Finalize() has pinned the final manifest — the
	// server can still answer subsequent GETs indefinitely from the
	// cached segments.
	if sink.Manifest() != nil {
		b.WriteString("#EXT-X-ENDLIST\n")
	}

	body := b.String()
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write([]byte(body))
}

func (r *LiveRouter) serveInit(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	sink, ok := r.sink(id)
	if !ok {
		http.Error(w, "live: unknown session", http.StatusNotFound)
		return
	}
	init, err := sink.InitBytes()
	if err != nil {
		http.Error(w, "live: init not ready", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("Content-Length", strconv.Itoa(len(init)))
	_, _ = w.Write(init)
}

// serveManifest emits the session's VOD manifest once Finalize has
// been called. Viewers arriving after the live session has closed
// fetch this to reconstruct a seekable HLS playlist locally — and to
// verify the Merkle root against the on-chain ContentRegistry anchor
// if they want end-to-end cryptographic assurance.
func (r *LiveRouter) serveManifest(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	sink, ok := r.sink(id)
	if !ok {
		http.Error(w, "live: unknown session", http.StatusNotFound)
		return
	}
	m := sink.Manifest()
	if m == nil {
		http.Error(w, "live: session still in progress", http.StatusNotFound)
		return
	}
	startedAt, endedAt := sink.Timestamps()
	vod, err := BuildVODManifest(id, m, startedAt, endedAt)
	if err != nil {
		http.Error(w, "live: build manifest: "+err.Error(), http.StatusInternalServerError)
		return
	}
	body, err := vod.CanonicalJSON()
	if err != nil {
		http.Error(w, "live: encode manifest: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write(body)
}

// servePart serves a single LL-HLS partial segment fragment. Path
// shape: /live/{sessionID}/segment/{n}/part/{p}. Parts don't share
// the parent segment's immutable caching — they may be re-emitted
// under the same URI during the window before the parent closes.
func (r *LiveRouter) servePart(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	segStr := req.PathValue("n")
	partStr := req.PathValue("p")
	segIdx, err := strconv.ParseUint(segStr, 10, 32)
	if err != nil {
		http.Error(w, "live: invalid segment index", http.StatusBadRequest)
		return
	}
	partIdx, err := strconv.ParseUint(partStr, 10, 32)
	if err != nil {
		http.Error(w, "live: invalid part index", http.StatusBadRequest)
		return
	}
	sink, ok := r.sink(id)
	if !ok {
		http.Error(w, "live: unknown session", http.StatusNotFound)
		return
	}
	bytes, err := sink.PartBytes(uint32(segIdx), uint32(partIdx))
	if err != nil {
		http.Error(w, "live: part: "+err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	_, _ = w.Write(bytes)
}

// partDurationSecs converts VideoTimescale ticks to seconds.
func partDurationSecs(ticks uint32) float64 {
	return float64(ticks) / float64(VideoTimescale)
}

func yesNo(b bool) string {
	if b {
		return "YES"
	}
	return "NO"
}

func (r *LiveRouter) serveSegment(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	nStr := req.PathValue("n")
	idx, err := strconv.ParseUint(nStr, 10, 32)
	if err != nil {
		http.Error(w, "live: invalid segment index", http.StatusBadRequest)
		return
	}
	sink, ok := r.sink(id)
	if !ok {
		http.Error(w, "live: unknown session", http.StatusNotFound)
		return
	}
	bytes, err := sink.SegmentBytes(uint32(idx))
	if err != nil {
		http.Error(w, "live: segment: "+err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	_, _ = w.Write(bytes)
}
