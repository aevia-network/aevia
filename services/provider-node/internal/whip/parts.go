package whip

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/Eyevinn/mp4ff/mp4"
)

// PartTargetDuration is the LL-HLS PART-TARGET (seconds). 3 parts per
// 6s parent segment → ~2s latency floor for fully-independent viewers.
const PartTargetDuration = 2

// PartSink is the optional LL-HLS-partial-segments companion to
// SegmentSink. CMAFSegmenter detects this via a type assertion on the
// sink it was built with and, when present, emits OnMediaPart for
// each 2s slice of samples within the currently-building segment.
// Legacy sinks that only implement SegmentSink keep working — parts
// are simply skipped.
type PartSink interface {
	// OnMediaPart fires once per completed partial segment.
	//
	//   segmentIndex — which parent segment this part belongs to
	//                  (matches the eventual OnMediaSegment index)
	//   partIndex    — 0-based offset within the parent segment
	//   bytes        — standalone fMP4 fragment (moof + mdat)
	//   durationTicks — cumulative sample duration in this part
	//                  (TimescaleClock = VideoTimescale)
	//   independent  — true when the first sample is a keyframe,
	//                  enough on its own to initialise decode.
	OnMediaPart(segmentIndex, partIndex uint32, bytes []byte, durationTicks uint32, independent bool) error
}

// buildPartSegment produces a standalone fMP4 fragment containing a
// slice of samples from the current in-progress parent segment. The
// first sample's flags encode whether this part is INDEPENDENT (ie.
// begins with a sync sample — keyframe).
func buildPartSegment(
	sequenceNumber uint32,
	samples [][]byte,
	durations []uint32,
	startsOnKeyframe bool,
) ([]byte, uint32, error) {
	if len(samples) == 0 {
		return nil, 0, errors.New("segmenter: cannot build zero-sample part")
	}
	if len(samples) != len(durations) {
		return nil, 0, fmt.Errorf("segmenter: samples (%d) != durations (%d)", len(samples), len(durations))
	}

	seg := mp4.NewMediaSegment()
	frag, err := mp4.CreateFragment(sequenceNumber, 1)
	if err != nil {
		return nil, 0, fmt.Errorf("segmenter: CreateFragment: %w", err)
	}
	seg.AddFragment(frag)

	var totalTicks uint32
	for i, sample := range samples {
		fs := mp4.FullSample{
			Sample: mp4.Sample{
				Dur:  durations[i],
				Size: uint32(len(sample)),
			},
			Data: sample,
		}
		if i == 0 && startsOnKeyframe {
			fs.Flags = 0 // IsSync — first byte after moof is decodable
		} else {
			fs.Flags = mp4.NonSyncSampleFlags
		}
		frag.AddFullSample(fs)
		totalTicks += durations[i]
	}

	var buf bytes.Buffer
	if err := seg.Encode(&buf); err != nil {
		return nil, 0, fmt.Errorf("segmenter: encode part: %w", err)
	}
	return buf.Bytes(), totalTicks, nil
}
