package whip

import (
	"fmt"
	"io"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v4"
)

// VideoFrame is one H.264 access unit — one logical video frame,
// potentially spread across multiple RTP packets.
type VideoFrame struct {
	NAL       []byte // Annex-B NAL unit bytes (no start-code prefix)
	Timestamp uint32 // RTP timestamp (90 kHz clock for H.264 per RFC 6184)
	Arrived   time.Time
	Keyframe  bool
}

// AudioFrame is one Opus packet.
type AudioFrame struct {
	Opus      []byte
	Timestamp uint32 // RTP timestamp (typically 48 kHz for Opus)
	Arrived   time.Time
}

// FrameSink receives extracted video + audio frames from an ingest track.
// Implementations buffer into CMAF segments (M8-i3) or forward to a WHEP
// replay pipeline (M8-i8).
type FrameSink interface {
	OnVideoFrame(f VideoFrame)
	OnAudioFrame(f AudioFrame)
}

// TeeFrameSink fans out every VideoFrame / AudioFrame to N underlying
// sinks in registration order. Use when one logical ingest feeds
// multiple independent consumers — e.g. gohlslib HLSMuxer (HTTP HLS
// serving) running alongside LivePinSink+CMAFSegmenter (Merkle-leaf
// accumulation for VOD manifest).
//
// The tee holds no state beyond the sink list; each sink owns its
// own backpressure and error handling. A panicking sink will take the
// whole RTP pump down — sinks are expected to swallow their own errors.
type TeeFrameSink struct {
	sinks []FrameSink
}

// NewTeeFrameSink constructs a tee from the given sinks. nil entries
// are filtered out so callers can conditionally compose the list.
func NewTeeFrameSink(sinks ...FrameSink) *TeeFrameSink {
	live := make([]FrameSink, 0, len(sinks))
	for _, s := range sinks {
		if s != nil {
			live = append(live, s)
		}
	}
	return &TeeFrameSink{sinks: live}
}

func (t *TeeFrameSink) OnVideoFrame(f VideoFrame) {
	for _, s := range t.sinks {
		s.OnVideoFrame(f)
	}
}

func (t *TeeFrameSink) OnAudioFrame(f AudioFrame) {
	for _, s := range t.sinks {
		s.OnAudioFrame(f)
	}
}

// ReadTrack pumps RTP off a pion TrackRemote, depacketizes to H.264 or
// Opus, and forwards each frame to the sink. Returns when the track
// signals EOF (creator disconnected).
//
// The caller is responsible for running this in a goroutine per track
// (audio + video are separate tracks in a WHIP session). Use TeeReadTrack
// when WHEP viewers also need the raw RTP stream.
func ReadTrack(track *webrtc.TrackRemote, sink FrameSink) error {
	return TeeReadTrack(track, nil, sink)
}

// TeeReadTrack is ReadTrack with an optional fan-out hub. When hub is
// non-nil, every raw RTP packet pulled off the remote track is first
// written to the hub (which pion relays to every PeerConnection that
// bound hub.AddTrack) and then depacketized for the sink.
//
// This is the single-reader SFU pattern pion recommends: one goroutine
// owns the TrackRemote; fan-out and application consumers both live
// downstream of it.
func TeeReadTrack(track *webrtc.TrackRemote, hub *webrtc.TrackLocalStaticRTP, sink FrameSink) error {
	if track == nil || sink == nil {
		return fmt.Errorf("whip: TeeReadTrack requires track and sink")
	}
	switch track.Kind() {
	case webrtc.RTPCodecTypeVideo:
		return teeVideoTrack(track, hub, nil, sink)
	case webrtc.RTPCodecTypeAudio:
		return teeAudioTrack(track, hub, nil, sink)
	default:
		return fmt.Errorf("whip: unsupported track kind %v", track.Kind())
	}
}

// TeeReadSessionTrack is TeeReadTrack that ALSO fans out every RTP
// packet to the session's registered RTPSinks (mirror clients). Use
// this form when the node is an origin for a mirror stream. Hub is
// resolved from the session based on track kind, matching what
// EnsureHubFor populated.
func TeeReadSessionTrack(track *webrtc.TrackRemote, sess *Session, sink FrameSink) error {
	if track == nil || sess == nil || sink == nil {
		return fmt.Errorf("whip: TeeReadSessionTrack requires track, session, and sink")
	}
	switch track.Kind() {
	case webrtc.RTPCodecTypeVideo:
		return teeVideoTrack(track, sess.VideoHub(), sess.fanOutVideoRTP, sink)
	case webrtc.RTPCodecTypeAudio:
		return teeAudioTrack(track, sess.AudioHub(), sess.fanOutAudioRTP, sink)
	default:
		return fmt.Errorf("whip: unsupported track kind %v", track.Kind())
	}
}

// onRTP is the per-packet fan-out hook invoked after hub.WriteRTP.
// Use nil when no additional sinks are desired.
type onRTP func(*rtp.Packet)

func teeVideoTrack(track *webrtc.TrackRemote, hub *webrtc.TrackLocalStaticRTP, tap onRTP, sink FrameSink) error {
	depack := &codecs.H264Packet{IsAVC: false}
	for {
		pkt, _, err := track.ReadRTP()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if hub != nil {
			// Fan-out to every WHEP viewer subscribed to this hub.
			// Errors here are non-fatal — a slow consumer shouldn't
			// kill the publisher. pion queues per-sender.
			_ = hub.WriteRTP(pkt)
		}
		if tap != nil {
			// Fan-out to mirror sinks. Same non-fatal semantics as hub.
			tap(pkt)
		}
		nal, err := depack.Unmarshal(pkt.Payload)
		if err != nil {
			// Non-fatal: depacketization can fail on fragmented frames
			// or when we join mid-stream. Skip and keep reading.
			continue
		}
		if len(nal) == 0 {
			continue
		}
		sink.OnVideoFrame(VideoFrame{
			NAL:       nal,
			Timestamp: pkt.Timestamp,
			Arrived:   time.Now(),
			Keyframe:  isKeyframe(nal),
		})
	}
}

func teeAudioTrack(track *webrtc.TrackRemote, hub *webrtc.TrackLocalStaticRTP, tap onRTP, sink FrameSink) error {
	for {
		pkt, _, err := track.ReadRTP()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if hub != nil {
			_ = hub.WriteRTP(pkt)
		}
		if tap != nil {
			tap(pkt)
		}
		sink.OnAudioFrame(AudioFrame{
			Opus:      append([]byte(nil), pkt.Payload...),
			Timestamp: pkt.Timestamp,
			Arrived:   time.Now(),
		})
	}
}

// isKeyframe inspects an Annex-B NAL (or a concatenation of NALs
// returned by pion's depacketizer) to see whether it contains an
// IDR (NAL unit type 5). The presence of an IDR at the start of a
// segment is what makes the segment seekable / playable cold.
//
// Pion emits depacketized NALs WITHOUT the 3-byte / 4-byte start code
// prefix, so we read the NAL header byte directly.
func isKeyframe(nal []byte) bool {
	if len(nal) == 0 {
		return false
	}
	// Check every 4-byte delimited NAL unit inside the buffer — pion
	// sometimes concatenates the SPS/PPS/IDR triplet.
	for offset := 0; offset < len(nal); {
		// Find next 00 00 00 01 start code.
		next := findStartCode(nal[offset:])
		var unit []byte
		if next < 0 {
			unit = nal[offset:]
			offset = len(nal)
		} else {
			unit = nal[offset : offset+next]
			offset += next + 4
		}
		if len(unit) == 0 {
			continue
		}
		// NAL unit type is low 5 bits of first byte.
		if unit[0]&0x1F == 5 {
			return true
		}
	}
	return false
}

func findStartCode(buf []byte) int {
	for i := 0; i+3 < len(buf); i++ {
		if buf[i] == 0 && buf[i+1] == 0 && buf[i+2] == 0 && buf[i+3] == 1 {
			return i
		}
	}
	return -1
}

// buildSyntheticRTP helps tests construct one-shot RTP packets with a
// canned payload — used by frames_test.go and the M8-i9 E2E fixture.
// Not part of the production API; exported only so sibling internal
// packages (tests) can reuse.
func buildSyntheticRTP(seq uint16, ts uint32, marker bool, payload []byte) *rtp.Packet {
	return &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			Marker:         marker,
			PayloadType:    96,
			SequenceNumber: seq,
			Timestamp:      ts,
		},
		Payload: append([]byte(nil), payload...),
	}
}
