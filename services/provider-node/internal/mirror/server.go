package mirror

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

// Server is the mirror's side of the protocol: it accepts incoming
// libp2p streams from origin providers, reads the header to learn
// what session is landing, spawns a whip.Session with matching hubs,
// injects that session into the local whip.Server so /whep viewers
// can subscribe, and pumps RTP packets from the stream into the hubs.
//
// One mirror.Server instance is enough per provider-node. Sessions are
// ephemeral — created on stream open, torn down on stream close.
//
// Hop-latency metrics are collected per session via HopMetrics and
// exposed through OnSession callbacks (wired in main.go to the
// structured logger).
type Server struct {
	host    host.Host
	whipSrv *whip.Server
	log     *slog.Logger

	// OnSession is fired when a mirror session materialises. Callers
	// typically use this to announce the sessionCID in the DHT so
	// viewers find the mirror. Errors inside the callback are logged
	// but non-fatal — the mirror session still runs.
	OnSession func(sess *whip.Session)

	// OnClose fires when a mirror session tears down (stream EOF,
	// remote close, or read error). Useful for DHT un-announcement
	// or metric finalisation.
	OnClose func(sessionID string, metrics *HopMetrics)
}

// NewServer wires up a mirror server. Pass the same libp2p host the
// node uses for DHT; pass the local whip.Server so injected sessions
// are reachable via /whep.
func NewServer(h host.Host, whipSrv *whip.Server, logger *slog.Logger) (*Server, error) {
	if h == nil {
		return nil, errors.New("mirror: host required")
	}
	if whipSrv == nil {
		return nil, errors.New("mirror: whip.Server required")
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{host: h, whipSrv: whipSrv, log: logger}, nil
}

// Start registers the libp2p stream handler for MirrorProtocol. Call
// once at node boot. Subsequent origins dialing this host will land in
// handleStream.
func (s *Server) Start(_ context.Context) {
	s.host.SetStreamHandler(MirrorProtocol, s.handleStream)
	s.log.Info("mirror server listening",
		"proto", string(MirrorProtocol),
		"peer_id", s.host.ID().String(),
	)
}

// Stop unregisters the stream handler. In-flight streams keep running
// until they naturally close — libp2p does not forcibly tear down
// ongoing streams when a handler is removed.
func (s *Server) Stop() {
	s.host.RemoveStreamHandler(MirrorProtocol)
}

func (s *Server) handleStream(stream network.Stream) {
	remote := stream.Conn().RemotePeer().String()
	log := s.log.With("remote_peer", remote, "event", "mirror_stream")
	defer func() {
		_ = stream.Close()
	}()

	header, err := ReadHeader(stream)
	if err != nil {
		log.Warn("read header failed", "err", err.Error())
		_ = stream.Reset()
		return
	}
	log = log.With("session_id", header.SessionID)

	video := toRTPCapability(header.Video)
	audio := toRTPCapability(header.Audio)
	sess, err := whip.NewMirrorSession(header.SessionID, video, audio)
	if err != nil {
		log.Error("create mirror session", "err", err.Error())
		_ = stream.Reset()
		return
	}
	if err := s.whipSrv.InjectSession(sess); err != nil {
		log.Error("inject mirror session", "err", err.Error())
		_ = sess.Close()
		_ = stream.Reset()
		return
	}
	log.Info("mirror session ready",
		"video_mime", header.Video.MimeType,
		"audio_mime", header.Audio.MimeType,
		"started_at_ns", header.StartedAtNS,
	)
	if s.OnSession != nil {
		s.OnSession(sess)
	}

	metrics := NewHopMetrics()
	defer func() {
		s.whipSrv.RemoveSession(sess.ID)
		if s.OnClose != nil {
			s.OnClose(sess.ID, metrics)
		}
		log.Info("mirror session closed",
			"video_pkts", metrics.VideoCount(),
			"audio_pkts", metrics.AudioCount(),
			"probe_pkts", metrics.ProbeCount(),
			"hop_p50_walltime_ns", metrics.P50Nanos(),
			"hop_p95_walltime_ns", metrics.P95Nanos(),
			"hop_p50_echo_ns", metrics.EchoP50Nanos(),
			"hop_p95_echo_ns", metrics.EchoP95Nanos(),
			"hop_echo_ema_ns", metrics.EchoEMA().Nanoseconds(),
		)
	}()

	videoHub := sess.VideoHub()
	audioHub := sess.AudioHub()
	for {
		frame, err := ReadAnyFrame(stream)
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			log.Warn("read frame", "err", err.Error())
			return
		}
		switch frame.Type {
		case FrameTypeVideoRTP, FrameTypeAudioRTP:
			if frame.RTP == nil {
				continue
			}
			pkt := &rtp.Packet{}
			if err := pkt.Unmarshal(frame.RTP.RTP); err != nil {
				log.Debug("malformed rtp", "err", err.Error())
				continue
			}
			hop := time.Duration(time.Now().UnixNano() - frame.RTP.OriginNS)
			if frame.Type == FrameTypeVideoRTP {
				if videoHub != nil {
					_ = videoHub.WriteRTP(pkt)
				}
				metrics.RecordVideo(hop)
			} else {
				if audioHub != nil {
					_ = audioHub.WriteRTP(pkt)
				}
				metrics.RecordAudio(hop)
			}
		case FrameTypeProbe:
			// Echo back immediately. Stream writes are already serialised
			// by the single-writer invariant of libp2p streams, so the
			// echo simply races ahead of the next RTP write if one is
			// pending. Spec §4.7.3.
			if frame.Probe == nil {
				continue
			}
			if err := WriteProbeEcho(stream, *frame.Probe); err != nil {
				log.Warn("write probe echo", "err", err.Error())
				return
			}
		}
	}
}

// toRTPCapability converts the wire codec descriptor to pion's
// capability struct, used to build TrackLocalStaticRTP hubs. Returns
// zero-value capability when MimeType is empty (no track of this
// kind in the session).
func toRTPCapability(c CodecInfo) webrtc.RTPCodecCapability {
	if c.MimeType == "" {
		return webrtc.RTPCodecCapability{}
	}
	return webrtc.RTPCodecCapability{
		MimeType:    c.MimeType,
		ClockRate:   c.ClockRate,
		Channels:    uint16(c.Channels),
		SDPFmtpLine: c.SDPFmtpLine,
	}
}

// errorOnNil is a thin helper for readable guards.
func errorOnNil(v any, name string) error {
	if v == nil {
		return fmt.Errorf("mirror: %s is required", name)
	}
	return nil
}
