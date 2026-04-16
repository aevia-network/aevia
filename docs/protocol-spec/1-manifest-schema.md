# Aevia Manifest Schema (v0.1)

## Abstract

The Aevia Manifest is the canonical, signed JSON-LD object that declares a
piece of video content on the Aevia protocol. Every Video-on-Demand (VOD),
Live snapshot, and Clip has exactly one manifest. The manifest binds a
cryptographic identity (a `did:pkh` derived from a Base L2 account) to a
content address (a CIDv1 over the assembled bytes) and to a set of
content-plane assertions (duration, resolutions, provenance, Acceptable Use
Policy version).

The manifest is the only artifact that MUST be registered on-chain. All
downstream protocol operations — pinning, relay, clipping, moderation,
feed ranking — operate on manifests or on derivatives of manifests. This
document specifies the schema, the canonicalization procedure, the signing
envelope, and the validation rules. It does not prescribe how manifests are
discovered, stored, or ranked; those concerns are layered above the manifest
and are addressed in separate documents.

Because manifests are immutable once signed and because they are the single
source of truth for content identity, schema evolution is strict: the
`@context` URL is versioned and frozen, breaking changes bump the context
URL to a new path, and parsers MUST preserve unknown fields through
canonicalization to enable forward-compatible extension.

## Table of Contents

1. Scope
2. Design principles
3. `@context` URL and versioning
4. Manifest object shape
   1. Required fields
   2. Conditional fields
   3. Optional fields
5. Canonicalization
6. Signing
   1. EIP-712 TypedData structure
   2. Domain separator
   3. Signature envelope
7. Validation
8. Extensibility
9. Security considerations
10. Appendix A: Normative examples
11. References

---

## 1. Scope

This document specifies the wire format of an Aevia Manifest version 0.1.
It defines the required and conditional fields for each content type
(`VideoVOD`, `VideoLive`, `VideoClip`), the canonicalization procedure
applied before hashing or signing, the EIP-712 typed-data structure used
for creator signatures, and the validation rules that every conforming
implementation MUST apply before accepting a manifest.

This document does NOT specify:

- How manifests are transported between nodes (see `4-transport.md`,
  planned for v0.2).
- How manifests are discovered (see `5-discovery.md`, planned for v0.2).
- How manifests are ranked or filtered in feeds (see `6-risk-score.md`,
  planned for v0.2).
- How moderation decisions are expressed (see `7-moderation.md`, planned
  for v0.2).

## 2. Design principles

The manifest schema is derived directly from the axiom "persistence does
not imply distribution". Persistence is guaranteed by immutability and
cryptographic addressability; distribution is a separate, off-chain
concern governed by policy. Every design choice in this document follows
from that split.

**JSON-LD was selected** over bare JSON, CBOR, and Protocol Buffers for
three reasons:

1. **Open-world semantics.** Aevia manifests MUST be extensible by
   third parties (archive nodes, moderation services, creator tools)
   without coordination. JSON-LD's `@context` mechanism makes the
   meaning of each term explicit, discoverable, and linkable to external
   ontologies where appropriate.
2. **Deterministic canonicalization.** JSON with RFC 8785 JCS produces
   a byte-for-byte deterministic serialization suitable for hashing and
   signing. Protocol Buffers require a schema registry; CBOR does not
   natively carry semantic context.
3. **Human readability.** Manifests are inspected by creators,
   moderators, auditors, and regulators. A text-based format with
   explicit field names is a feature, not an overhead.

**The manifest is self-describing and context-bound.** A parser that
encounters a manifest with an unknown `@context` URL MUST refuse to
interpret it and MUST NOT attempt to coerce it into a known schema.

## 3. `@context` URL and versioning

The Aevia v0.1 `@context` URL is:

```
https://aevia.network/schema/v1
```

This URL is **immutable** for the lifetime of the v1 schema. The document
served at this URL MUST NOT be mutated. Bug fixes, typo corrections, and
editorial changes to the accompanying prose are permitted in the
specification documents, but the shape of the schema object served at the
context URL is frozen.

Breaking changes MUST bump the URL to a new path (`/schema/v2`). A
breaking change is any of:

- Removing or renaming a required field.
- Changing the semantic meaning of an existing field.
- Changing the signing algorithm or canonicalization procedure.
- Changing the set of permissible values for an enumerated field in a
  way that invalidates previously-valid manifests.

Non-breaking changes (adding optional fields, adding new values to an
open-ended enumeration) MAY be announced as v1.1, v1.2, etc., but the
`@context` URL remains `/schema/v1`. Implementations MUST ignore
additions they do not understand.

**Dual-accept window.** When v2 is published, nodes that implement v2
MUST continue to accept and verify v1 manifests for a minimum of 24
months from the v2 publication date. This preserves the persistence
axiom for historical content.

## 4. Manifest object shape

### 4.1 Required fields

Every manifest, regardless of `type`, MUST contain the following fields:

| Field | Type | Description |
|---|---|---|
| `@context` | string (URI) | MUST equal `https://aevia.network/schema/v1`. |
| `type` | string | One of `VideoLive`, `VideoVOD`, `VideoClip`. |
| `creator` | string (DID) | `did:pkh:eip155:<chainId>:<0xAddress>`. The address MUST be EIP-55 checksummed. |
| `contentUrl` | string (URI) | `ipfs://<CID>` where `<CID>` is the CIDv1 of the assembled content. For `VideoLive`, this CID refers to the snapshot at the given epoch. |
| `provenance` | object | See below. |
| `mime` | string | RFC 6838 media type. For v0.1: `video/mp4`, `application/vnd.apple.mpegurl`, or `application/dash+xml`. |
| `aupVersion` | integer | Positive integer. Identifies the Acceptable Use Policy version the creator attests to at signing time. v0.1 starts at `1`. |

The `provenance` object MUST contain:

| Field | Type | Description |
|---|---|---|
| `timestamp` | string | ISO 8601 UTC, e.g. `2026-04-16T14:32:05.001Z`. MUST be in UTC; offsets are rejected. |
| `location` | object (optional) | `{"geohash": "<geohash>"}` with at most 5 characters of precision. Precision beyond 5 characters MUST be rejected. |
| `captureDevice` | string (optional) | Free-form device identifier. MUST NOT exceed 128 UTF-8 bytes. |
| `signature` | object | See section 6.3. |

### 4.2 Conditional fields

**VideoVOD manifests** MUST additionally contain:

| Field | Type | Description |
|---|---|---|
| `duration` | integer | Duration in milliseconds. MUST be a non-negative integer. |
| `resolutions` | array of object | At least one entry. Each entry is a `Resolution` object: `{width: uint16, height: uint16, bitrate: uint32, codec: string, cid: string}`. |

`Resolution.codec` MUST be an IANA-registered codec string (e.g.
`avc1.640028`, `hev1.1.6.L93.B0`, `av01.0.05M.08`). `Resolution.cid`
MUST be a CIDv1 addressing the assembled bytes of that specific rendition.

**VideoClip manifests** MUST additionally contain:

| Field | Type | Description |
|---|---|---|
| `parent` | string (CID) | The CIDv1 of the source manifest this clip is derived from. The parent manifest MUST have `type` equal to `VideoVOD` or `VideoLive`. |
| `sourceRange` | object | `{"startMs": uint32, "endMs": uint32}` with `startMs < endMs`. |

A clip MUST re-encode its content and produce its own `contentUrl`; a
clip that merely references a byte range of its parent is not a valid
Aevia Clip.

**VideoLive manifests** MUST additionally contain:

| Field | Type | Description |
|---|---|---|
| `epoch` | integer | Monotonically increasing non-negative integer. Each snapshot emitted during a live broadcast increments `epoch` by 1. |
| `rendezvousTopic` | string | Opaque string (max 256 UTF-8 bytes) identifying the live-broadcast discovery topic on the mesh. |

### 4.3 Optional fields

| Field | Type | Description |
|---|---|---|
| `policyFlags` | integer (uint8 bitfield) | Creator-declared content flags. Reserved bits are specified in `7-moderation.md`. Unknown bits MUST be preserved but MUST NOT be interpreted. |
| `geoHint` | string | ISO 3166-1 alpha-2 country code. Advisory only. |
| `captions` | array of object | Each entry: `{lang: "<bcp47>", cid: "<CIDv1>", format: "vtt" \| "srt"}`. |
| `chapters` | array of object | Each entry: `{startMs: uint32, title: string}`. Titles MUST NOT exceed 256 UTF-8 bytes. |
| `tags` | array of string | Each tag MUST NOT exceed 64 UTF-8 bytes; the array MUST NOT exceed 32 entries. |
| `contentIntegrity` | object | `{merkleRoot: "<hex>"}`. The root hash of the binary Merkle tree over per-chunk SHA-256 digests. See `2-content-addressing.md`. |

## 5. Canonicalization

Before hashing or signing, the manifest MUST be canonicalized with
[RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) (JSON Canonicalization
Scheme).

The canonicalization input is the manifest object **with the
`provenance.signature` field excluded**. Implementations MUST compute the
canonical form over every other field (including unknown fields; see
section 8), then pass the resulting UTF-8 byte sequence to the EIP-712
hashing procedure described in section 6.

Rules:

1. Keys MUST be sorted by lexicographic code-point order.
2. Strings MUST be UTF-8 with the JCS-prescribed escaping.
3. Numbers MUST be serialized per the ECMAScript numeric representation
   as specified in RFC 8785.
4. Whitespace between tokens MUST be absent.
5. The `signature` block inside `provenance` MUST be removed prior to
   canonicalization. It is re-attached after the signature is produced.

A conforming implementation MUST fail closed: if canonicalization
produces any error (cyclic references, unsupported numeric values such
as `NaN` or `Infinity`, non-UTF-8 strings), the manifest MUST be
rejected and MUST NOT be signed.

## 6. Signing

### 6.1 EIP-712 TypedData structure

Aevia manifests are signed using [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
typed-structured-data signatures. The `types` object is:

```json
{
  "EIP712Domain": [
    { "name": "name", "type": "string" },
    { "name": "version", "type": "string" },
    { "name": "chainId", "type": "uint256" },
    { "name": "verifyingContract", "type": "address" }
  ],
  "Manifest": [
    { "name": "context", "type": "string" },
    { "name": "type", "type": "string" },
    { "name": "creator", "type": "string" },
    { "name": "contentUrl", "type": "string" },
    { "name": "mime", "type": "string" },
    { "name": "aupVersion", "type": "uint32" },
    { "name": "provenance", "type": "Provenance" },
    { "name": "payloadHash", "type": "bytes32" }
  ],
  "Provenance": [
    { "name": "timestamp", "type": "string" },
    { "name": "location", "type": "string" },
    { "name": "captureDevice", "type": "string" }
  ],
  "Resolution": [
    { "name": "width", "type": "uint16" },
    { "name": "height", "type": "uint16" },
    { "name": "bitrate", "type": "uint32" },
    { "name": "codec", "type": "string" },
    { "name": "cid", "type": "string" }
  ]
}
```

`Manifest.payloadHash` is the SHA-256 digest of the JCS-canonicalized
manifest (with the `signature` field removed) computed in section 5. This
construction keeps the EIP-712 typed structure bounded in size while
committing to the entire manifest contents.

For VODs, the `resolutions` array is committed via `payloadHash`. For
clips, the `parent` CID and `sourceRange` are committed via
`payloadHash`. For live snapshots, `epoch` and `rendezvousTopic` are
committed via `payloadHash`. Implementations MUST NOT sign a manifest
without computing `payloadHash` over the full canonical form.

### 6.2 Domain separator

The EIP-712 domain separator is:

```json
{
  "name": "Aevia Manifest",
  "version": "1",
  "chainId": 8453,
  "verifyingContract": "<AeviaRegistry address>"
}
```

`chainId` MUST be `8453` for Base mainnet or `84532` for Base Sepolia.
`verifyingContract` MUST be the canonical AeviaRegistry address for the
target chain as published in the protocol-params ADR.

Manifests signed against one chain ID MUST NOT be considered valid on
another chain. This prevents cross-chain replay.

### 6.3 Signature envelope

The `provenance.signature` field MUST be an object with the following
shape:

| Field | Type | Description |
|---|---|---|
| `algorithm` | string | MUST equal `EIP-712` in v0.1. |
| `chainId` | integer | MUST equal the `chainId` of the domain separator used to produce the signature. |
| `verifyingContract` | string | MUST equal the `verifyingContract` of the domain separator. |
| `signer` | string | EIP-55 checksummed address. MUST match the address embedded in `creator` (`did:pkh`). |
| `signature` | string | `0x`-prefixed hex string, 65 bytes (r,s,v) for EOAs or variable length for ERC-1271 smart accounts. |
| `signedAt` | string | ISO 8601 UTC timestamp. Informational; MUST NOT be trusted for freshness decisions without an external time source. |

## 7. Validation

A conforming verifier MUST execute the following checks in order. Any
failure terminates verification and rejects the manifest.

1. **Schema validation.** The manifest MUST conform to section 4. All
   required and conditional fields MUST be present with the specified
   types and value constraints.
2. **Context check.** `@context` MUST equal
   `https://aevia.network/schema/v1`. If the verifier supports multiple
   versions, it selects the validation profile accordingly.
3. **DID coherence.** The chain ID in `creator` MUST equal the chain ID
   in `provenance.signature.chainId`. The address in `creator` MUST
   equal `provenance.signature.signer`.
4. **Canonicalization.** The verifier re-canonicalizes the manifest
   with the `signature` block removed and computes `payloadHash`.
5. **Signature verification.**
   1. The verifier computes the EIP-712 digest using the domain
      separator from section 6.2 and the `Manifest` typed structure.
   2. The verifier attempts
      [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271)
      `isValidSignature(bytes32, bytes)` against `signer`. If the call
      returns the magic value `0x1626ba7e`, the signature is valid.
   3. If the `signer` address has no deployed contract code, the
      verifier falls back to [EIP-191](https://eips.ethereum.org/EIPS/eip-191)
      `ecrecover` over the EIP-712 digest and compares the recovered
      address to `signer`.
   4. Any other outcome is a verification failure.
6. **Cross-field coherence.**
   - If `type == "VideoClip"`, the verifier SHOULD resolve `parent` and
     confirm it is a `VideoVOD` or `VideoLive` manifest. Strict verifiers
     MUST perform this check.
   - `mime` MUST be consistent with `contentUrl` (e.g. an
     `application/vnd.apple.mpegurl` manifest MUST reference an HLS
     playlist, not a bare fMP4 segment).
   - For `VideoVOD`, every `resolutions[i].cid` MUST be resolvable
     according to the rules in `2-content-addressing.md`.
   - `provenance.timestamp` MUST NOT be more than 5 minutes in the
     future relative to the verifier's clock (replay guard for fresh
     submissions; historical manifests bypass this check).
7. **AUP version check.** If the node's enforced minimum `aupVersion`
   is greater than the manifest's `aupVersion`, the node MAY refuse
   distribution but MUST NOT refuse persistence. This is the operational
   embodiment of the persistence axiom.

## 8. Extensibility

Custom fields MUST use the prefix `x-<vendor>-<name>`, where `<vendor>`
is a lowercase ASCII identifier reserved by the implementer and
`<name>` is a lowercase ASCII identifier. Example:
`x-aevia-archiveNodeId`.

Parsers MUST preserve unknown fields through the canonicalization
procedure. This guarantees that signatures remain valid across
implementations that do not recognize every extension, and that
extensions can be added without coordination.

Parsers MUST NOT interpret unknown fields for security decisions.

Registered (non-`x-`) field names are reserved for future versions of
this specification.

## 9. Security considerations

**Replay across chains.** Mitigated by `chainId` in the EIP-712 domain
separator. A manifest signed for Base mainnet (`chainId=8453`) is not
a valid signature for Base Sepolia (`chainId=84532`).

**Replay across contracts.** Mitigated by `verifyingContract` in the
domain. A signature produced for registry `0xA` is invalid for registry
`0xB`.

**Downgrade.** Mitigated by the immutable `@context` URL. A v1 manifest
cannot be re-interpreted under a future v2 schema; v2 verifiers MUST
select the v1 profile based on the context URL.

**Partial-field tampering.** Mitigated by canonicalization (RFC 8785
JCS) and by `payloadHash` in the EIP-712 structure. Any change to any
field invalidates the hash and therefore the signature.

**Unknown-field attack.** An attacker who inserts an unknown field
cannot produce a valid signature without the signer's key. A verifier
that naively strips unknown fields before recomputing the hash would
break this guarantee; implementations MUST preserve unknown fields
exactly as received.

**Signature malleability.** EIP-712 over the standard secp256k1 curve
is subject to the well-known `s`-value malleability. Verifiers MUST
enforce low-`s` canonical signatures (EIP-2) for EOA signatures.
ERC-1271 verifiers are responsible for their own malleability
properties.

**Smart-wallet compromise.** If a smart wallet's key-management
contract is upgraded to a malicious implementation, ERC-1271 verification
may return true for forged signatures. Verifiers MUST consider this
risk when deciding how much trust to place in a given signer; the
protocol does not attempt to mitigate smart-contract-level compromise.

**Clock skew.** The 5-minute future-timestamp guard is a conservative
default. Nodes MAY tighten this bound; they MUST NOT loosen it to less
than 1 minute without a documented rationale.

**Manifest-of-manifest recursion.** `VideoClip` manifests reference a
`parent` CID. Verifiers that recursively validate ancestors MUST bound
recursion depth (recommended maximum: 8) to prevent resource-exhaustion
attacks.

## 10. Appendix A: Normative examples

### 10.1 Minimal VOD manifest

```json
{
  "@context": "https://aevia.network/schema/v1",
  "type": "VideoVOD",
  "creator": "did:pkh:eip155:8453:0x52908400098527886E0F7030069857D2E4169EE7",
  "contentUrl": "ipfs://bafybeibwzifw6rxx7z7d2wq4n3jtq5xqk5h3r7s3k6rqgikjwkkgzwuyhe",
  "mime": "application/vnd.apple.mpegurl",
  "aupVersion": 1,
  "duration": 184320,
  "resolutions": [
    {
      "width": 1280,
      "height": 720,
      "bitrate": 2500000,
      "codec": "avc1.640028",
      "cid": "bafybeicq4jx6lrllb7cbsgksxsmfczxh5erxs3c3mmp5b6f4gv6uoblube"
    }
  ],
  "contentIntegrity": {
    "merkleRoot": "0x7f9b1c21d8e4a60d09e5b6b20a8d0d9ecbf0f1de4d6c6e0a1a0a6f6c6d8e0a1f"
  },
  "provenance": {
    "timestamp": "2026-04-16T14:32:05.001Z",
    "captureDevice": "aevia-web/0.1.0 chromium/124",
    "signature": {
      "algorithm": "EIP-712",
      "chainId": 8453,
      "verifyingContract": "0x0000000000000000000000000000000000000000",
      "signer": "0x52908400098527886E0F7030069857D2E4169EE7",
      "signature": "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324252627282930313233343536373839404142434445464748494a4b4c01",
      "signedAt": "2026-04-16T14:32:06.210Z"
    }
  }
}
```

### 10.2 Live snapshot manifest

```json
{
  "@context": "https://aevia.network/schema/v1",
  "type": "VideoLive",
  "creator": "did:pkh:eip155:8453:0x52908400098527886E0F7030069857D2E4169EE7",
  "contentUrl": "ipfs://bafybeihg2yq4q5kqkk5xq5q3n5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q5q",
  "mime": "application/vnd.apple.mpegurl",
  "aupVersion": 1,
  "epoch": 3,
  "rendezvousTopic": "aevia/live/bafybeibwz.../v1",
  "contentIntegrity": {
    "merkleRoot": "0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
  },
  "provenance": {
    "timestamp": "2026-04-16T14:33:05.001Z",
    "signature": {
      "algorithm": "EIP-712",
      "chainId": 8453,
      "verifyingContract": "0x0000000000000000000000000000000000000000",
      "signer": "0x52908400098527886E0F7030069857D2E4169EE7",
      "signature": "0x02030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20212223242526272829303132333435363738394041424344454647484950515253541b",
      "signedAt": "2026-04-16T14:33:06.001Z"
    }
  }
}
```

### 10.3 Clip manifest

```json
{
  "@context": "https://aevia.network/schema/v1",
  "type": "VideoClip",
  "creator": "did:pkh:eip155:8453:0x52908400098527886E0F7030069857D2E4169EE7",
  "contentUrl": "ipfs://bafybeigc5hrlbgn5rlbgn5rlbgn5rlbgn5rlbgn5rlbgn5rlbgn5rlbgn5r",
  "mime": "application/vnd.apple.mpegurl",
  "aupVersion": 1,
  "parent": "bafybeibwzifw6rxx7z7d2wq4n3jtq5xqk5h3r7s3k6rqgikjwkkgzwuyhe",
  "sourceRange": { "startMs": 12000, "endMs": 42000 },
  "duration": 30000,
  "resolutions": [
    {
      "width": 1280,
      "height": 720,
      "bitrate": 2500000,
      "codec": "avc1.640028",
      "cid": "bafybeihhjx6lrllb7cbsgksxsmfczxh5erxs3c3mmp5b6f4gv6uoblube4"
    }
  ],
  "provenance": {
    "timestamp": "2026-04-16T15:00:00.000Z",
    "signature": {
      "algorithm": "EIP-712",
      "chainId": 8453,
      "verifyingContract": "0x0000000000000000000000000000000000000000",
      "signer": "0x52908400098527886E0F7030069857D2E4169EE7",
      "signature": "0x03040506070809101112131415161718192021222324252627282930313233343536373839404142434445464748495051525354555657585960616263646566671c",
      "signedAt": "2026-04-16T15:00:01.000Z"
    }
  }
}
```

## 11. References

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Key words for use in RFCs to Indicate Requirement Levels.
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838) — Media Type Specifications and Registration Procedures.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS).
- [W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/).
- [W3C DID Core](https://www.w3.org/TR/did-core/).
- [CAIP-10](https://chainagnostic.org/CAIPs/caip-10) — Account ID Specification.
- [CAIP-350](https://chainagnostic.org/CAIPs/caip-350) — DID Method for CAIP accounts (`did:pkh`).
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) — Signed Data Standard.
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data Hashing and Signing.
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) — Standard Signature Validation Method for Contracts.
- [EIP-2](https://eips.ethereum.org/EIPS/eip-2) — Homestead Hard-fork Changes (low-`s` canonicalization).
- [CID specification](https://github.com/multiformats/cid) — Self-describing content-addressed identifiers.
- [ISO 8601:2019](https://www.iso.org/standard/70907.html) — Date and time representations.
- [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf) — Secure Hash Standard (SHA-256).
