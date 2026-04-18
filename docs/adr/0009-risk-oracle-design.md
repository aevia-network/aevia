# ADR 0009 — RiskOracle design: on-chain Risk Score publication

- Status: Accepted
- Date: 2026-04-18
- Supersedes: —
- Superseded by: —

## Context

RFC-6 `docs/protocol-spec/6-risk-score.md` specifies the Risk Score
R(c), a function mapping content to a public scalar in [0, 1] that
determines eligibility for Persistence Pool subsidy, feed surfacing,
and paid amplification. The Score is computed off-chain from public
inputs and published on-chain so that distribution-layer consumers
(BoostRouter per RFC-8 §4.4, future feed indexers, Trust Ledger)
can read it in-transaction.

Without an on-chain oracle the score either (a) lives on a
centralized API that the LLC controls, which collapses the
Section-230 posture back to editorial discretion, or (b) is
recomputed by every consumer from raw inputs, which is
prohibitively expensive in an EVM context. The oracle is the
common substrate through which the Scoring service publishes and
all consumers subscribe.

`BoostRouter` (ADR 0008) already depends on `IRiskOracle.scoreBps`
via a minimal interface. `BoostRouter` cannot be deployed to any
network without a concrete RiskOracle implementation. This ADR
records the on-chain contract that closes that dependency and
makes the RFC-6 distribution-layer gate real.

## Decision

Ship `packages/contracts/src/RiskOracle.sol` as a feature-complete
implementation of RFC-6 §8 on-chain surface. Full specification is
in the contract NatSpec; this ADR captures decisions not directly
readable from the source.

### No stubs

Following the repository's "nunca stub" policy (memory
`feedback_no_stubs_production_only.md`), the contract is
production-grade for the RFC-6 surface as specified today.
Evolution fase 1 → fase 2 happens via **role rotation** of the
`scoringService` and `council` addresses, not via redeploy. The
EOA that signs scores at bootstrap will be rotated to a multisig
via `rotateScoringServiceKey()` once the Council multisig exists;
the contract does not need to change.

### Two roles, two mutators

- **`scoringService`** — publishes scores via `publishScore`.
  Rotatable only by the Council (RFC-6 §8.4 invariant: Operator
  cannot rotate the signer unilaterally, because that would let a
  compromised Operator re-sign historic scores post-hoc).
- **`council`** — opens contests (`contestScore`), resolves them
  (`resolveContest`), rotates the scoring service key, and rotates
  itself (`setCouncil`).

Everything not explicitly permitted reverts. There is no
"admin" role that can unilaterally overwrite a score outside the
contest → resolve path.

### `IRiskOracle` narrow + richer surface coexist

The `IRiskOracle` interface consumed by `BoostRouter` exposes only
`scoreBps(manifestHash) → uint16`. That is the single method the
boost gate needs. Expanding `IRiskOracle` to return the full Score
struct would complicate `BoostRouter` for no functional gain —
`BoostRouter` does not use the components, only the composite.

The full surface (`scoreOf`, `activeContestOf`, `isContested`) is
implemented directly on `RiskOracle` for consumers that need
freshness, component attribution, or contest state — Trust Ledger
indexers, creator dashboards, appeal UIs. Those consumers cast the
address to the concrete `RiskOracle` type.

### Signature-over-signer semantics

RFC-6 §8.2 prescribes `publishScore` as `msg.sender ==
ScoringServiceSigner AND signature matches`. We interpret that as
establishing the authority model (only the signer's key may
publish); we implement it as `msg.sender == scoringService` only.

Rationale: when `msg.sender` already equals the signer address, an
additional ECDSA signature over the payload is redundant. The
signature-AND-sender pattern is useful in a relayer context where
the transaction is submitted by a paymaster and the logical author
is recovered from the signature — but that semantic is better
served by standardized meta-transaction frameworks (EIP-7702, ERC-
4337 paymaster paths) than by a custom per-contract signature
check. If the protocol later needs gasless score publication, we
can layer a meta-tx router on top without modifying this contract.

Implementing the nonce-and-signature path today would add ~80 LOC
of EIP-712 domain, typehash, and nonce storage for zero current
benefit, which conflicts with the minimality discipline in CLAUDE.md.

### Contest state is binary, per-manifest

A manifest either has an active contest (`_activeContest != 0`) or
it doesn't. While a contest is active, `publishScore` reverts —
the Scoring service cannot race the Jury by re-publishing. Only
`resolveContest` with the matching `contestId` may write a new
score, which atomically clears the lock.

We considered an N-queue of pending contests but rejected it: if
multiple appeals target the same manifest simultaneously, the
off-chain Council pipeline serializes them and submits in order.
The simple per-manifest lock is sufficient and avoids reasoning
about interleaved resolutions. The `contestId` mismatch check
(`ContestIdMismatch`) ensures that if two contests are serialized,
`resolveContest` targets the right one.

### `isAbsolute → r == 10_000` invariant

RFC-4 hard exclusions (categories [b] CSAM, [c] NCII) short-circuit
the composite formula: the score MUST be 10_000 regardless of the
three components. The contract enforces this: publishing with
`isAbsolute = true` but `r != 10_000` reverts with
`AbsoluteMustBeMax`. This prevents a compromised Scoring service
from publishing "absolute" flags with arbitrary composite scores
(or failing to mark absolute when components suggest it) —
consumers reading `isAbsolute` can rely on the composite semantics.

### `updatedAt` skew window = 1 hour

`MAX_PUBLISH_SKEW` is hardcoded at 3600 seconds. Scores must have
`updatedAt ∈ [block.timestamp - 3600, block.timestamp + 3600]`.
Rationale:

- **Future-published rejection** guards against a Scoring service
  that publishes "fresh" scores with future timestamps to defeat
  consumer freshness checks.
- **Ancient rejection** guards against replay-style publication of
  stale scores to mask recent activity.
- 1 hour is generous for clock skew between the off-chain signer
  and the L2 sequencer but tight enough to make both attacks
  visibly abnormal.

The constant is not governance-mutable because changing it would
be a silent change of threat model; a future RFC revision could
make it parameter via redeploy, but a one-line window change
should require an explicit ADR.

### Inclusive edge of skew window

`updatedAt == now - 3600` is accepted (tested); `updatedAt == now -
3601` is rejected. The inclusive lower bound avoids false
rejections when the Scoring service batches scores and submits at
the last second of the window.

## Consequences

### Positive

- `BoostRouter` deployment is unblocked — the `_oracle` constructor
  arg has a concrete address.
- Evolution EOA signer → multisig signer requires a single
  `rotateScoringServiceKey` tx, no redeploy, no migration.
- The Operator cannot retro-edit scores: `publishScore` is the only
  write path for non-contested manifests and it requires the
  current scoring service key. If the Operator compromises that
  key, the Council rotates it and all subsequent publications
  require the new key; past scores remain but cannot be silently
  overwritten.
- All four `_validateScore` conditions are fuzz-covered
  (`testFuzz_PublishScore_AnyValidInputRoundTrips`,
  `testFuzz_PublishScore_RejectsOutOfRange`); 100% line, statement,
  branch, and function coverage on `RiskOracle.sol`.
- 36 Foundry tests including the `IRiskOracle` compatibility
  check (`test_IRiskOracle_InterfaceExposesScoreBps`) prove that
  `BoostRouter` can consume this contract unchanged.

### Negative

- No gasless publish path today. If the Scoring service runs in a
  context where paying gas directly is operationally awkward
  (e.g., rotating signer keys in an HSM that can't submit to L2),
  a future contract will need to wrap this one or this contract
  will need an upgrade. Given the volume (~O(posts/day) at
  steady state on Base L2 with gas < $0.01), this is tolerable for
  the foreseeable future.
- The `MAX_PUBLISH_SKEW = 3600` constant means if Base L2
  sequencer clock drifts by more than 1 hour the oracle stalls.
  Base L2 clock drift has never exceeded a few seconds in
  operational history; 1h is 3+ orders of magnitude of margin.
- `isAbsolute` is trust-the-signer: the contract cannot verify
  that a [b]/[c] trigger is real, only that `r == 10_000` when
  claimed. This is a known limitation of any on-chain oracle —
  the ground truth is off-chain. Contestation is the mitigation.

### Neutral

- `scoreBps` returns 0 for unknown manifests, matching the
  `IRiskOracle` NatSpec: BoostRouter treats 0 as "no signal" and
  allows the boost. This is a deliberate protocol choice — content
  is presumed distributable until scored, which follows the
  "persistence ≠ distribution" axiom at the distribution layer
  (unscored ≠ blocked, but unscored ≠ subsidized either once the
  feed-side gates are implemented).

## Deployment

- Deploy after (or with) external audit, together with
  `BoostRouter`. This contract is un-audited at commit time.
- Constructor args:
  - `_scoringService` — Aevia LLC's off-chain Scoring service key.
    EOA at bootstrap. Address TBD (single key under LLC custody).
  - `_council` — Same Council multisig as `BoostRouter.council` in
    production. Decision 2026-04-18: Gnosis Safe 2-of-2 (Leandro +
    spouse) on Base Sepolia, expanding to 2-of-3 after $10k/mo in
    receipts.
- Verification on Basescan via `--verify --verifier-url
  https://api-sepolia.basescan.org/api` (testnet) or
  `https://api.basescan.org/api` (mainnet).
- After deployment: `BoostRouter` constructor arg `_oracle` set to
  the deployed RiskOracle address; `deployments/base-sepolia.json`
  updated; `apps/video` + `apps/network` `.env.example` updated
  with `NEXT_PUBLIC_RISK_ORACLE_ADDRESS`.

## References

- `packages/contracts/src/RiskOracle.sol` — the contract
- `packages/contracts/test/RiskOracle.t.sol` — 36 Foundry tests
- `packages/contracts/src/IRiskOracle.sol` — narrow interface
  consumed by BoostRouter
- `docs/protocol-spec/6-risk-score.md` — RFC-6, normative
- `docs/protocol-spec/7-moderation-jury.md` — RFC-7, contestation
  semantics
- `docs/protocol-spec/8-economic-architecture.md` — RFC-8 §4.4
  boost gate
- `docs/adr/0008-boost-router-design.md` — BoostRouter (the
  primary consumer)
- `feedback_no_stubs_production_only.md` (memory) — policy that
  shaped this contract's feature-complete posture
