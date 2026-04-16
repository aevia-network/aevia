# Aevia Authentication (v0.1)

## Abstract

This document specifies how a human identity becomes a protocol-level
signer on Aevia, how server sessions are established and verified, and
how manifests authored by that identity are authenticated end-to-end.
Aevia v0.1 uses embedded smart wallets on Base L2 as the cryptographic
substrate for identity, derives a DID per [CAIP-10](https://chainagnostic.org/CAIPs/caip-10)
from the wallet's checksummed address, and uses a hosted JWT-based
session protocol for short-lived client-server authentication.

The authentication model separates three concerns: **account
provisioning** (the one-time binding of a human identity to a key and
to a DID), **session authentication** (the short-lived bearer token
that authorizes API calls against Aevia services), and **manifest
authentication** (the long-lived EIP-712 signature that authenticates
a manifest and is verifiable offline). Each layer has a distinct
trust boundary, a distinct revocation story, and a distinct failure
mode.

v0.1 intentionally accepts one custody trade-off: Privy holds the
signing key until the user exports it or connects an external wallet.
This trade-off is documented explicitly in section 8 and is motivated
by the consumer-grade onboarding target of the reference client.
Self-custodial signers (external wallets) are supported from day one
and share the same on-chain DID model.

## Table of Contents

1. Scope
2. Identity model
   1. Hierarchy
   2. DID method
3. Account creation flow
4. Session tokens
   1. Token format
   2. Server verification
   3. Required claims
   4. Transport
5. Manifest signing
   1. Signing flow
   2. Verification semantics
6. Revocation
   1. Session revocation
   2. Historical signatures
   3. On-chain revocation registry
7. Key rotation and recovery
8. Trust boundary
9. Security considerations
10. References

---

## 1. Scope

This document specifies the authentication layer of Aevia v0.1. It
defines the identity model, the session-token shape, the server-side
JWT verification procedure, and the relationship between session
authentication and manifest signature authentication. It does not
specify the format of manifests themselves (see `1-manifest-schema.md`)
nor the format of content addresses (see `2-content-addressing.md`).

## 2. Identity model

### 2.1 Hierarchy

Aevia v0.1 uses the following identity hierarchy:

```
Human identity
  → Privy login (email, Google, Apple, Passkey, external wallet)
    → Privy-managed embedded smart wallet on Base L2
      → DID (did:pkh) derived from the wallet address
        → Manifest signatures (EIP-712)
```

**Human identity** is the authentication factor the user presents to
Privy. Supported factors in v0.1 are email one-time code, Google
federation, Apple federation, WebAuthn Passkey, and external wallet
(WalletConnect / EIP-6963 / injected).

**Privy login** is the session established by the identity provider.
It produces a JWT that binds the presented factor to a Privy user
identifier.

**Embedded smart wallet** is a contract account on Base L2 whose
signing key is held by Privy's key-management infrastructure on
behalf of the user until export. Users who connect an external wallet
skip the embedded wallet step; the external wallet address is used
directly.

**DID** is the protocol-facing identity, described in section 2.2.

**Manifest signatures** are the cryptographic artifacts produced by
the DID's signer (see `1-manifest-schema.md`, section 6).

### 2.2 DID method

Aevia uses the `did:pkh` method per [CAIP-10](https://chainagnostic.org/CAIPs/caip-10)
and CAIP-350. The DID string has the exact shape:

```
did:pkh:eip155:<chainId>:<0xAddress>
```

Where:

- `<chainId>` is `8453` for Base mainnet or `84532` for Base Sepolia.
- `<0xAddress>` is the [EIP-55](https://eips.ethereum.org/EIPS/eip-55)
  checksummed address of the signing account. Lowercase or uppercase
  addresses MUST be rejected.

Example:

```
did:pkh:eip155:8453:0x52908400098527886E0F7030069857D2E4169EE7
```

Resolution of a `did:pkh` DID is deterministic: there is no DID
document hosted off-chain. The DID's public key is recovered from the
address (for EOAs) or from the contract's ERC-1271 verifier (for
smart accounts) at verification time.

## 3. Account creation flow

A new Aevia account is created through the following numbered steps.
The term "identity provider" refers to the Privy service; the term
"client" refers to the Aevia reference client.

1. The client presents the login surface (email, Google, Apple,
   Passkey, or external wallet).
2. The user authenticates to the identity provider. For passwordless
   flows this involves a one-time code or federation round-trip; for
   Passkey this is a WebAuthn assertion; for external wallet this
   is an EIP-1193 `personal_sign` challenge.
3. The identity provider creates or retrieves the user's embedded
   smart wallet on Base L2 (skipped for external-wallet flows).
4. The identity provider issues a JWT to the client as the session
   token (section 4.1).
5. The client derives the DID per section 2.2 from the wallet's
   checksummed address.
6. The client presents the DID to the user as their protocol-facing
   identity. The DID is the only identifier the user sees in
   protocol contexts.

No on-chain registration is required at account-creation time. The
first write that materializes a DID on Base is the first manifest
registration, which happens lazily.

## 4. Session tokens

### 4.1 Token format

Aevia session tokens are JWTs issued by Privy. v0.1 does not use SIWE
([EIP-4361](https://eips.ethereum.org/EIPS/eip-4361)) for session
establishment. SIWE MAY be adopted in a future version as an
alternative session mechanism; the manifest-signing layer is
independent of the session-token format.

The JWT is an asymmetrically signed (ES256 or RS256, per the identity
provider's published JWKS) token with the following Aevia-relevant
claims:

| Claim | Meaning |
|---|---|
| `iss` | Issuer URL of the identity provider. |
| `aud` | The Aevia application identifier registered with the identity provider. |
| `sub` | The identity provider's opaque user identifier. |
| `exp` | Expiration time (seconds since epoch). |
| `iat` | Issued-at time. |
| `sid` | Session identifier (identity-provider specific). |
| `wallet_address` | Optional. If present, the Base L2 address bound to this session. |

### 4.2 Server verification

An Aevia service verifying a session token MUST:

1. Parse the JWT header to extract the `kid`.
2. Fetch the identity provider's JWKS. Implementations MUST cache the
   JWKS with a **5-minute soft TTL** (refresh in background on expiry)
   and a **1-hour hard TTL** (MUST refresh synchronously beyond this
   bound).
3. Verify the JWT signature against the key identified by `kid`.
4. Check the claims listed in section 4.3.
5. Reject the token on any failure.

Services MUST NOT rely on transport-level security alone to validate
the token's authenticity. The signature check is mandatory even on
intra-service links.

### 4.3 Required claims to check

| Claim | Check |
|---|---|
| `iss` | MUST equal the configured identity-provider issuer URL. |
| `aud` | MUST equal the configured Aevia application identifier. |
| `sub` | MUST be non-empty. |
| `exp` | MUST be greater than the current time. A clock-skew tolerance of up to 60 seconds MAY be applied. |
| `iat` | MUST be less than or equal to `exp` and MUST NOT be more than 24 hours in the past. |

Services MAY enforce additional claim checks (e.g. `wallet_address`
presence for wallet-gated endpoints).

### 4.4 Transport

Session tokens MUST be presented as:

```
Authorization: Bearer <jwt>
```

on every authenticated API call. The token is additionally bound to
an HTTP-only, Secure, SameSite=Lax cookie set by the identity
provider's SDK at login time; browser clients that use the SDK's
cookie-based transport MUST still forward the `Authorization` header
for API calls, to allow non-browser clients and worker runtimes to
verify the same token format uniformly.

Tokens MUST NOT be logged, persisted to disk, or transmitted over
non-TLS channels.

## 5. Manifest signing

### 5.1 Signing flow

A manifest is signed through the following steps. The term "signer"
refers to the embedded smart wallet or the connected external wallet,
whichever is active.

1. **Build manifest.** The client constructs the manifest object per
   `1-manifest-schema.md`, section 4, **omitting** the
   `provenance.signature` field.
2. **JCS canonicalize.** The client canonicalizes the manifest object
   per RFC 8785. The result is a UTF-8 byte sequence.
3. **Compute payload hash.** The client hashes the canonical bytes
   with SHA-256. This is the `payloadHash` in the EIP-712 typed
   structure.
4. **Construct EIP-712 TypedData.** The client builds the domain
   separator and the `Manifest` typed structure per
   `1-manifest-schema.md`, section 6.
5. **Request signature.** The client invokes the identity provider's
   typed-data signing API (for embedded wallets, `signTypedData`;
   for external wallets, `eth_signTypedData_v4`).
6. **Wrap in envelope.** The client attaches the returned signature
   to the manifest as `provenance.signature` per
   `1-manifest-schema.md`, section 6.3.
7. **Publish.** The client publishes the signed manifest to the
   Aevia Content Registry contract (or to a Gateway that relays it).

The signing flow MUST NOT mutate any manifest field after step 2
except the `provenance.signature` block itself.

### 5.2 Verification semantics

Manifest verification follows ERC-1271 semantics as implemented by
Solady's `SignatureCheckerLib` (or an equivalent):

- If the `signer` address has deployed contract code, the verifier
  calls `isValidSignature(bytes32 hash, bytes signature)` on the
  contract. The call is considered successful if and only if the
  returned value equals the magic value `0x1626ba7e`.
- If the `signer` address has no deployed contract code, the
  verifier falls back to EIP-191 `ecrecover` over the EIP-712 digest
  and compares the recovered address to `signer`.

This dual path is important: an embedded smart wallet is a contract
account and MUST be verified via ERC-1271, while an externally-owned
account connected via WalletConnect is an EOA and MUST be verified
via `ecrecover`. The signer's account type is determined at
verification time by checking the presence of contract code, not by
reading a flag in the manifest.

## 6. Revocation

### 6.1 Session revocation

A user-initiated logout invalidates the JWT at the identity provider.
Services that receive a session token after a logout event MUST reject
the token. Because JWT verification is offline, real-time revocation
of individual tokens is not possible; services MUST rely on the
token's `exp` claim and SHOULD keep the `exp` short (the Aevia
reference client uses a 1-hour access token).

Services that require tighter revocation SHOULD layer a
revocation-list check (via the identity provider's introspection
endpoint) on top of JWT signature verification. This is OPTIONAL in
v0.1.

### 6.2 Historical signatures

A manifest signed by a key that was subsequently revoked remains
cryptographically valid. This is an intentional consequence of the
persistence axiom: a manifest, once signed and registered, speaks
for the creator at the moment of registration and MUST remain
verifiable forever.

Verifiers MUST NOT reject a manifest solely because the signing key
was later revoked. Verifiers MAY, and SHOULD in feed-distribution
contexts, downrank content whose signer has a recent revocation
event, per the Risk Score rules in `6-risk-score.md` (planned).

### 6.3 On-chain revocation registry

An on-chain revocation registry that allows a signer to publish a
"as of block N, treat manifests signed by me after timestamp T as
compromised" assertion is deferred to v0.2. v0.1 relies on the
identity provider's session-level revocation and on the persistence
axiom for historical content.

## 7. Key rotation and recovery

Key rotation and recovery are delegated to the identity provider in
v0.1. Supported flows are:

- **Email magic link.** The user re-authenticates to the identity
  provider, which re-issues the embedded wallet's signing capability
  for the same wallet address. The DID is unchanged.
- **Passkey recovery.** The user registers an additional WebAuthn
  credential; the identity provider binds both credentials to the
  same embedded wallet.
- **External-wallet export.** The user exports the private key of
  the embedded wallet (via the identity provider's export flow) and
  imports it into a self-custodial wallet. From that point, the same
  DID is controlled by the exported key; the identity provider no
  longer has custody.

Rotation to a **different** signing key (new DID) is out of scope
for v0.1. A creator who wishes to change their DID MUST publish a
new DID and MUST NOT expect historical manifests to be re-associated
with the new identifier.

## 8. Trust boundary

Aevia v0.1 accepts the following custody trade-off and documents it
explicitly:

**Privy holds the embedded smart wallet's signing key material until
the user exports it.** During this period, the identity provider is
capable, in principle, of signing manifests on behalf of the user.
The reference client treats the identity provider as a trusted
custody partner with documented security practices (SOC 2, key
shard architecture, etc.), but the protocol does not rely on this
trust assumption for correctness: a manifest signed by the identity
provider on behalf of the user is cryptographically indistinguishable
from a manifest signed by the user and is treated as the user's.

Users who require self-custody MUST connect an external wallet
(WalletConnect / EIP-6963 / injected). In that configuration, the
signing key never leaves the user's wallet, at the cost of a less
streamlined onboarding experience.

The trade-off is therefore **explicit, opt-in at the user's
discretion, and reversible at any time via export**. It is not a
protocol-level compromise; it is a client-level default.

## 9. Security considerations

**Replay.** Mitigated by `chainId` in the EIP-712 domain separator
(cross-chain replay) and by the `payloadHash` commitment
(cross-manifest replay). Additionally, per-manifest nonces are
unnecessary because the manifest's `provenance.timestamp` and
content-address coupling make two distinct manifests structurally
non-equal.

**Downgrade.** Mitigated by the `algorithm: "EIP-712"` field in the
signature envelope. Verifiers MUST NOT accept a manifest with an
unknown algorithm identifier and MUST NOT fall back to a weaker
algorithm. Adding EIP-191 fallback for `ecrecover` applies only to
EOA signers whose signatures are already EIP-712 typed-data hashes;
it is not a downgrade path.

**Origin binding.** Web-based signing flows are subject to origin
spoofing if the identity provider's SDK is loaded in an untrusted
iframe. Mitigated by the identity provider's allowlist of registered
origins and by the user's wallet client showing the domain in the
signing confirmation UI. Aevia's reference client MUST register only
first-party domains with the identity provider.

**Phishing resistance.** Email and OAuth-federated flows are
susceptible to phishing. WebAuthn Passkey is the recommended high-
assurance factor for creators with significant audiences; it provides
cryptographic origin binding at the browser level.

**Session hijacking.** JWT theft grants full account capability for
the token's remaining lifetime. Mitigated by short `exp` (1 hour),
by `HttpOnly` cookies for browser transport, and by operator-level
controls (e.g. DDoS protection, anomalous-IP detection). Manifest
signatures are NOT susceptible to session hijacking: a stolen JWT
does not grant access to the signing key.

**Smart-wallet upgrade attacks.** An attacker who compromises the
smart-wallet's upgrade path can retroactively cause ERC-1271 to
return true for forged signatures. This risk is inherent to smart
accounts and is not unique to Aevia. Verifiers operating feed
distribution SHOULD treat sudden code upgrades on a signer's
contract as a downranking signal.

**Key export leakage.** The export flow exposes the raw private key
to the user's browser. Implementations MUST use a modal that is
explicit about the risk, MUST NOT log or transmit the exported key,
and SHOULD recommend moving the key to hardware custody immediately
after export.

**JWKS cache poisoning.** A compromised JWKS endpoint could publish
an attacker-controlled public key. Mitigated by TLS and by the hard-
TTL cap (1 hour) that forces a synchronous refresh. Services SHOULD
additionally pin the identity provider's TLS certificate fingerprint
where operational maturity allows.

## 10. References

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Requirement Levels.
- [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) — JSON Web Token (JWT).
- [RFC 7517](https://www.rfc-editor.org/rfc/rfc7517) — JSON Web Key (JWK).
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme.
- [W3C DID Core](https://www.w3.org/TR/did-core/).
- [W3C Web Authentication Level 3 (WebAuthn)](https://www.w3.org/TR/webauthn-3/).
- [CAIP-10](https://chainagnostic.org/CAIPs/caip-10) — Account ID Specification.
- [CAIP-350](https://chainagnostic.org/CAIPs/caip-350) — `did:pkh` DID Method.
- [EIP-55](https://eips.ethereum.org/EIPS/eip-55) — Address Checksum.
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) — Signed Data Standard.
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data.
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) — Ethereum Provider JavaScript API.
- [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) — Sign-In with Ethereum (SIWE).
- [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) — Multi-Injected Provider Discovery.
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) — Contract Signature Validation.
