# Aevia Acceptable Use Policy (v0.1)

## Abstract

This document specifies the Aevia Acceptable Use Policy (AUP), the
normative set of content categories that the protocol's **distribution
economy** MUST NOT amplify. The AUP is not a storage filter. It does
not govern whether bytes can be placed into IPFS, pinned by a
self-hosted node, or shared privately by CID. It governs what the
protocol's economic and discovery surfaces — the Persistence Pool,
feed surfacing, ranking, recommendation — are permitted to reward,
boost, or deliver to an unsolicited audience.

This document formalizes the axiom "persistence does not imply
distribution" in its sharpest form: content that falls under §4.2 is
not erased from the network, because the network cannot erase it;
instead, such content is denied pinning subsidies, removed from
discovery, and delisted from any feed the protocol's Gateways
operate. Creators, peers, and third parties MAY still retrieve such
content directly by CID if they obtain the CID out-of-band. The
protocol refuses to *pay* for its persistence and refuses to *deliver*
it to audiences who did not opt in.

The AUP is enforced by a multi-denominational Jury (§4.5), a Risk
Score formula (§4.4), and a reversible action ladder (§4.3 and §4.6).
The Jury's decisions are published to an on-chain Trust Ledger that
downstream clients MAY consume; no actor, including the Jury,
possesses the capability to destroy content.

## Table of Contents

1. Motivation and scope
2. Hard exclusions (zero tolerance)
3. Grey zones and reversible actions
4. Risk Score formula
5. Jury composition (multi-denominational)
6. Appeals process
7. Implementation reference
8. Security considerations
9. References

---

## 1. Motivation and scope

### 1.1 Why an on-protocol AUP exists

Pure censorship-resistance — the property that no authority can
remove bytes once published — is necessary for a sovereign protocol
but is not sufficient for a habitable one. A network that combines
permanent storage with unconstrained distribution reproduces the
failure mode of early imageboards: a minority of legally and morally
unambiguous content (CSAM, direct incitement, coordinated harassment)
drives mainstream users, advertisers, payment rails, and regulators
off the platform, which in turn concentrates the remaining audience
around precisely that minority. The axiom of this protocol —
persistence does not imply distribution — is the design response to
that failure mode.

Aevia's AUP is normative at the **incentive layer**, not at the
**storage layer**. The protocol MUST NOT pay a Provider Node to pin
content that violates §4.2. Gateways that surface feeds MUST NOT
include §4.2 content in algorithmic discovery. Recommendation and
search endpoints MUST NOT return §4.2 content. But the underlying
bits, once placed on IPFS by any party, cannot be destroyed by any
Aevia actor; a peer that has obtained a CID by any means retains the
ability to fetch those bytes from any peer that has chosen to keep
them.

### 1.2 What the AUP governs

The AUP governs, normatively:

- **Persistence Pool eligibility.** A manifest whose Risk Score
  (§4.4) exceeds the auto-delist threshold MUST NOT receive pool
  payouts for pinning. Provider Nodes MAY continue to pin such
  content voluntarily; they MUST NOT earn credits for doing so. See
  RFC 5 §5.7.
- **Ranking and surfacing.** Feeds operated by Gateways conforming
  to Aevia v0.1 MUST apply the Risk Score as an input to ranking
  and MUST respect delist decisions published by the Jury.
- **Recommendation and search.** Discovery endpoints (search,
  "related content", autocomplete, topic pages) MUST exclude
  delisted manifests from their default output. Clients MAY expose
  a "show delisted" toggle to logged-in users who explicitly opt in;
  such a toggle MUST NOT be on by default.

### 1.3 What the AUP does NOT govern

The AUP does NOT govern, by design:

- **Raw bit storage on IPFS.** A manifest that violates §4.2 is not
  scrubbed from IPFS by the protocol. The protocol does not possess
  the authority to issue a global `rm` against content-addressable
  data; making such a claim would misrepresent the system's trust
  model.
- **Self-pinning.** A creator, a mesh peer, or any operator of a
  non-subsidized node MAY pin any content they choose, subject to
  their jurisdiction's laws. The AUP only speaks to pool-subsidized
  pinning.
- **Private sharing of CIDs.** Two parties who exchange a CID
  out-of-band and retrieve it from a cooperating peer are outside
  the AUP's surface area. The AUP is a policy on what the protocol
  amplifies, not on what peers transact.
- **Personal or jurisdictional filters set by a Gateway.** A Gateway
  MAY refuse to serve additional categories beyond §4.2 in its
  local jurisdiction (e.g. an EU Gateway applying DSA rules); such
  refusals MUST be logged per `0-overview.md` §4.4 and MUST NOT
  mutate any on-chain or content-addressable artifact.

This split is deliberate. It preserves the thesis invariant: the
protocol distinguishes between **existence** (uncontrolled,
permissionless, cryptographically durable) and **amplification**
(governed, reviewable, reversible).

## 2. Hard exclusions (zero tolerance)

Content in the following categories MUST be denied pool payouts,
MUST be removed from discovery, and MUST NOT receive ranking boosts
from any conforming surface. Each category additionally specifies a
reporting obligation and a legal basis where applicable. "Zero
tolerance" means that grey-zone reasoning (§4.3) does NOT apply: the
Jury's role in these categories is to confirm classification, not to
weigh context.

### 2.1 Sexualization of minors (CSAM)

- **Scope of prohibition.** Absolute. No pool payout. No ranking
  boost. Immediate active delisting from every surface upon
  detection. Gateways MUST refuse retrieval and MUST log the CID
  for reporting.
- **Reporting obligation.** Gateway operators MUST report to NCMEC
  (US: CyberTipline) and MUST cooperate with equivalent national
  authorities (e.g. INHOPE network, Brazilian SaferNet). Reporting
  is mandatory and not contingent on Jury confirmation.
- **Legal basis.** 18 U.S.C. §§ 2251, 2252, 2252A; EU Directive
  2011/93/EU; Brazil ECA Lei 8.069/90 Art. 240–241-E; UK Protection
  of Children Act 1978.
- **Operator note.** Aevia's reference Gateway implements perceptual
  hashing (PhotoDNA-class) at the relay boundary. This is a Gateway
  feature, not a protocol requirement; Gateways MAY use any
  detection mechanism their jurisdiction requires or permits.

### 2.2 Pornography and sexually explicit content

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting from discovery. Raw CIDs remain retrievable.
- **Reporting obligation.** None at the protocol level; Gateway
  operators comply with their local law.
- **Legal basis.** Not uniformly illegal; excluded on policy
  grounds. The protocol's thesis and the client-value constraints
  documented in `CLAUDE.md` §AUP govern this exclusion.

### 2.3 Sex work platforms

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting. Includes platforms whose primary function is
  advertising, brokering, or monetizing sex work.
- **Reporting obligation.** Gateway operators MUST comply with
  applicable anti-trafficking reporting in their jurisdiction
  (e.g. US: TVPA; EU: Directive 2011/36/EU).
- **Legal basis.** Varies by jurisdiction; the protocol applies a
  uniform exclusion.

### 2.4 Celebratory apologia of abortion

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting where the content's primary framing is
  celebration, promotion as a lifestyle choice, or entertainment.
  Medical, legal, and journalistic treatments are classified under
  §4.3 as grey-zone and are surfaced by default.
- **Reporting obligation.** None.
- **Legal basis.** Excluded on policy grounds.

### 2.5 Occultism, satanism, and witchcraft as practice

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting where content is instructional or promotes
  practice. Academic, historical, anthropological, and fictional
  treatments are §4.3 grey-zone.
- **Reporting obligation.** None.
- **Legal basis.** Excluded on policy grounds.

### 2.6 Drug apologia

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting where content promotes recreational use.
  Harm-reduction, medical, and addiction-recovery content is
  §4.3 grey-zone and is surfaced by default.
- **Reporting obligation.** Gateway operators MUST comply with
  controlled-substances reporting in their jurisdiction.
- **Legal basis.** Varies; uniform exclusion applied.

### 2.7 Actionable hate speech

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting for content that calls for, organizes, or
  celebrates violence against a group defined by race, ethnicity,
  religion, nationality, sex, or disability. This explicitly
  includes hate speech against Christians; the protocol applies the
  rule symmetrically.
- **Reporting obligation.** Gateway operators MUST comply with
  applicable jurisdictional reporting (EU DSA Art. 16, Germany
  NetzDG).
- **Legal basis.** 18 U.S.C. § 249 (US); EU Council Framework
  Decision 2008/913/JHA; Brazil Lei 7.716/89.

### 2.8 Violence apologia

- **Scope of prohibition.** No pool payout. No ranking boost.
  Active delisting for content that celebrates or instructs
  large-scale violence (terrorist attacks, mass shootings, genocide
  as entertainment). Journalism, historical documentary, and
  fictional treatments are §4.3 grey-zone.
- **Reporting obligation.** Gateway operators MUST comply with
  terrorism-content reporting (EU Regulation 2021/784 TERREG; UK
  Online Safety Act).
- **Legal basis.** 18 U.S.C. § 2339A (material support); EU TERREG;
  Brazil Lei 13.260/16 (antiterrorism).

Categories §4.2.1 through §4.2.8 are exhaustive for the v0.1 AUP.
Amendment requires a governance proposal ratified by the Jury and
an AUP version bump; see §4.7 and `1-manifest-schema.md` §4.1
(`aupVersion`).

## 3. Grey zones and reversible actions

### 3.1 Definition

A grey zone is content whose classification depends on context, not
on a bright-line rule. Examples include: journalistic coverage of
violence or drug use; medical or educational material on sexuality,
reproductive health, or addiction; apologetics with sharp polemical
edges; comedy with explicit language; religious content from
non-Christian traditions; partisan political content from any side.

Grey-zone classification is **reversible by default**. All actions
in this section MUST be appealable per §4.6 and MUST be accompanied
by a public Jury decision record on the Trust Ledger.

### 3.2 Classification signals

The Risk Score (§4.4) is computed from four input channels, which
the Jury weighs when classifying grey-zone content:

| Signal | Source | Weight characteristic |
|---|---|---|
| Creator self-label | `manifest.policyFlags` and `manifest.tags` | Informative; reduces `R_values` when present and accurate. |
| Viewer reports | Aggregated per-manifest, de-duplicated by signer DID | Enters `R_abuse` after Sybil filter. |
| Automated hints | Perceptual hashing, speech-to-text classifiers (Gateway-local) | Informative; Jury reviews on confidence threshold. |
| Cross-jurisdictional legality | Aggregated Provider Node refusals (RFC 5 §5.8) | Enters `R_legal`. |

Classification signals MUST NOT trigger automated delisting for
grey-zone content below the auto-delist threshold (§4.4). Signals
enter the Jury's review queue; the Jury issues the decision.

### 3.3 Reversible action ladder

The following actions are available for grey-zone classification.
All actions MUST preserve retrievability by direct CID lookup, and
all actions MUST be reversible on successful appeal (§4.6).

| Action | Effect | Trigger |
|---|---|---|
| **Shadow-rank drop** | Reduced ranking weight in algorithmic feeds. Still discoverable by tag and search. | `R ∈ [0.5, 0.65)` and Jury confirms. |
| **Unlisted** | Removed from tag pages, topic pages, recommendations, and default search. Retrievable by direct CID and by creator's profile page. | `R ∈ [0.65, 0.8)` and Jury confirms. |
| **Delisted** | Removed from all discovery surfaces. Pool pays no further subsidies. Retrievable by direct CID from any willing peer. | `R ≥ 0.8` or category §4.2 match. |
| **Permanent ban of signer** | Future manifests from the same DID are auto-delisted pending per-manifest appeal. | Repeat §4.2 violations; Jury supermajority. |

Each action is recorded on the Trust Ledger as a signed Jury
assertion. The assertion is itself a manifest-like object committed
by the Jury's multi-sig; see §4.7.

## 4. Risk Score formula

### 4.1 Definition

The Risk Score `R` is a value in `[0, 1]` computed for every manifest
that enters a conforming surface (feed, search, recommendation, pool
payout). `R` MUST be computable from public signals alone; the
formula MUST NOT depend on any Jury-private input except the Jury's
published classification decisions, which are themselves public.

```
R = α·R_legal + β·R_abuse + γ·R_values
α + β + γ = 1
```

The v0.1 default weights are:

```
α = 0.4   (legal exposure)
β = 0.3   (abuse and behavioural signals)
γ = 0.3   (AUP alignment)
```

These weights are bootstrap values. Sprint 4 on-chain governance
(forward-ref `<!-- sprint-4 -->`) MAY recalibrate them through a
proposal ratified by the Jury. The weights MUST satisfy the unit
sum constraint and MUST NOT individually fall below `0.1` (floor)
or exceed `0.6` (ceiling), to prevent any single signal from
dominating classification.

### 4.2 Components

#### 4.2.1 `R_legal`

`R_legal ∈ [0, 1]` measures the jurisdictional legality exposure of
a manifest. It is derived from:

- The creator's attested jurisdiction (optional manifest field
  `geoHint`, per `1-manifest-schema.md` §4.3).
- The content category (from `tags`, `policyFlags`, and automated
  classifiers).
- The aggregated refusal rate from Provider Nodes across regions
  (RFC 5 §5.8). A refusal rate of `r` in region `R` contributes
  `r · weight(R)` to `R_legal`, where region weights reflect
  population coverage (proposal: US = 0.25, EU = 0.25, BR = 0.10,
  rest-of-world aggregated = 0.40).

Missing jurisdictional attestation MUST NOT reduce `R_legal` below
its category baseline; a creator cannot lower their score by
omitting a declaration.

#### 4.2.2 `R_abuse`

`R_abuse ∈ [0, 1]` measures behavioural and adversarial signals:

- **Brigading.** A burst of reports from accounts that share graph
  features (recent creation, no signed manifests, shared funding
  source) is heuristically classified as coordinated report abuse.
  Sybil-filtered reports contribute to `R_abuse` at a reduced
  weight (proposal: 0.2× nominal).
- **Vote-farming.** Engagement bursts (views, likes, shares) from
  accounts with similar behavioural fingerprints are flagged.
- **Automated engagement.** Signed requests whose timing
  distribution matches known bot fingerprints contribute to
  `R_abuse`.

`R_abuse` MUST decay over time: signals older than 90 days
contribute at half weight, and signals older than 365 days MUST be
expunged from the computation. Long-tail archives are therefore not
penalized for ancient brigading events.

#### 4.2.3 `R_values`

`R_values ∈ [0, 1]` measures alignment with the AUP. Its baseline
is:

```
R_values = 0.0                                       for content fully outside §4.2
R_values = 1.0                                       for content confirmed in §4.2
R_values ∈ [0.3, 0.8]                                for active §4.3 grey-zone review
```

The grey-zone midrange is populated by Jury decisions; automated
classifiers MAY assign provisional values within `[0.3, 0.6]` while
the Jury reviews, but Jury decisions are authoritative and override
classifier outputs on the Trust Ledger.

`R_values` is the only component that directly reflects AUP intent.
A manifest with low `R_legal` and low `R_abuse` but high `R_values`
(e.g. a legally unproblematic, non-brigaded piece of content that
celebrates drug use) is correctly downranked.

### 4.3 Thresholds

| Range | Action |
|---|---|
| `R < 0.5` | Surfaced by default across all conforming feeds. |
| `0.5 ≤ R < 0.8` | Human review queued for the Jury. Shadow-rank drop MAY be applied provisionally until Jury confirms. |
| `R ≥ 0.8` | Automatic delist. Pool payouts MUST stop. Creator MAY appeal per §4.6. |

Automatic delist at `R ≥ 0.8` is reversible: a successful appeal
restores pool payouts and re-enters the manifest into discovery,
including retroactive credit for pool epochs during which payouts
were paused (see RFC 5 §5.6).

### 4.4 Worked example

Consider a journalistic documentary on narco-trafficking:

- Category: journalism. `R_values ≈ 0.2` (grey-zone, not §4.2).
- Creator attested jurisdiction: Brazil. Content legality: clear.
  `R_legal ≈ 0.15`.
- No unusual engagement pattern. `R_abuse ≈ 0.05`.

```
R = 0.4·0.15 + 0.3·0.05 + 0.3·0.2
  = 0.06 + 0.015 + 0.06
  = 0.135
```

`R < 0.5` — surfaced by default. No Jury review triggered.

Consider the same creator publishing a clip that briefly shows a
user self-injecting heroin, presented as harm-reduction:

- `R_values ≈ 0.5` (grey-zone, closer to §4.2.6 boundary).
- `R_legal ≈ 0.2` (borderline; varies by jurisdiction).
- `R_abuse ≈ 0.05`.

```
R = 0.4·0.2 + 0.3·0.05 + 0.3·0.5
  = 0.08 + 0.015 + 0.15
  = 0.245
```

`R < 0.5` — still surfaced by default, no Jury review. A high
volume of viewer reports would raise `R_abuse` toward the Jury
threshold; until that happens, the content stays surfaced.

## 5. Jury composition (multi-denominational)

### 5.1 Size and rotation

The Aevia Jury is a standing body of **7 members**. Members serve
**6-month rotating terms**; at any given time, 3 or 4 members are
rotating in while the others carry forward, preserving institutional
memory.

The Jury size is odd to prevent tied decisions. 7 members balance
quorum achievability against single-member capture risk: a 4-member
supermajority is required for delist confirmation, and a 5-member
supermajority is required for permanent bans (§4.6.4).

### 5.2 Denominational balance

The Jury MUST maintain the following minimum denominational
representation at all times:

| Slot | Minimum seats | Description |
|---|---|---|
| Evangelical | 2 | Protestant denominations aligned with historic evangelical confessions. |
| Catholic | 1 | Roman Catholic or Eastern Catholic. |
| Orthodox | 1 | Eastern Orthodox or Oriental Orthodox. |
| At-large (Christian) | 2 | Any historic Christian confession; includes Anglican, Lutheran, Reformed outside the Evangelical slot, etc. |
| Independent observer | 1 | Legal scholar, journalist, or human-rights advocate; Christian confession NOT required but MUST affirm the AUP as a working document. |

The balance is a protocol-level constraint. A proposal that would
seat a Jury violating this balance MUST be rejected at the governance
contract level (forward-ref `<!-- sprint-4 -->`). Rotation planning
MUST preserve the minima across transitions: no rotation MAY be
scheduled that produces, at any intermediate step, a slate violating
the minima.

### 5.3 Selection process

Jury members are selected through a two-step process:

1. **Staked nomination.** A nomination is placed on-chain with a
   stake of USDC (proposal: 1,000 USDC per nominee). The stake is
   slashed if the nominee withdraws before voting concludes or if
   the nomination is later found to have been made under false
   pretense.
2. **Governance ratification.** The nomination is ratified by a
   governance vote weighted by long-term protocol participation
   (pool funding history, legitimate content registrations,
   no-delist reputation). The governance weighting formula is
   specified separately in the forthcoming Governance RFC
   (forward-ref `<!-- sprint-4 -->`).

Nominees MUST disclose denomination, jurisdiction of residence, and
any material conflicts of interest. Non-disclosure of a material
conflict is grounds for removal and stake slash.

### 5.4 Quorum and majority thresholds

| Decision type | Quorum | Majority |
|---|---|---|
| Grey-zone classification (shadow-rank or unlist) | 5 of 7 | Simple majority of quorum. |
| Delist confirmation (`R ≥ 0.8`) | 5 of 7 | 4 of 7 supermajority. |
| Permanent ban of a signer | 6 of 7 | 5 of 7 supermajority. |
| AUP category amendment | 7 of 7 | 6 of 7 supermajority + governance ratification. |
| Weight recalibration (α/β/γ) | 6 of 7 | 5 of 7 supermajority + governance ratification. |

Decisions MUST be recorded on the Trust Ledger with the vote tally
of each Jury member, so third parties can audit both the outcome
and the individual stances. A Jury member's signed vote is itself a
signed statement; recusals (§4.6.5) are also recorded.

### 5.5 Publication

Every Jury decision MUST be published to the Trust Ledger as an
immutable signed assertion, structured as follows:

| Field | Type | Description |
|---|---|---|
| `manifestCid` | string (CIDv1) | The manifest under review. |
| `decision` | enum | `surface`, `shadow_rank`, `unlist`, `delist`, `ban`, `reinstate`. |
| `rationale` | string | Short explanation, max 512 UTF-8 bytes. |
| `votes` | array | `[{juror_did, vote, rationale?}, ...]`. |
| `effectiveAt` | string (ISO 8601 UTC) | Timestamp from which the decision takes effect. |
| `appealDeadline` | string (ISO 8601 UTC) | Timestamp until which appeals MAY be filed, per §4.6. |
| `priorDecisionCid` | string (CIDv1, optional) | If this decision overturns a prior Jury decision, the prior decision's CID. |

The assertion is signed by a Jury multi-sig (Gnosis Safe or
equivalent ERC-4337-compatible account) and written to the
ModerationRegistry contract (forward-ref `<!-- sprint-3 -->`).
Publication is non-revocable in the content-addressable sense:
overturning a prior decision produces a new assertion that points
back to the prior one via `priorDecisionCid`.

## 6. Appeals process

### 6.1 Who may appeal

- The creator of the content (identified by `manifest.creator`).
- For §4.2.1 (CSAM) false positives, a third party with
  demonstrable standing (parent, guardian, or victim's legal
  representative) MAY appeal on behalf of a subject who was
  misidentified as a minor.
- For content categorized under §4.2.7 (hate speech), the creator
  MAY elect to appear pseudonymously through a legal proxy if
  doing so is necessary to preserve their physical safety (e.g.
  apostates from hostile jurisdictions); the Jury MUST accept
  proxied appeals and MUST NOT require disclosure of the creator's
  real-world identity as a condition of review.

### 6.2 Timeline

| Milestone | Deadline |
|---|---|
| Appeal filed (from `effectiveAt`) | 30 days |
| Initial Jury review | 5 days from filing |
| Additional evidence window | 5 days from initial review |
| Final decision | 15 days from filing, maximum |

The 15-day ceiling is normative: a Jury that fails to render a final
decision within 15 days MUST automatically reinstate the manifest
to its pre-decision state (default surface for grey-zone; default
payout eligibility for pool) without prejudice to re-filing, and
MUST publish an `auto_reinstate` decision on the Trust Ledger noting
the procedural failure.

### 6.3 Outcome possibilities

| Outcome | Effect |
|---|---|
| `reinstate` | Pre-decision state restored. Pool back-credit computed per RFC 5 §5.6. |
| `downgrade_R` | Decision retained but applied action weakened (e.g. delist → unlist). No back-credit. |
| `uphold` | Decision retained. No back-credit. Creator MAY file one further appeal after 90 days with new evidence. |
| `permanent_ban` | Creator's DID loses default pool eligibility for future manifests; each new manifest from the DID is reviewed individually. |

### 6.4 Appeal fee

An appeal MUST be filed with a fee (proposal: 25 USDC) paid into
the Persistence Pool treasury.

- On `reinstate`: fee refunded in full.
- On `downgrade_R`: fee refunded at 50%.
- On `uphold`: fee forfeited to treasury.
- On `permanent_ban`: no additional fee; current appeal fee
  forfeited.

The fee structure is a spam filter, not a revenue mechanism. The
25 USDC default is calibrated to be trivial for creators with a
legitimate grievance and prohibitive for creators attempting to
flood the Jury with frivolous appeals.

### 6.5 Recusal for conflict of interest

A Jury member MUST recuse from any decision or appeal where:

- The member or an immediate family member has a financial stake
  in the manifest's success (pool funding above 100 USDC,
  creator-direct payments, prior advisory relationship).
- The member shares a direct organizational affiliation with the
  creator (same denomination's governing body within 2 degrees;
  same employer within 2 years).
- The member publicly opined on the specific manifest before
  review.

Recusal MUST be recorded on the Trust Ledger as part of the `votes`
array with `vote = "recuse"` and a rationale. If recusal reduces
quorum below the threshold for the decision type (§4.5.4), the
decision MUST be deferred until rotation provides sufficient
non-recused members.

## 7. Implementation reference

Forward-references to contracts and services that implement the AUP
on-chain and off-chain. These references are authoritative for
client implementers and informative for spec readers; the contracts
themselves are authored under the Sprint 3 milestone.

- **`ModerationRegistry.sol`** <!-- sprint-3 --> — On-chain registry
  of Jury assertions. Stores `(manifestCid, decision, effectiveAt,
  priorDecisionCid)` tuples signed by the Jury multi-sig. Emits
  `DecisionRecorded(manifestCid, decision, juryMultisig)` events
  consumed by the Indexer service.
- **`JuryRegistry.sol`** <!-- sprint-3 --> — Membership contract.
  Enforces §4.5.2 balance constraints at the smart-contract level;
  a transaction that would produce a balance-violating membership
  MUST revert. Holds nomination stakes and slashing logic.
- **`policyFlags` bit reservation** — The Sprint 2 `ContentRegistry`
  reserves bit `0x80` of the per-manifest `policyFlags` field for a
  future "moderation applied" marker (`1-manifest-schema.md` §4.3).
  Setting this bit is restricted to the Jury multi-sig; the
  `ContentRegistry` MUST revert if any other caller attempts to set
  it.
- **Indexer service** — `services/indexer/` <!-- sprint-3 -->
  consumes `DecisionRecorded` events and materializes the Trust
  Ledger into a queryable index for clients. The Indexer MUST NOT
  be authoritative: clients that require correctness for moderation
  state MUST re-verify against the on-chain contract.

## 8. Security considerations

### 8.1 Sybil resistance of the Jury

Nomination stakes (§4.5.3) raise the economic cost of nominating
puppets. Governance weighting, which prefers long-term participants
over newly created accounts, further reduces the feasibility of a
Sybil flood. Nonetheless, the protocol MUST NOT assume that Jury
selection is perfectly Sybil-resistant: the denominational balance
constraint (§4.5.2) is a structural mitigation that limits the
damage a single-faction Sybil operation could inflict.

### 8.2 Collusion resistance

Collusion is mitigated by:

- **Rotation cadence.** 6-month terms bound the window in which any
  specific slate operates. A sustained colluding majority would
  need to corrupt selection across rotations.
- **Public decisions and votes.** Every decision lists every Jury
  member's individual vote on the Trust Ledger. A consistently
  unanimous Jury on contested grey-zone cases is observable and
  itself a signal for governance intervention.
- **Balance minima.** A majority faction that aligns by denomination
  is structurally prevented by §4.5.2.
- **Recusal requirement.** §4.6.5 forces disclosure of material
  conflicts; failure to recuse is grounds for removal with stake
  slash.

### 8.3 Coordinated inauthentic behavior (CIB)

`R_abuse` (§4.2.2) absorbs CIB signals. Specific mitigations:

- **Graph clustering on report signers.** Reports from accounts
  whose `did:pkh` graph features cluster tightly (shared recent
  funding transactions, shared registration block, shared manifest
  set) are downweighted to 0.2× nominal.
- **Temporal clustering.** A burst of reports within a 1-hour
  window that deviates more than 3σ from the manifest's historical
  report rate is flagged for Jury review rather than triggering
  automatic thresholds.
- **Stake-weighted reports.** A high-reputation account's report
  carries more weight than a throwaway account's report; this makes
  CIB campaigns more expensive per unit of effective signal.

### 8.4 Jury capture via regulatory pressure

A hostile jurisdiction MAY attempt to compel a Jury member
(operating from that jurisdiction) to vote a particular way. The
protocol's mitigation is procedural:

- Jury members MAY operate pseudonymously, disclosing only their
  denomination, broad jurisdiction (continent-level), and any
  material conflicts.
- A member who reports coercion to the Jury multi-sig MUST be
  rotated out immediately, without stake slash.
- A member whose vote pattern shifts abruptly in a way that
  correlates with external regulatory pressure MAY be challenged
  for removal by governance proposal.

### 8.5 Information asymmetry between Jury and creators

The creator's ability to mount a successful appeal depends on
access to the signals that drove the original decision. The
protocol MUST publish the Risk Score components (`R_legal`,
`R_abuse`, `R_values`) alongside every Jury decision. The creator
is entitled to see the signals that counted against them; the
specific identities of reporters, however, remain private to
preserve anti-brigading protections.

### 8.6 Permanent-ban escalation

Permanent bans (§4.6.3) are the most severe action available. The
6-of-7 quorum and 5-of-7 supermajority are designed to make a
permanent ban structurally unattainable for any faction smaller than
the full Jury minus one dissenter. A permanent ban MUST be
accompanied by a public rationale of at least 1,024 UTF-8 bytes in
the assertion's `rationale` field, supplementing the normal 512-byte
limit.

## 9. References

### Normative

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Requirement Levels.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (used for Jury assertion hashing).
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data (used for Jury multi-sig).
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction (used for the Jury multi-sig account).
- `1-manifest-schema.md` — `aupVersion`, `policyFlags`, `tags`, `geoHint` fields referenced here.
- `3-authentication.md` — `did:pkh` identity of Jury members and creators.
- `5-persistence-pool.md` — payout suspension and refund semantics triggered by Jury decisions.

### Informative

- 18 U.S.C. §§ 2251, 2252, 2252A — US federal CSAM statutes.
- EU Directive 2011/93/EU — combating sexual abuse and sexual exploitation of children.
- EU Regulation 2021/784 (TERREG) — terrorist content online.
- EU Regulation 2022/2065 (DSA) — Digital Services Act.
- Brazil Lei 8.069/90 (ECA) — Estatuto da Criança e do Adolescente.
- Brazil Lei 7.716/89 — hate crimes.
- Brazil Lei 13.260/16 — antiterrorism.
- UK Online Safety Act 2023.
- Germany NetzDG (Netzwerkdurchsetzungsgesetz).
- NCMEC CyberTipline reporting procedures.
- INHOPE network of hotlines.
- `CLAUDE.md` §AUP — repository-level summary of exclusions.
- `docs/aup/README.md` — AUP placeholder and draft Sprint-1 notes.
