package mirror

import (
	"sort"
	"sync"
	"time"
)

// HopMetrics keeps a rolling window of origin→mirror hop latencies so
// operators can observe the actual cost of the mirror layer. Separate
// video/audio buckets because audio packets arrive much more
// frequently (50pkts/sec vs 30fps × keyframe-split NAL count).
//
// The window is a fixed-size ring buffer — N samples of each kind —
// that rotates as new samples arrive. Percentile queries sort a copy;
// cheap at our N (256 default) and immune to GC pressure.
type HopMetrics struct {
	mu       sync.Mutex
	videoRTT []time.Duration
	audioRTT []time.Duration
	videoIdx int
	audioIdx int
	videoN   int
	audioN   int
}

const defaultWindow = 256

// NewHopMetrics builds a metrics collector with the default 256-sample
// window per kind.
func NewHopMetrics() *HopMetrics {
	return &HopMetrics{
		videoRTT: make([]time.Duration, defaultWindow),
		audioRTT: make([]time.Duration, defaultWindow),
	}
}

// RecordVideo appends one hop measurement. Non-blocking — drops
// nothing, overwrites oldest when the ring is full.
func (m *HopMetrics) RecordVideo(d time.Duration) {
	m.mu.Lock()
	m.videoRTT[m.videoIdx%len(m.videoRTT)] = d
	m.videoIdx++
	if m.videoN < len(m.videoRTT) {
		m.videoN++
	}
	m.mu.Unlock()
}

// RecordAudio mirrors RecordVideo.
func (m *HopMetrics) RecordAudio(d time.Duration) {
	m.mu.Lock()
	m.audioRTT[m.audioIdx%len(m.audioRTT)] = d
	m.audioIdx++
	if m.audioN < len(m.audioRTT) {
		m.audioN++
	}
	m.mu.Unlock()
}

// VideoCount returns the total number of samples seen (not the window
// size — the full-stream counter).
func (m *HopMetrics) VideoCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.videoIdx
}

// AudioCount is the total number of audio samples.
func (m *HopMetrics) AudioCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.audioIdx
}

// P50Nanos returns the median hop latency across both video+audio in
// nanoseconds. Zero when empty.
func (m *HopMetrics) P50Nanos() int64 {
	return m.percentile(0.5).Nanoseconds()
}

// P95Nanos returns the 95th percentile hop latency.
func (m *HopMetrics) P95Nanos() int64 {
	return m.percentile(0.95).Nanoseconds()
}

// P99Nanos returns the 99th percentile hop latency.
func (m *HopMetrics) P99Nanos() int64 {
	return m.percentile(0.99).Nanoseconds()
}

func (m *HopMetrics) percentile(q float64) time.Duration {
	m.mu.Lock()
	samples := make([]time.Duration, 0, m.videoN+m.audioN)
	for i := range m.videoN {
		samples = append(samples, m.videoRTT[i])
	}
	for i := range m.audioN {
		samples = append(samples, m.audioRTT[i])
	}
	m.mu.Unlock()
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
