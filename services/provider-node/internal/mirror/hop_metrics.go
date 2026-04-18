package mirror

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// HopMetrics keeps rolling windows of mirror hop latency from two
// independent timing sources:
//
//  1. video/audio RTT — Fase 2.1 wall-clock subtraction
//     (`mirror.now() - origin_ns` stamped on every RTP frame).
//     DEPRECATED in Fase 2.2 because NTP drift between origin and
//     mirror hosts corrupts the value — we measured Mac p50=29ms <
//     Relay 2 p50=44ms despite BR→VA being physically longer than
//     VA→FL. Retained one release for regression comparison; removed
//     in Fase 2.3.
//
//  2. probe RTT — Fase 2.2 echo-back. Origin sends a probe over the
//     same libp2p stream as RTP fan-out; mirror echoes immediately;
//     origin measures `now - send_time` from its own clock alone. No
//     cross-host subtraction, no NTP dependency. This is the
//     authoritative hop metric.
//
// The EMA value (α=0.1) smooths toward the recent window — good for
// the candidate-ranking algorithm (spec §5) which needs a single
// scalar per peer without computing percentiles every time.
type HopMetrics struct {
	mu       sync.Mutex
	videoRTT []time.Duration
	audioRTT []time.Duration
	videoIdx int
	audioIdx int
	videoN   int
	audioN   int

	// Echo-back samples (Fase 2.2 authoritative).
	probeRTT []time.Duration
	probeIdx int
	probeN   int
	probeEMA time.Duration

	// probeLoss counts probes evicted from the outstanding map before
	// an echo arrived. Atomic so origin-side code can increment without
	// acquiring the mu mutex when a probe times out.
	probeLoss atomic.Uint32
}

const (
	defaultWindow = 256
	// probeEMAAlpha controls the exponential moving average smoothing.
	// 0.1 → new sample carries 10% weight, old EMA carries 90%. In
	// practice this yields a ~10-sample effective window — fast enough
	// to react to path changes within ~10 seconds at 1 Hz probes, stable
	// enough that a single spike doesn't tip rankings.
	probeEMAAlpha = 0.1
)

// NewHopMetrics builds a metrics collector with the default 256-sample
// window per kind.
func NewHopMetrics() *HopMetrics {
	return &HopMetrics{
		videoRTT: make([]time.Duration, defaultWindow),
		audioRTT: make([]time.Duration, defaultWindow),
		probeRTT: make([]time.Duration, defaultWindow),
	}
}

// RecordVideo appends one hop measurement. Non-blocking — drops
// nothing, overwrites oldest when the ring is full. DEPRECATED in
// Fase 2.2; see package doc on HopMetrics.
func (m *HopMetrics) RecordVideo(d time.Duration) {
	m.mu.Lock()
	m.videoRTT[m.videoIdx%len(m.videoRTT)] = d
	m.videoIdx++
	if m.videoN < len(m.videoRTT) {
		m.videoN++
	}
	m.mu.Unlock()
}

// RecordAudio mirrors RecordVideo. DEPRECATED — see package doc.
func (m *HopMetrics) RecordAudio(d time.Duration) {
	m.mu.Lock()
	m.audioRTT[m.audioIdx%len(m.audioRTT)] = d
	m.audioIdx++
	if m.audioN < len(m.audioRTT) {
		m.audioN++
	}
	m.mu.Unlock()
}

// RecordEcho appends one echo-back round-trip sample (Fase 2.2
// authoritative). Updates both the rolling window (for percentiles)
// and the EMA (for ranking).
func (m *HopMetrics) RecordEcho(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.probeRTT[m.probeIdx%len(m.probeRTT)] = d
	m.probeIdx++
	if m.probeN < len(m.probeRTT) {
		m.probeN++
	}
	if m.probeEMA == 0 {
		m.probeEMA = d
	} else {
		m.probeEMA = time.Duration(probeEMAAlpha*float64(d) + (1-probeEMAAlpha)*float64(m.probeEMA))
	}
}

// IncProbeLoss records a probe that timed out without receiving an
// echo. Lock-free — safe to call from the client's outstanding-map
// sweeper goroutine.
func (m *HopMetrics) IncProbeLoss() { m.probeLoss.Add(1) }

// ProbeLoss returns the total count of timed-out probes.
func (m *HopMetrics) ProbeLoss() uint32 { return m.probeLoss.Load() }

// VideoCount returns the total number of samples seen (not the window
// size — the full-stream counter). DEPRECATED.
func (m *HopMetrics) VideoCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.videoIdx
}

// AudioCount is the total number of audio samples. DEPRECATED.
func (m *HopMetrics) AudioCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.audioIdx
}

// ProbeCount is the total echo-back samples recorded.
func (m *HopMetrics) ProbeCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.probeIdx
}

// P50Nanos returns the median wall-clock hop latency across video+audio
// in nanoseconds. DEPRECATED — use EchoP50Nanos.
func (m *HopMetrics) P50Nanos() int64 {
	return m.wallclockPercentile(0.5).Nanoseconds()
}

// P95Nanos returns the 95th percentile wall-clock hop latency.
// DEPRECATED — use EchoP95Nanos.
func (m *HopMetrics) P95Nanos() int64 {
	return m.wallclockPercentile(0.95).Nanoseconds()
}

// P99Nanos returns the 99th percentile wall-clock hop latency.
// DEPRECATED — use EchoP99Nanos.
func (m *HopMetrics) P99Nanos() int64 {
	return m.wallclockPercentile(0.99).Nanoseconds()
}

// EchoEMA returns the current exponential moving average of echo-back
// RTT. Zero when no echoes have arrived yet — callers should treat
// that as "peer not yet probed".
func (m *HopMetrics) EchoEMA() time.Duration {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.probeEMA
}

// EchoP50Nanos returns the median echo-back RTT in nanoseconds.
func (m *HopMetrics) EchoP50Nanos() int64 {
	return m.echoPercentile(0.5).Nanoseconds()
}

// EchoP95Nanos returns the 95th percentile echo-back RTT in nanoseconds.
func (m *HopMetrics) EchoP95Nanos() int64 {
	return m.echoPercentile(0.95).Nanoseconds()
}

// EchoP99Nanos returns the 99th percentile echo-back RTT in nanoseconds.
func (m *HopMetrics) EchoP99Nanos() int64 {
	return m.echoPercentile(0.99).Nanoseconds()
}

func (m *HopMetrics) wallclockPercentile(q float64) time.Duration {
	m.mu.Lock()
	samples := make([]time.Duration, 0, m.videoN+m.audioN)
	for i := range m.videoN {
		samples = append(samples, m.videoRTT[i])
	}
	for i := range m.audioN {
		samples = append(samples, m.audioRTT[i])
	}
	m.mu.Unlock()
	return percentileOf(samples, q)
}

func (m *HopMetrics) echoPercentile(q float64) time.Duration {
	m.mu.Lock()
	samples := make([]time.Duration, 0, m.probeN)
	for i := range m.probeN {
		samples = append(samples, m.probeRTT[i])
	}
	m.mu.Unlock()
	return percentileOf(samples, q)
}

func percentileOf(samples []time.Duration, q float64) time.Duration {
	if len(samples) == 0 {
		return 0
	}
	sort.Slice(samples, func(i, j int) bool { return samples[i] < samples[j] })
	idx := int(float64(len(samples))*q) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(samples) {
		idx = len(samples) - 1
	}
	return samples[idx]
}
