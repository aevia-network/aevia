# ADR 0002 — ContentRegistry deployment on Base Sepolia

- Status: Accepted
- Date: 2026-04-17
- Supersedes: —
- Superseded by: —

## Context

Sprint 2 of the Aevia protocol lands the first on-chain anchor: the
`ContentRegistry` contract specified in `packages/contracts/src/ContentRegistry.sol`
and in the signing/validation rules of `docs/protocol-spec/1-manifest-schema.md`
§6. The contract implements the axiom "persistence does not imply
distribution" by recording the existence of a signed manifest CID while
delegating every distribution concern (pinning, ranking, feed surfacing) to
the off-chain Risk Score pipeline.

The contract was sealed for Sprint 2 after 22/22 Foundry tests passing and
reviewed EIP-712 typing (`RegisterContent(address owner,bytes32 manifestCid,
bytes32 parentCid,uint8 policyFlags,uint256 chainId,uint256 nonce)` —
typehash `0x8c8ee0c01f85e8e70588bfddbac469cf565f6c12435948d2b54b5b7fda771415`).
Signature validation dispatches via OpenZeppelin `SignatureChecker` to
ERC-1271 for smart wallets (Privy embedded) and to ECDSA for EOAs, so the
registry supports Privy-managed accounts without additional glue.

Sprint 2 also unblocks the dashboard "registrar on-chain" action: from the
moment a live input finishes and Cloudflare Stream produces a VOD
(`meta.recordingVideoUid`), the creator can sign a typed-data payload with
their Privy wallet and persist the anchor on Base Sepolia. Without a
canonical deployed address this flow cannot ship, hence this ADR.

The Sprint 2 scope explicitly does not produce the full CIDv1 raw + binary
Merkle SHA-256 root over the assembled MP4 yet (that lands in Sprint 3 when
the Stream webhook pipeline gains the authority to emit the final CID
server-side). To still exercise the end-to-end on-chain flow, Sprint 2 uses
a deterministic placeholder:

```
manifestCid = keccak256(abi.encodePacked(
  bytes32(videoUid),      // Cloudflare Stream video UID, left-padded
  address(creator),       // owner address (20 bytes)
  uint64(createdAtSeconds)// epoch seconds at registration time
))
```

This placeholder is unique per (live, creator, timestamp) tuple and cannot
collide with a future real CIDv1 (CIDv1 bytes always start with a multibase
/ multicodec prefix; a raw keccak output does not). When Sprint 3 ships the
webhook pipeline, the placeholder is replaced; already-registered placeholder
entries remain valid on-chain and can be migrated or superseded via a
clip/re-register flow without editing the contract.

## Decision

Deploy `ContentRegistry` once to Base Sepolia at the address below and treat
it as canonical for the Sepolia network for the remainder of the pre-audit
program.

| Field | Value |
|---|---|
| Contract | `ContentRegistry` |
| Network | Base Sepolia |
| Chain ID | `84532` |
| Address | `0x07ffbcB245bcD8aA08F8dA75B2AeDE750d5592F0` |
| Deploy tx | `0xdfd8c57b69ea02311fa594144a37f16a419b1858e6eef2fb8e9da150ae458562` |
| Deploy block | `40345592` |
| Deployer | `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca` |
| Deployment time | `2026-04-17T20:57:51.882Z` |
| Gas used | `705130` |
| DOMAIN_NAME | `Aevia ContentRegistry` |
| DOMAIN_VERSION | `1` |
| DOMAIN_SEPARATOR | `0x2c78e842aafb062367f91fb28e747b6cf70d898dcbe60089f7f152a7d5eb831d` |
| REGISTER_TYPEHASH | `0x8c8ee0c01f85e8e70588bfddbac469cf565f6c12435948d2b54b5b7fda771415` |

Deploy command (reproducible from `packages/contracts/`):

```
set -a; source .env; set +a
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BASE_SEPOLIA_RPC" \
  --broadcast \
  -vv
```

Basescan verification was skipped (`BASESCAN_API_KEY` empty). The ABI is
committed at `packages/contracts/abi/ContentRegistry.json`; the canonical
address + block manifest is committed at
`packages/contracts/deployments/base-sepolia.json`.

Protocol spec cross-link: `docs/protocol-spec/1-manifest-schema.md` §6
(signing envelope) and the new "Implementation reference" appendix at the
bottom of that document.

Sprint 2 manifest-CID placeholder:

```
manifestCid = keccak256(abi.encodePacked(
  bytes32(videoUid), address(creator), uint64(createdAtSeconds)
))
```

TODO (Sprint 3+): replace with the CIDv1 raw + binary-Merkle SHA-256 root
defined in `docs/protocol-spec/2-content-addressing.md` once the Cloudflare
Stream webhook pipeline emits the assembled MP4 server-side.

## Consequences

- The address `0x07ffbcB245bcD8aA08F8dA75B2AeDE750d5592F0` is the canonical
  Aevia `ContentRegistry` on Base Sepolia (chain 84532). All client code
  (`packages/auth/src/register-content.ts`, dashboard "registrar on-chain"
  action) MUST target this address. Any new deploy requires a new ADR and a
  migration plan for already-anchored manifests.
- Mainnet migration will require a fresh deploy after external audit, a
  distinct deployer key managed via keystore (not the throwaway EOA used
  here), and a new ADR (`0003-content-registry-mainnet.md`). This ADR does
  not authorize mainnet deployment.
- The deployer EOA (`0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca`) has no
  privileged role on the deployed contract. `ContentRegistry` has no owner,
  no admin, no upgrade path; the deployer key can be discarded safely. It
  is retained only to fund additional Sepolia gas experiments during the
  pre-audit window.
- The placeholder manifest CID scheme is a Sprint 2 simplification that
  trades full CIDv1 fidelity for an unblocked end-to-end on-chain demo.
  Verifiers built before Sprint 3 MUST treat manifest CIDs whose first
  byte does not match a CIDv1 multibase/multicodec prefix as placeholder
  entries, not as canonical content addresses.
- Signatures produced for this chain ID / verifying-contract pair MUST NOT
  be considered valid for any other deployment. `DOMAIN_SEPARATOR` binds
  both, so a signature for `0x07ff…5592F0` on chain `84532` cannot be
  replayed on mainnet or on a future redeployment.
