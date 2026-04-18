// Package whip implements the ingest side of WebRTC-HTTP Ingestion Protocol
// (IETF RFC 9725, ex-draft-ietf-wish-whip). Creators POST an SDP offer to
// /whip; the Provider Node answers with SDP + a Location URL the creator
// can use to PATCH ICE candidates or DELETE to end the session.
//
// M8 scope: single-bitrate ingest. Creator's browser encodes (H.264 + Opus),
// Provider remuxes into CMAF fMP4 segments, pins via BadgerDB, announces
// CID via DHT. No transcoding; ABR lands in M9+.
//
// This file is the scaffold (M8-i1): SDP exchange lives here; media
// pipeline wires in M8-i2+.
package whip

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

// KeyframeRequestInterval is how often the server asks the encoder (via
// RTCP PLI) for a fresh IDR. Chrome's WebRTC stack only emits keyframes
// on its own schedule — often every 20-60s — which makes CMAF segment
// boundaries drift wildly (segments balloon to 20+ MB before the next
// IDR lets the segmenter cut). 2s keeps segments near the 6s target.
const KeyframeRequestInterval = 2 * time.Second

// Session represents one active WHIP ingest — one creator streaming one
// live show. The provider-node exposes an /active endpoint later for
// viewer discovery.
type Session struct {
	ID            string
	StartedAt     time.Time
	peerConn      *webrtc.PeerConnection
	mu            sync.Mutex
	trackHandlers []func(*webrtc.TrackRemote, *webrtc.RTPReceiver)
	doneCh        chan struct{}
}

// Close drops the peer connection and signals session end. Idempotent.
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.peerConn == nil {
		return nil
	}
	err := s.peerConn.Close()
	s.peerConn = nil
	select {
	case <-s.doneCh:
	default:
		close(s.doneCh)
	}
	return err
}

// Done returns a channel that closes when the session ends.
func (s *Session) Done() <-chan struct{} { return s.doneCh }

// OnTrack registers a handler invoked when the peer connection receives
// a media track (H.264 video or Opus audio). Multiple handlers can be
// registered; all fire on each track.
func (s *Session) OnTrack(handler func(*webrtc.TrackRemote, *webrtc.RTPReceiver)) {
	s.mu.Lock()
	s.trackHandlers = append(s.trackHandlers, handler)
	s.mu.Unlock()
}

// Server accepts WHIP ingest requests and spins up one Session per.
type Server struct {
	api *webrtc.API

	mu             sync.Mutex
	sessions       map[string]*Session
	sessionID      func() string
	onSessionCbs   []func(*Session)
	authorisedDIDs map[string]struct{}
}

// Options configure a Server. Zero value is fine for tests; production
// sets AuthorisedDIDs to the creator allowlist.
type Options struct {
	// AuthorisedDIDs controls who can POST /whip. Empty slice means
	// authentication is DISABLED — useful for local dev + CI, unsafe
	// for public deploys. Production MUST supply this.
	AuthorisedDIDs []string
	// PublicIPs is the list of reachable public IPs for this node.
	// When set, pion replaces its local host ICE candidates with
	// these addresses so browsers behind/outside the same NAT can
	// reach the node's UDP sockets. Required for any deployment
	// where the node runs behind 1:1 NAT (cloud VMs that expose a
	// public IP but internally bind a private RFC1918 address).
	PublicIPs []string
}

// NewServer builds a whip.Server with a pion/webrtc API configured for
// H.264 + Opus. Other codecs are rejected to keep the M8 scope tight —
// VP9/AV1 land when transcoding gets added.
//
// We explicitly register ONLY H.264 (Baseline + Constrained Baseline)
// and Opus. Browsers negotiating a WHIP session will then be forced to
// encode in H.264; defaulting to RegisterDefaultCodecs() lets Chrome
// pick VP8 for some inputs (canvas.captureStream, screen capture) and
// our CMAF segmenter rejects non-H.264 payloads silently.
func NewServer(opts Options) (*Server, error) {
	mediaEngine := &webrtc.MediaEngine{}
	// H.264 Constrained Baseline 3.1 + packetization-mode=1. Matches the
	// profile Chrome/Safari ship for WebRTC and that most hardware
	// decoders accept.
	h264Profiles := []string{
		"level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
		"level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f",
		"level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
	}
	for _, fmtp := range h264Profiles {
		if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
			RTPCodecCapability: webrtc.RTPCodecCapability{
				MimeType:     webrtc.MimeTypeH264,
				ClockRate:    90000,
				Channels:     0,
				SDPFmtpLine:  fmtp,
				RTCPFeedback: nil,
			},
			PayloadType: 0, // let MediaEngine assign
		}, webrtc.RTPCodecTypeVideo); err != nil {
			return nil, fmt.Errorf("whip: register h264 codec: %w", err)
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
		return nil, fmt.Errorf("whip: register opus codec: %w", err)
	}
	settings := webrtc.SettingEngine{}
	if len(opts.PublicIPs) > 0 {
		// NAT 1:1 rewrite — pion replaces its discovered host IPs with
		// the operator-supplied public IPs when building ICE candidates.
		// Without this, ICE stalls forever for clients outside the NAT.
		settings.SetNAT1To1IPs(opts.PublicIPs, webrtc.ICECandidateTypeHost)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine), webrtc.WithSettingEngine(settings))
	dids := make(map[string]struct{}, len(opts.AuthorisedDIDs))
	for _, did := range opts.AuthorisedDIDs {
		if did != "" {
			dids[did] = struct{}{}
		}
	}
	return &Server{
		api:            api,
		sessions:       make(map[string]*Session),
		sessionID:      newSessionID,
		authorisedDIDs: dids,
	}, nil
}

// OnSession registers a callback invoked whenever a new WHIP session is
// established. Handlers register Track + Connection state callbacks on
// the Session to attach their pipeline (segmenter, metrics, etc.).
//
// Callbacks fire synchronously before the SDP answer is returned, so
// the caller has full control over the media pipeline before the
// creator's first RTP packet arrives. Multiple callbacks can be
// registered; all fire on each session.
func (s *Server) OnSession(cb func(*Session)) {
	if cb == nil {
		return
	}
	s.mu.Lock()
	s.onSessionCbs = append(s.onSessionCbs, cb)
	s.mu.Unlock()
}

// HandlerRegistrar matches the signature shared by httpx.Server and
// *http.ServeMux.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Register wires the WHIP routes into r. M8-i1 ships /whip (POST); later
// iterations add PATCH and DELETE per RFC 9725.
func (s *Server) Register(r HandlerRegistrar) {
	r.HandleFunc("POST /whip", s.handleIngest)
}

// handleIngest accepts an SDP offer body and returns the Provider's SDP
// answer. Session handle (ID + PeerConnection) is stored so later media
// arrives with context.
func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); ct != "application/sdp" {
		http.Error(w, "whip: Content-Type must be application/sdp", http.StatusUnsupportedMediaType)
		return
	}

	// Authorization check — allowlist-only for M8 MVP. Production upgrade
	// path: X-Aevia-Signature header carrying an EIP-191 / EIP-712
	// signature of the SDP offer, which we'd recover to a DID and compare.
	if !s.checkAuth(r.Header.Get("X-Aevia-DID")) {
		http.Error(w, "whip: DID not authorised", http.StatusUnauthorized)
		return
	}
	offerBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "whip: read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if len(offerBytes) == 0 {
		http.Error(w, "whip: empty SDP offer", http.StatusBadRequest)
		return
	}

	// Build the peer connection. For M8 the STUN/TURN list is empty —
	// production adds stun:stun.aevia.network once Relay Nodes run the
	// coturn service alongside Circuit Relay.
	pc, err := s.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		http.Error(w, "whip: new peer connection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add transceivers so the peer connection is ready to RECEIVE media.
	// WHIP creators push tracks; our job is to accept them.
	for _, kind := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
		if _, err := pc.AddTransceiverFromKind(kind, webrtc.RTPTransceiverInit{
			Direction: webrtc.RTPTransceiverDirectionRecvonly,
		}); err != nil {
			_ = pc.Close()
			http.Error(w, "whip: add transceiver: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	session := &Session{
		ID:        s.sessionID(),
		StartedAt: time.Now(),
		peerConn:  pc,
		doneCh:    make(chan struct{}),
	}

	// Wire up the OnTrack fanout. pion calls this when each remote track
	// lands; handlers registered via Session.OnTrack fire.
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		if track.Kind() == webrtc.RTPCodecTypeVideo {
			go pliLoop(pc, session.doneCh, uint32(track.SSRC()))
		}
		session.mu.Lock()
		handlers := make([]func(*webrtc.TrackRemote, *webrtc.RTPReceiver), len(session.trackHandlers))
		copy(handlers, session.trackHandlers)
		session.mu.Unlock()
		for _, h := range handlers {
			h(track, receiver)
		}
	})

	// Close session when the peer connection dies.
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed || state == webrtc.PeerConnectionStateDisconnected {
			_ = session.Close()
		}
	})

	// Negotiate.
	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: string(offerBytes)}
	if err := pc.SetRemoteDescription(offer); err != nil {
		_ = pc.Close()
		http.Error(w, "whip: set remote desc: "+err.Error(), http.StatusBadRequest)
		return
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		http.Error(w, "whip: create answer: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// Block on ICE candidate gathering so the answer body contains them
	// all (non-trickle WHIP path; simpler for v1).
	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		http.Error(w, "whip: set local desc: "+err.Error(), http.StatusInternalServerError)
		return
	}
	<-gatherComplete

	s.mu.Lock()
	s.sessions[session.ID] = session
	callbacks := make([]func(*Session), len(s.onSessionCbs))
	copy(callbacks, s.onSessionCbs)
	s.mu.Unlock()

	// Fan out new-session notification to registered pipelines BEFORE
	// media starts flowing, so track handlers are in place for the first
	// RTP packet.
	for _, cb := range callbacks {
		cb(session)
	}

	answerSDP := pc.LocalDescription().SDP
	w.Header().Set("Content-Type", "application/sdp")
	w.Header().Set("Location", "/whip/"+session.ID)
	w.Header().Set("X-Aevia-Session-ID", session.ID)
	w.Header().Set("Content-Length", strconv.Itoa(len(answerSDP)))
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(answerSDP))
}

// GetSession returns the session by ID or ErrSessionNotFound.
func (s *Server) GetSession(id string) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return sess, nil
}

// ActiveSessions returns a snapshot of currently open session IDs.
func (s *Server) ActiveSessions() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]string, 0, len(s.sessions))
	for id := range s.sessions {
		out = append(out, id)
	}
	return out
}

// ErrSessionNotFound is returned when GetSession is called with an
// unknown ID.
var ErrSessionNotFound = errors.New("whip: session not found")

// newSessionID generates a URL-safe ephemeral ID. Short enough for logs,
// long enough to avoid collision.
func newSessionID() string {
	return fmt.Sprintf("s_%d", time.Now().UnixNano())
}

// checkAuth validates the creator's DID against the authorised allowlist.
// An empty allowlist means auth is off (dev/test mode).
func (s *Server) checkAuth(did string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.authorisedDIDs) == 0 {
		return true
	}
	_, ok := s.authorisedDIDs[did]
	return ok
}

// pliLoop sends RTCP Picture-Loss-Indication to the sender every
// KeyframeRequestInterval, so the browser's H.264 encoder emits an IDR
// promptly and the CMAF segmenter can cut segments near the 6s target.
// Returns when the session's done channel closes or WriteRTCP fails
// (typically because the peer went away).
func pliLoop(pc *webrtc.PeerConnection, done <-chan struct{}, ssrc uint32) {
	t := time.NewTicker(KeyframeRequestInterval)
	defer t.Stop()
	pkts := []rtcp.Packet{&rtcp.PictureLossIndication{SenderSSRC: 0, MediaSSRC: ssrc}}
	for {
		select {
		case <-done:
			return
		case <-t.C:
			if err := pc.WriteRTCP(pkts); err != nil {
				return
			}
		}
	}
}
