// Package por implements Proof of Relay — cryptographic receipts that a
// Provider Node accumulates as off-chain evidence of bytes served. Receipts
// are dual-signed (viewer + provider), aggregated into Merkle roots, and
// those roots are what the PersistencePool contract on Base consumes to
// distribute cUSDC rewards.
//
// The trust model:
//  - Viewer CANNOT deny a fetch, because the provider holds their signed
//    receipt.
//  - Provider CANNOT fabricate receipts, because forging requires the
//    viewer's private key.
//  - Cross-provider cannot steal — each receipt names its provider.
//  - Network CANNOT inflate — on-chain total is gated by deposits in the
//    pool, so fake receipts beyond real deposits collect nothing.
package por

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
)

// Receipt is the off-chain accounting unit. One receipt = one segment
// served. Dual-signed once both sides have co-operated.
type Receipt struct {
	ProviderPeerID string `json:"provider_peer_id"`
	ViewerPeerID   string `json:"viewer_peer_id"`
	CID            string `json:"cid"`
	SegmentIndex   int    `json:"segment_index"`
	SegmentSize    int    `json:"segment_size"`
	TimestampUnix  int64  `json:"timestamp_unix"`
	Nonce          uint64 `json:"nonce"`

	ViewerSig   []byte `json:"viewer_sig,omitempty"`
	ProviderSig []byte `json:"provider_sig,omitempty"`
}

// CanonicalBytes returns the deterministic serialization that both sides
// sign. ORDER AND WIDTHS MATTER — any change here breaks every existing
// signature, so callers must treat this as a wire format and version it
// if ever revised.
func (r *Receipt) CanonicalBytes() []byte {
	// [providerPeerID len][providerPeerID]
	// [viewerPeerID   len][viewerPeerID]
	// [cid            len][cid]
	// [segmentIndex uint64 be]
	// [segmentSize  uint64 be]
	// [timestamp    int64 be]
	// [nonce        uint64 be]
	buf := make([]byte, 0, 64+len(r.ProviderPeerID)+len(r.ViewerPeerID)+len(r.CID))
	buf = appendLV(buf, []byte(r.ProviderPeerID))
	buf = appendLV(buf, []byte(r.ViewerPeerID))
	buf = appendLV(buf, []byte(r.CID))

	var tmp [8]byte
	binary.BigEndian.PutUint64(tmp[:], uint64(r.SegmentIndex))
	buf = append(buf, tmp[:]...)
	binary.BigEndian.PutUint64(tmp[:], uint64(r.SegmentSize))
	buf = append(buf, tmp[:]...)
	binary.BigEndian.PutUint64(tmp[:], uint64(r.TimestampUnix))
	buf = append(buf, tmp[:]...)
	binary.BigEndian.PutUint64(tmp[:], r.Nonce)
	buf = append(buf, tmp[:]...)
	return buf
}

// Hash returns the SHA-256 of the canonical bytes. Used as the Merkle tree
// leaf in the aggregator.
func (r *Receipt) Hash() []byte {
	sum := sha256.Sum256(r.CanonicalBytes())
	return sum[:]
}

// SignAsViewer adds the viewer's signature. Idempotent.
func (r *Receipt) SignAsViewer(priv crypto.PrivKey) error {
	sig, err := priv.Sign(r.CanonicalBytes())
	if err != nil {
		return fmt.Errorf("por: viewer sign: %w", err)
	}
	r.ViewerSig = sig
	return nil
}

// SignAsProvider adds the provider's signature. Typical flow: viewer signs
// first, POSTs to /ack, provider verifies viewer sig + co-signs + stores.
func (r *Receipt) SignAsProvider(priv crypto.PrivKey) error {
	sig, err := priv.Sign(r.CanonicalBytes())
	if err != nil {
		return fmt.Errorf("por: provider sign: %w", err)
	}
	r.ProviderSig = sig
	return nil
}

// VerifyViewerSig confirms r.ViewerSig is valid against a public key
// derived from r.ViewerPeerID. Returns nil if valid.
func (r *Receipt) VerifyViewerSig() error {
	if len(r.ViewerSig) == 0 {
		return errors.New("por: viewer sig missing")
	}
	pub, err := pubKeyFromPeerID(r.ViewerPeerID)
	if err != nil {
		return fmt.Errorf("por: viewer pub key: %w", err)
	}
	ok, err := pub.Verify(r.CanonicalBytes(), r.ViewerSig)
	if err != nil {
		return fmt.Errorf("por: verify viewer: %w", err)
	}
	if !ok {
		return errors.New("por: viewer signature rejected")
	}
	return nil
}

// VerifyProviderSig confirms r.ProviderSig is valid against a public key
// derived from r.ProviderPeerID.
func (r *Receipt) VerifyProviderSig() error {
	if len(r.ProviderSig) == 0 {
		return errors.New("por: provider sig missing")
	}
	pub, err := pubKeyFromPeerID(r.ProviderPeerID)
	if err != nil {
		return fmt.Errorf("por: provider pub key: %w", err)
	}
	ok, err := pub.Verify(r.CanonicalBytes(), r.ProviderSig)
	if err != nil {
		return fmt.Errorf("por: verify provider: %w", err)
	}
	if !ok {
		return errors.New("por: provider signature rejected")
	}
	return nil
}

// VerifyBoth runs both verification passes. Preferred entry point for
// on-chain submission flows where both signatures must be valid.
func (r *Receipt) VerifyBoth() error {
	if err := r.VerifyViewerSig(); err != nil {
		return err
	}
	return r.VerifyProviderSig()
}

func pubKeyFromPeerID(pidStr string) (crypto.PubKey, error) {
	pid, err := peer.Decode(pidStr)
	if err != nil {
		return nil, fmt.Errorf("decode peer id %q: %w", pidStr, err)
	}
	return pid.ExtractPublicKey()
}

func appendLV(dst, payload []byte) []byte {
	var tmp [4]byte
	binary.BigEndian.PutUint32(tmp[:], uint32(len(payload)))
	dst = append(dst, tmp[:]...)
	dst = append(dst, payload...)
	return dst
}
