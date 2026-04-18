package mirror_test

import (
	"bytes"
	"errors"
	"io"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/mirror"
)

func TestHeaderRoundTrip(t *testing.T) {
	in := mirror.Header{
		SessionID:   "s_123",
		StartedAtNS: 1_700_000_000_000_000_000,
		Video: mirror.CodecInfo{
			MimeType:    "video/H264",
			ClockRate:   90_000,
			SDPFmtpLine: "packetization-mode=1",
		},
		Audio: mirror.CodecInfo{MimeType: "audio/opus", ClockRate: 48_000, Channels: 2},
	}

	var buf bytes.Buffer
	if err := mirror.WriteHeader(&buf, in); err != nil {
		t.Fatalf("WriteHeader: %v", err)
	}

	out, err := mirror.ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader: %v", err)
	}
	if out.SessionID != in.SessionID {
		t.Errorf("SessionID got %q want %q", out.SessionID, in.SessionID)
	}
	if out.Video.MimeType != "video/H264" {
		t.Errorf("Video.MimeType got %q", out.Video.MimeType)
	}
	if out.Audio.ClockRate != 48_000 {
		t.Errorf("Audio.ClockRate got %d want 48000", out.Audio.ClockRate)
	}
}

func TestRTPFrameRoundTripCarriesOriginNS(t *testing.T) {
	payload := []byte("fake-rtp-packet-bytes-would-be-here")
	originNS := int64(1_776_000_000_123_456_789)

	var buf bytes.Buffer
	if err := mirror.WriteRTPFrame(&buf, mirror.FrameTypeVideoRTP, originNS, payload); err != nil {
		t.Fatalf("WriteRTPFrame: %v", err)
	}

	ft, rtp, err := mirror.ReadFrame(&buf)
	if err != nil {
		t.Fatalf("ReadFrame: %v", err)
	}
	if ft != mirror.FrameTypeVideoRTP {
		t.Fatalf("frame type got 0x%02x want Video", ft)
	}
	if rtp == nil {
		t.Fatal("nil RTPFrame")
	}
	if rtp.OriginNS != originNS {
		t.Errorf("OriginNS got %d want %d", rtp.OriginNS, originNS)
	}
	if !bytes.Equal(rtp.RTP, payload) {
		t.Errorf("payload round-trip mismatch")
	}
}

func TestCloseFrameReturnsEOF(t *testing.T) {
	var buf bytes.Buffer
	if err := mirror.WriteCloseFrame(&buf); err != nil {
		t.Fatalf("WriteCloseFrame: %v", err)
	}

	ft, rtp, err := mirror.ReadFrame(&buf)
	if ft != mirror.FrameTypeClose {
		t.Errorf("frame type got 0x%02x want Close", ft)
	}
	if rtp != nil {
		t.Error("Close frame should yield nil RTPFrame")
	}
	if !errors.Is(err, io.EOF) {
		t.Errorf("Close frame should return io.EOF, got %v", err)
	}
}

func TestReadFrameRejectsUnknownType(t *testing.T) {
	// type 0xFF isn't defined — write a synthetic frame header to test.
	// 1 byte type + 4 bytes len (0).
	raw := []byte{0xFF, 0x00, 0x00, 0x00, 0x00}
	_, _, err := mirror.ReadFrame(bytes.NewReader(raw))
	if err == nil {
		t.Fatal("expected error on unknown frame type")
	}
}

func TestMultipleRTPFramesStreamCleanly(t *testing.T) {
	// Simulate a typical session: header → 3 video RTP frames → close.
	var buf bytes.Buffer

	if err := mirror.WriteHeader(&buf, mirror.Header{
		SessionID: "s_stream",
		Video:     mirror.CodecInfo{MimeType: "video/H264", ClockRate: 90_000},
	}); err != nil {
		t.Fatalf("WriteHeader: %v", err)
	}
	for i := range 3 {
		originNS := int64(1_000_000 * (i + 1))
		payload := []byte{byte(i)}
		if err := mirror.WriteRTPFrame(&buf, mirror.FrameTypeVideoRTP, originNS, payload); err != nil {
			t.Fatalf("frame %d: %v", i, err)
		}
	}
	if err := mirror.WriteCloseFrame(&buf); err != nil {
		t.Fatalf("Close: %v", err)
	}

	// Reader side
	h, err := mirror.ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader: %v", err)
	}
	if h.SessionID != "s_stream" {
		t.Fatalf("header SessionID got %q", h.SessionID)
	}

	gotCount := 0
	for {
		ft, rtp, err := mirror.ReadFrame(&buf)
		if errors.Is(err, io.EOF) {
			if ft != mirror.FrameTypeClose {
				t.Fatalf("ended with ft=0x%02x want Close (EOF can also be stream exhaustion)", ft)
			}
			break
		}
		if err != nil {
			t.Fatalf("ReadFrame[%d]: %v", gotCount, err)
		}
		if ft != mirror.FrameTypeVideoRTP {
			t.Fatalf("frame[%d] ft got 0x%02x want Video", gotCount, ft)
		}
		if len(rtp.RTP) != 1 || rtp.RTP[0] != byte(gotCount) {
			t.Fatalf("frame[%d] payload unexpected: %v", gotCount, rtp.RTP)
		}
		gotCount++
	}
	if gotCount != 3 {
		t.Fatalf("got %d video frames, want 3", gotCount)
	}
}

func TestFrameBodyOverflowRejected(t *testing.T) {
	// Synthesize a frame header claiming a body of MaxFrameBytes+1.
	body := []byte{
		byte(mirror.FrameTypeHeader),
		0x00, 0x01, 0x00, 0x01, // 64KiB+1
	}
	_, err := mirror.ReadHeader(bytes.NewReader(body))
	if err == nil {
		t.Fatal("expected overflow error")
	}
}
