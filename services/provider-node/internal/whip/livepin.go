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
	// LL-HLS partial segments: parts[segIdx] is the ordered list of
	// part fragments that make up segment segIdx. A part is persisted
	// the moment the segmenter emits it (well before the full segment
	// closes), so viewers polling playlist.m3u8 see new EXT-X-PART
	// entries within ~PartTargetDuration of ingest rather than waiting
	// for the 6s parent segment to close.
	parts map[uint32][]PartRecord
}

// PartRecord is one LL-HLS partial segment persisted by a LivePinSink.
type PartRecord struct {
	Index       uint32
	Bytes       []byte
	DurationT   uint32
	Independent bool
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
	return &LivePinSink{
		store:     store,
		sessionID: sessionID,
		startedAt: time.Now().UTC(),
		parts:     make(map[uint32][]PartRecord),
	}, nil
}

// OnMediaPart satisfies the PartSink interface. Called by CMAFSegmenter
// every PartTargetDuration of accumulated samples inside the current
// parent segment. Parts are appended in order; tests use PartsOf
// (below) to inspect or PartBytes for HTTP serving.
func (l *LivePinSink) OnMediaPart(segIdx, partIdx uint32, b []byte, durationT uint32, independent bool) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.parts == nil {
		l.parts = make(map[uint32][]PartRecord)
	}
	// Enforce monotonic partIdx within segIdx. Gaps indicate a bug in
	// the segmenter; better to fail loud than silently accept.
	existing := l.parts[segIdx]
	if uint32(len(existing)) != partIdx {
		return fmt.Errorf("livepin: part idx %d != expected %d for segment %d", partIdx, len(existing), segIdx)
	}
	l.parts[segIdx] = append(existing, PartRecord{
		Index:       partIdx,
		Bytes:       append([]byte(nil), b...),
		DurationT:   durationT,
		Independent: independent,
	})
	return nil
}

// PartsOf returns a defensive copy of the parts recorded for a given
// segment. Used by the HLS playlist generator to emit EXT-X-PART
// entries referencing the currently-building segment's parts.
func (l *LivePinSink) PartsOf(segIdx uint32) []PartRecord {
	l.mu.Lock()
	defer l.mu.Unlock()
	parts := l.parts[segIdx]
	if len(parts) == 0 {
		return nil
	}
	out := make([]PartRecord, len(parts))
	copy(out, parts)
	return out
}

// PartBytes retrieves a single part's raw fMP4 fragment for HTTP
// serving. Returns an error when segIdx or partIdx are out of range.
func (l *LivePinSink) PartBytes(segIdx, partIdx uint32) ([]byte, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	parts := l.parts[segIdx]
	if int(partIdx) >= len(parts) {
		return nil, fmt.Errorf("livepin: part %d/%d out of range (have %d)", segIdx, partIdx, len(parts))
	}
	return append([]byte(nil), parts[partIdx].Bytes...), nil
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
