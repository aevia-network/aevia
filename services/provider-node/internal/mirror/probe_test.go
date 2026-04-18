package mirror_test

import (
	"bytes"
	"testing"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/mirror"
)

// TestProbeRoundTripWireFormat locks the wire contract that the
// echo-back RTT calculation depends on: a probe written by the origin,
// read back verbatim, round-trips ProbeID + SendNS byte-for-byte.
func TestProbeRoundTripWireFormat(t *testing.T) {
	in := mirror.ProbeFrame{
		ProbeID: 0xCAFEBABEDEADBEEF,
		SendNS:  0x0123456789ABCDEF,
	}
	var buf bytes.Buffer
	if err := mirror.WriteProbe(&buf, in); err != nil {
		t.Fatalf("WriteProbe: %v", err)
	}

	frame, err := mirror.ReadAnyFrame(&buf)
	if err != nil {
		t.Fatalf("ReadAnyFrame: %v", err)
	}
	if frame.Type != mirror.FrameTypeProbe {
		t.Fatalf("frame type got 0x%02x want Probe", frame.Type)
	}
	if frame.Probe == nil {
		t.Fatal("nil Probe")
	}
	if frame.Probe.ProbeID != in.ProbeID {
		t.Errorf("ProbeID got %x want %x", frame.Probe.ProbeID, in.ProbeID)
	}
	if frame.Probe.SendNS != in.SendNS {
		t.Errorf("SendNS got %x want %x", frame.Probe.SendNS, in.SendNS)
	}
}

// TestProbeEchoRoundTrip covers the mirror→origin direction. The
// mirror MUST echo the same ProbeID back unchanged.
func TestProbeEchoRoundTrip(t *testing.T) {
	in := mirror.ProbeFrame{ProbeID: 42, SendNS: 1_000_000_000}

	var buf bytes.Buffer
	if err := mirror.WriteProbeEcho(&buf, in); err != nil {
		t.Fatalf("WriteProbeEcho: %v", err)
	}
	frame, err := mirror.ReadAnyFrame(&buf)
	if err != nil {
		t.Fatalf("ReadAnyFrame: %v", err)
	}
	if frame.Type != mirror.FrameTypeProbeEcho {
		t.Fatalf("frame type got 0x%02x want ProbeEcho", frame.Type)
	}
	if frame.Probe == nil || frame.Probe.ProbeID != in.ProbeID {
		t.Fatalf("echo ProbeID lost: %+v", frame.Probe)
	}
}

// TestHopMetricsEchoEMAConverges validates that RecordEcho updates the
// EMA so the candidate ranker gets a stable scalar. Uses known values
// and hand-checks the EMA result.
func TestHopMetricsEchoEMAConverges(t *testing.T) {
	m := mirror.NewHopMetrics()
	if m.EchoEMA() != 0 {
		t.Fatalf("empty EMA should be zero, got %v", m.EchoEMA())
	}
	// First sample seeds the EMA directly.
	m.RecordEcho(100_000_000) // 100ms
	if m.EchoEMA() != 100_000_000 {
		t.Fatalf("first sample seed: got %v want 100ms", m.EchoEMA())
	}
	// Second sample with α=0.1: ema = 0.1*200 + 0.9*100 = 110ms
	m.RecordEcho(200_000_000)
	ema := m.EchoEMA()
	if ema < 105_000_000 || ema > 115_000_000 {
		t.Fatalf("second sample EMA should be ~110ms, got %v", ema)
	}
	// 10 consecutive 100ms samples should pull EMA back near 100ms.
	for i := 0; i < 10; i++ {
		m.RecordEcho(100_000_000)
	}
	ema = m.EchoEMA()
	if ema < 100_000_000 || ema > 106_000_000 {
		t.Fatalf("after 10 stable samples EMA should be ~100-105ms, got %v", ema)
	}
	if m.ProbeCount() != 12 {
		t.Fatalf("ProbeCount got %d want 12", m.ProbeCount())
	}
}

// TestHopMetricsProbeLossAtomicIncrement ensures IncProbeLoss can be
// called concurrently without a data race under `go test -race`.
func TestHopMetricsProbeLossAtomicIncrement(t *testing.T) {
	m := mirror.NewHopMetrics()
	const N = 1000
	done := make(chan struct{}, 4)
	for i := 0; i < 4; i++ {
		go func() {
			for j := 0; j < N; j++ {
				m.IncProbeLoss()
			}
			done <- struct{}{}
		}()
	}
	for i := 0; i < 4; i++ {
		<-done
	}
	got := m.ProbeLoss()
	if got != 4*N {
		t.Fatalf("ProbeLoss got %d want %d", got, 4*N)
	}
}

// TestReadAnyFrameHandlesMixedStream covers the server-side reader
// contract: a stream carrying header + RTP + probe + close must be
// dispatchable by ReadAnyFrame in order.
func TestReadAnyFrameHandlesMixedStream(t *testing.T) {
	var buf bytes.Buffer

	// Header first.
	if err := mirror.WriteHeader(&buf, mirror.Header{
		SessionID: "s_mix",
		Video:     mirror.CodecInfo{MimeType: "video/H264", ClockRate: 90_000},
	}); err != nil {
		t.Fatalf("WriteHeader: %v", err)
	}
	// One RTP frame.
	if err := mirror.WriteRTPFrame(&buf, mirror.FrameTypeVideoRTP, 12_345, []byte{0x01, 0x02, 0x03}); err != nil {
		t.Fatalf("WriteRTPFrame: %v", err)
	}
	// One probe.
	if err := mirror.WriteProbe(&buf, mirror.ProbeFrame{ProbeID: 7, SendNS: 99_999}); err != nil {
		t.Fatalf("WriteProbe: %v", err)
	}
	// Close.
	if err := mirror.WriteCloseFrame(&buf); err != nil {
		t.Fatalf("WriteCloseFrame: %v", err)
	}

	// Header read separately (legacy path).
	h, err := mirror.ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader: %v", err)
	}
	if h.SessionID != "s_mix" {
		t.Fatalf("SessionID got %q", h.SessionID)
	}

	// RTP
	f1, err := mirror.ReadAnyFrame(&buf)
	if err != nil {
		t.Fatalf("ReadAnyFrame[rtp]: %v", err)
	}
	if f1.Type != mirror.FrameTypeVideoRTP || f1.RTP == nil || f1.RTP.OriginNS != 12_345 {
		t.Fatalf("rtp frame unexpected: %+v", f1)
	}

	// Probe
	f2, err := mirror.ReadAnyFrame(&buf)
	if err != nil {
		t.Fatalf("ReadAnyFrame[probe]: %v", err)
	}
	if f2.Type != mirror.FrameTypeProbe || f2.Probe == nil || f2.Probe.ProbeID != 7 {
		t.Fatalf("probe frame unexpected: %+v", f2)
	}

	// Close — EOF.
	_, err = mirror.ReadAnyFrame(&buf)
	if err == nil {
		t.Fatal("expected EOF after close frame")
	}
}
