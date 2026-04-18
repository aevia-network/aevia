# Aevia Risk Score (v0.1)

## Abstract

This document specifies the **Risk Score**, the public function
R(c) ∈ [0, 1] that governs which pieces of content are eligible for
Persistence Pool subsidy, for placement in Aevia-operated feeds and
rankings, and for amplification via the Boost Router. The Score is
computed off-chain from public inputs, signed, and published to an
on-chain oracle contract that consumers of the score (the Boost
Router in particular, per RFC 8 §4.4) read in-transaction.

The Risk Score is the technical mechanism by which the editorial
criterion declared in RFC 4 (the Acceptable Use Policy) is enforced
at the distribution layer without impairing the persistence layer.
Content with a high R(c) loses subsidy and feed placement; it does
not become inaccessible. This asymmetry is the architectural
instantiation of the persistence-distribution separation principle
at the editorial tier, and it is what preserves the protocol's
Section 230 intermediary posture (RFC 4 §2).

Three invariants distinguish Aevia's Risk Score from platform
moderation systems and from most blockchain-based reputation
systems:

1. The formula is **public and normative** (§3). Any third party
   can recompute R(c) from the inputs. The weights α, β, γ are
   disclosed; the decision function is not a black-box classifier.
2. The Score is **contestable** (§10). A creator who disputes a
   score may request Jury review per RFC 7. A successful contest
   reverts the score and publishes the revision on the Trust Ledger.
3. The Score is **decoupled from presence**. A high R(c) excludes
   content from subsidy and feed, but the content remains
   addressable by CID and retrievable from any Provider Node that
   chooses to continue hosting it at their own expense. This is
   distinct from platform moderation, in which "removed" generally
   means "deleted".

## Table of Contents

1. Motivation
2. Terminology
3. Score formula
4. R_legal inputs
5. R_abuse inputs
6. R_values inputs
7. Thresholds and enforcement
8. RiskOracle contract
9. Reporter reputation and decay
10. Appeals and Jury review
11. Security considerations
12. Implementation reference
13. References

---

## 1. Motivation

### 1.1 The gap between AUP and enforcement

RFC 4 (`4-aup.md`) declares what the protocol will and will not
amplify. It enumerates eight excluded categories ([a] through [h])
and it specifies the legal obligations Aevia LLC accepts as an
intermediary (DMCA, DSA, NCMEC, OFAC). It does not specify the
mechanism by which a given piece of content is classified into one
of those categories, nor the function by which that classification
translates into a consequence (no subsidy, no feed, no boost).

This RFC is that mechanism.

Without a normative Risk Score, the AUP is enforceable only by
Operator discretion. That is not a stable basis for protocol trust:
a future Operator could reinterpret the categories, narrow or widen
them at will, and creators would have no recourse. A normative
Score with public weights, declared inputs, and a Jury-governed
contestation path makes AUP enforcement legible, reproducible, and
bounded.

### 1.2 Why three dimensions, not one

A single-dimension score (say, "illegal / not illegal") would
collapse three distinct kinds of signal: (i) signals that a third
party is asserting a legal claim (DMCA takedown, DSA notice,
subpoena), (ii) signals that users of the protocol are flagging a
piece of content as abusive (user reports, jury decisions), and
(iii) signals that content falls within an AUP-excluded category
independent of any specific legal claim or user report (e.g., an
obvious case of category [a] that no one has flagged yet).

Treating these three signals as distinct components allows:

- α, β, γ to be tuned independently by the Council as the protocol
  matures; the optimal weight for flag-based signals early in
  protocol life (when user base is small and prone to brigading) is
  different from the optimal weight after a large flag corpus has
  been gathered.
- A creator contesting a score to be told specifically which
  component drove the disqualification, and to challenge the
  relevant input.
- A jury reviewing a contested score to evaluate the contest at
  the component level rather than reasoning over a single opaque
  number.
- An external party auditing the protocol to verify that each
  component is being computed correctly without the inputs for
  other components being visible.

### 1.3 Non-goals

This document does not:

- Specify the training corpus, architecture, or weights of the
  classifier used to compute R_values. §6 defines the interface the
  classifier MUST expose and the invariants its outputs MUST
  satisfy; the specific implementation (language model, rules
  engine, hybrid system) is an Operator choice subject to
  auditability requirements.
- Specify the composition, election, or deliberation procedure of
  the Jury; that is the subject of RFC 7.
- Specify how the Aevia LLC relayer, Aggregator, or client renders
  a given R(c) into UI (a warning badge, a de-ranked feed position,
  a hidden-by-default state). Rendering decisions are an Operator
  UX concern.

---

## 2. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**,
and **MAY** in this document are to be interpreted as described in
RFC 2119.

**Content identifier (CID)** — as defined in `2-content-addressing.md`.
All Risk Score computations are scoped to a specific CID representing
a manifest (RFC 1); when this document refers to "content c", it
means the CID of the manifest and its transitively referenced
segments.

**R(c)** — the Risk Score of content `c`, a value in [0, 1]. Higher
values indicate higher risk; R = 0 means no risk signals present;
R = 1 means maximal risk across all components.

**R_legal(c)** — the legal-risk component of the Score, in [0, 1].
Driven by formal legal actions (DMCA, DSA, subpoena, court order).

**R_abuse(c)** — the user-report component of the Score, in [0, 1].
Driven by protocol-user flags weighted by reporter reputation.

**R_values(c)** — the AUP-alignment component of the Score, in
[0, 1]. Driven by classifier output and manual review for
alignment with the categories excluded by RFC 4.

**α, β, γ** — the weights combining the three components into R(c).
Defaults: α = 0.4, β = 0.3, γ = 0.3. Subject to Council governance.

**θ_subsidy** — the threshold above which content loses Persistence
Pool subsidy. Default: 0.5. Subject to Council governance.

**θ_feed** — the threshold above which content is excluded from
curated feed and ranking, and from boost. Default: 0.3. Subject
to Council governance.

**RiskOracle** — the on-chain contract that holds the current R(c)
for every content item and exposes it to consumers (notably the
Boost Router per RFC 8 §4.4). Specified in §8.

**Reporter reputation** — a per-address weight applied to a user's
flags when computing R_abuse. Reputation accrues with confirmed
flags (those that lead to jury-confirmed actions) and decays with
disconfirmed flags and with inactivity. Specified in §9.

**Jury** — the subset of the Ecumenical Council that reviews
contested scores. Specified normatively in RFC 7.

**Trust Ledger** — the public, Merkle-anchored log of Council and
Jury deliberations on Base L2. Every score change above threshold
MUST be published to the Trust Ledger.

**Scoring service** — the off-chain service, operated by the
Operator in v0.1, that ingests public signals, applies the formula,
signs the result, and submits it to the RiskOracle. Decentralization
of this service is future work tracked by a subsequent RFC.

---

## 3. Score formula

### 3.1 The composite

The Risk Score of content `c` at time `t` is:

```
R(c, t) = α · R_legal(c, t) + β · R_abuse(c, t) + γ · R_values(c, t)
```

with:

- R(c, t) clamped to [0, 1]
- α + β + γ = 1 (invariant; any Council proposal that violates this
  MUST be rejected by the Scoring service and rolled back)
- default (α, β, γ) = (0.4, 0.3, 0.3)

The default weights prioritize legal-risk signals (α = 0.4) because
they represent formal third-party claims with due-process
consequences (a failure to respond to DMCA in the required window
destroys safe-harbor, for example). R_abuse and R_values are
co-equal at 0.3 each because they represent, respectively, the
internal community signal and the declared editorial criterion,
neither of which should dominate the other.

### 3.2 Time dependence

The Score is time-dependent. Each of R_legal, R_abuse, and R_values
MAY change over time as inputs arrive, expire, or are contested.
The Scoring service SHOULD recompute R(c, t) at least once per
epoch for every content item that has received new inputs during
that epoch, and publish the updated value to the RiskOracle.

Implementations MUST NOT treat an old score as still-current for
the purpose of enforcement. The Boost Router (RFC 8 §4.4) reads
the current score in-transaction; other consumers (ranking,
feed placement) SHOULD do the same or otherwise enforce a
freshness window (e.g., reject any score older than 24 hours).

### 3.3 Threshold semantics

Two thresholds drive enforcement:

- `R(c) ≥ θ_subsidy` (default 0.5): content is excluded from
  Persistence Pool subsidy (RFC 5 §7). Provider Nodes continue
  to be compensated for already-committed storage commitments
  until their current window expires, but new creator flows
  directed to that content do not fund the Pool's replication
  of it.
- `R(c) ≥ θ_feed` (default 0.3): content is excluded from
  Aevia-operated curated feed and ranking, and from the Boost
  Router (RFC 8 §4.4 invariant INV-11).

θ_feed is lower than θ_subsidy by design. Feed placement is a
stronger editorial endorsement than subsidy; a higher bar applies
to qualify for feed placement. Subsidy is a utility function
(keep the bytes alive); feed is a promotion function.

Content with R(c) < θ_feed is in both the curated feed eligible
set and the Pool subsidy set. Content with θ_feed ≤ R(c) <
θ_subsidy is in the Pool subsidy set but not the feed eligible
set. Content with R(c) ≥ θ_subsidy is in neither.

### 3.4 Hard exclusions

Categories marked `[ABSOLUTE]` in RFC 4 §3 (minor sexualization,
NCII, and any other category a future RFC declares absolute) MUST
yield R_values(c) = 1.0, regardless of classifier output or any
other input. Implementations MUST enforce this floor before
computing R(c) and MUST NOT allow any combination of inputs to
produce R(c) < 1.0 for content matching an absolute exclusion.

This is a protocol-level floor, not a Council-governable parameter.
Absolute exclusions cannot be weakened by Council vote; they can
only be narrowed or eliminated by a new RFC.

---

## 4. R_legal inputs

### 4.1 Signal sources

R_legal(c) ingests formal legal actions directed at the content
identified by CID `c`. Five input classes are defined; a future
RFC MAY add more.

1. **DMCA takedown notice.** A notice compliant with 17 U.S.C.
   §512(c)(3), received by the Aevia LLC designated agent (RFC 4
   §4), identifying `c` by CID or by canonical reference. Valid
   notices (those with all required elements) produce an
   input; facially deficient notices do not.
2. **DMCA counter-notification.** A counter-notification received
   per 17 U.S.C. §512(g), which reverses a prior takedown after
   the statutory 10–14 business day window. A successful
   counter-notification rolls the R_legal signal back to pre-notice.
3. **DSA notice-and-action.** A notice per art. 16 of Regulation
   (EU) 2022/2065, with the elements specified in RFC 4 §5.
4. **Subpoena or court order.** A formal demand for removal or
   non-distribution from a court of competent jurisdiction,
   regardless of source.
5. **OFAC match.** An automated match of the creator address
   against the OFAC SDN list, or a jurisdictional match against
   a comprehensively sanctioned region (RFC 4 §8).

### 4.2 Weighting

The Scoring service computes R_legal by weighting each active
signal according to a published table:

| Signal class         | Weight | Expiry                                 |
|----------------------|--------|----------------------------------------|
| DMCA notice          | 0.6    | On counter-notice success or 1 year    |
| DMCA 3rd strike      | 1.0    | Permanent until jury-reversed          |
| DSA art. 16 notice   | 0.5    | On review resolution or 90 days        |
| Subpoena / court     | 1.0    | Permanent until jury-reversed          |
| OFAC SDN match       | 1.0    | Permanent; no jury contest path        |
| Comprehensive jurisdictional match | 0.8 | Until creator moves jurisdiction or list changes |

R_legal(c) is the maximum of all currently-active weights, not the
sum. A DMCA notice with weight 0.6 and a DSA notice with weight
0.5 yields R_legal = 0.6, not 1.1. This prevents double-counting
signals that may reflect the same underlying complaint filed in
two jurisdictions.

### 4.3 Due process

DMCA notices MUST be processed per 17 U.S.C. §512: the creator is
notified, the content is gated (R_legal rises), the 10–14 day
counter-notification window is observed. If the creator files a
valid counter-notification, R_legal returns to its pre-notice state
until and unless the notifier files suit. The Scoring service
MUST publish notice receipt, counter-notice receipt, and final
disposition to the Trust Ledger.

DSA notices MUST be answered with a statement of reasons per art. 17
within the protocol's internal service-level commitment (7
business days, RFC 4 §5).

Subpoenas and court orders are obeyed; the Jury has no path to
overturn them at the R_legal layer. A creator whose content is
removed by subpoena MAY nonetheless petition for Jury review of
other components (R_abuse, R_values) and of whether the Aevia LLC
response to the subpoena was appropriate; those reviews are
normative under RFC 7.

---

## 5. R_abuse inputs

### 5.1 Signal sources

R_abuse(c) ingests user-level reports and jury-level confirmations.
Two input classes are defined.

1. **User flag.** A protocol user, identified by DID (RFC 3), flags
   content `c` as violating the AUP. The flag specifies which
   category ([a]–[h] of RFC 4 §3) the user alleges is violated and
   optionally a free-text justification.
2. **Jury decision.** A Jury deliberation concluding that `c`
   violates the AUP. Jury decisions are reached via the procedure
   in RFC 7 and are published to the Trust Ledger.

### 5.2 Weighting

User flags are weighted by **reporter reputation** (§9). A flag
from a reporter with reputation 1.0 counts fully; a flag from
reputation 0.5 counts half; a flag from a reporter with reputation
near zero has effectively no signal contribution, which prevents
new-account brigading.

The per-content flag signal `F(c)` is:

```
F(c) = Σ_i reputation_i  / N_effective(c)
```

where the sum is over active flags on `c`, and `N_effective(c)` is
a normalizing denominator that scales with content audience
(e.g., total cumulative unique viewers on the canonical client).
Without audience normalization, widely-viewed content would
accumulate flags merely by volume of exposure, and small-audience
content could never meet a threshold.

Default form of the normalizer:

```
N_effective(c) = max(100, sqrt(audience(c)))
```

The `max(100, ...)` floor prevents a few unanimous flags from
driving F(c) high on niche content; the `sqrt` form attenuates the
cost of scale.

Jury decisions are added directly to R_abuse at weight 1.0 if
affirmative (content violates AUP) or subtracted at weight 0.5 if
declinative (content does not violate AUP, overturning a prior
escalation).

The composite:

```
R_abuse(c) = clamp( F(c) + juryAffirmative(c) - 0.5 · juryDeclinative(c), 0, 1 )
```

### 5.3 Review escalation

When R_abuse(c) crosses θ_review (default 0.4, Council-governable),
the Scoring service MUST escalate `c` to the Jury for review per
RFC 7. The creator is notified at escalation time. The content is
not de-prioritized on the sole basis of the escalation; it is
de-prioritized only once the Jury issues a decision or once the
composite R(c) crosses θ_feed or θ_subsidy.

---

## 6. R_values inputs

### 6.1 Signal sources

R_values(c) assesses content alignment with the AUP categories
declared in RFC 4 §3. Three input classes are defined.

1. **Classifier output.** A machine classifier (the specific
   implementation is an Operator choice; see §1.3) scores `c` on
   each of the eight AUP categories, producing per-category
   probabilities in [0, 1].
2. **Manual review.** An Operator-employed or Operator-contracted
   reviewer assesses `c` and produces a categorical verdict (fits
   category X, does not fit any category). Manual review typically
   follows escalation, not every content item.
3. **Prior-content signal from same creator.** If `c`'s creator has
   prior content with confirmed AUP violations (jury decisions or
   DMCA 3rd strikes), a fraction of that signal propagates to `c`
   to reflect persistent-offender risk. The propagation fraction
   is 0.3 by default, Council-governable.

### 6.2 Weighting

Per-category classifier probabilities p_k for categories k ∈
{[a], [b], [c], [d], [e], [f], [g], [h]} are combined with
category-specific severity weights `s_k`:

| Category | Severity s_k | Absolute? |
|----------|--------------|-----------|
| [a] pornography                    | 1.0 | No  |
| [b] minor sexualization            | —   | Yes |
| [c] NCII / sexualized deepfake     | —   | Yes |
| [d] violence / terrorism apologia  | 0.9 | No  |
| [e] celebratory abortion apologia  | 0.7 | No  |
| [f] occultism / satanism practice  | 0.6 | No  |
| [g] recreational illicit drug apologia | 0.6 | No |
| [h] actionable hate speech         | 0.9 | No  |

Categories [b] and [c] are absolute exclusions (§3.4); their
presence yields R_values(c) = 1.0 directly, bypassing the
weighted-sum formula.

For non-absolute categories, R_values is:

```
R_values(c) = max_k ( s_k · p_k ) + 0.3 · priorSignal(creator)
```

clamped to [0, 1]. The `max_k` form (rather than sum) prevents
double-counting when multiple categories are partially detected.
The prior signal propagates a fraction of the creator's historical
R_values floor; a creator with no prior confirmed violations has
`priorSignal = 0`.

### 6.3 Classifier invariants

The classifier that produces p_k MUST satisfy:

1. **Reproducibility.** Given the same content bytes and the same
   classifier version, the classifier MUST produce the same p_k.
   Nondeterministic classifiers (e.g., temperature > 0 language
   models) MUST be sampled multiple times and the median taken as
   the output, with sampling count and seed published.
2. **Versioning.** Every classifier output MUST be published with
   the classifier version hash. A version bump invalidates all
   prior R_values computations and triggers rescoring.
3. **Auditability.** The classifier's outputs for any CID MUST be
   queryable by any Council member. The inputs (the content bytes)
   are inherently public by CID; the Scoring service MUST expose an
   API that returns the current p_k values and classifier version
   for any requested CID.
4. **Confidence floor.** Classifier outputs with confidence below
   0.4 MUST NOT drive R_values alone; they MUST trigger manual
   review. This prevents classifier hallucinations from gating
   content by themselves.

### 6.4 Manual review

Content that reaches manual review (either triggered by low
classifier confidence or by creator appeal) is reviewed by an
Operator-contracted reviewer. The review outcome replaces the
classifier output for R_values. Manual review outcomes MUST be
published to the Trust Ledger with the reviewer's pseudonymous
identifier and the category determination.

Manual reviewers are rotated; no single reviewer MAY review more
than 5% of content in a given epoch. This is to limit the influence
of individual reviewer bias on R_values.

---

## 7. Thresholds and enforcement

### 7.1 Default thresholds

- θ_subsidy = 0.5
- θ_feed = 0.3
- θ_review = 0.4 (triggers Jury escalation)

All three are Council-governable per RFC 7.

### 7.2 Enforcement points

Every consumer of the Risk Score MUST enforce at the correct
threshold:

| Consumer                      | Threshold   | Behavior when above                     |
|-------------------------------|-------------|-----------------------------------------|
| Persistence Pool (RFC 5 §7)   | θ_subsidy   | Exclude from future subsidy             |
| aevia.video curated feed      | θ_feed      | Exclude from feed surfaces              |
| aevia.video ranking           | θ_feed      | De-prioritize to below ranked baseline  |
| Boost Router (RFC 8 §4.4)     | θ_feed      | Revert boost() call                     |
| Jury escalation trigger       | θ_review    | Notify Jury for review                  |
| Absolute exclusion floor      | 1.0 always  | Remove from index, NCMEC report if [b]  |

Alternative clients that do not use the Operator's rendering
layer MAY adopt different thresholds, subject to the constraint
that they MUST NOT render content flagged as an absolute
exclusion category (§3.4). A client that violates this constraint
is not in AUP conformance per RFC 4.

### 7.3 Enforcement is not removal

None of the enforcement actions listed above removes the bytes of
`c` from the network. The CID remains resolvable; any Provider
Node that chooses to continue hosting `c` MAY do so at its own
expense; alternative clients MAY render `c` subject to their own
editorial criterion. This is the distillation of the
persistence-is-not-distribution principle at the R(c) boundary.

---

## 8. RiskOracle contract

### 8.1 Purpose

The RiskOracle is the on-chain contract through which the
Scoring service publishes R(c) values and through which consumers
(notably the Boost Router, RFC 8 §4.4) read them.

### 8.2 Interface

```solidity
interface IRiskOracle {
    struct Score {
        uint16 r;            // R(c) in basis points (0-10000)
        uint16 rLegal;       // component, basis points
        uint16 rAbuse;       // component, basis points
        uint16 rValues;      // component, basis points
        uint64 updatedAt;    // Unix timestamp
        bytes32 classifierVersion;  // version hash, see §6.3
        bool isAbsolute;     // true if category [b]/[c] triggered
    }

    /// @notice Current score for content identified by manifestHash.
    /// @dev reverts if no score has been published for this hash.
    function scoreOf(bytes32 manifestHash) external view returns (Score memory);

    /// @notice Publish or update a score. Signed by the Scoring service key.
    /// @dev MUST revert unless msg.sender is the authorized ScoringServiceSigner
    ///      AND the signature in _sig matches the expected payload.
    function publishScore(
        bytes32 manifestHash,
        Score calldata newScore,
        bytes calldata _sig
    ) external;

    /// @notice Contest a score. Only callable by the CouncilMultisig.
    /// @dev Emits ScoreContested; freezes score at current value; triggers Jury review.
    function contestScore(bytes32 manifestHash, bytes32 contestId) external;

    /// @notice Overwrite a contested score with Jury decision outcome.
    /// @dev Only callable by CouncilMultisig after Jury deliberation.
    function resolveContest(
        bytes32 manifestHash,
        bytes32 contestId,
        Score calldata resolvedScore
    ) external;

    event ScorePublished(
        bytes32 indexed manifestHash,
        uint16 r,
        uint16 rLegal,
        uint16 rAbuse,
        uint16 rValues,
        bytes32 indexed classifierVersion,
        bool isAbsolute
    );
    event ScoreContested(
        bytes32 indexed manifestHash,
        bytes32 indexed contestId,
        address indexed initiator
    );
    event ContestResolved(
        bytes32 indexed manifestHash,
        bytes32 indexed contestId,
        uint16 resolvedR
    );
}
```

### 8.3 Freshness

Consumers reading `scoreOf()` SHOULD check `updatedAt` against a
freshness window. Default window: 24 hours. Scores older than the
window are considered stale; the consumer MAY choose to (i)
re-request a fresh score from the Scoring service, (ii) use the
stale score, or (iii) revert. The Boost Router (RFC 8 §4.4) uses
option (i) for high-value boosts and option (ii) for small boosts;
this trade-off is a client policy decision, not a protocol
mandate.

### 8.4 Scoring service signer key

The Scoring service has a single signing key, held by the Operator.
The corresponding public key is set at RiskOracle deployment and
is **not rotatable by the Operator unilaterally**; rotation
requires a Council proposal per RFC 7. This is to prevent a
compromised-Operator scenario from re-signing scores post-hoc.

Key rotation is executed by:

1. Council proposal specifying new public key
2. ≥7/12 approval, per-term veto respected
3. CouncilMultisig calls `rotateScoringServiceKey(newKey)` on
   RiskOracle
4. Old key is retired; scores signed with old key remain valid
   retroactively but new submissions MUST use new key

---

## 9. Reporter reputation and decay

### 9.1 Initial reputation

A new protocol user (new DID) starts with reputation = 0.3. This
is a non-zero baseline so that new users' flags are not entirely
discarded, but low enough that a single user flag cannot drive
R_abuse above any enforcement threshold.

### 9.2 Reputation accrual

Reporter reputation increases when a flag is confirmed by Jury
decision. The accrual amount per confirmation is:

```
Δ_rep = (1 - reputation_current) · 0.1
```

This is a saturating curve: low-reputation reporters gain more per
confirmation, high-reputation reporters gain less. Reputation is
bounded above at 1.0.

### 9.3 Reputation decay

Reporter reputation decreases on two conditions:

1. **Disconfirmed flag.** A flag that is reviewed by Jury and
   overturned (content found not to violate AUP) reduces the
   reporter's reputation by Δ_disconfirm = 0.15.
2. **Inactivity decay.** A reporter who has not flagged anything
   for 90 days experiences exponential decay: reputation halves
   every subsequent 180 days of inactivity. This prevents
   long-dormant high-reputation accounts from being resurrected
   for brigading.

Reputation is bounded below at 0. A reporter who reaches
reputation 0 remains able to flag (the protocol does not block
them) but their flags contribute zero weight to R_abuse until they
accrue reputation via confirmed flags.

### 9.4 Shill and brigade detection

The Scoring service MAY apply additional adjustments to flags that
show evidence of coordination (e.g., many flags from addresses
created on the same day with similar wallet patterns). These
adjustments are described in Operator-published detection rules
and are themselves published on the Trust Ledger. A creator
contesting a score MAY challenge the validity of shill-detection
adjustments via Jury review.

---

## 10. Appeals and Jury review

### 10.1 Who may appeal

A creator MAY appeal the Risk Score applied to their content. The
appeal is signed by the creator's DID (RFC 3) and submitted to
the Jury escrow endpoint. Appeals are logged on the Trust Ledger
within one epoch of submission.

A Provider Node MAY also appeal a score if it believes a content
item has been disqualified from subsidy inappropriately; this is
a secondary interest path and receives lower Jury priority than
creator appeals.

### 10.2 Appeal grounds

Valid appeal grounds include:

1. **Factual error in inputs.** The R_legal signal is based on a
   forged DMCA notice; the R_abuse signal is based on brigaded
   flags; the R_values signal is based on a misclassified input
   (e.g., the classifier confused satire for advocacy).
2. **Category error.** The classifier correctly identified the
   content but applied the wrong category or severity weight.
3. **Weight error.** The current Score would fall below threshold
   if the default weights were applied correctly (e.g., a Jury
   previously overturned a flag but the R_abuse was not
   correspondingly lowered).

Appeals that merely express disagreement with the AUP itself (e.g.,
"I should be allowed to post this") are not valid grounds for Jury
review; those are Council-level policy discussions handled per
RFC 7.

### 10.3 Jury procedure

The Jury procedure for a contested Risk Score is specified
normatively in RFC 7. Summary:

1. The appeal is published to the Trust Ledger.
2. Jury members review within 14 days.
3. A decision requires a majority of reviewing Jury members
   (≥7/12 default, per-term veto per RFC 7).
4. The decision is published to the Trust Ledger with per-member
   votes and dissents.
5. The Scoring service calls `resolveContest()` on RiskOracle to
   overwrite the disputed score with the Jury-confirmed value.

### 10.4 Cooldown

A creator who has received a Jury decision on a specific piece of
content may not re-appeal the same content for 180 days, absent
material new evidence. Repeated appeals without new evidence are
rate-limited to prevent Jury-capacity exhaustion.

---

## 11. Security considerations

### 11.1 Scoring service capture

**Threat.** A compromised or malicious Scoring service signs
fraudulent scores — either inflating scores on targeted creators
or deflating scores to evade AUP enforcement.

**Mitigations.**

1. The Scoring service signer key is fixed at RiskOracle
   deployment and rotatable only by Council vote (§8.4).
2. All published scores are auditable: any third party can
   re-run the Scoring service locally from public inputs and
   verify that the published scores match.
3. Jury contests allow creators to challenge specific scores
   (§10).
4. A future RFC MAY replace the single-signer Scoring service
   with a federation of independent scorers (e.g., three
   Operator-independent entities publish scores; consensus is
   required).

### 11.2 Classifier gaming

**Threat.** A creator learns the classifier's decision boundary
and crafts content that falls just below the R_values threshold
while still violating the AUP in substance.

**Mitigations.**

1. Manual review (§6.4) captures content that classifier
   boundary-surfs. Escalation to manual review is triggered by
   low classifier confidence (§6.3) and by community flags.
2. The classifier version is rotated periodically; past
   boundary-gaming strategies lose effectiveness.
3. The Jury escalation path (§5.3) provides a human check on
   content that accumulates user reports without crossing
   R_values threshold.

### 11.3 Brigaded reports

**Threat.** A coordinated group of accounts flags a creator's
content to drive R_abuse above threshold, bypassing classifier and
without legal merit.

**Mitigations.**

1. Reporter reputation weighting (§9) — low-reputation accounts
   contribute negligible signal.
2. Audience normalization (§5.2) — flag density on small-audience
   content does not scale.
3. Shill detection (§9.4) — coordinated flag patterns are down-weighted.
4. Jury escalation (§5.3) — a surge in R_abuse triggers review;
   if the Jury finds the flags inappropriate, they are rolled
   back and reporter reputations decay.

### 11.4 Stale score attack

**Threat.** An attacker exploits a stale score to execute a boost
on content that is subsequently rescored above θ_feed.

**Mitigations.**

1. Boost Router (RFC 8 §4.4) reads score in-transaction; the
   score at the moment of boost is what matters.
2. 24-hour freshness window (§8.3) ensures the score is recent.
3. High-value boosts MAY trigger a fresh score fetch before
   execution; low-value boosts accept the marginal stale-score
   risk to save gas.

### 11.5 Category dispute

**Threat.** A creator argues that their content does not fit
the declared AUP category, and the dispute hinges on subjective
interpretation (e.g., "is this content celebratory apologia or
historical analysis?").

**Mitigations.**

1. RFC 4 §3 enumerates the categories with descriptive text. A
   creator can read the description and form a good-faith
   judgment before posting.
2. Manual review (§6.4) resolves ambiguous cases with a human
   determination.
3. Jury review (§10) provides a second human layer, with plural
   Council composition (RFC 7) preventing any single interpretive
   tradition from dominating.

---

## 12. Implementation reference

### 12.1 Contract file

`packages/contracts/src/RiskOracle.sol` (new)

### 12.2 Scoring service

The v0.1 Scoring service is operated by Aevia LLC. It is
implemented in Go under `services/scorer/` (to be scaffolded).
Subcomponents:

- `internal/signals/legal/` — DMCA / DSA / subpoena ingest
- `internal/signals/abuse/` — flag aggregation + reputation
- `internal/signals/values/` — classifier invocation + manual
  review UI
- `internal/publish/` — signs and submits to RiskOracle
- `internal/ledger/` — Trust Ledger publication

Classifier implementation is an Operator internal choice. v0.1
uses a combination of rule-based detection (for categories with
clear textual signals) and a language-model pipeline (for nuanced
categories). Version hash is published per §6.3.

### 12.3 Trust Ledger format

All scoring events are published to the Trust Ledger (RFC 7) as:

```json
{
  "kind": "risk_score",
  "manifest_cid": "bafy...",
  "score": { "r": 0.52, "r_legal": 0.6, "r_abuse": 0.12, "r_values": 0.58 },
  "classifier_version": "sha256:abc...",
  "issued_at": "2026-04-18T14:00:00Z",
  "issuer": "did:pkh:eip155:8453:0x..."
}
```

Merkle anchor of the batch is published to Base L2 per epoch.

### 12.4 Bootstrap

The v0.1 Risk Score operates with:

- Council not yet elected (operating in bootstrap mode per RFC 7)
- Scoring service single-signer (Aevia LLC)
- Classifier v0.1 (rule-based + LM hybrid)
- Manual review by Operator-contracted reviewers

Production readiness checklist before first mainnet score:

- [ ] RiskOracle.sol audited
- [ ] Scoring service key ceremony (3-of-5 Shamir shares)
- [ ] Jury bootstrap appointed (RFC 7)
- [ ] Trust Ledger publication live on Base Sepolia
- [ ] Classifier version 0.1 published with reproducibility check
- [ ] Appeals endpoint live

---

## 13. References

1. **RFC 2119** — Key words for use in RFCs to Indicate Requirement
   Levels.
2. **Aevia RFC 1** — Manifest Schema.
3. **Aevia RFC 2** — Content Addressing.
4. **Aevia RFC 3** — Authentication.
5. **Aevia RFC 4** — Acceptable Use Policy.
6. **Aevia RFC 5** — Persistence Pool.
7. **Aevia RFC 7** — Moderation and Jury (draft).
8. **Aevia RFC 8** — Economic Architecture.
9. **17 U.S.C. §512** — DMCA safe harbor.
10. **18 U.S.C. §2258A** — NCMEC reporting requirements.
11. **Regulation (EU) 2022/2065** — Digital Services Act.
12. **47 U.S.C. §230** — Section 230 intermediary immunity.
13. **SEC v. W. J. Howey Co.**, 328 U.S. 293 (1946).

---

*This RFC is v0.1, published 2026-04-18. Subsequent revisions will
be tracked in `docs/changelog/` and referenced at the top of this
document.*
