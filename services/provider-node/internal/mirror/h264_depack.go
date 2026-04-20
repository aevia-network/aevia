package mirror

import (
	"github.com/pion/rtp/codecs"
)

// fuaTypeByte is the H.264 RTP payload discriminator for Fragmentation
// Unit Type A — the NAL type lives in the low 5 bits of the first
// payload byte (RFC 6184 §5.8).
const fuaNALType = 28

// h264SeqAwareDepacketizer wraps pion's codecs.H264Packet with
// sequence-number awareness. When a middle FU-A fragment arrives with
// a gap in the RTP sequence space the internal reassembly buffer is
// stale — continuing to feed it would eventually emit a half-fragmented
// NAL whose slice payload is corrupt from byte-one. Pion's depacketizer
// has no Reset method, so the only safe recovery is to replace the
// instance wholesale and drop the in-flight fragment.
//
// This is the same bug class we fixed on origin via RTCP NACK: mirror
// hop is nominally reliable (libp2p streams deliver in order on a
// single stream) but packets can still be missing because the origin
// didn't retransmit them before forwarding, or because the mirror
// reattaches to a stream mid-session (reconnect path). Either way the
// result is the same — gaps in the RTP seq space need a hard reset.
//
// Returns the NAL bytes when a complete access unit is assembled,
// (nil, false) on a gap-induced drop, and (nil, true) when the frame
// is swallowed for being a mid-FU-A fragment that the depacketizer
// has not yet emitted. True in the second bool means "no error, just
// keep feeding".
type h264SeqAwareDepacketizer struct {
	inner *codecs.H264Packet

	// hasLast is false before the first packet — we cannot assert
	// continuity against an empty history.
	hasLast bool
	lastSeq uint16

	// dropCount counts FU-A fragments we dropped due to sequence
	// gaps. Exposed via DropCount for test assertions and structured
	// logging.
	dropCount uint64
}

// newH264SeqAwareDepacketizer builds a depacketizer with a fresh
// internal H264Packet. One per session — the underlying H264Packet
// carries FU-A reassembly state, so sharing would corrupt mixed
// streams.
func newH264SeqAwareDepacketizer() *h264SeqAwareDepacketizer {
	return &h264SeqAwareDepacketizer{
		inner: &codecs.H264Packet{IsAVC: false},
	}
}

// DropCount returns how many FU-A fragments the depacketizer has
// discarded due to sequence gaps over its lifetime.
func (d *h264SeqAwareDepacketizer) DropCount() uint64 {
	return d.dropCount
}

// Depacketize consumes one RTP payload + its sequence number. Returns
// (nal, ok, dropped):
//
//   - nal   — non-nil when pion's Unmarshal emitted a complete access
//     unit (one NAL or a concatenated STAP-A bundle).
//   - ok    — true when the packet was processed successfully. false
//     only on pion's own Unmarshal errors (malformed payloads).
//   - dropped — true when we detected a sequence gap mid-FU-A and
//     tore down + rebuilt the inner depacketizer. Caller should log
//     but continue feeding; the depacketizer will re-sync on the
//     next FU-A start fragment.
func (d *h264SeqAwareDepacketizer) Depacketize(seq uint16, payload []byte) (nal []byte, ok bool, dropped bool) {
	// Detect gap ONLY on FU-A middle/end fragments. Pion emits the
	// fully reassembled NAL only on the FU-A END fragment, so a gap
	// in the middle (or between middle and end) leaves the internal
	// buffer with a partial NAL that will then be appended to the
	// next FU-A start's partial — producing garbage.
	//
	// FU-A START fragments are fine to receive at ANY sequence —
	// they begin a new NAL regardless of what came before. Similarly,
	// non-FU-A packets (single NAL, STAP-A) never add to the
	// reassembly buffer so a gap before them is irrelevant.
	if d.hasLast && isFUAMidOrEnd(payload) {
		expected := d.lastSeq + 1 // uint16 wraps naturally at 65535→0
		if seq != expected {
			// Gap detected. Drop the currently-buffered reassembly by
			// replacing the depacketizer. Do NOT forward the fragment —
			// it belongs to a NAL whose prefix we already missed.
			d.inner = &codecs.H264Packet{IsAVC: false}
			d.dropCount++
			d.lastSeq = seq
			d.hasLast = true
			return nil, true, true
		}
	}

	nal, err := d.inner.Unmarshal(payload)
	// Always advance the sequence pointer, even on unmarshal error —
	// otherwise a single bad packet would make every subsequent packet
	// look like a gap.
	d.lastSeq = seq
	d.hasLast = true

	if err != nil {
		return nil, false, false
	}
	return nal, true, false
}

// isFUA returns true when the RTP payload's first byte identifies a
// Fragmentation Unit Type A (NAL type 28). Valid for H.264 payloads.
func isFUA(payload []byte) bool {
	if len(payload) == 0 {
		return false
	}
	return payload[0]&0x1F == fuaNALType
}

// isFUAMidOrEnd returns true ONLY when the payload is an FU-A fragment
// whose S (start) bit is 0 — i.e. a middle or end fragment. FU-A START
// fragments (S=1) begin a new NAL and are safe at any sequence number.
//
// FU-A payload layout (RFC 6184 §5.8):
//
//	byte 0: FU indicator  (F | NRI | Type=28)
//	byte 1: FU header     (S | E | R | NAL-type[5 bits])
//
// S bit is the MSB of byte 1.
func isFUAMidOrEnd(payload []byte) bool {
	if len(payload) < 2 {
		return false
	}
	if payload[0]&0x1F != fuaNALType {
		return false
	}
	// S bit == 0 means NOT a start → middle or end.
	return payload[1]&0x80 == 0
}
