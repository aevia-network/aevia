// Package whep implements the egress side of WebRTC-HTTP Egress Protocol
// (IETF draft-ietf-wish-whep). Viewers POST an SDP offer to
// /whep/{sessionID}; the Provider Node answers with SDP describing the
// live session's RTP stream and fans out the creator's packets to the
// viewer's PeerConnection. Every viewer is an independent pion PC that
// reuses the session's TrackLocalStaticRTP hub for RTP egress.
//
// M8 scope: video-only egress, single codec (H.264 Constrained Baseline
// negotiated on WHIP). Audio + codec negotiation flexibility land in M9.
//
// Why this pattern: the alternative is TRANSCODING the creator's track
// into a fresh SRTP stream per viewer, which costs 1 vCPU per stream.
// TrackLocalStaticRTP (pion SFU primitive) just shuffles packets with
// SSRC/PT rewrite — ~0 CPU per viewer.
package whep

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

// Options configure the WHEP server. WhipServer is required — the WHEP
// handler looks up sessions by ID to find their fan-out hubs.
type Options struct {
	WhipServer *whip.Server
	// PublicIPs mirrors whip.Options.PublicIPs — same 1:1 NAT escape
	// hatch. WHEP PeerConnections need the same override or ICE fails
	// for viewers outside the NAT.
	PublicIPs []string
}

// Server accepts WHEP playout requests and spins up one PeerConnection
// per viewer. Each PC subscribes to the corresponding WHIP session's
// TrackLocalStaticRTP hub, so creator RTP is relayed with zero
// transcoding.
type Server struct {
	whipSrv *whip.Server
	api     *webrtc.API

	// viewers tracks every active viewer PC keyed by sessionID:viewerID.
	// Populated on POST /whep/{sessionID}, drained on DELETE
	// /whep/{sessionID}/{viewerID}, and swept when the upstream session
	// closes. Per-viewer entries rather than a session-scoped map
	// because spec §4 (draft-ietf-wish-whep-07) mandates a distinct
	// resource per POST so DELETE can target a single viewer without
	// collaterally killing the others.
	viewersMu sync.Mutex
	viewers   map[string]*viewerBinding
}

// viewerBinding is the per-viewer state the server holds so DELETE can
// tear down one viewer without disturbing siblings.
type viewerBinding struct {
	sessionID string
	viewerID  string
	pc        *webrtc.PeerConnection
}

// New builds a WHEP server using the same media engine defaults as
// whip.NewServer (H.264 + Opus). If WhipServer is nil the server can't
// look up sessions — callers must supply it.
func New(opts Options) (*Server, error) {
	if opts.WhipServer == nil {
		return nil, errors.New("whep: WhipServer is required")
	}
	mediaEngine := &webrtc.MediaEngine{}
	h264Profiles := []string{
		"level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
		"level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f",
		"level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
	}
	for _, fmtp := range h264Profiles {
		if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
			RTPCodecCapability: webrtc.RTPCodecCapability{
				MimeType:    webrtc.MimeTypeH264,
				ClockRate:   90000,
				SDPFmtpLine: fmtp,
			},
			PayloadType: 0,
		}, webrtc.RTPCodecTypeVideo); err != nil {
			return nil, fmt.Errorf("whep: register h264: %w", err)
		}
	}
	if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		PayloadType: 0,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		return nil, fmt.Errorf("whep: register opus: %w", err)
	}
	settings := webrtc.SettingEngine{}
	if len(opts.PublicIPs) > 0 {
		settings.SetNAT1To1IPs(opts.PublicIPs, webrtc.ICECandidateTypeHost)
	}
	settings.SetIncludeLoopbackCandidate(true)
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine), webrtc.WithSettingEngine(settings))
	return &Server{
		whipSrv: opts.WhipServer,
		api:     api,
		viewers: make(map[string]*viewerBinding),
	}, nil
}

// HandlerRegistrar matches *http.ServeMux.HandleFunc.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Register wires POST /whep/{sessionID} and DELETE
// /whep/{sessionID}/{viewerID} into r. POST returns a Location header
// pointing at the per-viewer resource so spec-compliant clients can
// DELETE cleanly without guessing the URI.
func (s *Server) Register(r HandlerRegistrar) {
	r.HandleFunc("POST /whep/{sessionID}", s.handleWhep)
	r.HandleFunc("DELETE /whep/{sessionID}/{viewerID}", s.handleWhepDelete)
}

// viewerKey is the internal map key for viewers. Keeps one key type
// rather than a nested map so Delete / sweep can be a single lookup.
func viewerKey(sessionID, viewerID string) string {
	return sessionID + ":" + viewerID
}

// newViewerID returns a 128-bit hex identifier suitable for URL paths.
// crypto/rand is mandatory — a predictable viewerID would let a hostile
// peer DELETE other viewers by enumerating. 128 bits is more than enough
// to make brute-force DELETE infeasible within a session lifetime.
func newViewerID() (string, error) {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", fmt.Errorf("whep: generate viewer id: %w", err)
	}
	return hex.EncodeToString(buf[:]), nil
}

func (s *Server) handleWhep(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); ct != "application/sdp" {
		http.Error(w, "whep: Content-Type must be application/sdp", http.StatusUnsupportedMediaType)
		return
	}
	sessionID := r.PathValue("sessionID")
	if sessionID == "" {
		http.Error(w, "whep: sessionID required", http.StatusBadRequest)
		return
	}

	sess, err := s.whipSrv.GetSession(sessionID)
	if err != nil {
		http.Error(w, "whep: session not found", http.StatusNotFound)
		return
	}

	// Creator may still be negotiating their ingest when a viewer shows
	// up first. VideoHub returns nil until the first track lands — tell
	// the client to retry rather than leave them with a broken PC.
	videoHub := sess.VideoHub()
	if videoHub == nil {
		http.Error(w, "whep: session has no video track yet", http.StatusConflict)
		return
	}

	offerBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "whep: read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if len(offerBytes) == 0 {
		http.Error(w, "whep: empty SDP offer", http.StatusBadRequest)
		return
	}

	viewerID, err := newViewerID()
	if err != nil {
		http.Error(w, "whep: "+err.Error(), http.StatusInternalServerError)
		return
	}

	pc, err := s.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		http.Error(w, "whep: new peer connection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Attach the creator's video track. pion handles SSRC/PT remap so
	// the viewer decodes cleanly even though they negotiated their own
	// payload types independently of the creator.
	if _, err := pc.AddTrack(videoHub); err != nil {
		_ = pc.Close()
		http.Error(w, "whep: add video track: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if audio := sess.AudioHub(); audio != nil {
		if _, err := pc.AddTrack(audio); err != nil {
			_ = pc.Close()
			http.Error(w, "whep: add audio track: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	binding := &viewerBinding{
		sessionID: sessionID,
		viewerID:  viewerID,
		pc:        pc,
	}
	s.viewersMu.Lock()
	s.viewers[viewerKey(sessionID, viewerID)] = binding
	s.viewersMu.Unlock()

	// End the viewer PC when the WHIP session ends. We deliberately do
	// NOT tie the PC lifetime to r.Context() — that context cancels the
	// moment the HTTP answer is written, which would kill the PC before
	// ICE completes and RTP flows. The PC is torn down later by
	// OnConnectionStateChange (Failed / Closed / Disconnected), DELETE,
	// or when the upstream session ends.
	go func() {
		<-sess.Done()
		s.closeViewer(binding)
	}()

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed ||
			state == webrtc.PeerConnectionStateClosed ||
			state == webrtc.PeerConnectionStateDisconnected {
			s.closeViewer(binding)
		}
	})

	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: string(offerBytes)}
	if err := pc.SetRemoteDescription(offer); err != nil {
		s.closeViewer(binding)
		http.Error(w, "whep: set remote desc: "+err.Error(), http.StatusBadRequest)
		return
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		s.closeViewer(binding)
		http.Error(w, "whep: create answer: "+err.Error(), http.StatusInternalServerError)
		return
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		s.closeViewer(binding)
		http.Error(w, "whep: set local desc: "+err.Error(), http.StatusInternalServerError)
		return
	}
	select {
	case <-gather:
	case <-time.After(10 * time.Second):
		s.closeViewer(binding)
		http.Error(w, "whep: ICE gathering timeout", http.StatusGatewayTimeout)
		return
	}

	answerSDP := pc.LocalDescription().SDP
	w.Header().Set("Content-Type", "application/sdp")
	// Per draft-ietf-wish-whep-07 §4 the Location header identifies the
	// per-viewer resource. Using the session id alone (the pre-fix
	// behaviour) meant every viewer claimed the same URL and a DELETE
	// by one client would implicitly reference somebody else's PC.
	w.Header().Set("Location", "/whep/"+sessionID+"/"+viewerID)
	w.Header().Set("Content-Length", strconv.Itoa(len(answerSDP)))
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(answerSDP))
}

// handleWhepDelete tears down one viewer identified by its per-POST
// URI. Idempotent: an unknown viewerID returns 404 so a client can
// treat the DELETE as a no-op without worrying about retries.
//
// The handler never touches the upstream whip.Session — closing it here
// would stop every OTHER viewer as a side effect. We close only the
// viewer's PeerConnection and drop the map entry; the session hub keeps
// running for the remaining subscribers.
func (s *Server) handleWhepDelete(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionID")
	viewerID := r.PathValue("viewerID")
	if sessionID == "" || viewerID == "" {
		http.Error(w, "whep: sessionID and viewerID required", http.StatusBadRequest)
		return
	}
	key := viewerKey(sessionID, viewerID)
	s.viewersMu.Lock()
	binding, ok := s.viewers[key]
	if ok {
		delete(s.viewers, key)
	}
	s.viewersMu.Unlock()
	if !ok {
		http.Error(w, "whep: viewer not found", http.StatusNotFound)
		return
	}
	// Close the PC outside the lock — pion's Close can block while it
	// drains RTCP, and we don't want that blocking concurrent DELETEs
	// targeting different viewers on the same session.
	_ = binding.pc.Close()
	w.WriteHeader(http.StatusNoContent)
}

// closeViewer is the internal teardown helper used by (a) the DELETE
// handler, (b) OnConnectionStateChange, and (c) the session-done
// goroutine. Safe to call repeatedly.
func (s *Server) closeViewer(b *viewerBinding) {
	if b == nil {
		return
	}
	s.viewersMu.Lock()
	existing, ok := s.viewers[viewerKey(b.sessionID, b.viewerID)]
	if ok && existing == b {
		delete(s.viewers, viewerKey(b.sessionID, b.viewerID))
	}
	s.viewersMu.Unlock()
	_ = b.pc.Close()
}

// ActiveViewers returns the current viewer count for a given session.
// Useful for /live/{id}/stats and test assertions.
func (s *Server) ActiveViewers(sessionID string) int {
	s.viewersMu.Lock()
	defer s.viewersMu.Unlock()
	n := 0
	for _, b := range s.viewers {
		if b.sessionID == sessionID {
			n++
		}
	}
	return n
}
