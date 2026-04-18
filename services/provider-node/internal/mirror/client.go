package mirror

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)

// Client is the origin's side of the protocol: it opens libp2p streams
// to each configured downstream mirror, sends a Header, and then
// forwards every RTP packet from the WHIP session to each stream.
//
// Typical wiring (in main.go's OnSession callback):
//
//	client := mirror.NewClient(host, mirrorPeers, logger)
//	whipSrv.OnSession(func(sess *whip.Session) {
//	    // ... existing segmenter/pinning wiring ...
//	    client.StartMirroring(ctx, sess, videoCodec, audioCodec)
//	})
//
// StartMirroring is safe to call even with zero mirror peers — it
// simply no-ops. This keeps the OnSession callback branch-free.
type Client struct {
	host    host.Host
	peers   []peer.ID
	log     *slog.Logger
	sendBuf int // per-sink channel buffer — number of in-flight RTP packets before backpressure drops

	// peerMetrics tracks hop latency per downstream peer across every
	// session the origin mirrors. Keyed by peer.ID; values persist
	// across session lifecycles so the Fase 2.2 candidate ranker has
	// stable history when re-selecting mirrors on the next WHIP session.
	peerMu       sync.Mutex
	peerMetrics  map[peer.ID]*HopMetrics
	nextProbeID  atomic.Uint64
}

// ClientOptions configures NewClient.
type ClientOptions struct {
	// SendBuffer is how many RTP packets queue per downstream sink
	// before we start dropping. Zero uses 1024 — empirically ~30s of
	// 50pkt/s audio or 30fps video at modest bitrate. Big enough to
	// absorb GC pauses, small enough to fail fast on a dead mirror.
	SendBuffer int
}

// NewClient wires a mirror client. peers is the list of downstream
// libp2p peer IDs we fan out to. Empty slice is valid — resulting
// StartMirroring calls no-op.
func NewClient(h host.Host, peers []peer.ID, logger *slog.Logger, opts ClientOptions) (*Client, error) {
	if h == nil {
		return nil, errors.New("mirror: client requires host")
	}
	if logger == nil {
		logger = slog.Default()
	}
	sendBuf := opts.SendBuffer
	if sendBuf <= 0 {
		sendBuf = 1024
	}
	return &Client{
		host:        h,
		peers:       peers,
		log:         logger,
		sendBuf:     sendBuf,
		peerMetrics: make(map[peer.ID]*HopMetrics),
	}, nil
}

// PeerMetrics returns the HopMetrics for a given peer, creating one
// lazily on first access. Safe for concurrent callers. The returned
// pointer is stable across the Client's lifetime.
func (c *Client) PeerMetrics(p peer.ID) *HopMetrics {
	c.peerMu.Lock()
	defer c.peerMu.Unlock()
	m, ok := c.peerMetrics[p]
	if !ok {
		m = NewHopMetrics()
		c.peerMetrics[p] = m
	}
	return m
}

// PeerMetricsSnapshot returns a copy of the current peer→metrics map
// for callers that want to log or serve the whole set (e.g. candidate
// ranking, /mirrors/candidates endpoint in Fase 2.2b).
func (c *Client) PeerMetricsSnapshot() map[peer.ID]*HopMetrics {
	c.peerMu.Lock()
	defer c.peerMu.Unlock()
	out := make(map[peer.ID]*HopMetrics, len(c.peerMetrics))
	for k, v := range c.peerMetrics {
		out[k] = v
	}
	return out
}

// MirrorPeers returns a snapshot of configured downstream peers.
// Empty when the operator did not enable mirroring. Exposed for
// logging + diagnostics in /live/{id}/stats.
func (c *Client) MirrorPeers() []peer.ID {
	out := make([]peer.ID, len(c.peers))
	copy(out, c.peers)
	return out
}

// StartMirroring opens one stream per configured mirror peer, sends
// the header, and attaches RTPSink-backed fan-outs to sess so every
// subsequent RTP packet is forwarded.
//
// Call-order invariant: MUST be called after the session has its hubs
// populated (i.e. inside OnSession AFTER EnsureHubFor / TeeReadTrack
// have set them up) so we can read the codec capabilities from the
// hub tracks. A simpler alternative — passing explicit codec caps —
// is on purpose not the default because the origin's pion session
// knows the actual negotiated codec, whereas an operator-supplied
// override could drift.
//
// Returns the number of streams successfully opened. Non-fatal errors
// are logged; callers don't need to handle the return value unless
// they want to abort the session when no mirror attached.
func (c *Client) StartMirroring(ctx context.Context, sess *whip.Session, videoCodec, audioCodec webrtc.RTPCodecCapability) int {
	if len(c.peers) == 0 {
		return 0
	}
	started := 0
	for _, p := range c.peers {
		if p == c.host.ID() {
			c.log.Debug("skip self as mirror peer", "peer_id", p.String())
			continue
		}
		stream, err := c.host.NewStream(ctx, p, MirrorProtocol)
		if err != nil {
			c.log.Warn("mirror open stream failed",
				"peer_id", p.String(),
				"session_id", sess.ID,
				"err", err.Error(),
			)
			continue
		}
		hdr := Header{
			SessionID:   sess.ID,
			StartedAtNS: sess.StartedAt.UnixNano(),
			Video:       fromRTPCapability(videoCodec),
			Audio:       fromRTPCapability(audioCodec),
		}
		if err := WriteHeader(stream, hdr); err != nil {
			c.log.Warn("mirror write header failed",
				"peer_id", p.String(),
				"err", err.Error(),
			)
			_ = stream.Reset()
			continue
		}

		// Start the forward goroutine with a per-stream channel that
		// owns writes. Multiple streams get multiple channels + gos;
		// keeps wire ordering intact per peer while isolating stalls.
		peerMetrics := c.PeerMetrics(p)
		sink := newStreamSink(stream, c.log.With("peer_id", p.String(), "session_id", sess.ID), c.sendBuf, peerMetrics, &c.nextProbeID)
		sess.AttachVideoSink(sink.video)
		sess.AttachAudioSink(sink.audio)
		go sink.run(ctx, sess)
		go sink.readEchoes(ctx, sess)

		c.log.Info("mirror stream started",
			"peer_id", p.String(),
			"session_id", sess.ID,
		)
		started++
	}
	return started
}

// streamSink is the per-peer fan-out engine. Video + audio sinks push
// into a single channel tagged by kind; the run goroutine drains and
// writes to the libp2p stream. Serialising through one channel per
// stream keeps wire order consistent and avoids concurrent writes to
// the stream (libp2p streams are not safe for concurrent writers).
//
// Fase 2.2 additions:
//   - metrics: per-peer HopMetrics accumulator for RTT + loss.
//   - probeIDCounter: shared across streams on the same Client so probe
//     IDs are globally unique (useful for cross-stream diagnostics).
//   - outstanding: probe_id → send_time_ns map with mutex. Populated
//     by the writer goroutine when a probe is sent, consumed + cleared
//     by the reader goroutine when an echo arrives.
type streamSink struct {
	stream network.Stream
	log    *slog.Logger
	ch     chan frameOut
	once   sync.Once
	closed chan struct{}

	video rtpSinkFn
	audio rtpSinkFn

	metrics        *HopMetrics
	probeIDCounter *atomic.Uint64

	outstandingMu sync.Mutex
	outstanding   map[uint64]time.Time
}

type frameOut struct {
	kind FrameType
	ts   int64
	pkt  *rtp.Packet
}

type rtpSinkFn func(*rtp.Packet) error

func (f rtpSinkFn) WriteRTP(pkt *rtp.Packet) error { return f(pkt) }

func newStreamSink(
	stream network.Stream,
	log *slog.Logger,
	buf int,
	metrics *HopMetrics,
	probeIDCounter *atomic.Uint64,
) *streamSink {
	s := &streamSink{
		stream:         stream,
		log:            log,
		ch:             make(chan frameOut, buf),
		closed:         make(chan struct{}),
		metrics:        metrics,
		probeIDCounter: probeIDCounter,
		outstanding:    make(map[uint64]time.Time),
	}
	s.video = func(pkt *rtp.Packet) error { return s.enqueue(FrameTypeVideoRTP, pkt) }
	s.audio = func(pkt *rtp.Packet) error { return s.enqueue(FrameTypeAudioRTP, pkt) }
	return s
}

func (s *streamSink) enqueue(kind FrameType, pkt *rtp.Packet) error {
	// Copy pion's Packet — pion reuses the underlying buffer across
	// ReadRTP calls, so downstream marshal inside the goroutine would
	// race with the next read. Cheap enough at tens of pkts/sec.
	clone := *pkt
	clone.Payload = append([]byte(nil), pkt.Payload...)
	out := frameOut{kind: kind, ts: time.Now().UnixNano(), pkt: &clone}
	select {
	case <-s.closed:
		return io.ErrClosedPipe
	case s.ch <- out:
		return nil
	default:
		// Channel full — we drop rather than block the origin's read
		// goroutine. Logged below at a sampled rate; full-blast log
		// in a storm would make things worse.
		return io.ErrShortBuffer
	}
}

func (s *streamSink) run(ctx context.Context, sess *whip.Session) {
	defer func() {
		_ = WriteCloseFrame(s.stream)
		_ = s.stream.Close()
		close(s.closed)
	}()
	dropped := 0
	lastDropLog := time.Now()

	// Fase 2.2 probe ticker: 1 Hz with ±100ms jitter (spec §4.5). Using
	// a ticker is enough — we reset it on each fire to get the jitter,
	// avoiding a rand call on the hot path when it isn't needed.
	probeTimer := time.NewTimer(probeInterval())
	defer probeTimer.Stop()
	// Expiry sweep timer — every 1s we drop outstanding probes older
	// than 5s and count them as loss (spec §4.6).
	sweepTicker := time.NewTicker(1 * time.Second)
	defer sweepTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-sess.Done():
			return
		case out := <-s.ch:
			raw, err := out.pkt.Marshal()
			if err != nil {
				s.log.Debug("rtp marshal failed", "err", err.Error())
				continue
			}
			if err := WriteRTPFrame(s.stream, out.kind, out.ts, raw); err != nil {
				s.log.Warn("mirror stream write failed", "err", err.Error())
				return
			}
			if dropped > 0 && time.Since(lastDropLog) > 5*time.Second {
				s.log.Warn("mirror buffer drops over last 5s",
					"dropped", dropped,
				)
				dropped = 0
				lastDropLog = time.Now()
			}
		case <-probeTimer.C:
			if err := s.sendProbe(); err != nil {
				s.log.Warn("probe write failed", "err", err.Error())
				return
			}
			probeTimer.Reset(probeInterval())
		case <-sweepTicker.C:
			s.sweepOutstanding(5 * time.Second)
		}
	}
}

// readEchoes is the sibling goroutine that consumes echo frames from
// the libp2p stream. It MUST NOT write — the writer goroutine owns
// the stream's write side. The split is safe because libp2p streams
// support concurrent read+write on distinct goroutines.
func (s *streamSink) readEchoes(ctx context.Context, sess *whip.Session) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-sess.Done():
			return
		case <-s.closed:
			return
		default:
		}
		frame, err := ReadAnyFrame(s.stream)
		if err != nil {
			// EOF on stream close is the expected end; anything else is
			// logged at debug because the writer side may already be
			// shutting down when we land here.
			if !errors.Is(err, io.EOF) {
				s.log.Debug("read echo frame", "err", err.Error())
			}
			return
		}
		if frame.Type != FrameTypeProbeEcho || frame.Probe == nil {
			// Ignore unknown frame types on the read side — the origin
			// never expects anything but echoes back from a mirror.
			continue
		}
		s.outstandingMu.Lock()
		sentAt, ok := s.outstanding[frame.Probe.ProbeID]
		if ok {
			delete(s.outstanding, frame.Probe.ProbeID)
		}
		s.outstandingMu.Unlock()
		if !ok {
			// Echo arrived after we already expired it, or for an id we
			// never sent (shouldn't happen but robust against a buggy
			// peer that echoes stale ids).
			continue
		}
		rtt := time.Since(sentAt)
		s.metrics.RecordEcho(rtt)
	}
}

func (s *streamSink) sendProbe() error {
	id := s.probeIDCounter.Add(1)
	now := time.Now()
	s.outstandingMu.Lock()
	s.outstanding[id] = now
	s.outstandingMu.Unlock()
	return WriteProbe(s.stream, ProbeFrame{
		ProbeID: id,
		SendNS:  uint64(now.UnixNano()),
	})
}

func (s *streamSink) sweepOutstanding(maxAge time.Duration) {
	cutoff := time.Now().Add(-maxAge)
	var lost uint32
	s.outstandingMu.Lock()
	for id, t := range s.outstanding {
		if t.Before(cutoff) {
			delete(s.outstanding, id)
			lost++
		}
	}
	s.outstandingMu.Unlock()
	for i := uint32(0); i < lost; i++ {
		s.metrics.IncProbeLoss()
	}
}

// probeInterval returns the per-probe wait: 1s ±100ms. Spec §4.5.
func probeInterval() time.Duration {
	const base = 1 * time.Second
	const jitter = 100 * time.Millisecond
	// rand.Int63n is fine here — this isn't security-sensitive.
	delta := time.Duration(rand.Int63n(int64(2*jitter))) - jitter
	return base + delta
}

// fromRTPCapability converts pion's codec capability to our wire
// descriptor. Zero-value capability ⇒ zero-value CodecInfo (mime ==
// "") so the wire header signals "no track of this kind".
func fromRTPCapability(c webrtc.RTPCodecCapability) CodecInfo {
	if c.MimeType == "" {
		return CodecInfo{}
	}
	return CodecInfo{
		MimeType:    c.MimeType,
		ClockRate:   c.ClockRate,
		Channels:    c.Channels,
		SDPFmtpLine: c.SDPFmtpLine,
	}
}

// sentinel used above for code paths that we expect won't be hit.
var _ = fmt.Sprintf
