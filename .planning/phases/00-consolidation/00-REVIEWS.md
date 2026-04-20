---
phase: 0
reviewers: [gemini, codex]
reviewed_at: 2026-04-20T19:50:00Z
plans_reviewed:
  - 00-01-PLAN.md
  - 00-02-PLAN.md
  - 00-03-PLAN.md
  - 00-04-PLAN.md
  - 00-05-PLAN.md
  - 00-06-PLAN.md
skipped: claude (SELF — running inside Claude Code)
---

# Cross-AI Plan Review — Phase 0: Consolidation

Two external AI systems reviewed the 6 plans independently. Gemini leaned lenient (overall risk LOW); Codex leaned strict (overall risk MEDIUM-HIGH). Divergence is structural — see `## Consensus Summary` at the bottom.

---

## Gemini Review

# Plan Review — Phase 0: Consolidation

This review evaluates the 6-plan sequence designed to close the architectural and deployment debt from parallel Phase 2 tracks, implement the B4 mirror protocol enhancement, and establish a verified production baseline for Phase 3.

---

### Plan 00-01: Frontend Merge + CF Pages Deploy (DEPLOY-01)

**Summary:** Executes the merge of `feat/frontend-phase2` into `main` and triggers the Cloudflare Pages production deployment. Focuses on attribution purity and post-deployment bundle verification.

**Strengths:**
- Bundle grep verification uses `curl | grep` loop against production chunks — high-signal validation.
- Merge discipline: dry-run merge + HEREDOC commit + strict `video` commitlint scope.
- Attribution guard: automated commit-body grep for forbidden AI-tool signatures.

**Concerns:**
- **LOW** — CF Pages build timing (90-180s wait) is optimistic for Next.js builds; plan has fallback.
- **LOW** — `pnpm-lock.yaml` flagged as likely conflict; frozen-lockfile check mandated.

**Suggestions:** None. Surgically focused.

---

### Plan 00-02: /healthz .build Field (DEPLOY-02 Preamble)

**Summary:** Tactical prerequisite plan that adds `build` field to provider-node `/healthz` response, enabling automated binary-hash verification for Phase 0 Strong gate.

**Strengths:**
- TDD: mandates RED → GREEN discipline.
- Adheres to existing `httpx.Server` functional option pattern (`WithBuild`).
- Forward compat: `omitempty` preserves rolling-deploy safety.

**Concerns:** None.

---

### Plan 00-03: Backend Merge + 6-Node Deploy (DEPLOY-02)

**Summary:** Merges `feat/backend-phase2` (B1/B2/B3) and performs first rollout of binary hash verification across all 6 providers.

**Strengths:**
- Binary integrity checks: `readelf` + `strings` to verify `CGO_ENABLED=0` invariant and embedded git SHA pre-deploy.
- Hybrid rollout: automated `deploy-3nodes.sh` for standard relays + human-verified manual loop for GPU hosts (rotating dev infra).
- Preflight sync: correct dependency on Plan 00-02 landing first.

**Concerns:**
- **MEDIUM** — GPU host complexity: manual SCP/SSH loop for 3 hosts is error-prone. Mitigated by CONTEXT.md calling them "rotating dev infra".

**Suggestions:** Consider `deploy/scripts/deploy-gpu.sh` for future phases; for Phase 0 debt-closure, manual verification is acceptable.

---

### Plan 00-04: B4 Wire Format — Route A + ADR 0012 (DEPLOY-03 Wire)

**Summary:** Locks wire-format design for SPS/PPS forwarding. Route A (silent JSON extension) over Route B (new FrameType) based on `json.Unmarshal` behavior evidence.

**Strengths:**
- Backward-compat proof via `TestHeaderReadsOlderBinaryWithoutSPSPPS` — synthesizes legacy JSON body.
- Comprehensive ADR covering "why" + rejected alternatives (Route B, inline-only).
- Avoids "forward-compat softening" of `ReadAnyFrame` loop — preserves strict protocol-violation detection.

**Suggestions:** Base64 overhead (33%) for SPS/PPS ~50 bytes is negligible — explicitly considered and dismissed.

---

### Plan 00-05: B4 End-to-End Plumbing (DEPLOY-03 Plumbing)

**Summary:** Wires SPS/PPS from WHIP origin session into mirror protocol header and mirror-side `HLSMuxer`.

**Strengths:**
- End-to-end integration test `TestMirrorHeaderForwardSPS` spawns two in-process libp2p hosts, asserts byte-identical round-trips.
- Chrome path protection: tests case where origin has no SPS/PPS, ensures fallback to inline STAP-A capture.
- `OnSession` signature refactoring includes grep-and-update across all test/main sites.

**Concerns:**
- **LOW** — Race condition correctly avoided: `OnSession` placed after `InjectSession` but before RTP read-loop.

---

### Plan 00-06: 6-Node B4 Deploy + Strong Gate (DEPLOY-03 Deploy)

**Summary:** Final validation + cleanup. Canary deploy pattern + exhaustive 6-check Strong Gate.

**Strengths:**
- 90s canary window acknowledges wire-format changes need longer observation than standard swaps.
- Strong gate covers every D-03 check including Playwright multi-viewer smoke.
- Worktree cleanup enforces "worktree-per-task" discipline only after gate is green.

**Concerns:**
- **MEDIUM** — Gate check #6 requires active live session. Plan mitigates via explicit task instruction; operator must set URL correctly.

**Suggestions:** `00-06-GATE-RESULT.md` table should be comprehensive — serves as final proof of Phase 0 zero-debt state.

---

### Gemini Phase Risk: **LOW**

**Justification:**
1. Route A Safety: wire-format change is non-breaking; older binaries ignore field.
2. Exhaustive testing: unit tests (Plan 04), integration (Plan 05), Playwright smoke (Plan 06).
3. Fix-forward posture supported by `/healthz .build` field for immediate deploy visibility.
4. Constraint compliance: `CGO_ENABLED=0`, Leandro-only authorship.

The plan sequence successfully achieves the 3 Phase 0 success criteria. It consolidates debt, implements B4 safely, provides verified baseline for Phase 1.

---

## Codex Review

### Plan 00-01

**Summary:** Strong, practical merge-and-promote plan for `DEPLOY-01`. Anchored to actual branch topology, respects Cloudflare Pages production model, includes meaningful verification of merge state + production bundle behavior. Main weakness: mixes code-level validation, merge procedure, and production deployment verification without clearly defining what happens if production deployment lags or partial bundle inspection gives false confidence.

**Strengths:**
- Correct deployment model: `main` drives Cloudflare Pages production; no fake staging-promote abstraction.
- Explicitly validates the 3 expected frontend commits and their intended artifacts.
- Preserves authorship + commitlint constraints correctly.
- Concrete production-bundle checks for `/hls/index.m3u8` + absence of `/playlist.m3u8`.
- Defers worktree cleanup appropriately to final consolidation plan.

**Concerns:**
- **HIGH** — Task 1 says "leave the tree on `main` with the merge staged OR aborted" — creates ambiguity for Task 2 and raises chance of human error or double-merge confusion.
- **MEDIUM** — Acceptance criterion "lists exactly three commits" is brittle if the branch is rebased, amended, or picks up a small follow-up commit before merge.
- **MEDIUM** — Bundle grep against a few discovered chunks is weaker than verifying the actual deployed asset manifest or all chunks referenced by the page.
- **LOW** — Plan treats Pages auto-deploy timing as roughly deterministic; delayed or queued production builds not operationally modeled beyond "wait 90-180s".

**Suggestions:**
- Require Task 1 to always end in a clean aborted state, never "staged OR aborted".
- Change commit verification from "exactly three commits" to "contains at least the required commits and no unreviewed extra frontend scope".
- Strengthen bundle verification by enumerating all script assets from the built HTML, not just a subset.
- Add explicit timeout/escalation branch for Cloudflare production builds that remain pending or stale.

**Risk: MEDIUM.** Core plan sound; staged-vs-aborted ambiguity + brittle commit assumptions create unnecessary operator risk.

---

### Plan 00-02

**Summary:** Cleanest plan in the set. Narrowly scoped additive `/healthz.build` field, wires correctly from `main.Version`, validates exact invariant needed by later deploy plans. Appropriately minimal and directly supports success criterion 2.

**Strengths:**
- Tight scope, proportionate to the problem.
- Correctly preserves backward compat via `omitempty`.
- Good TDD shape: include-path + omit-path tests are the right coverage.
- Explicitly ties field to `-X main.Version=${VERSION}` and CGO-disabled build pipeline.
- Properly lands on `main` as independent prerequisite before backend merge/deploy.

**Concerns:**
- **MEDIUM** — Smoke verification relies on `strings`/embedded version assumptions later; this plan doesn't validate runtime exposure beyond unit tests.
- **LOW** — "build equals short git SHA" assumed stable; if build scripts ever change to tags or long SHAs, later plans become brittle.
- **LOW** — Publicly exposing build hash is acceptable, but plan should explicitly reject using it as any trust/authentication signal.

**Suggestions:**
- Add one integration-style smoke check that instantiates the server and reads `/healthz` end-to-end with `Version` wired.
- State explicitly that `.build` is observability-only, never an integrity proof.
- Normalize later plans to say "expected build identifier" rather than hard-coding "short SHA".

**Risk: LOW.** Low blast radius, strong support for later deploy validation.

---

### Plan 00-03

**Summary:** Covers backend merge + 6-node B1/B2/B3 rollout competently. Main weakness: rollout split between scripted relays/Mac deployment and manual GPU deployment — realistic but leaves operational consistency weaker than ideal.

**Strengths:**
- Correct dependency on Plan 00-02.
- Validates right backend areas: `whep`, `mirror`, `dht`, `integration`, `httpx`.
- Preserves `CGO_ENABLED=0`; checks static-linking expectations.
- Uses `/healthz.build` exactly as intended to verify binary identity on hosts.
- Worktree cleanup deferred correctly.

**Concerns:**
- **HIGH** — Success criterion says "All 6 providers run the new binary" but the plan relies on a manual operator checkpoint for 3 GPU hosts with no built-in enforcement beyond human reply.
- **HIGH** — Rolling behavior only partial here; Task 3 deploys 3 nodes in one shot before all 6-node validation logic is centralized in Plan 00-06.
- **MEDIUM** — Merge assumption that only 3 commits matter may be brittle if backend worktree contains related doc/infra deltas.
- **MEDIUM** — Static-linking validation via `readelf -d | grep NEEDED` is Linux-specific; can produce false confidence about all runtime dependencies.
- **LOW** — Mac validation is weaker than Linux (may fall back to PID checks rather than HTTP behavior).

**Suggestions:**
- Make deploy ordering fully explicit here: relay canary → relay 2 → Mac → GPU hosts, OR defer all deploy fan-out to Plan 00-06.
- Tighten manual GPU checkpoint by requiring exact host-by-host evidence in a persisted summary artifact.
- Add explicit failure handling if `go test ./internal/integration/...` is flaky or environment-dependent.
- Prefer verifying built binary by running `aevia-node --version` or equivalent if available, rather than only `strings`.

**Risk: MEDIUM-HIGH.** Good technical content; operationally still partly manual and overlaps conceptually with Plan 00-06 — creates execution ambiguity.

---

### Plan 00-04

**Summary:** Strong protocol-shaping plan. Route A is the right choice: simpler, backward-compatible under Go JSON semantics, avoids deploy-ordering constraints, matches existing frame/header design. Somewhat over-documented for a small additive wire-format change, but ADR justified because B4 had explicit ambiguity and prior agent failure.

**Strengths:**
- Route A rationale sound; materially better than Route B for this phase.
- Backward-compat proof correctly centered on `json.Unmarshal` dropping unknown keys.
- Refuses to weaken `ReadAnyFrame` strictness just to support speculative future extensibility.
- Good tests: round-trip, legacy-read, `omitempty` on-wire behavior.
- ADR captures decision quality, not just implementation.

**Concerns:**
- **MEDIUM** — Test asserting "legacy wire is byte-identical" through omission may be too indirect unless it inspects the actual frame body precisely.
- **MEDIUM** — Introducing `[]byte` JSON fields means base64 payloads; negligible but plan should state upper bound assumption on SPS/PPS cardinality.
- **LOW** — Comments too heavy for hot-path protocol structs; may age poorly.
- **LOW** — Plan assumes exactly one useful SPS/PPS pair later, while wire type allows multiple pairs; needs clearer rule.

**Suggestions:**
- Add rule in ADR or tests that receivers use only first valid pair and ignore extras deterministically.
- Add negative test with malformed base64 or malformed pair content to ensure `ReadHeader` fails cleanly rather than partially.
- Shorten code comments; keep ADR as primary rationale store.

**Risk: LOW-MEDIUM.** Route A is correct decision for this phase.

---

### Plan 00-05

**Summary:** Most critical technical plan because it closes the real B4 behavior gap. End-to-end data path well chosen; nil fallback preserves pre-B4 behavior. Main concern: proposed `OnSession` signature change is practical but increases churn across tests and coupling between transport and session-consumer code.

**Strengths:**
- Correctly wires origin capture to mirror consumption with minimal semantic change.
- Nil fallback explicit; preserves Chrome inline-only behavior.
- Reuses existing `whip.NewHLSMuxer(sess.ID, sps, pps)` API instead of new side channel.
- Integration testing target is right: prove forwarded parameter sets are usable by mirror path.
- Explicitly removes mirror-side `nil,nil` constructor call in `main.go`.

**Concerns:**
- **HIGH** — `TestMirrorHeaderForwardSPS` mostly proves byte forwarding and muxer construction, NOT necessarily real late-join decode behavior or first-IDR success under actual mirrored RTP timing.
- **HIGH** — Changing `OnSession` to pass `sps, pps` increases API churn; if `whip.Session` could carry this state, might reduce coupling.
- **MEDIUM** — Plan says "SPS+PPS arrive before first IDR" but proposed test scaffolding does not fully exercise RTP/frame ordering through real read loop unless expanded.
- **MEDIUM** — Logging `mirror_muxer_sprop_forwarded` on every session may be noisy in production if not rate-limited or debug-scoped.
- **LOW** — Two integration tests may duplicate helper scaffolding instead of centralizing.

**Suggestions:**
- Strengthen integration test to actually feed IDR-only path after session creation and verify muxer/init-segment behaves as expected, not just constructor success.
- Consider attaching SPS/PPS to `whip.Session` as cleaner alternative to widening `OnSession`; if not, document why callback extension is preferred.
- Add small test for multiple-pair headers to confirm "use first pair only".
- Make new structured log debug-level or emit only when parameter sets are present and first used.

**Risk: MEDIUM-HIGH.** Plan likely works, but test as currently described does not fully prove the exact success criterion "no viewer sees stream-start decode failures when joining mid-session on a mirror-recipient provider".

---

### Plan 00-06

**Summary:** Good final integration/deploy/gate plan with right canary posture for wire-format-adjacent production change. Strong gate meaningfully comprehensive, maps well to 3 success criteria. Main issue: parts of gate remain operator-dependent — closure quality depends heavily on disciplined execution rather than purely automated guarantees.

**Strengths:**
- Correct canary strategy: `R1 → observe → remaining 5` adequate for additive wire-format change.
- Strong gate covers source validation, backend tests, production bundle correctness, deployed binary identity, live Playwright smoke.
- Cleanup + planning-doc closure appropriately deferred until all gates pass.
- Worktree removal discipline correct and consistent with project workflow.

**Concerns:**
- **HIGH** — Gate #5 not truly automated for all 6 providers; Mac and GPU endpoints depend on operator-supplied or local details, weakens reproducibility.
- **HIGH** — Gate #6 depends on manually provisioned live session + operator interpretation of "degrade gracefully" — subjective.
- **MEDIUM** — Re-running `deploy-3nodes.sh` with R1 already canaried is probably safe but muddies evidence, can overwrite `.bak` unexpectedly.
- **MEDIUM** — Plan claims full strong-gate completion but parts depend on external infra + human confirmation not persisted in machine-checkable form.
- **LOW** — `percent: 14` in `STATE.md` is rough approximation; document whether percent is floor/rounded.

**Suggestions:**
- Persist full 6-host hash/status table + Playwright run evidence as required artifacts before closing phase.
- Make Mac check explicit: either require local `/healthz` endpoint or clearly state Mac is excluded from hash-based gate evidence and why.
- Prefer temporary R2/Mac-only script variant over re-running R1 if preserving `.bak` integrity matters operationally.
- Tighten wording for Gate #6 so "provider-only degradation allowed" still requires concrete UI/state assertions, not operator impression.

**Risk: MEDIUM.** Well designed; final success still relies on disciplined manual operations + evidence capture.

---

### Codex Phase-Wide Assessment

**Summary:** Six plans are coherent, mostly well ordered, aligned with 3 Phase 0 success criteria. Strongest: `build` observability prerequisite, Route A B4 protocol decision, final strong gate. Weakest: operational — deploy responsibilities split across plans, several checkpoints are human-gated, B4 integration test does not quite prove full viewer-facing decode guarantee on its own.

**Strengths:**
- Dependency structure mostly correct: `00-02` before backend deploy, `00-04` before `00-05`, final closure in `00-06`.
- Project-specific constraints respected: `CGO_ENABLED=0`, commit scopes, Cloudflare-only deployment model, no AI attribution, git-config-only authorship.
- Route A over Route B is right call.
- Canary + strong gate is appropriate operational model for B4.
- Plans materially target all 3 Phase 0 success criteria.

**Concerns:**
- **HIGH** — B4 success criterion 3 only partially proven by current test design; production validation may catch it, but implementation proof could be stronger.
- **MEDIUM** — Deploy logic spread across `00-03` and `00-06`, risks duplicated or inconsistent operator steps.
- **MEDIUM** — Heavy reliance on manual checkpoints reduces reproducibility, increases phase-close ambiguity.
- **LOW** — Some plans over-specified to brittleness, especially where exact commit counts or exact branch state are assumed.

**Suggestions:**
- Consolidate all provider rollout logic into `00-06`, leaving `00-03` as merge/build-only.
- Strengthen `TestMirrorHeaderForwardSPS` to exercise actual first-IDR/init-segment behavior, not just byte transport + muxer construction.
- Standardize summary artifacts so every manual checkpoint produces committed evidence file before phase marked complete.
- Reduce brittle assertions about exact commit counts; prefer assertions about required content plus clean ancestry.

**Codex Phase Risk: MEDIUM-HIGH.** Architecture + sequencing fundamentally good, protocol decision sound. Main residual risk: operational + validation-related — B4's real user-facing behavior not fully proven by described automated tests; phase completion depends on several manual deploy/verification steps being executed carefully.

---

## Consensus Summary

### Agreed Strengths (both reviewers)

- **Route A for B4 wire format is the correct choice** — backward-compatible via `json.Unmarshal` unknown-key behavior, avoids deploy-ordering constraints, matches existing frame/header design.
- **Canary + Strong Gate operational model is appropriate** for a wire-format-adjacent production change (R1 90s observation before 5-node fan-out).
- **`/healthz .build` prerequisite plan is cleanly scoped** and enables automated binary-hash verification; `omitempty` preserves rolling-deploy safety.
- **Project-specific constraints respected throughout**: `CGO_ENABLED=0` invariant, commitlint scopes (`video`/`provider-node`/`docs`/`repo`), Cloudflare-only deployment model, no AI attribution in commits, git-config-only authorship.
- **Dependency structure is correct**: `00-02` before backend deploy, `00-04` before `00-05`, final closure in `00-06`.
- **TDD and test coverage** at the unit level (round-trip, legacy-read, omitempty) is well designed.
- **Worktree cleanup discipline** deferred correctly to `00-06` after gate passes.

### Agreed Concerns (both flagged, highest priority)

1. **Plan 00-05 integration test doesn't fully prove the stated success criterion** — `TestMirrorHeaderForwardSPS` exercises byte forwarding + muxer construction, but does NOT prove the exact success criterion 3 ("no viewer sees stream-start decode failures when joining mid-session on a mirror-recipient provider"). Both reviewers flagged this as the single most important gap.
   - *Severity:* Gemini **LOW** (race condition noted, correctly avoided), Codex **HIGH** (success criterion 3 only partially proven).
   - *Fix direction:* strengthen the integration test to feed an IDR-only path after session creation and verify init-segment/muxer behavior end-to-end, not just constructor success.

2. **Deploy logic is split between Plans 00-03 and 00-06** — Codex HIGH concern (rolling behavior only partial in 00-03; 6-node validation centralized elsewhere); Gemini accepts the hybrid as pragmatic (MEDIUM on GPU host manual loop). Real operational risk either way.
   - *Fix direction:* consolidate all provider rollout into 00-06 and reduce 00-03 to merge + build + binary-hash verification only. OR clearly delineate which plan "owns" which hosts.

3. **Manual checkpoint evidence not persisted** — Codex HIGH concern (Gate #5 Mac/GPU + Gate #6 Playwright rely on operator action without machine-checkable artifacts); Gemini flags only gate #6 as MEDIUM. Both agree a gate-result persistence artifact is needed for audit trail.
   - *Fix direction:* require `00-06-GATE-RESULT.md` with full 6-host hash/status table + Playwright run evidence (screenshots or log excerpts) before phase is marked complete.

4. **Bundle verification in Plan 00-01 is coarse** — both flagged grep against "a few discovered chunks" is weaker than enumerating the built HTML's script assets. Codex MEDIUM, Gemini LOW.

### Divergent Views (worth investigating)

| Topic | Gemini | Codex | Verdict |
|---|---|---|---|
| Overall phase risk | LOW | MEDIUM-HIGH | Codex is closer to reality given Plan 00-05 test gap + Plan 00-06 operator dependency. |
| Plan 00-01 "staged OR aborted" Task 1 language | Not flagged | HIGH ambiguity | Codex wins — ambiguous endstate is real operator risk. Fix: require clean abort always. |
| Plan 00-01 "exactly three commits" acceptance criterion | OK | MEDIUM brittle (rebase/amend breaks it) | Codex wins — prefer "contains at least the required commits, no unreviewed extras". |
| Plan 00-03 manual GPU checkpoint | MEDIUM (acceptable for rotating dev infra) | HIGH (no machine enforcement for criterion #2) | Both points valid. CONTEXT.md should pick one: keep manual with committed evidence artifact, OR write `deploy-gpu.sh` as future Phase 5 robustness work. |
| Plan 00-04 code comments | Not flagged | LOW (too heavy, may age poorly) | Codex wins marginally — `git blame` + ADR carry the history; shorten inline. |
| Plan 00-05 `OnSession` signature change | Not flagged | HIGH API churn (consider `whip.Session` carrying state) | Defer to execution; if churn is painful during Task 1, revisit. Otherwise the explicit param is clearer than state mutation. |
| Plan 00-06 `.bak` integrity after re-running deploy script | Not flagged | MEDIUM (overwrites `.bak` unexpectedly) | Minor. Can be handled by snapshotting `.bak` before Gate or using R2/Mac-only variant. |

### Priority Actions Before Execute

Before running `/gsd-execute-phase 0`, consider addressing these (in priority order):

1. **Strengthen Plan 00-05 integration test** — ADD a test case that feeds a single IDR after session creation and asserts the init-segment/muxer first-frame path emits the expected output. This directly closes success criterion 3 gap. Worth replanning via `/gsd-plan-phase 0 --reviews` OR adding inline task modifier.

2. **Clarify Plan 00-01 Task 1 endstate** — change "staged OR aborted" to "aborted" so Task 2 starts from a known clean state. Small plan edit.

3. **Require `00-06-GATE-RESULT.md` artifact** — add this as explicit task deliverable in Plan 00-06. Plans already reference the idea; just make it mandatory and structured.

4. **Loosen "exactly three commits" assertions** — change to "contains expected commits + no unreviewed additions". Applies to Plans 00-01 and 00-03 merge steps.

5. **Defer rest** — the divergent views on code-comment density, API churn, and `.bak` integrity are tolerable risks for a debt-closure phase.

### What Not to Change

- **Route A decision** — both reviewers agree it's correct.
- **Canary + Strong Gate model** — both approve.
- **Wave structure** — both approve the 1-2-3-4-5 ordering.
- **TDD approach in Plan 00-02** — both approve.
- **Worktree discipline** — both approve the deferred cleanup in 00-06.

---

## To Incorporate This Feedback

```
/gsd-plan-phase 0 --reviews
```

This will re-run the planner with REVIEWS.md as input, producing revised plans that address the priority actions above.

Alternatively, apply the 4 priority actions as inline edits to the existing plans if the scope of changes is small enough to not warrant a full replan.
