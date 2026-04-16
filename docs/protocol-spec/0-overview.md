# Aevia Protocol Overview (v0.1)

## Abstract

Aevia is a sovereign video social protocol organized around a single
invariant: **persistence does not imply distribution**. Content
registered on the protocol is permanent and cryptographically
addressable; distribution — what appears in feeds, how it is ranked,
how it is moderated — is a separate, policy-layer concern that
operates off-chain and is subject to governance. This document
introduces the protocol, its six-layer architecture, its trust
boundaries, its versioning discipline, and the conformance classes
that implementations target.

The specification is written for protocol implementers, auditors,
and operators of Provider Nodes and Gateways. It is not a product
brief, a roadmap, or a marketing narrative. Where this document
describes the current reference implementation's gaps relative to
the protocol specification — for instance, the Cloudflare Stream
WebRTC recording gap — those notes are framed as infrastructure
trade-offs of the client, not as limitations of the protocol.

The v0.1 specification covers the manifest schema, the content-
addressing model, and the authentication layer: the minimum surface
required to produce a signed, verifiable piece of content and bind
it to a durable identity. Transport, discovery, moderation, and
economics are addressed in documents planned for v0.2.

## Table of Contents

1. Introduction
   1. Motivation
   2. Non-goals (v0.1)
   3. Terminology
2. Architecture
   1. Six-layer model
   2. Actors
   3. Trust boundaries
3. Protocol versioning
   1. SemVer semantics
   2. `@context` URL freezing
   3. Wire compatibility matrix
4. Conformance classes
   1. Minimal Viewer
   2. Full Node
   3. Provider Node
   4. Gateway
5. Document map
6. Current implementation notes
7. IANA / registry considerations
8. References

---

## 1. Introduction

### 1.1 Motivation

Contemporary video platforms collapse two distinct functions into one
system: they **store** the content, and they **distribute** the
content. That collapse is a root cause of several well-known
pathologies: a platform's moderation policy effectively destroys
content (because retrieval is only possible through the platform);
a platform's ranking algorithm effectively destroys speech (because
suppression in the feed is indistinguishable from removal for most
users); a platform's commercial incentives effectively destroy
creator autonomy (because the creator-platform relationship
concentrates all value capture at the distribution layer).

Aevia separates these two functions. **Persistence** is handled by
the protocol: a signed manifest, a content-addressable artifact, a
durable registry entry. **Distribution** is handled by a policy
layer that runs off-chain: feeds, ranking, moderation, geographic
gating. The policy layer can remove content from a feed, demote a
creator, apply geographic restrictions, or refuse to relay — but
**none of those actions can destroy the content**. The content is
always retrievable by its CID from any Provider Node that has
chosen to keep it.

This asymmetry — immutable persistence and mutable distribution —
is the axiom from which every other design decision in this
specification derives.

### 1.2 Non-goals (v0.1)

Aevia v0.1 deliberately does NOT attempt:

- **Federation.** v0.1 has a single canonical ContentRegistry
  contract. Multi-instance federation is deferred.
- **Payment channels.** v0.1 has no in-protocol payment primitive.
  The economy layer (`8-economy.md`) is planned for v0.2 and will
  address Provider Node incentives; it does not exist in v0.1.
- **Token economics.** v0.1 does not issue a token. Any future
  token design is explicitly out of scope for this version.
- **Machine-learning ranking.** v0.1 does not specify a ranking
  algorithm. Ranking is deferred to the Risk Score document
  (`6-risk-score.md`, planned), which specifies inputs, not
  models.
- **Mobile-native clients.** v0.1 targets browser-based PWAs.
  Native iOS/Android clients are implementation-level follow-ons,
  not v0.1 protocol concerns.
- **On-chain revocation registry.** Deferred to v0.2. See
  `3-authentication.md`, section 6.3.
- **BLAKE3 hashing.** Deferred to v0.2. See
  `2-content-addressing.md`, section 9.

### 1.3 Terminology

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD,
SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL in this document are to
be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
when, and only when, they appear in all capitals.

**Aevia-specific terms:**

| Term | Definition |
|---|---|
| **Manifest** | The canonical, signed JSON-LD object that declares a piece of content. See `1-manifest-schema.md`. |
| **CID** | Content Identifier, CIDv1 with multibase base32, multicodec `raw`, SHA-256. See `2-content-addressing.md`. |
| **DID** | Decentralized Identifier, specifically `did:pkh:eip155:<chainId>:<address>`. See `3-authentication.md`. |
| **Chunk** | A CMAF fragment of target duration 2 seconds, capped at 8 MiB, IDR-aligned. |
| **Ticket** | A signed delivery authorization issued by a Provider Node or Gateway. Specified in `4-transport.md` (planned v0.2). |
| **Vigil** | An observer-node role that records distribution events for audit. Specified in `7-moderation.md` (planned v0.2). |
| **Waterfall** | The fallback order for content retrieval: local cache → mesh peer → Provider Node → Gateway. Specified in `4-transport.md` (planned v0.2). |
| **Permanence Strip** | The visual UI element in the reference client that displays a manifest's CID, signer, and registry status. Not protocol-level, but referenced in editorial material. |
| **Provider Node** | A node that stores, serves, and optionally proofs-of-relay content on behalf of creators. |
| **Gateway** | An HTTP-fronted access point that bridges legacy clients to the protocol and enforces a specific distribution policy. |

## 2. Architecture

### 2.1 Six-layer model

Aevia is organized into six layers. Layers below the Graph layer
are concerned with individual pieces of content; layers above are
concerned with the social graph and the economic incentives that
sustain the network.

| # | Layer | Responsibility | v0.1 status |
|---|---|---|---|
| 1 | **Capture / Live** | Encoding, chunking, IDR alignment, live snapshots, broadcast rendezvous. | Specified (client behavior implicit in `2-content-addressing.md`). |
| 2 | **Media** | Manifest schema, content addressing, CID construction, Merkle trees. | Specified (`1-manifest-schema.md`, `2-content-addressing.md`). |
| 3 | **Persistence** | ContentRegistry contract on Base; Provider Node pinning; archive durability. | Specified for the contract surface; Provider Node economics deferred. |
| 4 | **Graph** | Follows, mentions, shares; reply/quote structures; social-graph primitives. | Planned (v0.2). |
| 5 | **Economy** | Provider Node incentives; Proof of Relay; fee routing. | Planned (v0.2). |
| 6 | **Trust** | Risk Score inputs, moderation decisions, governance. | Planned (v0.2). |

The six-layer model is architectural, not geometric: higher layers
may reference lower layers freely, but lower layers MUST NOT depend
on higher layers. In particular, the Media and Persistence layers
MUST be usable without any Trust or Economy logic.

### 2.2 Actors

| Actor | Role |
|---|---|
| **Creator** | Signs manifests, registers them on-chain, authors content. |
| **Viewer** | Retrieves manifests, verifies signatures and content hashes, plays content. |
| **Provider Node** | Pins content, serves it to peers and gateways, may earn fees (v0.2). |
| **Gateway** | Provides HTTP access to protocol content, enforces a jurisdiction-specific policy, may relay on-chain writes. |
| **Registry** | The Base L2 smart contract (or set of contracts) that records signed manifest CIDs. |
| **Moderator** | Issues moderation assertions (v0.2) that downstream feeds MAY consume; cannot destroy content. |

### 2.3 Trust boundaries

Every actor has a list of things it MUST verify and a list of things
it MAY trust without verification.

| Actor | MUST verify | MAY trust |
|---|---|---|
| Creator | Their own signing key's integrity; their own DID consistency across manifests. | Their session transport (HTTPS; identity provider's session token). |
| Viewer | Manifest signature (EIP-712 + ERC-1271 fallback); manifest CID over signed bytes; each retrieved chunk's hash; Merkle root match. | Feed ordering (advisory); Gateway metadata (informative). |
| Provider Node | Incoming manifest signature; chunk hashes on ingest; ContentRegistry state at pin time. | Peer claims about unrelated manifests (revalidate on retrieval). |
| Gateway | Everything a Viewer verifies; additionally, Provider Node identity at relay time. | Local policy configuration. |
| Registry | Contract state transitions per Solidity invariants. | Nothing off-chain. |
| Moderator | Manifest signature before issuing a moderation assertion. | Their own policy; operator-level oracles. |

No actor is trusted transitively. A Viewer that receives a chunk
from a Gateway MUST verify the chunk against the manifest's
commitment; the Viewer does not "trust the Gateway's word" about
content integrity at any point.

## 3. Protocol versioning

### 3.1 SemVer semantics

Aevia protocol versions follow [SemVer 2.0](https://semver.org/):

| Change type | Version bump |
|---|---|
| Breaking schema change, signing-algorithm change, canonicalization change. | MAJOR. |
| Additional optional fields, new optional conformance behavior. | MINOR. |
| Editorial clarifications, non-normative prose, typo fixes. | PATCH. |

v0.1 is the first published protocol version. It is pre-1.0 and
therefore MAY receive breaking changes on MINOR bumps prior to 1.0.
After 1.0, the strict SemVer discipline above applies.

### 3.2 `@context` URL freezing

The JSON-LD `@context` URL (`https://aevia.network/schema/v1`) is
**immutable** for the lifetime of the v1 major version. The
document served at that URL MUST NOT be mutated. Breaking changes
bump the URL to a new path (`/schema/v2`); see
`1-manifest-schema.md`, section 3.

v2-aware nodes MUST continue to accept v1 manifests for a minimum
of **24 months** after the v2 publication date. This dual-accept
window preserves the persistence axiom for historical content.

### 3.3 Wire compatibility matrix

| Manifest context | v0.1 node behavior | v0.2 node behavior (planned) |
|---|---|---|
| `/schema/v1` | Fully supported. | Fully supported (dual-accept). |
| `/schema/v2` | Rejected. | Fully supported. |
| Unknown | Rejected. | Rejected. |

Rejection means the manifest is neither verified nor distributed by
that node. It does NOT mean the manifest is erased; another node
with the appropriate version support MAY still serve it. This is
the persistence axiom in operational form.

## 4. Conformance classes

Aevia v0.1 defines four conformance classes. Each class is defined
by a superset of capabilities; a Full Node is a Minimal Viewer plus
additional functionality.

### 4.1 Minimal Viewer

A Minimal Viewer MUST:

- Parse a v0.1 manifest per `1-manifest-schema.md`, section 4.
- Canonicalize per RFC 8785 (section 5 of the manifest schema).
- Verify the EIP-712 signature with ERC-1271 fallback to EIP-191
  `ecrecover` (section 7 of the manifest schema).
- Resolve a CID to bytes via an HTTP Gateway or an IPFS client.
- Verify each retrieved chunk's SHA-256 against the declared leaf
  or root.
- Verify the manifest's content-integrity Merkle root when chunks
  are retrieved piecewise.

A Minimal Viewer MAY render the content for user consumption but
is not required to implement any specific player; it is required
only to verify that what it would render matches the signed
manifest.

### 4.2 Full Node

A Full Node is a Minimal Viewer plus:

- libp2p-based peer discovery on the Aevia mesh.
- Peer-to-peer chunk relay (best-effort, no economic model in
  v0.1).
- Local caching of verified chunks with a bounded cache policy.

Full Node is the first class that participates in distribution.

### 4.3 Provider Node

A Provider Node is a Full Node plus:

- Long-term pinning of specified content with durability
  guarantees documented in the node's operator terms.
- Proof of Relay (v0.2) participation — tracking of delivered
  bytes for the economy layer.
- Public HTTP endpoint or libp2p multiaddr advertising pinned
  content.

A Provider Node is the durability substrate for creator content.
In v0.1 there is no protocol-level economic reward for operating a
Provider Node; operators run nodes for reputation, service-level
agreements, or platform-level commitments.

### 4.4 Gateway

A Gateway is a Provider Node plus:

- HTTP fallback for clients that cannot speak libp2p.
- Policy enforcement at the distribution boundary: a Gateway MAY
  refuse to serve content that violates its jurisdiction's law or
  its published policy, provided such refusal is logged and does
  NOT mutate or destroy the content.
- Session-token verification for write operations that relay
  manifests into the ContentRegistry on the user's behalf
  (optional, per Gateway).

A Gateway is the policy layer's operational interface. The
protocol assumes the existence of Gateways with diverse policies
and does not prescribe a canonical policy.

## 5. Document map

| # | Document | Status (v0.1) |
|---|---|---|
| 0 | Protocol Overview (this document). | Shipped. |
| 1 | Manifest Schema. | Shipped. |
| 2 | Content Addressing. | Shipped. |
| 3 | Authentication. | Shipped. |
| 4 | Transport. | Planned (v0.2). |
| 5 | Discovery. | Planned (v0.2). |
| 6 | Risk Score. | Planned (v0.2). |
| 7 | Moderation. | Planned (v0.2). |
| 8 | Economy. | Planned (v0.2). |
| 9 | Governance. | Planned (v0.2). |

v0.1 is deliberately the minimum set sufficient to produce, sign,
register, retrieve, and verify content. It does not specify how
that content is ranked or served at scale; those concerns are
handled by the planned v0.2 documents.

## 6. Current implementation notes

This section documents specific infrastructure trade-offs in the
Aevia reference client at the time of this specification's
publication. These notes are informative; they do not modify any
normative requirement above.

**Cloudflare Stream WebRTC recording gap.** Cloudflare Stream's
WebRTC (WHIP) beta does not currently produce server-side
recordings; the product's public documentation notes this as a
known limitation with server-side recording marked "coming soon".
The Aevia reference client works around this by recording client-
side via the browser's `MediaRecorder` API and uploading the
resulting blob to Cloudflare Stream as a VOD after the broadcast
ends. This is an infrastructure trade-off of the client, **not a
limitation of the protocol**: the manifest schema refers to
content by CID after assembly regardless of how the assembly was
produced. When Cloudflare Stream exposes a server-side recording
API for WHIP, the client can be updated to rely on it with no
change to the manifest or to any on-chain artifact.

**libp2p mesh deferred to Sprint 3.** v0.1's reference client
retrieves content via HTTP only. The Full Node conformance class
(section 4.2) is specified so that future implementations can
target it, but the reference client does not currently meet Full
Node requirements. This is an implementation schedule decision,
not a protocol concern.

**ContentRegistry on Base Sepolia first.** The ContentRegistry
contract is deployed on Base Sepolia (`chainId=84532`) during the
pre-audit period. Base mainnet (`chainId=8453`) deployment follows
external audit. Manifests signed during the Sepolia phase are
valid on Sepolia only; they are NOT automatically valid on mainnet
because the EIP-712 domain separator's `chainId` and
`verifyingContract` differ. Creators who produce content during
the Sepolia phase may re-sign and re-register their manifests on
mainnet after the audit, producing a new signed manifest with a
new signature; the underlying content bytes and CIDs remain
identical.

## 7. IANA / registry considerations

Aevia v0.1 anticipates the following registrations but does NOT
finalize them in this specification:

- **Media types.** A dedicated `application/vnd.aevia+json`
  media type MAY be registered for serialized manifests.
  Implementations MAY use `application/json` with the context URL
  as a distinguishing header in the interim.
- **Multicodec.** Aevia does not require new multicodec
  entries in v0.1; all used codes (`0x12` SHA-256, `0x55` raw)
  are pre-existing.
- **Protocol ID.** A libp2p protocol ID (`/aevia/<operation>/<version>`)
  will be reserved when the transport document is published.
  v0.1 does not stake claims on specific IDs.

Concrete registration requests are deferred until v0.2, at which
point the specification will have stabilized sufficiently to
justify formal IANA engagement.

## 8. References

### Normative

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Requirement Levels.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme.
- [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf) — Secure Hash Standard.
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data.
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) — Signed Data Standard.
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) — Contract Signature Validation.
- [CAIP-10](https://chainagnostic.org/CAIPs/caip-10) — Account ID Specification.
- [W3C DID Core](https://www.w3.org/TR/did-core/).
- [W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/).
- [CID specification](https://github.com/multiformats/cid).
- [ISO/IEC 23000-19](https://www.iso.org/standard/79106.html) — CMAF.

### Informative

- [SemVer 2.0](https://semver.org/).
- [IPFS documentation](https://docs.ipfs.tech/).
- [libp2p specifications](https://github.com/libp2p/specs).
- [Base documentation](https://docs.base.org/).
- [Cloudflare Stream WHIP documentation](https://developers.cloudflare.com/stream/webrtc-beta/).
- Internal documents: `1-manifest-schema.md`, `2-content-addressing.md`, `3-authentication.md`.
