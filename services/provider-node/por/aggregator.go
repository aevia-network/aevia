package por

import (
	"errors"
	"fmt"
	"sort"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/manifest"
)

// Settlement is the on-chain payload for one PersistencePool epoch. The
// contract consumes MerkleRoot + Providers + Bytes; the receipts behind
// the tree never touch gas, only surfacing in a dispute.
type Settlement struct {
	// MerkleRoot is SHA-256 Merkle of every receipt hash, in canonical
	// order (ascending Hash). Used as the on-chain commitment.
	MerkleRoot []byte
	// ReceiptCount is the number of receipts aggregated.
	ReceiptCount int
	// TotalBytes is the sum of SegmentSize across all receipts.
	TotalBytes uint64
	// Providers + Bytes are parallel arrays sorted by provider PeerID so
	// the settlement is byte-deterministic regardless of receipt arrival
	// order. PerProviderBytes[i] is the bytes earned by Providers[i].
	Providers        []string
	PerProviderBytes []uint64
}

// BuildSettlement aggregates a slice of dual-signed receipts into a
// single on-chain settlement payload. Pre-conditions checked here:
//   - every receipt has both signatures valid
//   - no duplicate receipt (same provider + ts + nonce)
// Receipts are not mutated.
func BuildSettlement(receipts []*Receipt) (*Settlement, error) {
	if len(receipts) == 0 {
		return nil, errors.New("por: cannot build settlement from zero receipts")
	}

	// Signature + uniqueness validation.
	seen := make(map[string]struct{}, len(receipts))
	for i, r := range receipts {
		if err := r.VerifyBoth(); err != nil {
			return nil, fmt.Errorf("por: receipt %d failed verification: %w", i, err)
		}
		key := fmt.Sprintf("%s:%d:%d", r.ProviderPeerID, r.TimestampUnix, r.Nonce)
		if _, dup := seen[key]; dup {
			return nil, fmt.Errorf("por: duplicate receipt at index %d (key=%s)", i, key)
		}
		seen[key] = struct{}{}
	}

	// Per-provider totals.
	perProvider := make(map[string]uint64, len(receipts))
	var total uint64
	for _, r := range receipts {
		perProvider[r.ProviderPeerID] += uint64(r.SegmentSize)
		total += uint64(r.SegmentSize)
	}
	providers := make([]string, 0, len(perProvider))
	for p := range perProvider {
		providers = append(providers, p)
	}
	sort.Strings(providers)
	bytesArr := make([]uint64, len(providers))
	for i, p := range providers {
		bytesArr[i] = perProvider[p]
	}

	// Merkle tree: leaves are receipt hashes, sorted so the root is
	// independent of the order Put/Get gave us. The aggregator produces
	// the same root regardless of how receipts were collected.
	leaves := make([][]byte, len(receipts))
	for i, r := range receipts {
		leaves[i] = r.Hash()
	}
	sort.Slice(leaves, func(i, j int) bool { return compareBytes(leaves[i], leaves[j]) < 0 })

	tree, err := manifest.NewTree(leaves)
	if err != nil {
		return nil, fmt.Errorf("por: build merkle tree: %w", err)
	}

	return &Settlement{
		MerkleRoot:       tree.Root(),
		ReceiptCount:     len(receipts),
		TotalBytes:       total,
		Providers:        providers,
		PerProviderBytes: bytesArr,
	}, nil
}

func compareBytes(a, b []byte) int {
	switch {
	case len(a) < len(b):
		n := len(a)
		for i := 0; i < n; i++ {
			if a[i] != b[i] {
				return int(a[i]) - int(b[i])
			}
		}
		return -1
	case len(a) > len(b):
		n := len(b)
		for i := 0; i < n; i++ {
			if a[i] != b[i] {
				return int(a[i]) - int(b[i])
			}
		}
		return 1
	default:
		for i := range a {
			if a[i] != b[i] {
				return int(a[i]) - int(b[i])
			}
		}
		return 0
	}
}
