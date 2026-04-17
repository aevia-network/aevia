# Aevia Persistence Pool (v0.1)

## Abstract

This document specifies the **Persistence Pool**, the economic layer
that funds the retention of Aevia content across the Provider Node
fleet. The Pool is the operational realization of the "persistence"
half of the protocol's axiom: a creator who has signed and registered
a manifest (per `1-manifest-schema.md`) pays the Pool for a retention
window, and Provider Nodes pin the manifest's chunks for that window
in exchange for per-epoch credits. The "distribution" half of the
axiom is governed by RFC 4; the two layers are coupled only at one
point, namely that content delisted by the Jury MUST NOT receive
further Pool payouts, though it MAY continue to be pinned voluntarily.

Funding, payout, and slashing are all settled in USDC on Base L2, not
in native ETH. This is a deliberate choice: content-persistence
horizons are measured in years, and a volatile settlement asset would
distort both creator funding decisions (over- or under-funding by
factor of 2× within a quarter) and Provider Node operating economics.
USDC provides a stable unit of account while preserving on-chain
settlement.

The Pool is a **subsidy mechanism**, not a custodian. Provider Nodes
hold the content; the Pool holds the creator's pre-paid USDC and
releases it to Provider Nodes that have demonstrably served the
content, via per-epoch availability proofs. A Pool insolvency or a
Provider Node failure does not destroy the content — it changes who
gets paid — because the content is addressable by CID on any peer
that has retained the bytes.

## Table of Contents

1. Motivation
2. Actors and roles
3. Pricing model
4. Availability proofs
5. Creator funding flow
6. Payout schedule
7. Economic edge cases
8. Jurisdictional neutrality
9. Security considerations
10. Implementation reference
11. References

---

## 1. Motivation

### 1.1 Why vanilla IPFS is insufficient

Public IPFS provides content-addressable retrieval but not
content-persistent storage. A CID resolves only while some peer
chooses to host the bytes; there is no economic mechanism that
compels any peer to retain any specific piece of content. Empirical
measurement across public gateways routinely shows median retention
of uncommercialized CIDs below six months. This is a correctness
gap relative to the Aevia thesis: if persistence cannot be relied
upon, the permanence claim on the Capture surface reduces to
marketing copy.

Filecoin introduced pay-for-pinning contracts but does so with
per-deal pricing, long negotiation cycles, and a gas-heavy
settlement path. The operational mismatch between sub-second social
interactions and multi-hour Filecoin deal lifecycle makes Filecoin
unsuitable as the first-order persistence mechanism for a live-video
social protocol.

### 1.2 Why pooled pinning

Pooled pinning — where many creators contribute to a shared budget
and many Provider Nodes draw from it proportionally to their verified
service — dominates per-file pricing for Aevia's workload for three
reasons:

1. **Predictability for creators.** A creator funds a fixed USDC
   envelope for a fixed retention window. They do not price-discover
   per file, per Provider Node, per chunk; they do not bid against
   other creators. This is the only mental model compatible with
   consumer-grade onboarding.
2. **Liquidity for Provider Nodes.** An operator earning from 10,000
   manifests at a low per-manifest yield is far more viable than an
   operator dependent on 10 high-value contracts. Pool settlement
   smooths the operator's income and reduces the minimum viable
   Provider Node scale.
3. **Censorship-resistance via redundancy.** A pooled model naturally
   funds replication across multiple Provider Nodes per manifest.
   Redundancy factor (§5.3) is a funding parameter; the Pool prices
   it as a multiplier, and the resulting replication is the
   protocol's structural defense against selective takedown pressure
   on any single node or jurisdiction.

### 1.3 Relationship to the axiom

The Pool funds **persistence**. It does not fund **distribution**,
which is governed by the Risk Score (RFC 4 §4.4) and by the Jury
(RFC 4 §4.5). A manifest with a clean Risk Score receives both
persistence payouts and distribution amplification; a manifest
delisted by the Jury receives neither (RFC 5 §5.7), but its bytes
are not destroyed and remain retrievable by direct CID from any
willing peer. This strict separation is the Pool's mechanical
embodiment of the thesis: the Pool can refuse to **subsidize**, but
it cannot **erase**.

## 2. Actors and roles

| Actor | Role |
|---|---|
| **Creator** | Signs a manifest per RFC 1; funds the Pool for a retention window covering that manifest; MAY top up to extend retention per §5.7.2. |
| **Provider Node** | Commits storage and egress for pinned manifests; submits per-epoch availability proofs; receives credits per §5.6. |
| **Pool contract** | On-chain custody of creator funds, accounting of per-manifest budgets, payout schedule execution. Implemented as `PersistencePool.sol` <!-- sprint-3 -->. |
| **Credit token** | ERC-20 wrapper around cUSDC with purpose metadata, issued by `CreditToken.sol` <!-- sprint-3 -->; represents Provider Node earnings pre-withdrawal. |
| **Indexer** | Off-chain `services/indexer/` <!-- sprint-3 --> service that consumes Pool events, maintains the ranking of unfunded manifests, and serves matching queries to Provider Nodes. |
| **Jury** | RFC 4 §4.5; MAY trigger payout suspension for delisted manifests via the `ModerationRegistry`. |

The Pool contract and Credit token are the only new smart-contract
surface introduced by this RFC. The ContentRegistry (`1-manifest-schema.md`
§12) remains the authoritative registry of manifests; the Pool
references manifest CIDs but does not re-verify signatures (it
relies on the ContentRegistry's invariants, per §5.9.2).

### 2.1 Settlement asset

The Pool settles exclusively in **USDC on Base L2**:

- Base mainnet (`chainId=8453`): USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Base Sepolia (`chainId=84532`): USDC contract `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

Native ETH, wrapped ETH, and other ERC-20 tokens are NOT accepted
as Pool settlement assets in v0.1. A future governance proposal MAY
introduce additional stable assets (e.g. PYUSD, EURC); volatile
assets MUST NOT be considered. This is an explicit architectural
constraint, not a pricing preference: the Pool's multi-year
retention horizon is incompatible with volatile settlement.

## 3. Pricing model

### 3.1 Per-byte-per-day unit

The cost of funding a manifest for a retention window is:

```
cost(bytes, days) = bytes × days × unit_price + overhead
```

Where `unit_price` is a function of protocol parameters:

```
unit_price = P_base × (1 + congestion_factor) × (1 + redundancy_factor)
```

### 3.2 `P_base`

`P_base` is the protocol's bootstrap per-byte-per-day price before
modifiers. The v0.1 default is:

```
P_base = 0.000_000_5 USDC per byte per day
       ≈ 5 USDC per GB per year
```

This benchmarks against:

- **Filecoin** spot market (~$3–6 per GB per year for 1-year deals
  on FilMarket, 2026 Q1 figures).
- **Arweave** endowment model (~$8–15 per GB upfront amortized
  over the 200-year endowment horizon).
- **Cloudflare R2** retail (~$15 per TB-month = $180 per TB-year ≈
  $0.18 per GB per year, which is significantly cheaper but is
  centralized custody; the Pool's price includes the redundancy
  multiplier and the operational overhead of small distributed
  nodes).

`P_base` is **reassessed quarterly** by the governance contract
(forward-ref `<!-- sprint-4 -->`) based on:

- Aggregate Provider Node marginal cost (measured via a stake-
  weighted survey).
- Pool utilization (target: 60–80% of funded bytes actively pinned).
- External benchmark deltas (Filecoin spot, Arweave endowment).

Changes to `P_base` MUST use a 14-day timelock (§5.9.1) and MUST
NOT apply retroactively: manifests funded at the prior price retain
their original cost basis for their full retention window.

### 3.3 `congestion_factor`

`congestion_factor ∈ [0, 1]` scales with Pool utilization. Let `U`
be the ratio of actively pinned bytes to theoretical Pool capacity:

```
congestion_factor = max(0, (U - 0.7) / 0.3)
```

- `U ≤ 0.7` (ample capacity): `congestion_factor = 0`.
- `U = 0.85`: `congestion_factor = 0.5` (prices rise 50%).
- `U ≥ 1.0`: `congestion_factor = 1.0` (prices double).

`congestion_factor` is a market-clearing mechanism: when Pool
capacity approaches saturation, new funding becomes more expensive,
which both discourages marginal new commitments and signals the
need for additional Provider Node onboarding.

### 3.4 `redundancy_factor`

`redundancy_factor` scales with the creator's declared replication
count:

| Tier | Replication count | `redundancy_factor` | Typical use |
|---|---|---|---|
| **Family** | 3× | 2 | Default tier. Personal, creator-direct content. |
| **Standard** | 5× | 4 | Small-ministry broadcasts, community content. |
| **Ministry** | 9× | 8 | High-durability content (persecuted-church broadcasts, archival documentaries). |

The `redundancy_factor` equals `(replication_count - 1)`: a 3×
replicated manifest pays for 1 original + 2 redundant copies = 3
total storage commitments, hence `redundancy_factor = 2`.

Replication count is a creator choice at funding time (§5.5) and is
not reversible within a retention window. A creator who wants to
increase replication on an existing manifest MUST top up with
additional funds and a new `redundancy` argument; the Pool's
accounting treats this as a separate commitment layered on top of
the original.

### 3.5 `overhead`

`overhead` is a fixed per-manifest fee covering:

- Base L2 gas for the Pool contract's `Funded` event emission and
  accounting writes.
- Indexer compute cost of queuing the manifest for Provider Node
  bidding.

v0.1 default: `overhead = 0.15 USDC` per manifest. This is a flat
fee independent of manifest size; it is recalibrated by governance
alongside `P_base`.

### 3.6 Worked example

A 1 GB VOD, funded for 1 year, Family tier (3× replication), at
`P_base = 0.000_000_5` and `congestion_factor = 0`:

```
bytes  = 1_073_741_824       (1 GiB exact)
days   = 365
P_base = 0.000_000_5 USDC/byte/day
red_f  = 2                   (3× replication)
cong_f = 0                   (ample capacity)

unit_price = 0.000_000_5 × (1 + 0) × (1 + 2)
           = 0.000_001_5 USDC/byte/day

cost = 1_073_741_824 × 365 × 0.000_001_5 + 0.15
     ≈ 587_723 USDC micro-units + 0.15
     ≈ 0.588 USDC + 0.15
     ≈ 0.738 USDC
```

A 1 GB VOD for 1 year at Family tier costs approximately **$0.74**
at `P_base`. For the Ministry tier (9× replication, `red_f = 8`):

```
unit_price = 0.000_000_5 × 9 = 0.000_004_5 USDC/byte/day
cost       ≈ 1.76 USDC + 0.15 ≈ 1.91 USDC
```

A 1 GB VOD for 1 year at Ministry tier costs approximately **$1.91**.
Both figures are well below Cloudflare R2 retail at equivalent
redundancy, but they are the floor: `congestion_factor` drives the
price up under load, and governance MAY raise `P_base` if
Provider Node marginal cost rises.

## 4. Availability proofs

### 4.1 Epoch cadence

Provider Nodes submit availability proofs on a **24-hour epoch**.
Epochs are aligned to UTC midnight. An epoch's submission window
opens at epoch boundary and closes 6 hours later; proofs received
after the window are not credited.

The 24-hour cadence is a deliberate trade-off: shorter epochs
increase gas cost per Provider Node per manifest; longer epochs
reduce the granularity of slashing decisions. 24 hours bounds the
maximum credit-earning outage at one epoch and matches the typical
operational rhythm of small-fleet Provider Nodes.

### 4.2 Proof format

An availability proof for a manifest at epoch `e` is structured as:

```
Proof(manifestCid, epoch) = {
  manifestCid: CIDv1,
  epoch:       uint64,
  challenge:   bytes32,     // derived from block.prevrandao at epoch start
  samples:     [chunkIndex, chunkHash, merkleProof],
  merkleRoot:  bytes32,     // the manifest's contentIntegrity.merkleRoot
  signature:   EIP-712 signature by Provider Node's did:pkh
}
```

The challenge is a deterministic function of the epoch boundary
block's `prevrandao` value and the manifest CID:

```
challenge = keccak256(prevrandao(epoch_boundary_block) || manifestCid)
```

From the challenge, the Provider Node derives 3 chunk indices
modulo the manifest's total chunk count. For each index, the node
retrieves the chunk from its local store, computes its SHA-256, and
constructs a Merkle inclusion proof against the manifest's
`contentIntegrity.merkleRoot` per `2-content-addressing.md` §4.

A submitted proof is valid if and only if:

1. The `signature` field verifies against the Provider Node's
   registered `did:pkh`.
2. Each `chunkHash` matches `SHA-256(chunkBytes)`.
3. Each `merkleProof` reconstructs to `merkleRoot`.
4. The `challenge` equals the deterministic derivation from epoch
   randomness.
5. The epoch is the current epoch (submissions for past epochs are
   rejected).

### 4.3 Sampling parameters

The 3-sample count is a calibration between:

- **Detection power.** A Provider Node that retains 90% of a
  manifest's chunks passes 3-sample random challenges with
  probability `0.9³ ≈ 0.73`. Missing proofs beyond the slashing
  threshold (§5.4.5) will catch this node over a rolling window.
- **Cost.** 3 samples bound the Merkle proof size at approximately
  `3 × log₂(chunk_count) × 32` bytes, which stays under 10 KiB
  for any realistic manifest and keeps the calldata cost manageable
  on Base L2.

A future protocol version MAY increase the sample count for
high-tier manifests (forward-ref `<!-- v0.2 -->`) or add optional
challenge-response rounds (e.g. proof-of-replication per Filecoin-
style constructions). v0.1 uses the 3-sample rule uniformly.

### 4.4 Reward distribution

Within an epoch, let `N_m` be the set of Provider Nodes that
submitted valid proofs for manifest `m`. The epoch's reward for
manifest `m` is:

```
reward_per_epoch(m) = manifest_budget(m) / (retention_days × replication_count(m))
```

Each Provider Node in `N_m` receives:

```
node_credit(n, m, epoch) = reward_per_epoch(m) / |N_m| × region_weight(n) × tier_weight(n)
```

Where:

- `region_weight(n)` normalizes for regional egress cost. Default
  weights: North America = 1.0, Europe = 1.0, South America = 1.2,
  Africa = 1.3, Asia = 1.2, Oceania = 1.1. These are bootstrap
  values; governance recalibrates them quarterly.
- `tier_weight(n)` reflects the Provider Node's tier (stake,
  uptime history, no-slash reputation). Default tiers: Bronze =
  1.0, Silver = 1.1, Gold = 1.2.

If `|N_m|` exceeds the manifest's `replication_count(m)`, the Pool
distributes to the top `replication_count(m)` nodes by
`region_weight(n) × tier_weight(n)`, breaking ties by earliest
proof submission. Excess nodes MAY have pinned voluntarily and
receive no credit; they bear their own opportunity cost.

### 4.5 Slashing conditions

A Provider Node that fails to submit a valid proof in an epoch
forfeits its credit share for that epoch for that manifest.
Persistent failures trigger collateral slashing:

| Missed epochs in rolling 30-day window | Consequence |
|---|---|
| 1–3 | No collateral slash. Credit forfeited. |
| 4–7 | 5% of manifest-specific collateral slashed. |
| 8–14 | 10% of manifest-specific collateral slashed, node suspended from new manifest assignment for 30 days. |
| 15+ | 20% of manifest-specific collateral slashed (§5.9.3 cap), node removed from manifest's Provider set. Content is re-queued to the Indexer for new bids. |

Slashing is **per-manifest**, not global: a Provider Node that
operates 10,000 manifests and neglects one does not lose collateral
on the other 9,999. This preserves operator incentives in the face
of localized failures (network outage affecting a subset of manifests
stored on a single disk, etc.).

Slashed collateral accrues to the Pool treasury, not to other
Provider Nodes, to avoid creating perverse incentives to report
peers for slashing eligibility.

## 5. Creator funding flow

### 5.1 Funding steps

A creator funds persistence through the following steps. Each step
is normative; skipping a step produces an invalid funding attempt
that the Pool contract MUST reject.

1. **Compute manifest CID.** The creator computes the manifest CID
   per `2-content-addressing.md` §5.2 over the signed manifest
   bytes.
2. **Register manifest.** The creator calls the ContentRegistry's
   `registerContent(manifestCid, ...)` per `1-manifest-schema.md`
   §12, binding the manifest CID to their `did:pkh`.
3. **Approve USDC.** The creator calls `USDC.approve(pool_address,
   amount)` authorizing the Pool to pull the funding amount.
4. **Fund the manifest.** The creator calls
   `PersistencePool.fund(manifestCid, bytes, days, redundancy)`.
   The Pool contract:
   - Verifies the manifest is registered in the ContentRegistry
     and the caller is the registered creator.
   - Computes `cost` per §5.3.
   - Pulls the USDC via `transferFrom`.
   - Records `(manifestCid, bytes, days, redundancy, amount,
     fundedAt)` in its storage.
   - Emits `Funded(manifestCid, creator, bytes, days, redundancy,
     amount)`.
5. **Indexer match.** The off-chain Indexer consumes the `Funded`
   event and queues the manifest for Provider Node bidding.
6. **Provider Node pinning.** Up to `redundancy` Provider Nodes
   accept the assignment, pin the chunks referenced by the manifest,
   and begin submitting per-epoch availability proofs (§5.4).

Between steps 4 and 6 there is an unfunded window during which the
manifest is in the Pool's accounting but not yet pinned. The Pool
MUST track the `fundedAt` timestamp and the `firstProofAt` timestamp
per manifest; if `firstProofAt - fundedAt > 24 hours`, the
creator is entitled to a partial refund for the unfunded window
(§5.7.1).

### 5.2 Funding with creator-chosen region preference

A creator MAY supply an optional `regionFilter` argument to `fund`:

```
fund(manifestCid, bytes, days, redundancy, regionFilter?)
```

`regionFilter` is a bitmask of allowed regions (e.g. exclude US, or
require at least 2 nodes in Europe). The Pool does not enforce the
filter cryptographically; it passes the filter to the Indexer, which
restricts Provider Node matching accordingly. If the filter cannot
be satisfied (e.g. the creator requires 9× replication entirely in
Oceania), the `Funded` event is still emitted, but the Indexer MUST
emit a `Underprovisioned(manifestCid, reason)` event. The creator
MAY at that point either relax the filter (by calling a dedicated
`updateRegionFilter` entry point) or accept partial provisioning.

Jurisdictional neutrality constraints on `regionFilter` are
documented in §5.8.

## 6. Payout schedule

### 6.1 Epoch crediting

At the close of each 24-hour epoch, the Pool contract credits each
Provider Node's on-chain balance per §5.4.4. Crediting writes to a
mapping `balance(did:pkh) → uint256 USDC units`; it does not
transfer USDC to the node until withdrawal (§5.6.2).

Credits are represented in the accounting system as balances in the
`CreditToken` contract (<!-- sprint-3 --> an ERC-20 wrapper around
cUSDC with purpose metadata; the wrapper exposes the underlying
USDC 1:1 on withdrawal).

### 6.2 Withdrawal threshold

A Provider Node MAY call `withdraw(amount)` on the Pool at any time,
subject to:

- **Minimum withdrawal: 1 USDC.** Withdrawals below 1 USDC are
  rejected to avoid dust, which would waste gas relative to yield.
- **Node active status.** A node suspended under §5.4.5 (8-14 missed
  epochs) MAY NOT withdraw for the duration of the suspension.
  Credits continue to accrue for manifests on which the node is
  not suspended.
- **No pending slash.** A node with an unresolved slash proceeding
  (>14 missed epochs on a manifest) MAY NOT withdraw until the
  slash is applied. The slash debits from accrued credits first,
  then from staked collateral.

### 6.3 Treasury cut

**2%** of each epoch's gross Pool disbursement accrues to the
protocol treasury instead of being distributed to Provider Nodes.
The treasury funds:

- Audit and bug-bounty budgets.
- Governance tooling.
- Indexer operations (the reference Indexer is run by the Aevia
  foundation, but the protocol treats it as a service to fund like
  any other).

The 2% cut is a governance parameter with a 14-day timelock
(§5.9.1). It MUST NOT exceed **5%** without a supermajority
governance proposal; the 5% ceiling is a structural protection
against treasury bloat.

### 6.4 Unclaimed credit expiration

A Provider Node credit balance that has not been withdrawn for
**365 days** reverts to the treasury. The node is notified via an
on-chain `ExpiryWarning` event at T-30, T-14, T-7, and T-1 days
prior to expiration; a single `withdraw` call within the window
resets the expiration timer.

The expiration rule exists so that abandoned Provider Node keys do
not indefinitely lock creator funds inside the Pool. It does NOT
apply to staked collateral, which is released only on explicit
un-stake or on slash.

## 7. Economic edge cases

### 7.1 Pool insolvency

**Definition.** Pool insolvency occurs when the aggregate
commitments (sum over all active manifests of remaining obligation)
exceed the aggregate funded balance (creator USDC deposited minus
payouts already made). This can occur if `congestion_factor` was
under-priced during a utilization spike, or if a governance error
reduced `P_base` retroactively (which §5.3.2 forbids, but the
contract MUST assume defense-in-depth).

**Response.** On insolvency detection, the Pool enters **graceful
rebate mode**:

1. Proportional rebate to creators based on time already served.
   A creator whose manifest has served `t / total_days` of its
   retention window, and whose original commitment was `cost`,
   receives a rebate of `cost × (1 - t / total_days) × (1 - solvency_ratio)`
   where `solvency_ratio = available_balance / aggregate_commitments`.
2. Provider Nodes continue pinning on a **best-effort** basis.
   Nodes MAY stop pinning insolvent manifests at any time without
   slashing penalty.
3. The governance contract is notified via `InsolvencyEntered`
   event and MUST schedule a remediation proposal within 7 days
   (typically: raise `P_base` or inject treasury funds to restore
   solvency).

Graceful rebate preserves the persistence axiom operationally: even
under insolvency, the content is not destroyed. Best-effort pinning
continues for as long as any Provider Node finds it worthwhile; the
underlying CIDs remain resolvable on any node that has retained
them.

### 7.2 Creator top-up

A creator MAY extend a funded manifest's retention window by
calling `topUp(manifestCid, additionalDays, additionalRedundancy?)`.
The Pool:

- Computes the prorated cost at the **current** `P_base` and
  `congestion_factor` (top-ups do not grandfather the original
  price, to prevent arbitrage across price changes).
- Pulls the additional USDC from the creator.
- Extends the manifest's `retention_end` by `additionalDays`.
- Optionally increases `replication_count` by `additionalRedundancy`,
  which triggers the Indexer to recruit additional Provider Nodes.

Top-ups MUST NOT reduce a manifest's retention window or
replication count. A creator who wishes to terminate coverage early
MUST contact the Jury for a graceful removal assertion (RFC 4 §4.5);
the Pool does not expose a "cancel and refund" primitive, to prevent
creators from weaponizing cancellation against Provider Nodes that
have already committed storage.

### 7.3 Content delisting via AUP

When the Jury (RFC 4 §4.5) records a `delist` decision on the
ModerationRegistry (RFC 4 §4.7), the Pool contract:

1. Stops accruing payouts for the manifest at the next epoch
   boundary.
2. **Does not refund** the creator. The creator's original
   commitment remains inside the Pool and is transferred to the
   treasury at the manifest's original `retention_end`.
3. Notifies Provider Nodes via the `PayoutSuspended(manifestCid)`
   event.

Provider Nodes MUST respect the suspension for credit purposes.
They MAY voluntarily continue pinning the content; doing so earns
no credits but incurs no slash. This preserves the axiom:
**distribution** (pool-subsidized amplification) is denied, but
**persistence** (bits remain retrievable from any willing peer) is
not destroyed.

If the Jury later records a `reinstate` decision (successful
appeal, RFC 4 §4.6), the Pool resumes payouts and computes
retroactive credit for the suspended epochs, drawn from the
creator's originally committed funds. The creator is made whole
relative to their original commitment; the Provider Nodes are made
whole relative to their availability proofs during the suspension.
The treasury is not drawn upon for reinstatements.

### 7.4 Manifest replacement

Aevia does not support in-place manifest replacement (manifests are
content-addressed, so "replacement" means publishing a new manifest
with a new CID). A creator who publishes a follow-up manifest (a
corrected VOD, a longer version) MUST fund the new manifest
separately. The Pool does not transfer funding across manifest
CIDs; there is no primitive for "apply my existing budget to this
new CID", because doing so would violate the content-address
guarantee (§5.9.2).

## 8. Jurisdictional neutrality

### 8.1 Provider Node discretion

Provider Nodes MAY refuse to pin a specific manifest per their
local legality assessment. Refusal is a pre-commitment act: a node
that sees a manifest assignment from the Indexer MAY decline to
accept it without penalty. A node that accepted an assignment and
later refuses MUST signal `VoluntaryDrop(manifestCid, reason)`;
voluntary drops do not trigger slashing but do move the node to
the "available" queue for that manifest (so the Indexer can
re-assign). Frequent voluntary drops degrade the node's tier weight
(§5.4.4).

### 8.2 No global takedown authority

The Pool contract has NO entry point for administrative content
removal beyond the Jury path (RFC 4 §4.5). There is no
`adminForceDelist` function; there is no multisig-bypass route.
This is enforced at the contract level: the only caller authorized
to flip a manifest into suspended status is the ModerationRegistry's
Jury multisig.

### 8.3 Aggregated refusal as a Risk Score input

The Pool emits per-manifest `VoluntaryDrop` events with region
tags. The Indexer aggregates these events and publishes a
per-manifest refusal rate by region. This aggregate feeds
`R_legal` in the Risk Score (RFC 4 §4.2.1). A manifest that is
refused by a majority of Provider Nodes in a region has, by
definition, high regional legal exposure, and the Risk Score reflects
that signal without requiring any central adjudicator to declare
the content illegal.

### 8.4 Creator region filters

Creators MAY use `regionFilter` (§5.5.2) to decline provisioning
from specific jurisdictions. This is a legitimate operational tool
(a journalist covering sensitive material in country X may wish to
avoid Provider Nodes in country X, which are susceptible to local
pressure) and is a first-class Pool primitive. The Pool does NOT,
however, allow region filters for the purpose of evading the AUP:
a creator cannot target a filter set to "all regions with no CSAM
reporting" and escape NCMEC reporting obligations, because those
obligations attach at the **Gateway** layer (RFC 4 §4.2.1), not
at the Pool layer.

## 9. Security considerations

### 9.1 Timelocked parameter changes

All protocol parameters (`P_base`, `congestion_factor` formula,
`redundancy_factor` tiers, treasury cut, epoch length, slashing
rates) MUST be changed via a governance proposal with a minimum
**14-day timelock**. The timelock is enforced at the smart-contract
level: a `queueChange(param, newValue)` call creates a pending change
with `executableAfter = now + 14 days`; a separate `executeChange`
call becomes valid only after the delay.

The timelock is shorter than is customary for DeFi protocols (which
typically use 48-72 hours) but longer than the 24-hour epoch
cadence, so Provider Nodes always have at least 14 epochs of notice
before any parameter affecting their economics changes. 14 days is
also the minimum window in which a malicious governance capture
could be detected and mitigated (by un-staking, by fork proposal,
etc.).

### 9.2 Manifest verification delegation

The Pool does NOT re-verify manifest signatures at funding time. It
relies on the ContentRegistry's invariants: a manifest CID that is
registered has been verified by the ContentRegistry at registration
time. The Pool trusts the ContentRegistry's state via direct view
calls; it does not trust any off-chain source for this
determination.

This delegation is documented here to make the trust boundary
explicit: if the ContentRegistry has a bug that admits an invalid
manifest, the Pool will pay for its persistence. Mitigation is to
audit the ContentRegistry to the same standard as the Pool and to
couple their deployment in governance (a ContentRegistry upgrade
MUST be reviewed by the Pool's audit council, forward-ref
`<!-- sprint-4 -->`).

### 9.3 Bounded slashing

Slashing per epoch per manifest is capped at **20% of the
manifest-specific collateral**. A Provider Node cannot lose more
than 20% of its collateral for a single manifest in a single
24-hour window. This protects operators from catastrophic loss
during transient outages (24-hour regional power failure, ISP
partitioning, etc.) while preserving the incentive to maintain
uptime.

The cap is particularly important as a governance-attack defense:
a compromised governance that attempted to slash an operator to
zero in one action would be blocked by the per-epoch cap, giving
the operator time to raise the alarm, un-stake, or fork.

### 9.4 Provider Node identity

A Provider Node's identity is its `did:pkh` (per `3-authentication.md`
§2.2), accompanied by staked collateral registered in the
`PersistencePool.sol` contract. Two properties follow:

- **Non-anonymous signing.** Every availability proof is signed by
  the node's `did:pkh`. Faked proofs are infeasible without the
  node's signing key.
- **Cost-of-Sybil.** Creating N Sybil Provider Nodes requires
  staking N × collateral amount. The reward function (§5.4.4)
  distributes pro rata, so Sybil nodes earn no more in aggregate
  than a single honest node with equivalent staked capital; the
  only gain is influence over replication-count selection, which
  is bounded by the Pool's tier-weight cap.

### 9.5 Reorg handling

Base L2 follows Ethereum-style finality semantics with a typical
deep-reorg probability below 10⁻⁶ at 15-block confirmation depth.
The Pool contract considers `Funded` and `Credited` events final at
**60 blocks of confirmation** (approximately 2 minutes on Base's
2-second block time). Pool state read by off-chain Indexer services
MUST likewise buffer to 60 blocks; reading at lower depth risks
ingesting an orphaned event.

### 9.6 Oracle trust in challenge randomness

The availability-proof challenge derivation (§5.4.2) depends on
`block.prevrandao` at the epoch boundary block. `prevrandao` on Base
L2 is a function of the L1 beacon chain's RANDAO, which is
unpredictable prior to the slot and unmalleable post-slot except by
a ≥33% consensus attacker on Ethereum mainnet. This level of
assurance is sufficient for the Pool's sampling, which does not
require cryptographic-grade unpredictability; a 3-sample challenge
is robust against biased randomness provided the bias is bounded
below 50% per bit. Future protocol versions MAY adopt a dedicated
VRF (e.g. Chainlink VRF or drand) for higher-assurance sampling.

### 9.7 Replay and cross-epoch reuse

Availability proofs are bound to their epoch via the `challenge`
derivation (§5.4.2) and the `epoch` field of the proof structure.
Submitting an epoch-`e` proof as evidence for epoch `e+1` fails
validation because the challenge does not match.

Cross-manifest replay is prevented by including `manifestCid` in
the challenge derivation. A proof for manifest `m₁` is not valid for
manifest `m₂` even if the two manifests share chunks.

## 10. Implementation reference

Forward-references to contracts and services that implement the
Persistence Pool. These references are authoritative for client
implementers and informative for spec readers. Contracts are
authored under the Sprint 3 milestone.

- **`PersistencePool.sol`** <!-- sprint-3 --> — Core Pool contract.
  Holds USDC custody, records per-manifest budgets, schedules
  payouts, implements slashing, emits `Funded`,
  `PayoutCredited`, `VoluntaryDrop`, `Underprovisioned`,
  `PayoutSuspended`, and `InsolvencyEntered` events.
- **`CreditToken.sol`** <!-- sprint-3 --> — ERC-20 wrapper for
  cUSDC with purpose metadata. Represents Provider Node earnings
  pre-withdrawal. See `TODO.md` §5 for the detailed scope breakdown.
- **`ModerationRegistry.sol`** <!-- sprint-3 --> — Referenced from
  RFC 4 §4.7. The Pool reads this contract to determine payout
  suspension state.
- **`services/indexer/`** <!-- sprint-3 --> — Go service that
  subscribes to `Funded` and `VoluntaryDrop` events, maintains
  Provider Node assignment queues, and serves matching queries.
  Stateless with respect to correctness: the Pool contract is the
  source of truth; the Indexer accelerates match-making.
- **Governance contract** <!-- sprint-4 --> — Recalibrates `P_base`,
  `redundancy_factor` tiers, region weights, and treasury cut.
  Enforces the 14-day timelock (§5.9.1).

## 11. References

### Normative

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Requirement Levels.
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data (used for availability-proof signatures).
- [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612) — Permit (referenced for USDC approval UX).
- [ERC-20](https://eips.ethereum.org/EIPS/eip-20) — Token standard (used for USDC and CreditToken).
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction (referenced for Provider Node smart accounts).
- `1-manifest-schema.md` — Manifest CID referenced by `fund()`.
- `2-content-addressing.md` — Chunk structure and Merkle root used by availability proofs.
- `3-authentication.md` — `did:pkh` identity for Provider Nodes and creators.
- `4-aup.md` — Jury decisions that trigger payout suspension (RFC 4 §4.5).

### Informative

- [Filecoin specification](https://spec.filecoin.io/) — Comparison point for per-deal pinning economics.
- [Arweave yellow paper](https://www.arweave.org/yellow-paper.pdf) — Comparison point for endowment-model persistence.
- [IPFS documentation](https://docs.ipfs.tech/) — Underlying content-addressing substrate.
- [Base documentation](https://docs.base.org/) — L2 runtime, block time, finality semantics.
- [Circle USDC on Base](https://developers.circle.com/stablecoin/docs/usdc-on-base) — Settlement asset.
- [Chainlink VRF](https://docs.chain.link/vrf) — Candidate randomness source for future sampling upgrades.
- [drand](https://drand.love/) — Alternative randomness beacon.
- `CLAUDE.md` §Stack invariants — Cloudflare + Base + USDC architectural anchors.
- `docs/aup/README.md` — AUP placeholder document.
- `TODO.md` §5 — Sprint 3 scope for `PersistencePool.sol` and `CreditToken.sol`.
