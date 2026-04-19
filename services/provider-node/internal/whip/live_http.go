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
// surface. Two serving modes coexist:
//
//	A — gohlslib muxer (current default via Attach*Muxer):
//	  The HLSMuxer owns playlist.m3u8 + segments + init.mp4 under
//	  the same /live/{id}/ prefix. LiveRouter strips the prefix and
//	  delegates to muxer.Handler(). This is the path we chose after
//	  the hand-rolled CMAFSegmenter + parts emitted bitstreams that
//	  only hls.js tolerated (VLC/ffplay broke on strict decode).
//
//	B — legacy sink (kept for backwards-compat + Merkle manifest):
//	  The LivePinSink path rebuilt init/segments/parts from the
//	  sink's pinning.ContentStore. Still serves the VOD
//	  /live/{id}/manifest.json endpoint even in muxer mode because
//	  the Merkle root is sink-owned and independent of the serving
//	  format.
//
// A session may have both a muxer AND a sink attached. When both
// exist, the muxer wins for playlist/init/segment/part. The sink
// always wins for manifest.json (VOD manifest only emerges after
// Finalize).
type LiveRouter struct {
	mu     sync.Mutex
	pins   map[string]*LivePinSink // sessionID -> sink (legacy + Merkle manifest)
	muxers map[string]*HLSMuxer    // sessionID -> gohlslib muxer (HLS serving)
}

// NewLiveRouter returns an empty router. Sessions register via
// AttachSession (sink) and/or AttachMuxer (muxer) as they start;
// the WHIP OnSession callback is the natural call site.
func NewLiveRouter() *LiveRouter {
	return &LiveRouter{
		pins:   make(map[string]*LivePinSink),
		muxers: make(map[string]*HLSMuxer),
	}
}

// AttachMuxer registers a gohlslib-backed HLSMuxer for the session.
// Idempotent per-session — a session can only have one muxer.
func (r *LiveRouter) AttachMuxer(sessionID string, mux *HLSMuxer) error {
	if sessionID == "" {
		return errors.New("live: empty sessionID")
	}
	if mux == nil {
		return errors.New("live: nil muxer")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.muxers[sessionID]; exists {
		return fmt.Errorf("live: muxer for session %q already attached", sessionID)
	}
	r.muxers[sessionID] = mux
	return nil
}

// DetachMuxer removes the muxer binding (e.g. on session close).
// Idempotent. Does NOT call muxer.Close() — that's the caller's
// responsibility because muxer lifetime may extend beyond routing.
func (r *LiveRouter) DetachMuxer(sessionID string) {
	r.mu.Lock()
	delete(r.muxers, sessionID)
	r.mu.Unlock()
}

func (r *LiveRouter) muxer(id string) (*HLSMuxer, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.muxers[id]
	return m, ok
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
//
// Two coexisting serving surfaces:
//
//	/live/{id}/hls/{file}  — gohlslib muxer output. Whatever file
//	   gohlslib's internal registerPath emitted (index.m3u8 master,
//	   <streamID>_stream.m3u8 media playlist, <prefix>_<streamID>_init.mp4,
//	   seg/part .mp4/.ts). Player fetches /hls/index.m3u8 first and
//	   follows chained URIs — all resolve under this prefix.
//
//	/live/{id}/playlist.m3u8 + /init.mp4 + /segment/{n}[/part/{p}]
//	   — legacy hand-rolled CMAF path backed by LivePinSink. Retained
//	   for backwards-compat during rollout; new clients SHOULD prefer
//	   /hls/*. Will be removed once all viewers migrate.
//
//	/live/{id}/manifest.json — VOD Merkle manifest, sink-backed. Only
//	   available post-Finalize. Independent of serving surface choice.
func (r *LiveRouter) Register(reg HandlerRegistrar) {
	reg.HandleFunc("GET /live/{sessionID}/hls/{file}", r.serveHLS)
	reg.HandleFunc("GET /live/{sessionID}/playlist.m3u8", r.servePlaylist)
	reg.HandleFunc("GET /live/{sessionID}/init.mp4", r.serveInit)
	reg.HandleFunc("GET /live/{sessionID}/segment/{n}", r.serveSegment)
	reg.HandleFunc("GET /live/{sessionID}/segment/{n}/part/{p}", r.servePart)
	reg.HandleFunc("GET /live/{sessionID}/manifest.json", r.serveManifest)
}

// serveHLS delegates the request to the session's gohlslib HLSMuxer.
// gohlslib's server uses filepath.Base on the URL — so {file} is passed
// through unchanged. The handler needs the raw request because the
// muxer inspects headers (e.g. _HLS_msn/_HLS_part LL-HLS blocking
// preload hints) that a rewrite would strip.
func (r *LiveRouter) serveHLS(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("sessionID")
	mux, ok := r.muxer(id)
	if !ok {
		http.Error(w, "live: no muxer for session", http.StatusNotFound)
		return
	}
	mux.Handler().ServeHTTP(w, req)
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
