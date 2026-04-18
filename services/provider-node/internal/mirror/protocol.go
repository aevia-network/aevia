// Package mirror implements Aevia's multi-origin SFU fan-out via libp2p
// streams. One WHIP-ingesting provider (the "origin") replicates its
// RTP stream to N downstream providers (the "mirrors"). Each mirror
// runs its own TrackLocalStaticRTP hub and serves /whep viewers
// exactly like the origin would — but from a location closer to its
// viewers.
//
// The thesis: a live stream's topology should match the viewer
// distribution, not the origin's geography. With 3 providers in
// 3 regions, a viewer on the other side of the world still watches
// with one hop to the nearest mirror, not 2 hops to the origin.
//
// Wire format — framed binary stream:
//
//	Frame 0 (mandatory, once, stream start):
//	  [FrameTypeHeader=0x01][len: u32 BE][JSON header]
//
//	RTP frames (any order, any count):
//	  [FrameTypeVideoRTP=0x02 | FrameTypeAudioRTP=0x03]
//	    [origin_ns: u64 BE] — wall-clock nanos when origin tapped the packet
//	    [len: u32 BE]
//	    [RTP packet bytes, raw pion rtp.Packet.Marshal() output]
//
//	Optional close frame:
//	  [FrameTypeClose=0x04]
//
// The origin_ns on every RTP frame enables honest hop-latency
// measurement: mirror computes `now - origin_ns` when the packet lands.
// Paired with /latency-probe's Server-Timing header (Fase 2.0) this
// gives a complete picture: origin→mirror hop + mirror→viewer RTT.
//
// All multi-byte integers are big-endian (network byte order).
//
// Stream lifecycle:
//  1. Origin opens stream with protocol ID MirrorProtocol.
//  2. Origin writes the header frame immediately.
//  3. Origin writes RTP frames as they arrive from the WHIP creator.
//  4. Origin may write a close frame; OR the stream closes (EOF)
//     when the WHIP session ends.
//  5. Mirror tears down its session on stream close.
package mirror

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/libp2p/go-libp2p/core/protocol"
)

// MirrorProtocol is the libp2p stream protocol ID for RTP mirror traffic.
const MirrorProtocol protocol.ID = "/aevia/mirror/rtp/1.0.0"

// FrameType is the 1-byte discriminator at the start of every frame.
type FrameType uint8

const (
	FrameTypeHeader   FrameType = 0x01
	FrameTypeVideoRTP FrameType = 0x02
	FrameTypeAudioRTP FrameType = 0x03
	FrameTypeClose    FrameType = 0x04
)

// MaxFrameBytes guards against memory blow-up on a malicious or buggy
// peer. RTP packets are <1500 bytes; the JSON header is a few hundred
// bytes. 64 KiB is ample and fits safely in a single io.ReadFull call.
const MaxFrameBytes = 64 * 1024

// CodecInfo is the subset of pion's RTPCodecCapability needed to
// recreate a TrackLocalStaticRTP hub on the mirror. Empty MimeType
// means "no track of this kind in this session".
type CodecInfo struct {
	MimeType    string `json:"mime"`
	ClockRate   uint32 `json:"clock_rate"`
	Channels    uint16 `json:"channels,omitempty"`
	SDPFmtpLine string `json:"sdp_fmtp_line,omitempty"`
}

// Header is the first frame of every mirror stream. It tells the
// mirror what session it's getting and which codecs to configure.
type Header struct {
	SessionID   string    `json:"session_id"`
	StartedAtNS int64     `json:"started_at_ns"`
	Video       CodecInfo `json:"video,omitempty"`
	Audio       CodecInfo `json:"audio,omitempty"`
}

// WriteHeader writes frame 0 to w.
func WriteHeader(w io.Writer, h Header) error {
	body, err := json.Marshal(h)
	if err != nil {
		return fmt.Errorf("mirror: marshal header: %w", err)
	}
	if len(body) > MaxFrameBytes {
		return fmt.Errorf("mirror: header body %d > MaxFrameBytes %d", len(body), MaxFrameBytes)
	}
	return writeFrame(w, FrameTypeHeader, nil, body)
}

// ReadHeader reads and parses frame 0 from r. Callers MUST call this
// before any ReadRTPFrame on the same reader.
func ReadHeader(r io.Reader) (Header, error) {
	ft, _, body, err := readFrame(r)
	if err != nil {
		return Header{}, err
	}
	if ft != FrameTypeHeader {
		return Header{}, fmt.Errorf("mirror: expected header frame, got 0x%02x", ft)
	}
	var h Header
	if err := json.Unmarshal(body, &h); err != nil {
		return Header{}, fmt.Errorf("mirror: decode header: %w", err)
	}
	return h, nil
}

// WriteRTPFrame writes one RTP packet with its origin timestamp.
// kind must be FrameTypeVideoRTP or FrameTypeAudioRTP.
func WriteRTPFrame(w io.Writer, kind FrameType, originNS int64, rtp []byte) error {
	if kind != FrameTypeVideoRTP && kind != FrameTypeAudioRTP {
		return fmt.Errorf("mirror: invalid RTP frame kind 0x%02x", kind)
	}
	if len(rtp) > MaxFrameBytes {
		return fmt.Errorf("mirror: RTP body %d > MaxFrameBytes %d", len(rtp), MaxFrameBytes)
	}
	tsBuf := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBuf, uint64(originNS))
	return writeFrame(w, kind, tsBuf, rtp)
}

// RTPFrame is the parsed result of ReadFrame when the frame type is
// video or audio RTP. OriginNS is the wall-clock ns stamped by the
// origin when the packet was tapped; callers compute hop latency as
// `time.Now().UnixNano() - OriginNS`.
type RTPFrame struct {
	Kind     FrameType // FrameTypeVideoRTP or FrameTypeAudioRTP
	OriginNS int64
	RTP      []byte
}

// HopLatency returns the wire delay in nanoseconds, measured from the
// origin's timestamp to now.
func (f RTPFrame) HopLatency() time.Duration {
	return time.Duration(time.Now().UnixNano() - f.OriginNS)
}

// ReadFrame reads the next frame. Returns io.EOF when the stream is
// exhausted. Callers typically loop until EOF OR a close frame.
//
// On a close frame: returns (FrameTypeClose, nil, io.EOF) so callers
// can uniformly end the loop with `if err != nil { break }`.
func ReadFrame(r io.Reader) (FrameType, *RTPFrame, error) {
	ft, tsBuf, body, err := readFrame(r)
	if err != nil {
		return 0, nil, err
	}
	switch ft {
	case FrameTypeVideoRTP, FrameTypeAudioRTP:
		if len(tsBuf) != 8 {
			return ft, nil, fmt.Errorf("mirror: RTP frame missing 8-byte origin_ns prefix (got %d)", len(tsBuf))
		}
		return ft, &RTPFrame{
			Kind:     ft,
			OriginNS: int64(binary.BigEndian.Uint64(tsBuf)),
			RTP:      body,
		}, nil
	case FrameTypeClose:
		return FrameTypeClose, nil, io.EOF
	case FrameTypeHeader:
		return FrameTypeHeader, nil, fmt.Errorf("mirror: unexpected repeated header frame")
	default:
		return ft, nil, fmt.Errorf("mirror: unknown frame type 0x%02x", ft)
	}
}

// WriteCloseFrame writes the optional close sentinel. The mirror will
// also treat io.EOF as end-of-stream, so callers may skip this if they
// close the libp2p stream cleanly.
func WriteCloseFrame(w io.Writer) error {
	return writeFrame(w, FrameTypeClose, nil, nil)
}

// writeFrame is the low-level frame writer. prefix is an optional
// additional header between FrameType+Len and body — used by RTP
// frames for the 8-byte origin_ns.
func writeFrame(w io.Writer, ft FrameType, prefix []byte, body []byte) error {
	hdr := make([]byte, 1+4)
	hdr[0] = byte(ft)
	binary.BigEndian.PutUint32(hdr[1:], uint32(len(body)))
	if _, err := w.Write(hdr); err != nil {
		return fmt.Errorf("mirror: write frame header: %w", err)
	}
	if len(prefix) > 0 {
		if _, err := w.Write(prefix); err != nil {
			return fmt.Errorf("mirror: write frame prefix: %w", err)
		}
	}
	if len(body) > 0 {
		if _, err := w.Write(body); err != nil {
			return fmt.Errorf("mirror: write frame body: %w", err)
		}
	}
	return nil
}

// readFrame reads the low-level frame back. For RTP frames the 8-byte
// origin_ns is returned in prefix; otherwise prefix is nil.
func readFrame(r io.Reader) (ft FrameType, prefix, body []byte, err error) {
	hdr := make([]byte, 1+4)
	if _, err := io.ReadFull(r, hdr); err != nil {
		return 0, nil, nil, err
	}
	ft = FrameType(hdr[0])
	bodyLen := binary.BigEndian.Uint32(hdr[1:])
	if bodyLen > MaxFrameBytes {
		return ft, nil, nil, fmt.Errorf("mirror: frame body %d > MaxFrameBytes %d", bodyLen, MaxFrameBytes)
	}
	switch ft {
	case FrameTypeVideoRTP, FrameTypeAudioRTP:
		prefix = make([]byte, 8)
		if _, err := io.ReadFull(r, prefix); err != nil {
			return ft, nil, nil, fmt.Errorf("mirror: read origin_ns: %w", err)
		}
	case FrameTypeHeader, FrameTypeClose:
		// no prefix
	default:
		return ft, nil, nil, fmt.Errorf("mirror: unknown frame type 0x%02x", ft)
	}
	if bodyLen > 0 {
		body = make([]byte, bodyLen)
		if _, err := io.ReadFull(r, body); err != nil {
			return ft, prefix, nil, fmt.Errorf("mirror: read body: %w", err)
		}
	}
	return ft, prefix, body, nil
}
