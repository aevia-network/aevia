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
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pion/interceptor"
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

// RTPSink is a write-only endpoint that receives a copy of the session's
// RTP stream. Mirror clients implement this to forward packets to
// downstream provider nodes over libp2p streams (see internal/mirror).
//
// WriteRTP MUST be non-blocking for the caller: slow mirrors cannot
// stall the ingest goroutine. Implementations buffer internally and
// drop on backpressure.
type RTPSink interface {
	WriteRTP(pkt *rtp.Packet) error
}

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

	// Hub tracks are per-session TrackLocalStaticRTPs that mirror the
	// creator's RTP stream so N WHEP viewers can subscribe without the
	// creator re-encoding. TeeReadTrack populates them, the whep package
	// consumes them via VideoHub / AudioHub.
	hubMu    sync.RWMutex
	videoHub *webrtc.TrackLocalStaticRTP
	audioHub *webrtc.TrackLocalStaticRTP

	// Sinks are extra write-only endpoints that receive a copy of every
	// RTP packet alongside the hub. Mirror clients register sinks to
	// forward packets over libp2p streams to downstream providers. The
	// lists are separate per kind so the mirror can address video vs
	// audio frames distinctly on the wire. Fan-out happens in
	// TeeReadSessionTrack, after hub.WriteRTP.
	sinkMu     sync.RWMutex
	videoSinks []RTPSink
	audioSinks []RTPSink

	// FrameSinks receive DEPACKETIZED frames (per-AU NAL slices for
	// video, per-packet Opus buffers for audio). Unlike RTPSinks which
	// are RTP-level tees, FrameSinks live above pion's H264 / Opus
	// depacketizer — they're what HLSMuxer and LivePinSink+
	// CMAFSegmenter consume. One per session. Lets mirror-recipient
	// providers serve /hls/ independently of the WHIP origin, with
	// the exact same pipeline origin uses.
	frameSinkMu    sync.RWMutex
	videoFrameSink FrameSink
	audioFrameSink FrameSink
}

// AttachVideoSink registers an additional RTP endpoint that receives a
// copy of every video packet. Idempotent-per-sink is the caller's
// responsibility: each AddSink call adds another entry.
func (s *Session) AttachVideoSink(sink RTPSink) {
	s.sinkMu.Lock()
	s.videoSinks = append(s.videoSinks, sink)
	s.sinkMu.Unlock()
}

// AttachAudioSink is the audio counterpart of AttachVideoSink.
func (s *Session) AttachAudioSink(sink RTPSink) {
	s.sinkMu.Lock()
	s.audioSinks = append(s.audioSinks, sink)
	s.sinkMu.Unlock()
}

// AttachVideoFrameSink installs a FrameSink that receives demuxed H.264
// NALs. Used by mirror-recipient providers to drive their own HLSMuxer
// + LivePinSink from the RTP stream arriving via libp2p. Passing nil
// detaches. Later calls overwrite — one sink per session.
func (s *Session) AttachVideoFrameSink(sink FrameSink) {
	s.frameSinkMu.Lock()
	s.videoFrameSink = sink
	s.frameSinkMu.Unlock()
}

// AttachAudioFrameSink is the audio counterpart — receives demuxed
// Opus buffers. Reserved for M9 Opus→AAC transcode.
func (s *Session) AttachAudioFrameSink(sink FrameSink) {
	s.frameSinkMu.Lock()
	s.audioFrameSink = sink
	s.frameSinkMu.Unlock()
}

// VideoFrameSink returns the installed FrameSink or nil.
func (s *Session) VideoFrameSink() FrameSink {
	s.frameSinkMu.RLock()
	defer s.frameSinkMu.RUnlock()
	return s.videoFrameSink
}

// AudioFrameSink returns the installed audio FrameSink or nil.
func (s *Session) AudioFrameSink() FrameSink {
	s.frameSinkMu.RLock()
	defer s.frameSinkMu.RUnlock()
	return s.audioFrameSink
}

// fanOutVideoRTP writes pkt to every registered video sink. Errors are
// swallowed — a slow or failing mirror must not stall the ingest loop.
// Called by TeeReadSessionTrack after hub.WriteRTP.
func (s *Session) fanOutVideoRTP(pkt *rtp.Packet) {
	s.sinkMu.RLock()
	sinks := s.videoSinks
	s.sinkMu.RUnlock()
	for _, sink := range sinks {
		_ = sink.WriteRTP(pkt)
	}
}

// fanOutAudioRTP mirrors fanOutVideoRTP for audio packets.
func (s *Session) fanOutAudioRTP(pkt *rtp.Packet) {
	s.sinkMu.RLock()
	sinks := s.audioSinks
	s.sinkMu.RUnlock()
	for _, sink := range sinks {
		_ = sink.WriteRTP(pkt)
	}
}

// NewMirrorSession builds a Session with no WHIP peer connection —
// its RTP packets arrive from a libp2p mirror stream instead. Callers
// WriteRTP directly to the returned hubs; /whep viewers subscribe
// exactly as they would on an origin session.
//
// Codec capabilities are forwarded verbatim from the origin's stream
// header so the downstream hub advertises matching SDP parameters.
// Pass a zero-value CodecInfo (MimeType == "") for a track kind the
// session doesn't carry.
//
// The returned session has peerConn=nil; Close() becomes a pure
// signalling operation (closes doneCh), which is correct — there is
// no peer connection to tear down.
func NewMirrorSession(id string, video, audio webrtc.RTPCodecCapability) (*Session, error) {
	if id == "" {
		return nil, errors.New("whip: mirror session requires non-empty ID")
	}
	s := &Session{
		ID:        id,
		StartedAt: time.Now(),
		doneCh:    make(chan struct{}),
	}
	if video.MimeType != "" {
		hub, err := webrtc.NewTrackLocalStaticRTP(video, "aevia-video-"+id, id)
		if err != nil {
			return nil, fmt.Errorf("whip: new mirror video hub: %w", err)
		}
		s.videoHub = hub
	}
	if audio.MimeType != "" {
		hub, err := webrtc.NewTrackLocalStaticRTP(audio, "aevia-audio-"+id, id)
		if err != nil {
			return nil, fmt.Errorf("whip: new mirror audio hub: %w", err)
		}
		s.audioHub = hub
	}
	return s, nil
}

// OfferFmtpLines returns every a=fmtp:* line from the WHIP offer SDP,
// unparsed. Debug aid — lets the operator log exactly what the client
// negotiated so we can correlate codec behaviour without redeploying
// with a full SDP dump (privacy-safer than a verbatim offer log).
func (s *Session) OfferFmtpLines() []string {
	s.mu.Lock()
	pc := s.peerConn
	s.mu.Unlock()
	if pc == nil {
		return nil
	}
	desc := pc.RemoteDescription()
	if desc == nil {
		return nil
	}
	var out []string
	for _, line := range strings.Split(desc.SDP, "\n") {
		line = strings.TrimRight(line, "\r")
		if strings.HasPrefix(line, "a=fmtp:") {
			out = append(out, line)
		}
	}
	return out
}

// VideoSPSPPS extracts the H.264 Sequence + Picture Parameter Sets
// from the WebRTC offer's fmtp line (sprop-parameter-sets=SPS_b64,PPS_b64).
// Browser encoders typically transmit SPS/PPS OUT-OF-BAND via the SDP
// and only insert IDR NALs into the RTP stream — without fishing them
// out here, downstream muxers (gohlslib, ffmpeg) get "non-existing PPS
// referenced" on every keyframe because the MPEG-TS/fmp4 output
// carries IDR with no matching parameter sets. Returns (nil, nil) when
// the session has no peer connection (mirror origins) or the fmtp line
// is missing sprop-parameter-sets.
func (s *Session) VideoSPSPPS() (sps, pps []byte) {
	s.mu.Lock()
	pc := s.peerConn
	s.mu.Unlock()
	if pc == nil {
		return nil, nil
	}
	// The offer carries sprop-parameter-sets — pion keeps it on the
	// remote description. LocalDescription drops it because pion's
	// Go codec doesn't re-emit SPS/PPS on its answer side.
	desc := pc.RemoteDescription()
	if desc == nil {
		return nil, nil
	}
	return parseSpropParameterSets(desc.SDP)
}

// parseSpropParameterSets scans an SDP blob for any H.264 fmtp line
// containing sprop-parameter-sets and returns the first SPS/PPS pair.
// Format per RFC 6184 §8.2.1: comma-separated base64 NAL bytes, in
// the order the encoder would have emitted them (SPS first, PPS next).
// When multiple fmtps appear (e.g. packetization-mode=0 fallback and
// =1 primary), we pick whichever reports sprop-parameter-sets first
// — in practice they agree.
func parseSpropParameterSets(sdp string) (sps, pps []byte) {
	for _, line := range strings.Split(sdp, "\n") {
		line = strings.TrimRight(line, "\r")
		if !strings.HasPrefix(line, "a=fmtp:") {
			continue
		}
		for _, kv := range strings.Split(line, ";") {
			kv = strings.TrimSpace(kv)
			if !strings.HasPrefix(kv, "sprop-parameter-sets=") {
				continue
			}
			val := strings.TrimPrefix(kv, "sprop-parameter-sets=")
			parts := strings.SplitN(val, ",", 2)
			if len(parts) != 2 {
				continue
			}
			spsB, err := base64.StdEncoding.DecodeString(strings.TrimSpace(parts[0]))
			if err != nil || len(spsB) == 0 {
				continue
			}
			ppsB, err := base64.StdEncoding.DecodeString(strings.TrimSpace(parts[1]))
			if err != nil || len(ppsB) == 0 {
				continue
			}
			return spsB, ppsB
		}
	}
	return nil, nil
}

// Close drops the peer connection and signals session end. Idempotent.
// Mirror sessions (peerConn == nil from birth) still signal doneCh so
// WHEP viewers bound to them tear down cleanly.
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var err error
	if s.peerConn != nil {
		err = s.peerConn.Close()
		s.peerConn = nil
	}
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

// VideoHub returns the session's video fan-out track, or nil if the
// creator hasn't sent a video track yet. WHEP handlers call this to
// attach viewers: pc.AddTrack(session.VideoHub()) subscribes the viewer
// to every RTP packet the creator publishes.
func (s *Session) VideoHub() *webrtc.TrackLocalStaticRTP {
	s.hubMu.RLock()
	defer s.hubMu.RUnlock()
	return s.videoHub
}

// AudioHub is the audio counterpart of VideoHub. Audio mux into CMAF
// lands in M9; the hub path already works for WHEP viewers.
func (s *Session) AudioHub() *webrtc.TrackLocalStaticRTP {
	s.hubMu.RLock()
	defer s.hubMu.RUnlock()
	return s.audioHub
}

// setVideoHub stores the hub track (called by TeeReadTrack once the
// creator's first RTP packet reveals the codec parameters).
func (s *Session) setVideoHub(hub *webrtc.TrackLocalStaticRTP) {
	s.hubMu.Lock()
	s.videoHub = hub
	s.hubMu.Unlock()
}

// setAudioHub stores the audio hub. See setVideoHub.
func (s *Session) setAudioHub(hub *webrtc.TrackLocalStaticRTP) {
	s.hubMu.Lock()
	s.audioHub = hub
	s.hubMu.Unlock()
}

// EnsureHubFor creates the correct hub (video or audio) for the given
// remote track if one doesn't exist yet, matching its codec capability.
// Safe to call repeatedly; second call returns the cached hub.
//
// The trackID is forwarded to TrackLocalStaticRTP so WHEP SDP answers
// advertise a stable identifier. The streamID groups related hubs so
// browsers render audio+video together as one logical MediaStream.
func (s *Session) EnsureHubFor(remote *webrtc.TrackRemote) (*webrtc.TrackLocalStaticRTP, error) {
	if remote == nil {
		return nil, errors.New("whip: EnsureHubFor requires remote track")
	}
	s.hubMu.Lock()
	defer s.hubMu.Unlock()
	kind := remote.Kind()
	cap := remote.Codec().RTPCodecCapability
	trackID := "aevia-" + kind.String() + "-" + s.ID
	switch kind {
	case webrtc.RTPCodecTypeVideo:
		if s.videoHub != nil {
			return s.videoHub, nil
		}
		hub, err := webrtc.NewTrackLocalStaticRTP(cap, trackID, s.ID)
		if err != nil {
			return nil, fmt.Errorf("whip: create video hub: %w", err)
		}
		s.videoHub = hub
		return hub, nil
	case webrtc.RTPCodecTypeAudio:
		if s.audioHub != nil {
			return s.audioHub, nil
		}
		hub, err := webrtc.NewTrackLocalStaticRTP(cap, trackID, s.ID)
		if err != nil {
			return nil, fmt.Errorf("whip: create audio hub: %w", err)
		}
		s.audioHub = hub
		return hub, nil
	default:
		return nil, fmt.Errorf("whip: unsupported track kind %v", kind)
	}
}

// Server accepts WHIP ingest requests and spins up one Session per.
type Server struct {
	api *webrtc.API

	mu                sync.Mutex
	sessions          map[string]*Session
	sessionID         func() string
	onSessionCbs      []func(*Session)
	authorisedDIDs    map[string]struct{}
	requireSignatures bool
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
	// RequireSignatures forces every POST /whip to carry an EIP-191
	// signature of the SDP offer in X-Aevia-Signature, which must
	// recover to the address inside X-Aevia-DID. With the allowlist
	// (AuthorisedDIDs) the flow is:
	//   1. DID appears in allowlist → continue
	//   2. recovered signer address matches the DID's address → accept
	// Both must pass. If RequireSignatures is true but AuthorisedDIDs
	// is empty, any *signed* DID is accepted — the signature alone
	// binds the SDP to the creator's wallet, which is enough for
	// attribution / abuse logging without a static whitelist.
	RequireSignatures bool
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
	// RTCPFeedback advertises the transport features the browser SHOULD
	// use when the answer comes back. Critical:
	//   - "nack"              — lost RTP packet retransmission. Without
	//                           this, Chrome never retries a dropped
	//                           FU-A fragment, pion's H264Packet
	//                           silently reassembles with missing bytes,
	//                           and the resulting IDR has corrupt slice
	//                           entropy data. The segmenter then emits
	//                           an MPEG-TS segment that fails every
	//                           strict decoder (ffprobe "out of range
	//                           intra chroma pred mode", VLC "error
	//                           while decoding MB 0 1"). Evidence
	//                           gathered 2026-04-19 comparing Mac
	//                           localhost (0% loss, decode clean) vs
	//                           prod CF Tunnel path (packet loss,
	//                           decode fail despite identical pipeline).
	//   - "nack pli"          — picture loss indication. Browser sends
	//                           a fresh IDR when we detect decode is
	//                           beyond repair, so the HLS segment can
	//                           recover without breaking playback.
	//   - "ccm fir"           — full intra request, older path some
	//                           clients use instead of PLI.
	//   - "goog-remb"         — receiver estimated max bitrate, lets
	//                           Chrome adapt its encode to our reported
	//                           capacity (prevents bursts that cause loss).
	//   - "transport-cc"      — per-packet transport feedback used by
	//                           Chrome's congestion controller. With
	//                           transport-cc + default interceptors,
	//                           Chrome paces the encode to avoid the
	//                           bursts that provoke FU-A loss in the
	//                           first place.
	rtcpFb := []webrtc.RTCPFeedback{
		{Type: "nack"},
		{Type: "nack", Parameter: "pli"},
		{Type: "ccm", Parameter: "fir"},
		{Type: "goog-remb"},
		{Type: "transport-cc"},
	}
	for _, fmtp := range h264Profiles {
		if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
			RTPCodecCapability: webrtc.RTPCodecCapability{
				MimeType:     webrtc.MimeTypeH264,
				ClockRate:    90000,
				Channels:     0,
				SDPFmtpLine:  fmtp,
				RTCPFeedback: rtcpFb,
			},
			PayloadType: 0, // let MediaEngine assign
		}, webrtc.RTPCodecTypeVideo); err != nil {
			return nil, fmt.Errorf("whip: register h264 codec: %w", err)
		}
	}
	if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeOpus,
			ClockRate:    48000,
			Channels:     2,
			RTCPFeedback: []webrtc.RTCPFeedback{{Type: "transport-cc"}},
		},
		PayloadType: 0,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		return nil, fmt.Errorf("whip: register opus codec: %w", err)
	}
	// RegisterDefaultInterceptors wires the pion-maintained pipeline
	// for NACK (so we actually request retransmission when we detect
	// a seq gap), RTP sender/receiver reports, and TWCC feedback. The
	// default chain matches what the pion examples ship with and is
	// the assumed baseline for any production WebRTC receiver.
	ir := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(mediaEngine, ir); err != nil {
		return nil, fmt.Errorf("whip: register default interceptors: %w", err)
	}
	settings := webrtc.SettingEngine{}
	if len(opts.PublicIPs) > 0 {
		// NAT 1:1 rewrite — pion replaces its discovered host IPs with
		// the operator-supplied public IPs when building ICE candidates.
		// Without this, ICE stalls forever for clients outside the NAT.
		settings.SetNAT1To1IPs(opts.PublicIPs, webrtc.ICECandidateTypeHost)
	}
	// Loopback candidates are critical for same-host tests (and for any
	// scenario where a viewer and creator share a machine). Wi-Fi client
	// isolation on some networks also blocks peer discovery between two
	// IPs on the same subnet — loopback sidesteps that for co-resident
	// viewers like test harnesses.
	settings.SetIncludeLoopbackCandidate(true)
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine), webrtc.WithInterceptorRegistry(ir), webrtc.WithSettingEngine(settings))
	dids := make(map[string]struct{}, len(opts.AuthorisedDIDs))
	for _, did := range opts.AuthorisedDIDs {
		if did != "" {
			dids[did] = struct{}{}
		}
	}
	return &Server{
		api:               api,
		sessions:          make(map[string]*Session),
		sessionID:         newSessionID,
		authorisedDIDs:    dids,
		requireSignatures: opts.RequireSignatures,
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

	did := r.Header.Get("X-Aevia-DID")
	sigHex := r.Header.Get("X-Aevia-Signature")

	// Allowlist gate — empty allowlist means "anyone with any DID can
	// publish", useful for local dev + CI. Production MUST set it.
	if !s.checkAuth(did) {
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

	// Signature gate — cryptographically bind the SDP offer to the
	// creator's wallet. Required when RequireSignatures is set; when
	// it's off but the client SENT a signature, we still validate it
	// (incentivises clients to sign voluntarily and gives us defense-
	// in-depth once the public beta flips this on).
	if s.requireSignatures || sigHex != "" {
		if sigHex == "" {
			http.Error(w, "whip: X-Aevia-Signature required", http.StatusUnauthorized)
			return
		}
		sig, err := ParseHexSignature(sigHex)
		if err != nil {
			http.Error(w, "whip: parse signature: "+err.Error(), http.StatusUnauthorized)
			return
		}
		if err := VerifySignatureForDID(did, string(offerBytes), sig); err != nil {
			http.Error(w, "whip: "+err.Error(), http.StatusUnauthorized)
			return
		}
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

// ActiveSessionCount returns just the count — satisfies
// httpx.ActiveSessionCounter without paying the allocation cost of
// ActiveSessions() every time /healthz is scraped. Fase 2.2 candidate
// ranking reads this as the load term (β·load).
func (s *Server) ActiveSessionCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.sessions)
}

// InjectSession registers a pre-built Session under its own ID so that
// /whep/{id} can find it. Used by mirror.Server when it receives a
// fan-out stream from an origin — the mirror builds a Session via
// NewMirrorSession and injects it so viewers reach its hubs.
//
// OnSession callbacks are NOT fired for injected sessions: those
// callbacks wire origin-side behaviour (CMAF segmenter, DHT announce
// of the manifest CID) that should run once, on the origin. The
// mirror announces the sessionCID + joins the GossipSub topic via
// mirror.Server's own OnSession hook, which is assigned before
// mirror.Server.Start() is called — the ordering there is race-free
// by construction, unlike an InjectSession-level hook would be.
//
// Returns an error when the ID is already registered — mirror and
// origin on the same node would collide on ID; this guards that.
func (s *Server) InjectSession(sess *Session) error {
	if sess == nil {
		return errors.New("whip: InjectSession requires non-nil session")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.sessions[sess.ID]; exists {
		return fmt.Errorf("whip: session %s already registered", sess.ID)
	}
	s.sessions[sess.ID] = sess
	return nil
}

// RemoveSession drops a session from the registry and closes it.
// Idempotent: calling on an unknown ID is a no-op. Mirror.Server
// invokes this when the upstream stream closes.
func (s *Server) RemoveSession(id string) {
	s.mu.Lock()
	sess, ok := s.sessions[id]
	if ok {
		delete(s.sessions, id)
	}
	s.mu.Unlock()
	if ok {
		_ = sess.Close()
	}
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
