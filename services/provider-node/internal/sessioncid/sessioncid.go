// Package sessioncid derives a stable CID from a WHIP session ID so both
// provider and viewer (or any Aevia node) can announce/resolve the same
// live session in the DHT without coordination.
//
// The algorithm is:
//
//	cid = CIDv1(raw, sha256(sessionID_utf8))
//
// Deterministic, collision-free for any practical session ID length,
// and trivially reproducible in JS (`multiformats/cid` + sha2 + raw
// codec). The same helper is called by the frontend so resolves match.
package sessioncid

import (
	"fmt"

	"github.com/ipfs/go-cid"
	"github.com/multiformats/go-multihash"
)

// Of returns the canonical CID representing a WHIP session in the DHT.
// Callers use the returned string with dht.Provide / dht.FindProviders.
func Of(sessionID string) (string, error) {
	if sessionID == "" {
		return "", fmt.Errorf("sessioncid: empty sessionID")
	}
	mh, err := multihash.Sum([]byte(sessionID), multihash.SHA2_256, -1)
	if err != nil {
		return "", fmt.Errorf("sessioncid: multihash: %w", err)
	}
	return cid.NewCidV1(cid.Raw, mh).String(), nil
}
