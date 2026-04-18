# Aevia Moderation and Ecumenical Jury (v0.1)

## Abstract

This document specifies the **Ecumenical Council** and the **Jury**
procedure through which Aevia's distribution-layer decisions are
governed. The Council is a twelve-seat body with four-year terms
that holds veto authority over protocol parameters affecting
persistence, distribution, and the Pool. The Jury is the subset of
Council members that reviews contested Risk Scores and individual
content-level disputes on a rolling basis.

The Council exists to resolve a structural tension. Token-weighted
governance (one-token-one-vote) converges on plutocracy at scale.
Person-weighted democratic governance (one-person-one-vote) is
vulnerable to Sybil attack at the protocol's identity layer.
Aevia deliberately chooses neither. The Council is a fixed-size
plural body: twelve individuals with publicly declared theological,
philosophical, and professional perspectives, no single tradition
holding a majority, each with a one-time-per-term veto on
parameter proposals they judge incompatible with the protocol's
stated values.

The design trade-off is explicit: legitimacy is reduced (Council
members are appointed in bootstrap, elected thereafter by a
narrow electorate) in exchange for predictability, plurality, and
resistance to capture. A protocol that moderates content
distribution with editorial honesty requires a governance layer
that is itself legible and contestable; the Council is that layer.

Every Council deliberation, every vote, every veto, and every
dissenting opinion is published to the **Trust Ledger**, a
Merkle-anchored log on Base L2. The Trust Ledger is the canonical
record of governance; any party — creator, Provider Node, Operator,
regulator, journalist — can audit the protocol's moderation
history from it alone.

## Table of Contents

1. Motivation
2. Terminology
3. Council composition and selection
4. Parameter governance
5. Jury review workflow
6. Trust Ledger
7. Per-term veto
8. Appeals cadence
9. Compensation and Council Fund
10. Bootstrap and rotation
11. Security considerations
12. Implementation reference
13. References

---

## 1. Motivation

### 1.1 Why Council rather than token governance

The first Web3 wave defaulted to token-weighted voting for all
governance decisions: parameter changes, treasury allocations,
moderation outcomes. This design has three well-documented
pathologies:

1. **Plutocracy.** Outcomes converge on the preferences of the
   largest token holders, who are typically investors or
   founders, not users. Protocol behavior becomes a function of
   capital, not of community.
2. **Voter apathy.** Under 5% of token holders vote on typical
   proposals; governance is effectively decided by the small
   fraction that pays attention.
3. **Bribery cycles.** Markets for votes (Curve wars, bribe
   aggregators) emerge whenever token governance affects
   treasury or parameter decisions.

For moderation — where the decision is editorial judgment about
specific content pieces and about protocol values, not about
commercial outcomes — token-weighted voting is a particularly
poor fit. A determined $100M holder could single-handedly re-
charter the AUP.

### 1.2 Why not democratic vote

The alternative — one-person-one-vote across all protocol users —
has its own pathologies on a blockchain substrate:

1. **Sybil attack.** Without a strong identity layer, creating
   many accounts is cheap; majority votes can be fabricated.
   Aevia's identity layer is Privy-backed wallets (RFC 3), which
   provides economic friction but not KYC-level Sybil resistance.
2. **Tyranny of the transient majority.** Moderation decisions
   that require deep contextual judgment (is this content
   genuine satire or hate-speech rhetorical cover?) do not
   benefit from aggregation across uninformed voters.
3. **Operational capacity.** Scoring and reviewing tens of
   thousands of content decisions per year is not a job any
   popular vote can perform.

### 1.3 Council as a deliberate trade-off

The Ecumenical Council is a middle path:

- **Fixed size (twelve seats).** Small enough to deliberate,
  large enough to be plural.
- **Long terms (four years).** Resists capture by short-term
  coordinated campaigns; prioritizes continuity.
- **Plural composition (§3).** No single tradition holds a
  majority; divergent worldviews are required for quorum.
- **Per-term veto (§7).** Each member may block one proposal per
  term they judge incompatible with protocol values.
- **Transparent (§6).** Every vote and dissent is public on
  the Trust Ledger.
- **Contestable (§5).** Jury decisions can be appealed; the
  Council itself can be re-elected.

The trade-off is that Council members are not elected by a broad
electorate in v0.1 (they are appointed by Aevia LLC in bootstrap,
elected by established operators thereafter); and that a Council
majority with bad judgment can sustain bad decisions longer than
a more democratic system would allow. Those are the specific
costs of predictability and capture-resistance, and this RFC
accepts them.

### 1.4 Non-goals

This document does not:

- Specify the substance of the Risk Score or AUP; see RFC 6 and
  RFC 4 respectively.
- Specify Council salaries as fixed amounts; stipend structure is
  defined in §9 but specific amounts are set by the initial
  Council resolution.
- Mandate any particular denominational or ideological balance;
  §3 specifies plurality constraints, not specific identities.

---

## 2. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**,
and **MAY** in this document are to be interpreted as described in
RFC 2119.

**Council** — the twelve-seat Ecumenical Council with four-year
terms. The full governance body.

**Jury** — a subset of Council members assigned to review a
specific content-level contest. The Jury for a given contest is
selected per §5. A given content contest has one Jury; a Council
member may serve on many Juries in parallel.

**Seat** — one of the twelve Council positions. Each seat is held
by a named individual, not an entity.

**Term** — the four-year tenure of a seat. Terms are staggered so
that approximately one-quarter of seats are up for renewal each
year.

**Per-term veto** — a single-use blocking vote that any Council
member may exercise once per term on a proposal they judge
incompatible with protocol values. See §7.

**Parameter proposal** — a formal proposal to change a
Council-governable parameter. Governance scope specified in §4.

**Trust Ledger** — the public, Merkle-anchored log of Council
and Jury deliberations on Base L2. Specified in §6.

**Elector** — a protocol user (creator or Provider Node operator)
who has met the eligibility criteria (§10.3) to vote in Council
elections.

**Dissent** — a public statement by a Council member explaining
why they voted against a passing proposal. Dissents are required
for transparency and published to the Trust Ledger.

**Recusal** — the act of a Council member abstaining from a vote
or Jury review due to conflict of interest. Recusals MUST be
declared and published.

**Plurality constraint** — the rule that no single declared
tradition may hold more than four of twelve seats. See §3.3.

---

## 3. Council composition and selection

### 3.1 Seat count and term

The Council has exactly twelve seats. Each term is four years. Terms
are staggered: three seats are renewed each year (in rotation),
with the initial staggering set at bootstrap (§10).

### 3.2 Seat-holder eligibility

A seat is held by a named individual, not an entity. A prospective
seat-holder MUST:

1. Declare a primary professional or vocational identity (e.g.,
   practicing clergy, secular legal scholar, human-rights
   activist, technical cryptographer, journalist, educator).
2. Declare a theological or philosophical affiliation (e.g.,
   Reformed Protestant, Eastern Orthodox, Roman Catholic,
   Jewish, Muslim, Buddhist, secular humanist, non-affiliated).
3. Commit to serving the full four-year term in absence of
   resignation for cause (§3.5).
4. Publish a public seat-holder statement on the Trust Ledger at
   induction, specifying their declared affiliations and their
   view on the protocol's stated values.

Seat-holders are individuals. A seat MUST NOT be held by:

- an organization, fund, or DAO
- an anonymous pseudonym (pseudonymous identities are permitted
  but MUST be linked to a real individual known to a minimum of
  three other Council members for Sybil verification)
- an officer of Aevia LLC in their official capacity (however,
  a seat-holder MAY independently be a contractor, advisor, or
  supporter of Aevia LLC, with the relationship declared)

### 3.3 Plurality constraint

The Council is plural by construction. The following plurality
constraint MUST be maintained throughout any term:

**No single declared theological or philosophical tradition MAY
hold more than four of the twelve seats.**

A "declared tradition" is the affiliation declared by the
seat-holder at induction. If a seat becomes vacant and filling it
with the next candidate would violate the plurality constraint,
the next-best candidate from a less-represented tradition MUST
be chosen.

In v0.1, the following traditions are recognized as distinct for
plurality purposes:

- Eastern Orthodox Christian
- Roman Catholic Christian
- Reformed (Presbyterian / Baptist / Anglican Reformed)
- Evangelical Non-Reformed
- Pentecostal / Charismatic
- Jewish
- Muslim
- Other monotheistic
- Secular / non-affiliated
- Other (e.g., Buddhist, Hindu, indigenous traditions)

This list MAY be refined by subsequent Council resolution as the
protocol's geographic reach expands; any refinement MUST be
published on the Trust Ledger with 90 days notice.

### 3.4 Recusal and conflict of interest

A Council member MUST recuse themselves from any vote or Jury
review in which they have a material conflict of interest:

- Financial interest in the outcome (e.g., Council member is the
  creator of the content under review, or is a Provider Node
  operator whose payouts are directly affected)
- Close personal relationship with the appellant or a named party
- Recent (< 90 days) consulting engagement with any party to the
  matter

Recusals are declared on the Trust Ledger before the vote. A seat
with > 30% recusal rate in any rolling 12-month window triggers a
Council review of whether the seat should be reassigned.

### 3.5 Removal for cause

A seat-holder MAY be removed from the Council for cause before the
end of their term. Causes include:

- Fraud or material dishonesty in Council work
- Public violation of the AUP in a manner incompatible with
  continued service
- Sustained non-participation (no participation in any vote or
  Jury for 90 consecutive days without declared medical or
  personal cause)
- Conviction of a felony related to the protocol's activities
  (fraud, computer crime, etc.)

Removal requires a motion from any sitting Council member, Jury
review (minimum 7/12), and a ≥9/12 supermajority vote. The
per-term veto does NOT apply to removal votes (§7.4).

---

## 4. Parameter governance

### 4.1 Governance scope

The following parameters are **Council-governable**. Changes MUST
follow the procedure in §4.2 through §4.5:

- R(c) formula weights: α, β, γ (RFC 6 §3.1)
- R(c) thresholds: θ_subsidy, θ_feed, θ_review (RFC 6 §7.1)
- R_values severity weights s_k (RFC 6 §6.2)
- R_values prior-signal propagation fraction (RFC 6 §6.1)
- Reporter reputation parameters (RFC 6 §9)
- AUP category list and descriptions (RFC 4 §3) *except
  absolute exclusions (§3.4 of RFC 6, not Council-governable)*
- Persistence Pool parameters: ε, λ, epoch duration (RFC 5)
- Region weights W_region (RFC 5 §5)
- Boost Router split: creatorBps, poolBps, llcBps, councilBps
  (RFC 8 §4.3)
- Credit Pulse fractions (RFC 8 §5.2)
- Aggregator fee (RFC 8 §6.2)
- Classifier version upgrades (RFC 6 §6.3)
- Scoring service signer key rotation (RFC 6 §8.4)

The following are **NOT Council-governable**, and the Council has
no authority to change them:

- Absolute exclusion categories [b] and [c] (RFC 4 §3)
- Protocol-level invariants enumerated in RFC 8 §7
- The Council composition rules themselves (§3) — except by
  supermajority ≥9/12 *and* a public comment period of 90 days
- The prohibition of native tokens (RFC 8 INV-8)
- Any change that would violate the plurality constraint (§3.3)

### 4.2 Proposal submission

A parameter proposal is submitted by any Council member. The
proposal MUST include:

1. The parameter being changed
2. The current value and the proposed new value
3. A justification statement (≥500 words, published to the
   Trust Ledger)
4. Any external reviews or analyses cited

### 4.3 Comment period

After submission, the proposal enters a **21-day comment period**.
During this period:

- Any protocol user MAY submit a public comment, signed by their
  DID (RFC 3). Comments are published to the Trust Ledger.
- Aevia LLC (as Operator) MAY publish a technical impact analysis.
- Council members not proposing the change MAY publish their
  preliminary views.

Comments MUST NOT determine the outcome by themselves; they are
input to Council deliberation.

### 4.4 Vote

After the comment period closes, Council members vote within a
**14-day vote window**. A vote requires:

- Simple majority (≥7/12) to pass, OR
- Supermajority (≥9/12) for changes to governance rules themselves
  (§4.1)
- ≥7/12 members participating (not recusing and not abstaining)

Votes are recorded on the Trust Ledger with per-member signatures.

### 4.5 Per-term veto

Any Council member MAY exercise their per-term veto (§7) to block
a passing proposal. A veto is recorded on the Trust Ledger with
justification. A vetoed proposal MAY NOT be resubmitted in the
same form for 6 months.

### 4.6 Implementation

After a proposal passes without veto, the change is implemented by
the Operator within 7 days for parameter changes that do not
require contract deployment, or within 30 days for changes that do.
The implementation timestamp is published on the Trust Ledger.

Parameters affecting in-flight settlements or boosts MUST include
a transition period specified in the proposal, during which
existing state uses old parameters and new state uses new.

---

## 5. Jury review workflow

### 5.1 Jury convening

When a Risk Score is contested (RFC 6 §10) or when any
content-level matter requires Council attention, a Jury is
convened. The Jury is a subset of Council members assigned to
review the specific contest.

Jury size: 3 members by default, or 5 for contests involving
claims of systemic error. The Jury is selected by random
rotation from non-recused Council members, excluding those who
have already served > 20 Juries in the current 6-month window.
This prevents both bias and capture by over-assignment to
sympathetic members.

### 5.2 Review timeline

1. **Day 0:** Contest filed. Jury selected and notified.
2. **Days 1–14:** Jury reviews inputs (content, R(c) components,
   appellant statement, classifier output, flag history).
3. **Days 15–17:** Jury deliberates and publishes a preliminary
   decision.
4. **Days 18–21:** Appellant and community may submit brief
   reactions.
5. **Days 22–24:** Jury issues final decision.
6. **Day 25:** Decision is published to Trust Ledger with per-Jury
   member votes and dissents; RiskOracle is updated via
   `resolveContest()` (RFC 6 §8.2).

### 5.3 Decision structure

A Jury decision MUST state:

1. **Finding:** whether each component of R(c) is correctly
   computed from the declared inputs.
2. **Category determination:** if R_values is disputed, which
   AUP category (if any) the content fits.
3. **Outcome:** the corrected R(c) after Jury findings, or
   affirmation of the Scoring service value.
4. **Rationale:** a written explanation (≥200 words) of the
   reasoning.
5. **Dissent(s):** if the decision is not unanimous, each
   dissenting Jury member MUST publish a separate statement.

### 5.4 Jury decision precedent

Jury decisions do not create binding precedent. Each contest is
evaluated on its specific facts. However, Juries SHOULD consult
prior decisions on similar content types and SHOULD explain
departures from prior reasoning in their rationale.

Precedent is advisory rather than binding because moderation
judgment depends on context (the same image in an educational
documentary about war vs. in a recruitment video for violence has
different category fit). A binding precedent system would force
over-specification and reduce the Jury's ability to reason about
context.

### 5.5 Appeal of Jury decision

A Jury decision MAY be appealed to the full Council within 30
days of publication. The appeal triggers a full Council vote.
Full-Council decisions on appealed Jury outcomes are final for
the same piece of content for 180 days (§10.4 of RFC 6, cooldown).

---

## 6. Trust Ledger

### 6.1 Purpose

The Trust Ledger is the public, append-only log of Aevia's
governance events. It is the canonical record of Council
deliberations, Jury decisions, Risk Score changes, parameter
proposals, votes, and vetoes.

Any third party can audit the protocol's moderation history from
the Trust Ledger alone, without cooperation from the Operator.

### 6.2 On-chain anchor

The Trust Ledger is an append-only Merkle tree whose leaves are
signed governance events. The root of the tree is committed to
Base L2 on a per-epoch cadence (default: once per week) via a
`LedgerAnchor` contract.

### 6.3 Event schema

Every Trust Ledger event is a JSON document with the following
fields:

```json
{
  "kind": "<event-kind>",
  "id": "<ulid>",
  "timestamp": "<RFC-3339>",
  "signer": "did:pkh:eip155:8453:0x...",
  "payload": { ... },
  "signature": "0x..."
}
```

Canonical event kinds (non-exhaustive):

- `council_induction` — new seat-holder takes office
- `council_seat_vacated` — seat ends (term, resignation, removal)
- `parameter_proposal` — parameter change proposed
- `parameter_comment` — public comment during comment period
- `parameter_vote` — Council member votes on proposal
- `parameter_veto` — Council member exercises per-term veto
- `parameter_enacted` — proposal implemented by Operator
- `jury_convened` — Jury assembled for contest
- `jury_decision` — Jury issues preliminary or final decision
- `jury_dissent` — Jury member publishes dissenting opinion
- `risk_score` — Scoring service publishes new R(c) value (per RFC 6)
- `risk_contest` — creator or Provider Node appeals a score
- `removal_motion` — Council member files removal motion
- `election_scheduled` — Council election scheduled
- `election_result` — election outcome published

### 6.4 Signing

Events are signed by the DID of the submitting party. Council
member signatures use their Council identity key (a DID separate
from any personal wallet). Operator signatures use the LLC
Treasury multisig. Creator and viewer signatures use their
protocol DID (RFC 3).

Each signature MUST be verifiable offline from the event's
canonical JSON encoding (RFC 8785) and the signer's published
public key. Signature failure MUST cause the event to be
rejected from the Trust Ledger.

### 6.5 Discovery

The Trust Ledger is discoverable via:

- `aevia.network/transparency` (human-readable)
- A public gRPC / REST API at `trust-ledger.aevia.network`
- Direct Merkle tree queries via the `LedgerAnchor` contract on
  Base L2

Implementations SHOULD publish a content-addressed snapshot of
the Trust Ledger weekly, so that historical events can be
verified even if the live index becomes unavailable.

---

## 7. Per-term veto

### 7.1 Mechanic

Each Council member has exactly **one veto per four-year term**.
A veto blocks a passing parameter proposal.

### 7.2 Exercise

A veto is exercised by publishing a signed `parameter_veto` event
to the Trust Ledger within 48 hours of a proposal passing its
Council vote. The event MUST include:

1. The proposal being vetoed
2. A justification (≥500 words) explaining why the proposal is
   incompatible with the protocol's stated values

### 7.3 Effect

A vetoed proposal is blocked. The Operator does not implement it.
The proposal MAY be resubmitted by the same or a different Council
member after 6 months, subject to a new comment period, new vote,
and the possibility of a new veto from a different Council member.

### 7.4 Non-vetoable matters

The per-term veto does NOT apply to:

- Removal-for-cause votes (§3.5)
- Council election validations
- Emergency responses to identified absolute-exclusion content
  (§3.4 of RFC 6)
- Parameter changes that implement an already-passed higher-level
  resolution (i.e., the veto is used at the policy level, not the
  implementation level)

### 7.5 Veto accountability

A Council member who exercises their veto cannot exercise another
veto in the same term. The veto is recorded on the Trust Ledger
and becomes part of the member's public record. A pattern of
ideologically-narrow vetoes MAY be considered in subsequent
elections or, in extreme cases, in removal-for-cause motions.

---

## 8. Appeals cadence

### 8.1 Standard appeals

Risk Score contests (RFC 6 §10) follow the 21-day Jury workflow
(§5.2). Most appeals resolve within this window.

### 8.2 Expedited appeals

Content that is subject to time-sensitive circumstances (e.g.,
news cycle relevance, live-stream context) MAY request expedited
review. Expedited appeals complete within 7 days but sacrifice
the full comment-period structure. An expedited appeal MUST be
approved by at least two Jury members before commencing the
accelerated timeline.

### 8.3 Mass appeals

When many appeals arrive with shared underlying facts (e.g., a
large coordinated flagging campaign prompts many creators to
appeal), the Council MAY designate a lead case whose Jury
decision is precedential for the batch. Batch-related cases are
resolved summarily after the lead case; individual appellants
retain the right to request separate consideration if their case
diverges from the lead.

### 8.4 Appeals cooldown

A creator who has received a Jury decision on a specific piece of
content MAY NOT re-appeal the same content for 180 days absent
material new evidence (RFC 6 §10.4). "Material new evidence"
includes: Jury finding overturned in a related case, classifier
version upgraded with different output for the content, or
Council resolution changing a relevant parameter.

---

## 9. Compensation and Council Fund

### 9.1 Council Fund

The Council Fund is the treasury that funds Council operations.
It is specified normatively in RFC 8 §3.5.

Inflows: 1% of every boost (RFC 8 §4.3) plus any LLC Treasury
bootstrap transfer. Outflows: Council stipends, audit costs,
Trust Ledger publication costs, external governance grants.

The Fund is controlled by the CouncilMultisig: a Safe multisig
with all twelve seat-holders as signers, requiring at least 7
signatures for any outflow.

### 9.2 Stipends

Council members receive stipends for their work. In v0.1, the
default structure is:

- Base stipend: $2 000 USD-equivalent per month (paid in cUSDC)
- Jury work bonus: $200 per Jury decision participated in
- Veto exercise bonus: $1 000 (one per term, compensates the
  accountability burden)

Stipend amounts are set by Council resolution at bootstrap (§10)
and are adjusted periodically. A Council member who serves less
than a full month receives a pro-rated stipend.

### 9.3 Expense reimbursement

Council members MAY submit documented expenses for reimbursement
from the Council Fund. Eligible expenses: governance-related
travel, external legal or technical consultation, Trust Ledger
publication costs. Ineligible: anything not directly related to
Council work.

Expense reimbursement requires CouncilMultisig approval (7 of
12). Expense submissions and approvals are published to the
Trust Ledger.

### 9.4 Audit

The Council Fund is audited annually by an external firm (not
contracted by Aevia LLC). The audit report is published to the
Trust Ledger and to `aevia.network/transparency`.

---

## 10. Bootstrap and rotation

### 10.1 Bootstrap appointment

The initial Council is appointed by Aevia LLC. Each initial
seat-holder is:

1. Nominated by Aevia LLC with a public justification (published
   to the Trust Ledger).
2. Required to consent in writing, publish their seat-holder
   statement (§3.2), and sign the initial Council charter.
3. Subject to the plurality constraint (§3.3) from the moment of
   appointment.

The bootstrap Council is seated for staggered initial terms so
that rotation begins immediately:

- 3 seats: 1-year initial term (then 4-year rotations thereafter)
- 3 seats: 2-year initial term
- 3 seats: 3-year initial term
- 3 seats: full 4-year initial term

This staggering means three seats rotate each year starting year 2.

### 10.2 Electorate (for post-bootstrap elections)

Starting with the first non-appointed election (year 2 of
protocol operation), Council seats are elected. The electorate
consists of:

- **Creators** who have signed at least one manifest, maintained
  DID-active status for at least 12 months, and demonstrated AUP
  conformance (no Jury-confirmed violations in the rolling
  12-month window).
- **Provider Node operators** who have successfully responded to
  at least 1000 challenges in RFC 5 epochs, for at least 6
  months.
- **Council members themselves** (they vote on their peers).

Each elector receives one vote. Aevia LLC as an operator has no
vote; Council-governed weights cannot be capture by the
treasury.

### 10.3 Election mechanic

Candidates for Council seats declare candidacy by:

1. Publishing a seat-holder statement (§3.2) to the Trust Ledger.
2. Receiving endorsements from at least 5 existing electors.
3. Publishing a platform document articulating their view on
   open protocol questions.

Voting uses a ranked-choice / single-transferable-vote system
for multi-seat elections. Ballots are signed by the elector's
DID. Votes are tallied on-chain by a dedicated contract; the
outcome is confirmed by Council vote and published to the
Trust Ledger.

### 10.4 Continuity

Between an outgoing seat-holder's term end and the induction of
their successor, the seat is vacant. During vacancy:

- Votes requiring that seat default to abstention
- The plurality constraint is evaluated at the next scheduled
  election, not continuously

A seat remains vacant for no more than 90 days; if the election
is delayed beyond that, the Council MAY appoint an interim
seat-holder by a ≥9/12 vote, subject to ratification in the
eventual election.

### 10.5 Term limits

A Council member MAY serve a maximum of three consecutive
four-year terms. After three terms, they MUST step down for at
least one term before running again. This prevents capture by
long-tenured single individuals.

---

## 11. Security considerations

### 11.1 Council capture

**Threat.** A coordinated group funds or influences enough
Council candidates that a majority (≥7/12) share a specific
ideological or commercial position, enabling them to enact
changes that would otherwise be blocked.

**Mitigations.**

1. Plurality constraint (§3.3) caps any single tradition at 4 of
   12 seats, so any capture requires coordination across
   traditions.
2. Per-term veto (§7) allows any single non-captured Council
   member to block a specific change.
3. Long terms (§3.1) and staggered rotation mean capture requires
   sustained effort over years, not a single election.
4. Removal-for-cause (§3.5) allows a supermajority to remove a
   Council member who has obviously been captured (e.g., taking
   outside payment for votes).
5. Trust Ledger publicity means capture is visible: every
   member's vote record is permanent.

### 11.2 Jury bribery

**Threat.** A party to a specific content contest bribes Jury
members to rule in their favor.

**Mitigations.**

1. Jury selection is random from eligible members (§5.1); a
   specific bribe requires bribing before selection is known.
2. Jury decisions require majority (≥7/12 in the full Council
   appeal path) — a single bribed member cannot swing an
   appealed decision.
3. Dissent requirements (§5.3) mean a corrupt Jury cannot hide
   a non-unanimous ruling; every vote is recorded.
4. Compensation (§9.2) via Council Fund reduces the incentive to
   accept small bribes.
5. Removal-for-cause (§3.5) allows prosecution of proven corruption.

### 11.3 Pseudonymous seat attack

**Threat.** A single actor recruits pseudonymous confidants to
fill multiple seats, creating effective captured-bloc voting
despite appearing plural.

**Mitigations.**

1. Seat-holders must be linked to real individuals known to at
   least 3 other Council members (§3.2).
2. Election endorsements (§10.3) require 5 existing electors
   willing to publicly stake their reputation on the candidate's
   identity.
3. Plurality constraint (§3.3) on declared traditions forces
   ideological diversity; a single actor's confidants would need
   to plausibly belong to different traditions.
4. Removal-for-cause (§3.5) is available if pseudonymous linkage
   is later discovered.

### 11.4 Trust Ledger corruption

**Threat.** The Operator or a Council member manipulates the
Trust Ledger by publishing false events or withholding real ones.

**Mitigations.**

1. Every event is signed; signatures are verifiable (§6.4).
2. The Merkle anchor (§6.2) is on Base L2; tampering requires
   invalidating the L2 state.
3. Councils MAY independently verify the Ledger: each member
   SHOULD maintain their own local archive of all events they
   co-signed.
4. The Operator has no write access to other parties' signatures;
   they can refuse to publish an event (which is detectable) but
   cannot forge one (without access to the signing key).

### 11.5 Regulatory pressure

**Threat.** A governmental authority pressures the Operator (Aevia
LLC) to override Council decisions — e.g., ordering content
de-indexed that the Council has approved.

**Mitigations.**

1. Aevia LLC's legal obligations (DMCA, subpoena, NCMEC) apply
   only to Operator-controlled infrastructure (aevia.video,
   relayer, indexer). The Council's decisions apply to the
   protocol's incentive flows, which Aevia LLC cannot unilaterally
   override.
2. If Aevia LLC complies with a legal order to de-index content
   on aevia.video, alternative clients that do not follow
   Aevia-specific editorial choices can continue to render the
   content; the Council's rulings remain available on the Trust
   Ledger.
3. The protocol's architecture means that a government order
   against Aevia LLC cannot remove bytes from the network; the
   Persistence Pool continues to pay Provider Nodes regardless
   of Operator editorial actions.

---

## 12. Implementation reference

### 12.1 Contracts

- `LedgerAnchor.sol` (new) — accepts Merkle roots of Trust Ledger
  batches on a per-epoch cadence
- `CouncilMultisig` (Gnosis Safe) — 12 signers, 7-of-12 threshold
  for routine decisions, 9-of-12 for governance-rule changes
- `CouncilRegistry.sol` (new) — tracks seat-holder DIDs, terms,
  and veto status

### 12.2 Services

- `services/trust-ledger/` — Go service that ingests signed
  events, maintains the Merkle tree, anchors to Base L2
- `services/council-ui/` — Operator-operated UI for Council
  members to submit proposals, votes, dissents

### 12.3 Bootstrap sequence

1. Deploy `LedgerAnchor.sol` and `CouncilRegistry.sol`.
2. Aevia LLC publishes the initial Council nominee list to the
   Trust Ledger with justifications.
3. Each nominee accepts and publishes their seat-holder statement.
4. CouncilMultisig is configured with all twelve signers.
5. Initial staggered terms are set in CouncilRegistry.
6. Council issues its founding resolutions: stipend amounts,
   rules of order, ratification of the RFC-6/7/8 default
   parameters.
7. Trust Ledger goes live; all events from this point are
   signed and anchored.

### 12.4 First-year priorities

The bootstrap Council's first-year priorities SHOULD include:

- Ratify or adjust default Risk Score weights (α, β, γ).
- Ratify or adjust default thresholds (θ_subsidy, θ_feed).
- Confirm classifier v0.1 and sign off on its testing corpus.
- Establish reviewer pool for manual R_values reviews.
- Set the initial Trust Ledger publication cadence.
- Review and ratify the initial Boost Router default split
  (RFC 8 §4.3).

These are exactly the areas where Operator-drafted defaults need
a first Council blessing before the protocol enters mainnet.

---

## 13. References

1. **RFC 2119** — Key words for use in RFCs to Indicate Requirement
   Levels.
2. **Aevia RFC 3** — Authentication.
3. **Aevia RFC 4** — Acceptable Use Policy.
4. **Aevia RFC 5** — Persistence Pool.
5. **Aevia RFC 6** — Risk Score.
6. **Aevia RFC 8** — Economic Architecture.
7. **RFC 8785** — JSON Canonicalization Scheme.
8. **47 U.S.C. §230** — Section 230 intermediary immunity.
9. **Regulation (EU) 2022/2065** — Digital Services Act.
10. **Aevia whitepaper v1** — §8 Governance.

---

*This RFC is v0.1, published 2026-04-18. Subsequent revisions will
be tracked in `docs/changelog/` and referenced at the top of this
document.*
