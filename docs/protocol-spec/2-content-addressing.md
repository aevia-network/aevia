# Aevia Content Addressing (v0.1)

## Abstract

This document specifies how the raw bytes of a video become a
cryptographically verifiable address on the Aevia protocol, and how a
client validates the integrity of streamed content on the fly. The
chunking model produces CMAF fragments targeted at 2 seconds of media
and capped at 8 MiB, each aligned to an IDR boundary so that any
chunk is independently decodable. Each chunk is hashed with SHA-256
and assembled into a binary Merkle tree whose root is committed by
the manifest. Both individual chunks and assembled renditions are
addressable as CIDv1 strings; the manifest itself is addressable as
a CIDv1 over its RFC 8785 canonical form.

The content-addressing layer is the direct expression of the
persistence axiom. Once the manifest is signed and the content is
pinned, the tuple `(CID, signature)` uniquely identifies a piece of
content regardless of which node serves it. The protocol never trusts
a retrieval source; it trusts the hash.

v0.1 uses SHA-256 exclusively. BLAKE3 is a candidate for v0.2 and is
discussed in section 9. The multicodec registry has well-defined
codes for both, which allows future migration without breaking the
CIDv1 structure.

## Table of Contents

1. Scope
2. Chunking model
3. Hashing
4. Merkle tree
   1. Tree shape
   2. Internal node computation
   3. Root placement
5. CID construction
   1. Chunk CID
   2. Manifest CID
   3. Rendition CID
6. Live-specific addressing
7. Clip addressing
8. Client-side validation
9. Hash algorithm tradeoffs
10. Security considerations
11. References

---

## 1. Scope

This document specifies the chunking, hashing, Merkle-tree
construction, and CID layout used by Aevia manifests v0.1. It defines
the operations required to produce a signable manifest from raw
encoded bytes, and the operations required to verify, at retrieval
time, that a delivered chunk matches the committed hash.

This document does NOT specify the wire format used to transport
chunks between peers (deferred to `4-transport.md`), the incentive
model for pinning (deferred to `8-economy.md`), or the ranking rules
applied to content in feeds (deferred to `6-risk-score.md`).

## 2. Chunking model

Aevia content is chunked as CMAF fragments per
[ISO/IEC 23000-19](https://www.iso.org/standard/79106.html). Each
chunk is a self-contained `moof+mdat` pair (a CMAF Fragment in the
sense of the CMAF Header + Fragment model).

The chunking parameters are:

| Parameter | Value | Rationale |
|---|---|---|
| `CHUNK_TARGET_DURATION_MS` | `2000` | 2 seconds of media. Matches the LL-HLS and LL-DASH recommended fragment durations and approximates a round trip on a typical mesh. |
| `CHUNK_MAX_SIZE_BYTES` | `8_388_608` (8 MiB) | Cap that keeps a chunk transferable in a single request-response cycle over typical residential links without fragmentation concerns. |
| IDR alignment | Required | Every chunk MUST begin with an IDR (Instantaneous Decoder Refresh) frame for video tracks. This makes each chunk independently decodable and enables random access at chunk boundaries. |

A chunk MUST NOT exceed `CHUNK_MAX_SIZE_BYTES`. If the encoder
produces a fragment that would exceed the cap at the 2-second
boundary, the encoder MUST emit the chunk at the nearest preceding
IDR frame that fits within the cap. Chunks shorter than the target
duration are permitted and expected at IDR boundaries.

Audio-only tracks MUST be packetized into CMAF fragments whose
duration approximates `CHUNK_TARGET_DURATION_MS` within the limits
of the codec's frame structure; IDR alignment is not applicable.

The encoder's output is therefore an ordered sequence of chunks:

```
C_0, C_1, C_2, ..., C_{n-1}
```

where each `C_i` is a contiguous byte range (the `moof+mdat` of a
single fMP4 fragment). The sequence defines the playback order; out-
of-order chunks are invalid.

## 3. Hashing

Aevia v0.1 uses SHA-256 per
[FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
The multicodec code for SHA-256 is `0x12`; the multihash digest
length is 32 bytes.

The per-chunk hash is computed over the raw fMP4 bytes of the chunk,
with no transport-layer framing, no prefix, no length encoding:

```
H_i = SHA-256(bytes(C_i))
```

The choice of SHA-256 over BLAKE3 in v0.1 is motivated by:

1. **Ecosystem compatibility.** IPFS, the multicodec registry, and
   every on-chain precompile path on Ethereum-family chains
   standardize on SHA-256 as the default hash. Choosing BLAKE3 in
   v0.1 would require bundling a BLAKE3 verifier on every conforming
   node, which increases the bar for new implementations.
2. **Hardware acceleration.** SHA-256 has ISA-level acceleration on
   ARM64 (ARMv8 Crypto Extensions) and on x86-64 (Intel SHA
   extensions, AMD since Zen). On the ARM64 hardware dominating
   mobile and modern data-center fleets, SHA-256 is routinely within
   2x of BLAKE3 throughput.
3. **Audit surface.** SHA-256 has a longer cryptanalysis history.
   BLAKE3 is strong and modern, but for a v0.1 protocol the
   conservative choice is merited.

BLAKE3 is discussed in section 9 and is a live candidate for v0.2.

## 4. Merkle tree

### 4.1 Tree shape

The per-chunk digests are assembled into a **binary balanced**
Merkle tree. "Balanced" here means: if the number of leaves is not
a power of two, the final leaf at each incomplete level is
**duplicated** until the level is even.

Formally, given leaves `H_0, H_1, ..., H_{n-1}`:

- If `n == 0`, the tree has no root; manifests with zero chunks are
  invalid.
- If `n == 1`, the tree's root is `H_0`.
- If `n > 1` and `n` is odd, the final leaf `H_{n-1}` is duplicated
  to produce a pair, and the level is reduced pairwise.
- The reduction proceeds upward until a single root hash remains.

The duplication rule at odd boundaries is the same rule used by
Bitcoin's Merkle tree. It is chosen for simplicity; it is compatible
with the [CVE-2012-2459](https://nvd.nist.gov/vuln/detail/CVE-2012-2459)
mitigation described in section 10.

### 4.2 Internal node computation

Internal nodes are computed by concatenating left and right children
and hashing the concatenation:

```
N = SHA-256(left || right)
```

The concatenation is a plain byte concatenation; no framing, length
prefix, or tag byte is inserted.

### 4.3 Root placement

The root of the Merkle tree is placed in the manifest at:

```
manifest.contentIntegrity.merkleRoot
```

as a `0x`-prefixed lowercase hex string of 66 characters (`0x` + 64
hex digits). The manifest commits to the tree by signing the
canonicalized manifest per `1-manifest-schema.md`, section 6.

Per-chunk digests MAY be published alongside the manifest as an
auxiliary artifact (a Merkle "leaf list") to enable efficient partial
retrieval verification. Publication of the leaf list is OPTIONAL in
v0.1.

## 5. CID construction

All CIDs in Aevia v0.1 are CIDv1, multibase base32 (prefix `b`),
multicodec `raw` (`0x55`), hash SHA-256 (`0x12`). See the
[CID specification](https://github.com/multiformats/cid) and the
[multiformats](https://github.com/multiformats/multiformats) project.

The construction follows:

```
CID = base32( 0x01 || 0x55 || 0x12 || 0x20 || SHA-256(bytes) )
```

where:

- `0x01` is the CIDv1 version byte.
- `0x55` is the multicodec for `raw`.
- `0x12` is the multihash code for SHA-256.
- `0x20` is the digest length (32 bytes).
- `base32` is the RFC 4648 lowercase encoding without padding, as
  used in multibase prefix `b`.

### 5.1 Chunk CID

A chunk CID is computed over the raw fMP4 bytes of the chunk:

```
cid(C_i) = CIDv1(raw, SHA-256, bytes(C_i))
```

Each chunk CID MAY be stored in the manifest under
`manifest.chunks[i].cid` as part of a chunks array. The chunks
array is OPTIONAL; its absence is permitted when the Merkle root is
sufficient for the deployment's integrity model.

### 5.2 Manifest CID

The manifest itself is addressable. The manifest CID is computed
over the RFC 8785 canonical form of the manifest **with the
`provenance.signature` field included**:

```
cid(manifest) = CIDv1(raw, SHA-256, JCS(manifest_with_signature))
```

This differs from the canonicalization used for signing (which
excludes the signature block): the manifest CID binds the signed
artifact as a whole, including the signature envelope, so that
anyone referencing the CID references the exact signed bytes.

The manifest CID is the content address used by the on-chain
ContentRegistry to identify a manifest.

### 5.3 Rendition CID

For a VOD with multiple renditions, each `Resolution.cid` is
computed over the assembled rendition bytes. "Assembled" means the
concatenation of that rendition's chunks in playback order, with no
transport framing:

```
cid(rendition_r) = CIDv1(raw, SHA-256, bytes(C^r_0) || ... || bytes(C^r_{n-1}))
```

This makes each rendition independently retrievable and verifiable
by its CID, and ensures that a client that downloads a full
rendition can verify the integrity of the assembled bytes without
walking the Merkle tree.

## 6. Live-specific addressing

Live broadcasts present a special case: the manifest is not complete
until the broadcast ends. Aevia handles this with a split model:

### 6.1 Rolling manifest (ephemeral)

During a live broadcast, the client maintains a **rolling manifest**
in memory and on the mesh. The rolling manifest is:

- **Append-only.** New chunks are appended as they are produced.
- **Unstable.** The manifest is NOT signed in its rolling state and
  MUST NOT be persisted to any long-term store.
- **Mesh-scoped.** Distribution is gossiped under
  `rendezvousTopic` as specified in `1-manifest-schema.md`, section
  4.2. The topic is OPAQUE; verification rules are the same as for
  a signed manifest but apply only once a snapshot is produced.

### 6.2 Snapshot (durable)

Every 30 chunks (approximately 60 seconds at 2 seconds per chunk)
the client produces a **snapshot**:

- Snapshot = rolling-manifest state at the current epoch, frozen.
- `epoch` is incremented by 1.
- The snapshot is signed per `1-manifest-schema.md`, section 6, and
  the snapshot manifest is published to the Content Registry.
- Each snapshot has its own `contentUrl` CID, its own
  `contentIntegrity.merkleRoot`, and its own signature envelope.

Snapshots are the unit of durability for live content. A viewer who
joins a broadcast mid-stream MUST tune in via the rolling manifest
for low latency, but any recording or archive MUST reference the
snapshot manifests for persistence.

### 6.3 Termination

When the broadcaster ends the live session, the final rolling-
manifest state MUST be snapshotted as `type = VideoVOD` (not
`VideoLive`) with `contentUrl` set to the CID of the fully
assembled rendition. This is the "seal" step: the live stream
becomes a durable VOD, and the last live snapshot and the sealed
VOD are linked via the VOD's `provenance` or an optional
`x-aevia-liveParent` field (implementation-defined in v0.1).

## 7. Clip addressing

A clip is a derivative work. It MUST re-encode the selected time
range into its own independent byte sequence, produce its own chunk
stream, its own Merkle root, its own rendition CIDs, and its own
manifest. A clip that merely points into a parent manifest's byte
range via offset is NOT a valid Aevia clip.

The clip manifest commits to its parent via the `parent` field
(parent's manifest CID) and to the derived range via `sourceRange`
(`startMs` / `endMs` relative to the parent's timeline). Verifiers
MAY resolve the parent to check that the claimed `sourceRange` is
within the parent's duration.

The rationale for re-encoding is threefold:

1. **Independent verifiability.** A viewer who has only the clip's
   CID can verify and play it without fetching the parent.
2. **Moderation.** The clip has its own Risk Score inputs and can
   be moderated independently of the parent.
3. **Provenance clarity.** The clip's creator signs the clip; the
   parent's creator signed the parent. The protocol does not blur
   attribution.

## 8. Client-side validation

A conforming client MUST perform, at minimum:

1. **Per-chunk hash check.** For each retrieved chunk `C_i`, the
   client computes `SHA-256(bytes(C_i))` and compares it to the
   expected leaf digest (taken from a published leaf list or
   derived from the Merkle proof accompanying the chunk). On
   mismatch, the chunk MUST be discarded and re-requested from a
   different source.
2. **CID check.** For each assembled rendition, the client verifies
   that the concatenated bytes hash to the rendition CID before
   considering the rendition fully retrieved.

A conforming client SHOULD, when the Merkle proof accompanies the
chunk:

3. **Merkle path verification.** The client verifies the inclusion
   proof of `H_i` in the tree rooted at
   `manifest.contentIntegrity.merkleRoot`. This enables streaming
   verification with bounded memory: the client needs `O(log n)`
   hashes per chunk rather than the full leaf list.

Auditors and archival nodes SHOULD additionally verify the full
Merkle tree reconstruction against the manifest's root.

## 9. Hash algorithm tradeoffs

The v0.1 choice of SHA-256 is summarized in section 3. This section
discusses the tradeoff with BLAKE3 in more depth, because the
protocol is deliberately designed to allow a hash-algorithm
migration via the multicodec tag in CIDv1.

**BLAKE3 advantages:**

- 3–10x software throughput on general-purpose CPUs without
  hardware acceleration.
- Built-in tree mode (no separate Merkle construction needed).
- XOF (extendable output) for use cases beyond fixed-size digests.

**SHA-256 advantages:**

- Universal ecosystem support (IPFS, Ethereum, every multicodec
  registry consumer).
- Hardware acceleration on the dominant mobile and data-center
  ISAs (ARMv8 Crypto Extensions; Intel SHA and AMD Zen
  extensions).
- Larger cryptanalysis history; marginal safety factor against
  unknown attacks.
- Cheaper on-chain verification (native precompile on Ethereum-
  family chains).

**Migration path:** The CIDv1 multihash code (`0x12` for SHA-256,
`0x1e` for BLAKE3) is the native migration mechanism. A v0.2
manifest MAY declare its integrity root under BLAKE3; verifiers MAY
support both concurrently via a config flag. v0.1 nodes that do not
support BLAKE3 MUST reject v0.2 manifests with BLAKE3 integrity
roots; this is a non-breaking evolution because the `@context` URL
changes in lockstep.

For v0.1, SHA-256 is the only accepted hash algorithm.

## 10. Security considerations

**Second-preimage resistance.** SHA-256 provides
approximately 2^128 second-preimage resistance, well above the
attack-feasibility threshold for the foreseeable future.

**Chunk-ordering attack.** A malicious peer could swap the positions
of two chunks `C_i` and `C_j` in a delivery stream. Mitigated
because the Merkle tree is order-sensitive (each leaf position is
fixed) and because playback would fail at the first misaligned IDR
boundary. Clients MUST treat any Merkle-path verification failure
as a hard error and MUST NOT skip past a failed chunk.

**Padding / truncation.** A truncated fMP4 chunk would not match
its leaf digest; the mismatch is detected by the per-chunk hash
check. A trailing-byte-padded chunk similarly fails the hash check.

**Duplicated-last-leaf attack (CVE-2012-2459).** The rule that
duplicates the last leaf at odd levels creates a malleability
opportunity: an attacker could construct a different leaf sequence
that produces the same root by mirroring the duplication. Mitigated
by requiring that verifiers, during leaf-list reconstruction,
compare the tree's leaf count against the manifest's declared chunk
count and reject any reconstruction whose leaf count is not equal
to the declared count. The manifest's `duration` and (where
present) `chunks[]` array provide the required cross-check.

**Hash-length extension.** SHA-256 in the Merkle context is not
susceptible to length extension in any practical way, because the
`N = SHA-256(left || right)` construction fixes input length to
exactly 64 bytes and the caller controls the inputs.

**Rendition substitution.** A peer could deliver the 720p rendition
while claiming to deliver the 1080p rendition. Mitigated because
each rendition has its own CID committed in the manifest, and the
client verifies the rendition CID against the assembled bytes.

**Algorithm downgrade.** Mitigated by the multicodec-tagged CIDv1.
A SHA-256 CID cannot be re-interpreted as a weaker hash because the
multicodec `0x12` byte is part of the CID.

**Large-manifest DoS.** A manifest with a pathologically large
`chunks[]` array or a very deep Merkle tree could exhaust verifier
resources. Verifiers MUST cap the accepted chunk count (recommended
maximum: `1_000_000` chunks, corresponding to approximately 23 days
of continuous 2-second chunks) and MUST bound the Merkle-tree depth
accordingly.

## 11. References

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Requirement Levels.
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) — Base-N Encodings (base32).
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme.
- [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf) — Secure Hash Standard.
- [ISO/IEC 23000-19](https://www.iso.org/standard/79106.html) — CMAF.
- [CID specification](https://github.com/multiformats/cid).
- [Multiformats project](https://github.com/multiformats/multiformats).
- [BLAKE3 specification](https://github.com/BLAKE3-team/BLAKE3-specs).
- [CVE-2012-2459](https://nvd.nist.gov/vuln/detail/CVE-2012-2459) — Bitcoin Merkle-tree duplicated-leaf vulnerability.
