package whip

import "github.com/pion/rtp"

// TestSinkPushVideo drives the session's video fan-out sinks without
// needing a live pion TrackRemote. Used by integration tests in the
// mirror package (and any future fuzzing). Production code goes
// through TeeReadSessionTrack → fanOutVideoRTP; this helper is the
// test-only shortcut.
//
// Not export-worthy for a protocol-stable API — lives in a _helpers
// file because go test compiles it but external callers who depend on
// it are rightfully flagged as reaching into test-scoped internals.
func TestSinkPushVideo(s *Session, pkt *rtp.Packet) {
	s.fanOutVideoRTP(pkt)
}

// TestSinkPushAudio is the audio counterpart.
func TestSinkPushAudio(s *Session, pkt *rtp.Packet) {
	s.fanOutAudioRTP(pkt)
}
