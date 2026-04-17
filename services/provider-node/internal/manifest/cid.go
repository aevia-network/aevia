package manifest

import (
	"encoding/base32"
	"errors"
	"fmt"
	"strings"
)

// CIDv1 canonical constants. We restrict this package to the one CID shape
// that Aevia manifests use — raw-codec + sha256 multihash. Wider IPLD
// support (dag-pb, blake3) is out of scope for Milestone 2.
const (
	cidVersion1    byte = 0x01
	cidCodecRaw    byte = 0x55
	mhSHA256       byte = 0x12
	mhSHA256Length byte = 0x20
)

// base32LowerNoPad is the multibase 'b' encoding: RFC4648 base32, lowercase,
// no padding. See https://github.com/multiformats/multibase.
var base32LowerNoPad = base32.NewEncoding("abcdefghijklmnopqrstuvwxyz234567").WithPadding(base32.NoPadding)

// CIDv1Prefix is the 7-char prefix every canonical CIDv1-raw-sha256 shares,
// derived from the fixed header bytes [0x01 0x55 0x12 0x20].
const CIDv1Prefix = "bafkrei"

// CIDv1Raw encodes a SHA-256 digest (32 bytes) into a CIDv1 raw string with
// multibase base32-lowercase no-padding encoding — the canonical form that
// starts with "bafkrei".
func CIDv1Raw(sha256Digest []byte) (string, error) {
	if len(sha256Digest) != HashSize {
		return "", fmt.Errorf("manifest: CIDv1Raw expects %d-byte digest, got %d", HashSize, len(sha256Digest))
	}
	// All header bytes fit in a single byte as varint so we emit them
	// directly. The full binary is [ver, codec, mh_fn, mh_len, digest...].
	buf := make([]byte, 0, 4+HashSize)
	buf = append(buf, cidVersion1, cidCodecRaw, mhSHA256, mhSHA256Length)
	buf = append(buf, sha256Digest...)
	return "b" + base32LowerNoPad.EncodeToString(buf), nil
}

// DecodeCIDv1Raw parses a canonical Aevia CID back to its SHA-256 digest.
// Rejects any CID that is not version 1, codec raw (0x55), or multihash
// sha256 (0x12) with 32-byte digest.
func DecodeCIDv1Raw(s string) ([]byte, error) {
	if len(s) < 2 {
		return nil, errors.New("manifest: CID too short")
	}
	if s[0] != 'b' {
		return nil, fmt.Errorf("manifest: expected multibase prefix 'b', got %q", s[0])
	}
	payload, err := base32LowerNoPad.DecodeString(s[1:])
	if err != nil {
		return nil, fmt.Errorf("manifest: base32 decode: %w", err)
	}
	if len(payload) != 4+HashSize {
		return nil, fmt.Errorf("manifest: CID payload len %d, want %d", len(payload), 4+HashSize)
	}
	if payload[0] != cidVersion1 {
		return nil, fmt.Errorf("manifest: CID version = %d, want %d", payload[0], cidVersion1)
	}
	if payload[1] != cidCodecRaw {
		return nil, fmt.Errorf("manifest: CID codec = 0x%02x, want 0x%02x (raw)", payload[1], cidCodecRaw)
	}
	if payload[2] != mhSHA256 {
		return nil, fmt.Errorf("manifest: multihash fn = 0x%02x, want 0x%02x (sha256)", payload[2], mhSHA256)
	}
	if payload[3] != mhSHA256Length {
		return nil, fmt.Errorf("manifest: multihash length = %d, want %d", payload[3], mhSHA256Length)
	}
	return payload[4:], nil
}

// MustCIDv1Raw is a panicking helper for known-good inputs. Use only with
// digests produced by this package's Tree / HashLeaf.
func MustCIDv1Raw(digest []byte) string {
	cid, err := CIDv1Raw(digest)
	if err != nil {
		panic(err)
	}
	return cid
}

// TrimCIDPrefix returns a CID with the canonical 'bafkrei' prefix stripped —
// useful only for diagnostic display, never round-tripped.
func TrimCIDPrefix(cid string) string { return strings.TrimPrefix(cid, CIDv1Prefix) }
