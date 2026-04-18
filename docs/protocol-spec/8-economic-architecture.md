# Aevia Economic Architecture (v0.1)

## Abstract

This document specifies the **economic architecture** of the Aevia
protocol: which treasuries hold cUSDC, who controls each of them,
how funds move between them, and which invariants MUST hold at all
times. It is the third leg of the three-document stool that grounds
the protocol's claim to **not be a securities offering**; the other
two are `4-aup.md` (which specifies what the protocol will and will
not amplify) and `5-persistence-pool.md` (which specifies how
Provider Nodes are compensated for replication).

This document adds nothing to RFC 5 about how the Persistence Pool
pays Provider Nodes — that flow is already normative. What this
document adds is the **complete graph**: the other three treasuries
(LLC, Creator Escrow, Council Fund), the Boost Router that
redistributes creator-directed credit flow, the operator-fee
streams that fund Aevia LLC, and the bright-line invariants that
prevent any of those flows from capturing the Persistence Pool or
the Council Fund.

The core design commitment is that the Persistence Pool is
non-discretionary. Aevia LLC pre-funds it during bootstrap and
thereafter receives no claim on its balance; disbursements are
programmatic per RFC 5. This is the technical instantiation of the
separation principle at the economic layer: content persistence is
a public good funded by creator flows and operated by the protocol;
editorial services are a private good sold by Aevia LLC for a fee.
Collapsing these two would destroy both the protocol's Howey
defense and Provider Nodes' incentive to treat Pool commitments as
credible.

All compensation in this document is denominated in cUSDC on Base
L2. No native token exists. No treasury holds speculative assets.
This is deliberate: a volatile settlement asset would distort
creator budgeting, Provider Node operating economics, and Council
governance incentives, and would collapse the Howey defense that
`/providers` and `5-persistence-pool.md` rely on.

## Table of Contents

1. Motivation
2. Terminology
3. Treasury topology
4. Boost Router
5. Credit Pulse
6. Operator fees
7. Invariants
8. Security considerations
9. Implementation reference
10. References

---

## 1. Motivation

### 1.1 The gap this document closes

RFC 4 (`4-aup.md`) specifies the editorial criterion by which
content loses eligibility for subsidy and feed placement. RFC 5
(`5-persistence-pool.md`) specifies the mechanics of the Persistence
Pool: how creators pre-pay, how Provider Nodes prove availability,
and how payouts are computed. Neither document specifies:

- who holds the cUSDC that is not in the Persistence Pool
- what happens to a viewer tip routed from the aevia.video client
  to a creator
- how Aevia LLC is compensated for operating the relayer,
  settlement aggregator, and client platform
- what prevents Aevia LLC from sweeping the Pool balance to cover
  payroll
- how boost payments (paid amplification) are split across creator,
  pool, and operator
- how Council members are compensated for governance work

A system that answers these questions by convention rather than by
contract is not legible to a regulator, a Provider Node operator,
or an investor doing diligence. Convention is also not a defense
against founder replacement: any future operator of Aevia LLC could
unilaterally redirect flows in ways that invalidate the protocol's
persistence claim.

This RFC normalizes each of these flows.

### 1.2 The separation principle at the economic layer

The Aevia thesis — persistence is not distribution — maps directly
onto the economic graph. Persistence is funded from a pool whose
balance is non-discretionary: pre-paid by creators, disbursed to
Provider Nodes by a programmatic settlement (RFC 5). Distribution
is operated by editorial services (feed, ranking, recommendation,
boost placement) that are sold by Aevia LLC for a fee. Each half
of the thesis corresponds to a distinct treasury with distinct
access rules. The two halves touch at exactly two points: (i) a
configurable fraction of creator boost spending and subscription
take is routed back into the Persistence Pool as the Credit Pulse
(§5), and (ii) a content item scored R(c) ≥ θ_subsidy is excluded
from further Pool payouts (RFC 5 §7, RFC 6).

A conformant implementation MUST NOT allow any economic path that
lets Aevia LLC, any member of the Council, or any Provider Node
operator unilaterally move funds between these two halves in a
direction not specified in this document.

### 1.3 Non-goals

This document does not:

- perform the legal analysis that establishes the protocol is not
  a securities offering; that analysis is the responsibility of
  counsel, and this RFC is a technical artifact that such counsel
  can reference
- specify the substance of the AUP; see `4-aup.md`
- specify the mechanics of Risk Score computation; see
  `6-risk-score.md`
- specify the composition, election, or deliberation procedures of
  the Council; see `7-moderation-jury.md`
- mandate any particular multisig topology for any treasury; §3
  specifies the minimum number of signers and the role separation,
  and the implementation is free to use Gnosis Safe, a custom
  Solidity multisig, or equivalent primitives

---

## 2. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**,
and **MAY** in this document are to be interpreted as described in
RFC 2119.

**Treasury** — an on-chain address (multisig or contract) that
holds cUSDC and enforces access rules specified in §3. Aevia has
exactly four treasuries at protocol level: PersistencePool,
LLCTreasury, CreatorEscrow, and CouncilFund.

**Bright line** — a transfer that is explicitly forbidden by this
RFC. Bright lines MUST be enforced by contract (where possible)
or by multisig policy (where contract enforcement is not
applicable). Every bright line in this document is listed in §7.

**Credit Pulse** — the recurring inflow of cUSDC into the
PersistencePool from creator-directed flows (boost, subscription,
tips). The Pulse is the mechanism by which the Pool replenishes
itself after the Aevia LLC bootstrap contribution runs down.

**Boost** — a cUSDC payment made by a creator or a community of
viewers to amplify a specific piece of content (identified by its
manifest CID) across Aevia's editorial surfaces. Boosts are routed
through the Boost Router (§4) and are subject to Risk Score gating.

**Settlement** — the periodic (default: per-epoch) on-chain event
in which the PersistencePool disburses earned rewards to Provider
Nodes. Specified normatively in RFC 5.

**Operator** — Aevia LLC, in its role as the entity running the
relayer, settlement aggregator, client platform (aevia.video), and
enterprise deployments. The Operator is distinct from (i) the
protocol (which is the set of contracts, specs, and Provider Node
software) and (ii) the Council (which governs parameters).

**Relayer** — the service operated by the Operator that submits
gas-sponsored manifest registrations to the ContentRegistry on
behalf of creators who do not hold native ETH. See `3-authentication.md`.

**Aggregator** — the service operated by the Operator that computes
per-epoch Provider Node payouts from the challenge-response receipts
(RFC 5 §4) and submits them to the PersistencePool.

**Take-rate** — the percentage of a creator-directed gross flow
(tip, subscription, boost portion bound for the creator) that Aevia
LLC retains as compensation for operating aevia.video. Take-rate
applies only to flows routed through the CreatorEscrow.

**Non-custodial routing** — a pattern in which cUSDC passes through
an Operator-controlled contract but is never held beyond the
duration of a single transaction. The Operator MUST NOT be able to
pause, freeze, or reassign funds in a non-custodial routing path.

**Council-governable** — a parameter that can only be changed by
Council proposal passing the threshold specified in
`7-moderation-jury.md` (default ≥7/12, subject to per-term veto).

**LLC-unilateral** — a parameter or action that the Operator can
execute without Council approval. This RFC specifies which parameters
are LLC-unilateral and which are Council-governable; by default, any
parameter that affects the Persistence Pool, Boost Router split, or
Council Fund is Council-governable, and any parameter that affects
only the LLC Treasury is LLC-unilateral.

---

## 3. Treasury topology

### 3.1 Overview

There are four treasuries. Each holds cUSDC on Base L2. Each has a
distinct controlling entity and a distinct set of permitted inflows
and outflows. No other treasury exists at the protocol level; any
additional balance (e.g., a future Provider Node grant program) MUST
be specified by a subsequent RFC and MUST NOT draw from the four
treasuries defined here except via a transfer explicitly permitted
in §3.6.

```
                ┌──────────────────────────────────┐
                │          PersistencePool         │
                │                                  │
    bootstrap   │  controlled by: protocol         │
   (one-way) ──▶│  inflow: bootstrap, Credit Pulse │
    from LLC    │  outflow: Provider Node payouts  │
                │           (per RFC 5 settlement) │
                │                                  │
                │  LLC MUST NOT withdraw           │
                └──────────────────────────────────┘
                             ▲
                             │ credit pulse fraction
                             │
                ┌──────────────────────────────────┐
                │          BoostRouter             │
                │                                  │
                │  controlled by: protocol         │
                │  non-custodial splitter          │
                │  gate: R(c) < θ_feed             │
                └──────────────────────────────────┘
                  ▲        ▲        ▲         ▲
                  │        │        │         │
                  │        │        │         │
         creator wallet    LLC      Council   Pool
         (via escrow)   Treasury    Fund     (see above)

                ┌──────────────────────────────────┐
                │         LLCTreasury              │
                │                                  │
                │  controlled by: Aevia LLC multisig│
                │  inflow: relayer fee, aggregator │
                │    fee, take-rate, boost LLC     │
                │    share, enterprise, B2B SaaS   │
                │  outflow: payroll, infra, ops    │
                │                                  │
                │  LLC-discretionary               │
                └──────────────────────────────────┘

                ┌──────────────────────────────────┐
                │         CreatorEscrow            │
                │                                  │
                │  controlled by: protocol         │
                │  non-custodial intra-tx splitter │
                │  holds nothing between txs       │
                │  inflow: viewer tips, subs       │
                │  outflow: creator wallet +       │
                │    LLC take + pool fraction      │
                └──────────────────────────────────┘

                ┌──────────────────────────────────┐
                │         CouncilFund              │
                │                                  │
                │  controlled by: Council multisig │
                │  inflow: 1% of boost flow,       │
                │    bootstrap from LLC            │
                │  outflow: Council stipends,      │
                │    audit costs, trust ledger     │
                │    publication                   │
                │                                  │
                │  LLC MUST NOT withdraw           │
                └──────────────────────────────────┘
```

### 3.2 Persistence Pool

The Persistence Pool is specified normatively in RFC 5. This RFC
adds the following:

1. **Bootstrap funding.** Aevia LLC MAY contribute cUSDC to the Pool
   during the bootstrap phase. Such contributions are one-way; once
   transferred, the Operator forfeits any claim to them. Each
   bootstrap contribution MUST emit a `PoolBootstrapFunded(operator,
   amount, epoch)` event. The implementation reference is in §9.
2. **Credit Pulse inflows.** In steady state, the Pool is replenished
   by the Credit Pulse (§5) rather than by continued LLC bootstrap.
   The transition from bootstrap to Credit Pulse is observed rather
   than proclaimed: the Pool balance stabilizes when Pulse inflow
   equals ε · S(t) (RFC 5 §12 of the whitepaper).
3. **Bright line (MUST).** The Operator MUST NOT withdraw from the
   Persistence Pool by any path. The Pool contract MUST expose no
   `withdraw()` or `sweep()` function accessible to any non-Provider
   address. Provider Node payouts MUST flow exclusively through the
   settlement mechanism defined in RFC 5.

### 3.3 LLC Treasury

The LLC Treasury is the operator-controlled treasury funded by
service fees. It is a standard Gnosis Safe multisig or equivalent
with a minimum of 2 of 3 signers. The signers are Aevia LLC officers
as specified in the LLC operating agreement.

Permitted inflows:

- Relayer fees per manifest registration (§6.1)
- Aggregator fees per settlement submission (§6.2)
- aevia.video take-rate on creator flows (§6.3)
- Boost LLC share as routed by the Boost Router (§4)
- Enterprise deployment fees (§6.4)
- Risk Classifier B2B SaaS fees (§6.5)

Permitted outflows:

- Any Aevia LLC operational expense (payroll, infrastructure,
  legal, marketing, etc.)
- Bootstrap transfer to the Persistence Pool (§3.2.1) — one-way
- Bootstrap transfer to the Council Fund (§3.5.1) — one-way

The LLC Treasury is **LLC-discretionary**: the Operator chooses
how to spend it, subject to applicable fiduciary and contractual
constraints imposed by the LLC's operating agreement and by law.
The Council has no authority over LLC Treasury outflows.

### 3.4 Creator Escrow

The Creator Escrow is a non-custodial routing contract. It receives
viewer-initiated flows (tip, subscription) addressed to a specific
creator and splits them atomically in the same transaction.

Permitted inflows:

- Viewer tip (viewer → creator, specific manifest CID)
- Subscription payment (viewer → creator, time-bounded)

Permitted outflows, within the same transaction:

- `creator` wallet (primary recipient)
- `LLCTreasury` (take-rate, §6.3)
- `PersistencePool` (Credit Pulse fraction, §5)

**Bright line (MUST).** The CreatorEscrow MUST hold no balance
between transactions. Each inflow MUST be fully disbursed in the
same transaction. Implementations MUST NOT include any function that
allows the Operator or any other party to pause, freeze, or reassign
a creator's expected outflow. Reverted splits (e.g., if the creator
wallet is contract and rejects) MUST revert the entire transaction,
not land funds in the Escrow.

### 3.5 Council Fund

The Council Fund is a treasury controlled by a Council multisig
(minimum 7 of 12 Council members, per RFC 7). It funds governance
operations: Council member stipends (if any), publication of Trust
Ledger deliberations, external audit costs, and legal review of
proposed parameter changes.

Permitted inflows:

- Boost Router Council share (§4, default 1% of boost gross)
- Bootstrap transfer from LLC Treasury

Permitted outflows:

- Council member stipends as specified in the Council compensation
  schedule (RFC 7)
- Reimbursement of documented governance expenses (audit, legal,
  trust ledger publication)
- Grants to external parties for governance-related work (e.g.,
  academic review of Risk Score formulas)

**Bright line (MUST).** Aevia LLC MUST NOT withdraw from the
Council Fund. The Fund's multisig signers are exclusively Council
members; the Operator is not a signer.

### 3.6 Transfer matrix

The table below lists every inter-treasury transfer that conformant
implementations MUST permit. Any transfer not in this table is a
bright-line violation.

| From               | To                 | Trigger                     | Amount                           |
|--------------------|--------------------|-----------------------------|----------------------------------|
| LLC Treasury       | PersistencePool    | LLC-discretionary bootstrap | LLC-chosen                       |
| LLC Treasury       | CouncilFund        | LLC-discretionary bootstrap | LLC-chosen                       |
| PersistencePool    | Provider wallets   | Per-epoch settlement (RFC 5)| Per the settlement formula       |
| CreatorEscrow      | Creator wallet     | Viewer tip/sub (atomic)     | Gross minus take minus pulse     |
| CreatorEscrow      | LLC Treasury       | Viewer tip/sub (atomic)     | Take-rate × gross                |
| CreatorEscrow      | PersistencePool    | Viewer tip/sub (atomic)     | Pulse fraction × gross           |
| BoostRouter        | Creator wallet     | Boost call (atomic)         | Creator share × gross            |
| BoostRouter        | PersistencePool    | Boost call (atomic)         | Pool share × gross               |
| BoostRouter        | LLC Treasury       | Boost call (atomic)         | LLC share × gross                |
| BoostRouter        | CouncilFund        | Boost call (atomic)         | Council share × gross            |
| CouncilFund        | Council members    | Per compensation schedule   | Per the schedule                 |
| CouncilFund        | External vendors   | Council-approved invoice    | Per the invoice                  |

Every transfer MUST emit an event whose name and payload are
specified in §9. Indexers and auditors MUST be able to reconstruct
the full economic graph from these events alone.

---

## 4. Boost Router

### 4.1 Purpose

The Boost Router is a non-custodial splitter contract that handles
a single primitive: a creator or a community of viewers pays cUSDC
to amplify a specific piece of content, and that payment is split
atomically across four recipients — the creator, the Persistence
Pool, Aevia LLC, and the Council Fund — with the split weights
configurable by Council.

The Boost is the primary **Credit Pulse** inflow into the
Persistence Pool; in the steady state, boosts and subscription
take drive the Pool balance, not LLC bootstrap.

### 4.2 Interface

The canonical Boost Router interface is:

```solidity
interface IBoostRouter {
    /// @notice Boost content identified by manifestHash.
    /// @param manifestHash  Hash of the canonical manifest per RFC 1.
    /// @param amount        cUSDC amount (6 decimals) to boost.
    function boost(bytes32 manifestHash, uint256 amount) external;

    /// @notice Current split parameters (basis points, sum = 10_000).
    function split() external view returns (
        uint16 creatorBps,
        uint16 poolBps,
        uint16 llcBps,
        uint16 councilBps
    );

    /// @notice Council-gated setter for split parameters.
    /// @dev MUST revert unless msg.sender is the CouncilMultisig and
    ///      the four values sum to exactly 10_000.
    function setSplit(
        uint16 creatorBps,
        uint16 poolBps,
        uint16 llcBps,
        uint16 councilBps
    ) external;

    event Boost(
        bytes32 indexed manifestHash,
        address indexed from,
        address indexed creator,
        uint256 amount,
        uint256 creatorAmount,
        uint256 poolAmount,
        uint256 llcAmount,
        uint256 councilAmount
    );

    event SplitUpdated(
        uint16 creatorBps,
        uint16 poolBps,
        uint16 llcBps,
        uint16 councilBps,
        address indexed updatedBy
    );
}
```

### 4.3 Default split

The initial split is:

- **creator:** 5 000 bps (50%)
- **pool:** 3 000 bps (30%)
- **llc:** 1 900 bps (19%)
- **council:** 100 bps (1%)

These values are chosen to preserve three properties:

1. The creator is the primary recipient (50%) — boosts remain a
   creator-incentive primitive, not a protocol tax.
2. The pool receives a Credit Pulse that scales with content
   popularity (30%) — the more a piece of content is boosted, the
   more replication capacity is funded.
3. The LLC operator captures a service fee (19%) that covers the
   ranking, discovery, and surface placement it provides; this is
   the primary revenue stream of the Operator at scale.
4. The Council captures a small, bounded operational tax (1%) that
   makes the governance layer self-sustaining without requiring
   continued LLC subsidy.

The split is **Council-governable**. A Council proposal MAY change
the split, subject to the RFC 7 threshold (≥7/12 approval,
per-term veto).

### 4.4 Risk Score gating

The Boost Router MUST gate on Risk Score. A call to `boost(mh, a)`
MUST revert if the content identified by `manifestHash` has a
current Risk Score R(c) ≥ θ_feed (RFC 6, default 0.3). This is
the architectural instantiation of the AUP at the amplification
layer: content that the AUP excludes from curated feed placement
MUST NOT receive boosted placement either.

The Risk Score is read from the `RiskOracle` contract specified
in RFC 6. A conformant Boost Router implementation MUST fetch the
current score in the same transaction as the boost and revert if
it is at or above the feed threshold. Implementations MUST NOT
cache the score beyond a single transaction.

### 4.5 Community boosts

The Boost Router's `boost()` function is symmetric: anyone can
call it. When the caller is the creator, it is a self-boost; when
the caller is a viewer or a pool of viewers, it is a community
boost. The router makes no distinction in the split. Future RFCs
MAY define community-pooled boost primitives (escrowed until a
threshold is reached, or refundable if not) that route into the
canonical `boost()` once the community commitment is met.

### 4.6 Events and auditability

Every boost MUST emit a `Boost` event. The event payload includes
the four computed amounts (creatorAmount, poolAmount, llcAmount,
councilAmount), not just the gross amount and the split. This is
so that indexers, auditors, and third parties reconstructing the
economic graph do not need to re-execute the split arithmetic; the
event is self-contained.

Every split change MUST emit a `SplitUpdated` event with the
previous and new values and the address of the Council multisig
that executed the change.

---

## 5. Credit Pulse

### 5.1 Definition

The Credit Pulse is the sum of recurring inflows into the
Persistence Pool from creator-directed flows. It is not a single
transaction; it is the aggregate, per-epoch, of:

1. Boost Router pool share (§4, default 30% of every boost)
2. Creator Escrow pool share (§6.3, default fraction of
   subscription and tip gross)
3. Future flows defined by subsequent RFCs

### 5.2 Subscription and tip pool share

When a viewer sends cUSDC to a creator via the Creator Escrow
(subscription or tip), the Escrow MUST route a configurable
fraction to the Persistence Pool. The default fraction is
**5% (500 bps)** of the gross. The remaining 95% is split between
the creator and the LLC take-rate (§6.3).

This fraction is **Council-governable**. The rationale for a
smaller fraction than the boost Pulse (30%): tips and subscriptions
are volume revenue for the creator, and the creator bears the
opportunity cost of being on Aevia rather than a larger platform;
an excessive Pulse fraction would reduce creator gross to a point
that discourages migration. The boost Pulse can be higher because
boosts are discretionary spending targeted at a single content
item's amplification.

### 5.3 Steady-state dynamics

The steady-state rate for Provider Node compensation is governed
by the equation in RFC 5 §12 of the whitepaper:

```
ρ* = I / Σ_i (R_i · B_i · W_region)
```

where I is the Credit Pulse inflow per epoch. Implementations
MAY publish observed I, ε, and ρ values on-chain as metrics to
allow Provider Nodes to forecast earnings. The Council MAY adjust
the Credit Pulse fractions to target a particular ρ range; such
adjustments MUST be announced on the Trust Ledger at least 14
days before taking effect (RFC 7).

### 5.4 Bootstrap phase

During bootstrap, the Credit Pulse is insufficient to sustain
Provider Node compensation. The LLC Treasury MAY transfer cUSDC
directly to the Persistence Pool to supplement the Pulse. Each
such transfer is a one-way, LLC-discretionary bootstrap (§3.2.1).
Implementations SHOULD publish the ratio of bootstrap to Pulse
inflow per epoch on the Trust Ledger; a declining ratio signals
a credible transition to self-sustaining steady state, which is
a key pitch-to-investor metric and a key Provider Node confidence
signal.

---

## 6. Operator fees

This section specifies every flow that feeds the LLC Treasury.
The sum of these flows is the revenue stack by which Aevia LLC
sustains its operations and returns value to its equity holders.

### 6.1 Relayer fee

The Relayer is the service that submits gas-sponsored manifest
registrations to the ContentRegistry on behalf of creators. It is
specified normatively in `3-authentication.md` §8.

The Relayer fee is charged per manifest registered. The default
fee is **$0.25 USD equivalent per registration**, denominated in
cUSDC, collected at registration time from the creator's Aevia
balance (future) or waived during bootstrap (current). The fee
is flat regardless of manifest size, because the on-chain cost is
dominated by EIP-712 signature verification and storage write,
both of which are size-independent.

Revenue destination: LLC Treasury (100%).

The relayer fee is **LLC-unilateral** — the Operator sets it.
Justification: the relayer is a service operated by the LLC, not
a protocol primitive; the LLC may price it at whatever level the
market bears, subject to the constraint that no other party may
be excluded from submitting their own (non-gas-sponsored)
registration directly to the ContentRegistry.

### 6.2 Aggregator fee

The Aggregator is the service that computes per-epoch Provider
Node payouts from challenge-response receipts and submits them to
the Persistence Pool. See RFC 5 §4.

The Aggregator fee is **0.5% (50 bps) of the per-epoch
settlement total**, paid by the Pool to the LLC Treasury in the
same transaction as the settlement. The default is chosen to be
small enough that Provider Nodes do not bear a significant
overhead, and large enough that the Operator has an incentive to
continue operating the Aggregator reliably.

Revenue destination: LLC Treasury (100%).

The aggregator fee is **Council-governable**. Justification: the
Aggregator is load-bearing for the protocol; unilateral Operator
fee changes could compromise Provider Node trust. A future RFC
MAY specify a decentralized aggregator (e.g., a Chainlink-style
oracle network) at which point this fee structure is revisited.

### 6.3 aevia.video take-rate

The aevia.video client platform is operated by Aevia LLC and is
the reference implementation of the viewer-facing Aevia experience.
When a viewer tips or subscribes to a creator through aevia.video,
the LLC captures a **take-rate** on the gross.

The default take-rate is **10% (1 000 bps)** of the gross flow
routed through the Creator Escrow. The remaining 90% is split
between the creator (85%) and the Persistence Pool Credit Pulse
(5%, §5.2).

Revenue destination: LLC Treasury (100%).

The take-rate is **LLC-unilateral**. Justification: aevia.video
is a commercial product operated by the LLC; pricing its service
is an LLC commercial decision. However, alternative clients that
do not route through aevia.video's instance of the Creator Escrow
(e.g., a third-party client with its own Escrow instance) MAY set
their own take-rate, and creators MAY choose which client (and
therefore which take-rate) to endorse. The protocol does not
mandate routing through any particular Escrow.

### 6.4 Enterprise deployment fees

Ministries, nonprofits, media organizations, and other entities
MAY contract with Aevia LLC to operate a private Provider Node
network or a custom Aevia client tuned to their content. These
engagements are priced per contract and their revenue flows into
the LLC Treasury.

Revenue destination: LLC Treasury (100%).

This category is **LLC-unilateral** and unconstrained by this RFC,
because enterprise deployments are service agreements between the
LLC and a third party, not protocol flows.

### 6.5 Risk Classifier B2B SaaS

The Operator MAY offer the Risk Classifier (RFC 6) as a hosted
service to third parties operating their own Aevia clients or
Provider Node networks. Pricing is per-API-call or per-contract.

Revenue destination: LLC Treasury (100%).

This category is **LLC-unilateral** for the same reason as §6.4.
However, the underlying Risk Score computation MUST remain open
source and reproducible from the published weights and inputs;
the Operator's service offering is operational convenience, not
proprietary scoring.

### 6.6 Revenue stack summary

At steady state the LLC Treasury receives:

- Boost Router LLC share (§4, default 19% of boost gross)
- aevia.video take-rate (§6.3, default 10% of viewer-to-creator gross)
- Relayer fee (§6.1, flat per-manifest)
- Aggregator fee (§6.2, 0.5% of settlement total)
- Enterprise revenue (§6.4, contract-dependent)
- B2B SaaS revenue (§6.5, contract-dependent)

The take-rate and boost share are the primary scaling revenue;
the other categories are structural minimums that cover
infrastructure. This revenue stack is the basis for the equity
ROI thesis presented to investors; it is intentionally diverse so
that no single flow is load-bearing for LLC solvency.

---

## 7. Invariants

This section enumerates the bright lines that MUST hold at all
times. Each invariant is a MUST in RFC 2119 terms. Implementations
SHOULD enforce every invariant in contract code; where contract
enforcement is not applicable, the invariant MUST be enforced by
multisig policy and documented on the `aevia.network/operator`
page.

### 7.1 Pool sovereignty

**INV-1.** The Persistence Pool balance MUST NOT be withdrawable
by Aevia LLC. The Pool contract MUST expose no function whose
effect is to transfer Pool-held cUSDC to any address other than
Provider Node wallets receiving settlement or the Council Fund
receiving a governance-approved audit allocation.

**INV-2.** Once cUSDC has been transferred from the LLC Treasury
to the Persistence Pool (bootstrap), the Operator MUST forfeit
all claim to those funds. No refund, no clawback, no recall
mechanism MAY be implemented. A bootstrap transfer is one-way.

### 7.2 Council sovereignty

**INV-3.** The Council Fund balance MUST NOT be withdrawable by
Aevia LLC. Only the Council multisig (minimum 7 of 12 members,
per RFC 7) MAY authorize outflows.

**INV-4.** Council-governable parameters (Boost Router split,
Credit Pulse fractions, Aggregator fee, Risk Score thresholds,
Risk Score weights, Challenge rate λ, disbursement fraction ε,
epoch duration) MUST NOT be changeable by the Operator unilaterally.
Implementations MUST gate these parameters behind a CouncilMultisig
check.

### 7.3 Escrow non-custody

**INV-5.** The Creator Escrow MUST NOT hold a positive balance
between transactions. Each inflow MUST be fully disbursed in the
same transaction. Implementations MUST NOT include any pause,
freeze, or rescue function accessible to the Operator.

**INV-6.** The Boost Router MUST NOT hold a positive balance
between transactions. The same rule applies.

### 7.4 Denomination

**INV-7.** All four treasuries MUST hold cUSDC exclusively. Holding
of speculative assets, native tokens, LP positions, or any other
asset that introduces price volatility is prohibited. The Operator
MAY hold non-cUSDC assets in other wallets controlled by Aevia LLC
outside the protocol treasuries, and those are outside the scope of
this RFC; but the treasuries enumerated in §3 MUST be cUSDC-only.

**INV-8.** The protocol MUST NOT issue a native token. The word
"native token" here means any fungible token denominated as Aevia-
protocol-specific whose value fluctuates with protocol adoption,
governance outcomes, or treasury balances. Utility tokens, reward
tokens, and governance tokens are all prohibited in this sense.
This is a protocol-level design commitment and cannot be changed
by Council proposal; a subsequent protocol fork would be required.

### 7.5 Auditability

**INV-9.** Every inter-treasury transfer MUST emit a named event
on-chain. Indexers, auditors, and third parties MUST be able to
reconstruct the full economic graph from these events alone,
without off-chain data sources.

**INV-10.** The Aggregator settlement submission (RFC 5) MUST
include a public contestation window of at least **72 hours** before
funds become claimable by Provider Nodes. During this window, any
Provider Node MAY submit a counter-proof of underallocation or
mis-settlement; if the counter-proof verifies, the settlement is
reverted and re-submitted. This invariant protects against a
malicious Aggregator.

### 7.6 Editorial gating

**INV-11.** The Boost Router MUST check Risk Score R(c) against
θ_feed at boost time. If R(c) ≥ θ_feed, the boost call MUST
revert. This invariant instantiates the AUP at the economic layer
and prevents creators from laundering disqualified content into
curated surfaces via payment.

**INV-12.** Content with R(c) ≥ θ_subsidy MUST NOT generate any
Credit Pulse inflow into the Persistence Pool. Providers replicating
such content MAY continue to be paid under the existing settlement
formula during the notice window (RFC 5 §7), but subsequent creator
flows directed to that specific content MUST NOT route their pool
share.

---

## 8. Security considerations

### 8.1 Aggregator capture

**Threat.** A malicious Aggregator submits settlements that
over-pay colluding Provider Nodes or under-pay honest ones, or
that quietly route some fraction of the Pool balance to an attacker
wallet.

**Mitigations.**

1. The Aggregator is a single address today; the address is
   published. Any deviation from the challenge-response receipts
   (RFC 5) is verifiable by any party running a second Aggregator
   instance against the same receipts.
2. The contestation window (INV-10) prevents immediate extraction:
   a malicious settlement that drains the Pool in a single block
   is not possible, because claims MUST wait the window.
3. A future RFC MAY replace the single-address Aggregator with a
   decentralized network (multiple independent Aggregators publish,
   a Merkle-tree consensus is reached on the correct settlement).
   This is listed as future work and does not block current
   operations.

### 8.2 Boost spam

**Threat.** An attacker floods the Boost Router with tiny boosts
(dust) to (i) bloat indexer state, (ii) signal-jam the ranking
algorithm, or (iii) front-run legitimate boosts for gas cost
reasons.

**Mitigations.**

1. A minimum boost amount (default: $0.50 cUSDC) MUST be enforced
   by the Boost Router contract. Boosts below the minimum revert.
2. The ranking algorithm (RFC 6 future work) treats boost amount,
   not boost count, as the signal. A million $0.50 boosts from
   one address do not outweigh a single $500 boost.
3. Gas costs on Base L2 are low enough that contract-level rate
   limiting is not necessary; viewer-level rate limiting is a
   client-side concern.

### 8.3 Split parameter capture via governance

**Threat.** A Council majority (≥7/12) adopts a Boost Router split
that redirects all boost flow to the LLC Treasury or the Council
Fund, gutting creator incentives.

**Mitigations.**

1. The Council composition is designed to be plural (RFC 7) so
   that no single interest holds a majority. If the Council nonetheless
   converges on a creator-hostile split, creators MAY route through
   an alternative client that implements its own Boost Router
   instance with a different split; protocol-level routing through
   the Council-specified Boost Router is a default, not a mandate.
2. The Council Fund's audit outflows (§3.5) include review of
   proposed parameter changes; any split change MUST pass a public
   Trust Ledger review (RFC 7) before taking effect.
3. Per-term veto (RFC 7) allows any Council member to block a
   split change once per term.

### 8.4 Howey reinterpretation

**Threat.** A regulator argues that, notwithstanding this RFC, the
Aevia LLC bootstrap contribution to the Persistence Pool is an
investment by LLC equity holders in expectation of profit from the
efforts of the protocol's contributors, therefore satisfying Howey.

**Mitigations.**

1. The bootstrap is one-way and cannot be reversed (INV-2). Once
   transferred, the cUSDC in the Pool is a service-payment pool
   controlled by programmatic settlement, not an investment
   vehicle managed for return.
2. LLC equity holders invest in the LLC (which operates services
   for a fee), not in the Pool. The LLC's revenue streams (§6) are
   independent of Pool balance; the LLC can be profitable even if
   the Pool is depleted, and unprofitable even if the Pool is large.
3. Provider Nodes are compensated on a fee-for-service basis
   (RFC 5); their return is determined by replication performance,
   not by speculative appreciation of any asset. Node operators
   are service providers, not investors.
4. The absence of a native token (INV-8) removes the most common
   Howey vector for Web3 protocols (token sale with profit
   expectation from team efforts).

This is a technical RFC, not a legal opinion. Counsel representing
Aevia LLC should confirm that the implementation described here
matches the Howey defense articulated in the `/providers` and
`/aup` pages.

### 8.5 Take-rate races

**Threat.** The Operator unilaterally raises the aevia.video
take-rate to an extractive level (e.g., 50%) without creator
consent.

**Mitigations.**

1. The take-rate is LLC-unilateral (§6.3) but is not the only
   route. Any creator can route their Creator Escrow through an
   alternative client with a different take-rate. This is a market
   constraint, not a contract constraint.
2. The take-rate change MUST be announced with at least 90 days
   notice to creators who have active subscriptions routed
   through aevia.video. This is a platform policy commitment, not
   a protocol-level constraint, but is stated here for clarity.
3. The Risk Classifier (RFC 6) and the Trust Ledger (RFC 7) make
   alternative clients credible: a competing client can fetch the
   same Risk Score, render the same moderated feed, and compete
   on take-rate alone. The protocol does not privilege aevia.video.

---

## 9. Implementation reference

### 9.1 Contract files

The canonical contract implementations live in `packages/contracts/src/`:

- `PersistencePool.sol` — specified by RFC 5; this RFC adds
  bootstrap event emission and withdraw-guard invariants
- `BoostRouter.sol` — new, specified by §4
- `CreatorEscrow.sol` — new, specified by §3.4
- `RiskOracle.sol` — interface specified by RFC 6; the Boost Router
  reads from this oracle per §4.4

Gnosis Safe multisigs are used for:

- LLC Treasury — 2 of 3 signers, addresses on `/operator`
- Council Fund — minimum 7 of 12 signers, addresses on
  `aevia.network/transparency`

### 9.2 Canonical event signatures

```solidity
// PersistencePool.sol
event PoolBootstrapFunded(address indexed operator, uint256 amount, uint64 indexed epoch);
event Settlement(uint64 indexed epoch, uint256 totalPaid, uint256 providerCount);
event ProviderPaid(uint64 indexed epoch, address indexed provider, uint256 amount);
event AggregatorFeePaid(uint64 indexed epoch, uint256 amount);

// BoostRouter.sol
event Boost(
    bytes32 indexed manifestHash,
    address indexed from,
    address indexed creator,
    uint256 amount,
    uint256 creatorAmount,
    uint256 poolAmount,
    uint256 llcAmount,
    uint256 councilAmount
);
event SplitUpdated(
    uint16 creatorBps, uint16 poolBps, uint16 llcBps, uint16 councilBps,
    address indexed updatedBy
);

// CreatorEscrow.sol
event Routed(
    address indexed from,
    address indexed creator,
    bytes32 indexed manifestHash,
    uint256 gross,
    uint256 creatorAmount,
    uint256 llcAmount,
    uint256 poolAmount
);

// LLCTreasury (Gnosis Safe-compatible)
// No protocol-specific events; standard Safe events suffice.

// CouncilFund (Gnosis Safe-compatible)
event GovernancePayment(
    address indexed recipient,
    uint256 amount,
    bytes32 indexed proposalId
);
```

### 9.3 Bootstrap sequence

The recommended bootstrap sequence is:

1. Deploy `PersistencePool.sol` with the settlement aggregator
   address set to the Aggregator multisig.
2. Deploy `BoostRouter.sol` with initial split defaults (§4.3) and
   Council multisig address as setter.
3. Deploy `CreatorEscrow.sol` with the LLC Treasury and Persistence
   Pool addresses as outflow targets.
4. LLC Treasury funds the Persistence Pool with bootstrap capital
   (LLC-chosen amount).
5. LLC Treasury funds the Council Fund with bootstrap capital
   (LLC-chosen amount, typically small — enough for the first year
   of Council stipends and audits).
6. Publish all four treasury addresses on `aevia.network/operator`
   (to be built) and `aevia.network/transparency` (already exists).
7. Announce bootstrap amounts on the Trust Ledger (RFC 7).

### 9.4 Migration of existing Pool

If a previous version of `PersistencePool.sol` has been deployed
without the `PoolBootstrapFunded` event or the 72-hour contestation
window, migration consists of:

1. Deploying the new Pool contract.
2. Publishing a migration epoch during which the old Pool accepts
   no new deposits and the new Pool accepts all deposits.
3. Settling the old Pool for all outstanding Provider Node claims.
4. Transferring the remaining old Pool balance to the new Pool via
   a single one-way transfer emitting `PoolBootstrapFunded`.

---

## 10. References

1. **RFC 2119** — Key words for use in RFCs to Indicate Requirement
   Levels.
2. **Aevia RFC 0** — Overview (`0-overview.md`).
3. **Aevia RFC 1** — Manifest Schema (`1-manifest-schema.md`).
4. **Aevia RFC 3** — Authentication (`3-authentication.md`).
5. **Aevia RFC 4** — Acceptable Use Policy (`4-aup.md`).
6. **Aevia RFC 5** — Persistence Pool (`5-persistence-pool.md`).
7. **Aevia RFC 6** — Risk Score (`6-risk-score.md`, draft).
8. **Aevia RFC 7** — Moderation and Jury (`7-moderation-jury.md`,
   draft).
9. **SEC v. W. J. Howey Co.**, 328 U.S. 293 (1946) — the Howey
   test for investment contracts.
10. **47 U.S.C. §230** — Section 230 intermediary immunity.
11. **Storj Decentralized Cloud Storage Network** — per-unit
    payouts in stablecoin as operator compensation model.
12. **Signal Foundation operating model** — open protocol, separate
    operating entity, mission-aligned capital structure.
13. **Aevia whitepaper v1** — §5 Persistence Pool, §12 Economic
    Model.

---

*This RFC is v0.1, published 2026-04-18. Subsequent revisions will
be tracked in `docs/changelog/` and referenced at the top of this
document.*
