package whip

import (
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
	"github.com/Leeaandrob/aevia/services/provider-node/internal/pinning"
)

// LivePinSink implements SegmentSink by:
//  1. Appending each media segment's SHA-256 to a growing Merkle leaf
//     set (live manifest).
//  2. Persisting init + media segments in pinning.ContentStore under
//     a stable session CID so hls.js + p2p-media-loader can fetch.
//  3. Exposing the current live manifest for external consumers (the
//     HLS playlist generator + the DHT re-announce goroutine).
//
// On Close(), emits a final Merkle root that gets anchored on-chain
// post-session via ContentRegistry.registerContent.
type LivePinSink struct {
	store     *pinning.ContentStore
	sessionID string

	mu        sync.Mutex
	leaves    [][]byte
	initSeg   []byte
	segments  [][]byte // parallel to leaves; segments[i].hash == leaves[i]
	finalized *manifest.Manifest
	startedAt time.Time
	endedAt   time.Time
}

// NewLivePinSink binds a session ID to a ContentStore. The session ID
// doubles as the "live CID" the player references during the stream;
// post-live, a canonical VOD CID is computed from the final Merkle root
// and registered on-chain.
func NewLivePinSink(store *pinning.ContentStore, sessionID string) (*LivePinSink, error) {
	if store == nil {
		return nil, errors.New("livepin: store is nil")
	}
	if sessionID == "" {
		return nil, errors.New("livepin: sessionID is empty")
	}
	return &LivePinSink{store: store, sessionID: sessionID, startedAt: time.Now().UTC()}, nil
}

// OnInitSegment stores the fMP4 init segment. Called once per session.
func (l *LivePinSink) OnInitSegment(bytes []byte) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.initSeg != nil {
		return errors.New("livepin: init segment already set")
	}
	l.initSeg = append([]byte(nil), bytes...)
	return nil
}

// OnMediaSegment persists the segment, appends its SHA-256 to leaves,
// and triggers a manifest snapshot + DHT re-announce via the
// registered callbacks.
func (l *LivePinSink) OnMediaSegment(index uint32, bytes []byte, durationTicks uint32) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if uint32(len(l.leaves)) != index {
		return fmt.Errorf("livepin: segment index %d != expected %d", index, len(l.leaves))
	}
	leaf := manifest.HashLeaf(bytes)
	l.leaves = append(l.leaves, leaf)
	l.segments = append(l.segments, append([]byte(nil), bytes...))
	return nil
}

// Snapshot returns the current live Merkle root + segment count. Called
// by the HLS playlist generator + the DHT re-announcer.
//
// The root grows monotonically and incrementally every segment. For
// 14.4k-segment streams (24h at 6s/seg) the per-segment rebuild cost
// is trivial (sub-10ms); incremental Merkle lands in M9 if streams
// grow longer.
func (l *LivePinSink) Snapshot() (*LiveSnapshot, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.leaves) == 0 {
		return &LiveSnapshot{SessionID: l.sessionID, SegmentCount: 0}, nil
	}

	tree, err := manifest.NewTree(l.leaves)
	if err != nil {
		return nil, fmt.Errorf("livepin: build tree: %w", err)
	}
	rootHex := hex.EncodeToString(tree.Root())
	cid, err := manifest.CIDv1Raw(tree.Root())
	if err != nil {
		return nil, fmt.Errorf("livepin: cid: %w", err)
	}

	snap := &LiveSnapshot{
		SessionID:    l.sessionID,
		SegmentCount: len(l.leaves),
		RootHex:      rootHex,
		CID:          cid,
		InitSegment:  append([]byte(nil), l.initSeg...),
	}
	return snap, nil
}

// Finalize commits the live session to the ContentStore under a
// stable CID (derived from the final Merkle root) so VOD playback
// flows continue to work after the stream ends. Called exactly once
// via CMAFSegmenter.Close()'s trailing flush. Idempotent — a second
// call returns the cached manifest instead of re-pinning.
func (l *LivePinSink) Finalize(segmentDurationSecs int) (*manifest.Manifest, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.finalized != nil {
		return l.finalized, nil
	}
	if len(l.segments) == 0 {
		return nil, errors.New("livepin: cannot finalize zero-segment session")
	}
	payloads := make([][]byte, len(l.segments))
	copy(payloads, l.segments)

	m, err := l.store.PinPayloads(payloads, segmentDurationSecs)
	if err != nil {
		return nil, fmt.Errorf("livepin: pin: %w", err)
	}
	l.finalized = m
	l.endedAt = time.Now().UTC()
	return m, nil
}

// Manifest returns the finalized manifest when the session has closed,
// or nil when the live is still open. Safe for concurrent read.
func (l *LivePinSink) Manifest() *manifest.Manifest {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.finalized
}

// Timestamps returns (startedAt, endedAt). endedAt is zero time when
// the session is still live. Both returned in UTC.
func (l *LivePinSink) Timestamps() (time.Time, time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.startedAt, l.endedAt
}

// LiveSnapshot is the view the HLS playlist generator consumes.
type LiveSnapshot struct {
	SessionID    string
	SegmentCount int
	RootHex      string
	CID          string
	InitSegment  []byte
}

// SegmentBytes returns a specific segment body — used by the HLS
// segment handler to serve media to viewers.
func (l *LivePinSink) SegmentBytes(index uint32) ([]byte, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if int(index) >= len(l.segments) {
		return nil, fmt.Errorf("livepin: segment %d out of range (have %d)", index, len(l.segments))
	}
	return append([]byte(nil), l.segments[index]...), nil
}

// InitBytes returns the fMP4 init segment. Served at
// /live/{sessionID}/init.mp4.
func (l *LivePinSink) InitBytes() ([]byte, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.initSeg == nil {
		return nil, errors.New("livepin: init segment not yet emitted")
	}
	return append([]byte(nil), l.initSeg...), nil
}
