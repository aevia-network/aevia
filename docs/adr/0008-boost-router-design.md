# ADR 0008 — BoostRouter design: non-custodial 4-way splitter

- Status: Accepted
- Date: 2026-04-17
- Supersedes: —
- Superseded by: —

## Context

RFC-8 (`docs/protocol-spec/8-economic-architecture.md`) fixes the economic
architecture around four treasuries: the creator, the Persistence Pool (which
pays Provider Nodes for bytes served), the LLC operational treasury, and the
Council fund. Every paid amplification ("boost") MUST, per §4.2, split across
those four destinations atomically. Without an on-chain router the split is
either (a) implicit in client code — which any forked client can ignore — or
(b) routed through an LLC-controlled address, which re-custodies funds and
breaks the non-custodial claim that anchors Aevia's Section-230 posture.

`BoostRouter.sol` is the on-chain instrument that makes §4.2 contract-local.
It is the second of four treasuries from RFC-8 §3 (PersistencePool is the
first, shipped in ADR 0003); the remaining two — LLC Treasury and Council
Fund — are multisigs and need no contract surface beyond being named as
immutable destinations here.

The design has to satisfy, simultaneously:

- **INV-6** (`docs/protocol-spec/8-economic-architecture.md` §7) — the
  router MUST NOT hold USDC balance between transactions. Any boost is
  atomic: receive + fan-out or revert.
- **INV-9** — every boost MUST emit an auditable event carrying all four
  computed amounts, so indexers can verify the split without replaying the
  bps arithmetic.
- **INV-11** — a boost MUST revert if `R(c) >= θ_feed` (RFC-6 §7). This
  keeps paid amplification out of the editorial hot path for content that
  has already tripped the risk score.
- **§4.3** — split parameters are Council-governable. The LLC (which
  receives `llcBps`) MUST NOT be able to unilaterally redirect boost flow.
- **§4.2** — the four bps values MUST sum to exactly 10_000.

## Decision

Ship `packages/contracts/src/BoostRouter.sol` as a stateless, non-custodial
4-way splitter. The full specification is in the contract NatSpec; this ADR
captures the decisions that are not directly readable from the source.

### Immutable destinations, mutable split

Four of the seven constructor addresses are immutable:
`usdc`, `registry` (ContentRegistry for creator lookup), `oracle`
(RiskOracle for the θ_feed gate), `persistencePool`, `llcTreasury`,
`councilFund`. The seventh — `council` — is mutable via `setCouncil(address)`
so the Council multisig can rotate signers without a redeploy (RFC-7
bootstrap → elected rotation).

The split bps (`creatorBps`, `poolBps`, `llcBps`, `councilBps`) are also
mutable but guarded by `onlyCouncil`. The LLC, which benefits from
`llcBps`, is deliberately not a signer. This is the strongest expression
of §4.3's non-discretion claim: the entity that would profit from a larger
operator share is structurally unable to award it to itself.

### Pull-then-fan-out, not push

`boost()` pulls the full `amount` from `msg.sender` via `safeTransferFrom`
and then issues four `safeTransfer` calls. We considered direct
`transferFrom(msg.sender, destination, n)` for each of the four destinations
to save one SLOAD + one external call. We rejected it because:

1. USDC's ERC-20 implementation is non-standard (returns `void`). SafeERC20
   wraps that quirk for us only when the router is the caller.
2. A four-transfer-from pattern requires four separate allowance checks,
   which some wallets display as four confirmations in UIs that front-run
   on allowance reads.
3. INV-6 is preserved either way, but the pull-then-fan-out pattern makes
   the non-custodial claim trivially auditable: `usdc.balanceOf(router)`
   after any boost MUST equal 0, and the test suite verifies this.

### Dust flows to the creator

Integer division introduces up to 1 wei of rounding per recipient. We
allocate `poolAmount`, `llcAmount`, and `councilAmount` via
`(amount * bps) / BPS_TOTAL` and define `creatorAmount := amount - the other
three`. This guarantees the four sum to exactly `amount` at any granularity
and biases the rounding residue to the creator — whose share is the largest
in the default split (50%) and the one the protocol most wants to nominally
favor.

### `θ_feed` pinned as contract constant

The contract hardcodes `THETA_FEED_BPS = 3_000`, matching RFC-6 §7.1's
default. RFC-7 §4 makes θ_feed Council-governable in principle. We chose
to freeze it at the RFC default in this first deployment because making
the gate parameter Council-tunable would collapse one of the invariants
into a social-trust dependency — a decision we want to make explicit via
RFC update and redeploy if it ever becomes necessary, not silently via a
parameter sweep. A future ADR may revisit this.

### `MIN_BOOST = 500_000` (USDC 6 decimals = $0.50)

RFC-8 §8.2 calls for a dust-spam defense. $0.50 sits above the per-tx gas
cost on Base L2 (currently ≈$0.005 end-to-end) by ~2 orders of magnitude,
so the minimum can't be ground down by fee-sponsored spam, while still
being low enough that genuine micro-boosts (a $1 tip to a street preacher,
for instance) don't need to be withheld and batched.

### Default split: 50 / 30 / 19 / 1

The defaults come from RFC-8 §4.3 and are also hardcoded in the constructor
(rather than passed as constructor args) so the deploy script can't
silently misconfigure them.

| Recipient       | bps     | %     | Rationale                               |
| --------------- | ------- | ----- | --------------------------------------- |
| Creator         | 5_000   | 50 %  | Primary economic beneficiary            |
| Persistence Pool| 3_000   | 30 %  | Pays provider nodes to keep it alive    |
| LLC Treasury    | 1_900   | 19 %  | Operational costs + sustainable margin  |
| Council Fund    | 100     | 1 %   | Governance ops, small but non-zero      |

The Council can change these at any time. The Council MUST NOT change them
to violate the invariant that the four sum to 10_000; the contract enforces
this directly.

### Gate ordering matters

`boost()` checks gates in this order:

1. `amount >= MIN_BOOST` (cheapest check)
2. `registry.isRegistered(manifestHash)` (one external call, one SLOAD)
3. `oracle.scoreBps(manifestHash) < THETA_FEED_BPS` (one external call)

If a user submits a below-minimum boost to an unregistered manifest with a
high-risk score, they pay for exactly one check. Gas-conscious ordering is
not purely cosmetic — it shapes adversarial behavior by making the cheapest
failure mode the one the protocol most wants to discourage (dust spam).

## Consequences

### Positive

- `boost()` is a single user-signed transaction. No multi-step UX.
- The LLC provably cannot raise its own cut. This is an unusually strong
  governance claim and will carry weight with regulators and auditors.
- The router's contract surface is small (three public functions:
  `boost`, `setSplit`, `setCouncil`; one view: `previewSplit`). Audit cost
  is proportionally small.
- Every boost emits one `Boost` event with four amounts computed on-chain.
  Indexers don't need to mirror bps math.
- 29 Foundry tests (including two fuzz runs with 256 cases each) cover
  every revert path, the split conservation invariant, dust-flow-to-creator,
  preview parity, governance gates, and council rotation.

### Negative

- The θ_feed gate is pinned at 3_000 bps. If a future RFC wants a different
  threshold, the only path is a redeploy + migration. Our judgment is that
  the clarity of a contract-enforced invariant outweighs the operational
  burden of a redeploy. Migrations in this codebase are already cheap — the
  contract is stateless beyond governance parameters, and front-end URLs
  are already locale-segmented via the `[locale]` router, so a contract
  swap is a one-line config change in the viewer app.
- `previewSplit` duplicates the bps math from `boost`. Drift between them
  is caught by `test_PreviewSplit_MatchesBoostBehavior`, which fuzzes an
  odd number through both paths and asserts equality. Worth the duplication
  for the UI benefit of showing the split before confirmation.
- The minimum boost of $0.50 means the protocol cannot accept sub-$0.50
  tips. Justified by dust-spam defense but worth revisiting once we have
  production economics.

### Neutral

- RiskOracle returns `0` for unknown manifests, and `BoostRouter` treats
  `0` as "no signal" (passes the gate). This is deliberate: the protocol's
  editorial posture is that content is presumed distributable until scored,
  not the reverse. RiskOracle implementations MUST emit a non-zero score
  for any manifest they have evaluated, or return `0` otherwise.

## Deployment

- Deploy after external audit. This contract is un-audited at commit time.
- Deploy targets (Base Sepolia for validation, Base mainnet for production):
  - USDC Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
  - USDC Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Constructor args come from:
  - `ContentRegistry` address — see ADR 0002
  - `PersistencePool` address — see ADR 0003
  - `RiskOracle` address — pending (M7)
  - `llcTreasury` — Gnosis Safe 2-of-2 (Leandro + spouse), expansion
    trigger once receipts exceed a threshold (documented in
    `apps/network/src/app/[locale]/operator/page.tsx` §7)
  - `councilFund` — pending Council bootstrap (RFC-7 §3)
  - `council` — the same Council multisig until election rotation
- Verification on Basescan via `--verify --verifier-url
  https://api-sepolia.basescan.org/api` (testnet) or
  `https://api.basescan.org/api` (mainnet).

## References

- `packages/contracts/src/BoostRouter.sol` — the contract
- `packages/contracts/test/BoostRouter.t.sol` — 29 Foundry tests
- `docs/protocol-spec/8-economic-architecture.md` — RFC-8 (economic arch)
- `docs/protocol-spec/6-risk-score.md` — RFC-6 (risk score + θ_feed)
- `docs/protocol-spec/7-moderation-jury.md` — RFC-7 (Council governance)
- `docs/adr/0002-content-registry-deployment.md` — ContentRegistry
- `docs/adr/0003-persistence-pool-deployment.md` — PersistencePool
- `apps/network/src/app/[locale]/operator/page.tsx` — LLC boundaries,
  §7 revenue flow mechanics
