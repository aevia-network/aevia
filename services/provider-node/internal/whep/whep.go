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
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
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
	return &Server{whipSrv: opts.WhipServer, api: api}, nil
}

// HandlerRegistrar matches *http.ServeMux.HandleFunc.
type HandlerRegistrar interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// Register wires POST /whep/{sessionID} into r.
func (s *Server) Register(r HandlerRegistrar) {
	r.HandleFunc("POST /whep/{sessionID}", s.handleWhep)
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

	// End the viewer PC when the WHIP session ends. We deliberately do
	// NOT tie the PC lifetime to r.Context() — that context cancels the
	// moment the HTTP answer is written, which would kill the PC before
	// ICE completes and RTP flows. The PC is torn down later by
	// OnConnectionStateChange (Failed / Closed / Disconnected) or when
	// the upstream session ends.
	go func() {
		<-sess.Done()
		_ = pc.Close()
	}()

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed ||
			state == webrtc.PeerConnectionStateClosed ||
			state == webrtc.PeerConnectionStateDisconnected {
			_ = pc.Close()
		}
	})

	offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: string(offerBytes)}
	if err := pc.SetRemoteDescription(offer); err != nil {
		_ = pc.Close()
		http.Error(w, "whep: set remote desc: "+err.Error(), http.StatusBadRequest)
		return
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		http.Error(w, "whep: create answer: "+err.Error(), http.StatusInternalServerError)
		return
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		http.Error(w, "whep: set local desc: "+err.Error(), http.StatusInternalServerError)
		return
	}
	select {
	case <-gather:
	case <-time.After(10 * time.Second):
		_ = pc.Close()
		http.Error(w, "whep: ICE gathering timeout", http.StatusGatewayTimeout)
		return
	}

	answerSDP := pc.LocalDescription().SDP
	w.Header().Set("Content-Type", "application/sdp")
	w.Header().Set("Location", "/whep/"+sessionID+"/viewer")
	w.Header().Set("Content-Length", strconv.Itoa(len(answerSDP)))
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(answerSDP))
}
