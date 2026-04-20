# Phase 0: Consolidation - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the debt left by the two phase-2 parallel agents — merge `feat/frontend-phase2` into `main` + production Pages redeploy; push `feat/backend-phase2` to origin + cross-compile + deploy B1+B2+B3 across the 6 providers; complete B4 (SPS/PPS forward in the mirror protocol header). Zero new features — this phase is integration + deploy + debt closure so Phase 1 (M9 audio) starts from a clean production baseline.

In scope:
- Frontend merge (`feat/frontend-phase2` → `main`) + Pages production redeploy
- Backend push (`feat/backend-phase2` → origin) + cross-compile ARM64/AMD64/Darwin + 6-node deploy of B1/B2/B3
- B4 implementation, test, deploy
- Validation gate execution per the locked decision below

Out of scope (would belong in later phases or are already addressed elsewhere):
- New features or optimizations beyond B1-B4
- Formal `deploy/scripts/rollback.sh` infrastructure (deferred — see `<deferred>` section)
- P2P chunk tracker sovereignty (that's Phase 3)
- Anything in the OPPORTUNITY.md esports track
</domain>

<decisions>
## Implementation Decisions

### B4 Recovery Strategy

- **D-01: B4 implementation is deferred to `/gsd-plan-phase 0` — not decided here.**
  The discussion agreed that B4 (SPS/PPS forward in the mirror protocol header) has enough ambiguity in helper design, test harness, and wire format that the planner should break it into 2-3 subtasks with codebase evidence rather than locking an approach in discuss. The prior agent stall (stream watchdog 600s mid-`WriteHeaderRaw` helper) reinforces this — a bigger task needs smaller plans, not a re-run.
  Planner guidance: produce separate plans for (a) the `WriteHeaderRaw`/header-injection helper in `internal/mirror/server.go`, (b) `TestMirrorHeaderForwardSPS` + integration test in `internal/integration/`, (c) wire-format compatibility handling. Each plan gets its own atomic commit.

- **D-02: Wire-format backward-compat approach is deferred to `/gsd-plan-phase 0`.**
  Two routes identified in discuss but not chosen:
  - Silent JSON extension on the existing `FrameTypeHeader` (Frame 0) — add optional `sps_pps_set: [{sps, pps}]` field. Zero breaking change, zero deploy-ordering requirement.
  - New `FrameTypeHeader=0x07` with explicit sender/reader negotiation. Cleaner, more extensible, but requires all providers to run B4-aware binaries before any B4 sender enables emission.
  Planner must pick based on evidence in `services/provider-node/internal/mirror/` (existing frame types, Go struct JSON unmarshal behavior, pion header conventions). Carry this ambiguity into the plan as a research thread.

### Validation Gate

- **D-03: Strong gate locked.**
  Phase 0 is declared "done" when ALL of the following are green:
  1. `typecheck` + `biome check` across `apps/video/`, `packages/`, and `services/provider-node/` produce zero errors
  2. `TestMirror*` in `services/provider-node/internal/mirror/` green (including the new `TestMirrorHeaderForwardSPS`)
  3. `TestWhepPerViewer*` in `services/provider-node/internal/whep/` green (B1 spec compliance)
  4. Bundle grep on `apps/video` production build: `git grep '/hls/index.m3u8' .vercel .next .open-next` (or equivalent CF output) returns ≥ 1 hit; `git grep '/playlist.m3u8'` returns 0 hits (proves gohlslib path is in prod bundle)
  5. `/healthz` on all 6 providers returns the new binary hash matching HEAD of `main` (via `curl https://provider.aevia.network/healthz | jq .build`)
  6. `apps/video/e2e/p2p-hls-multiviewer.spec.ts` (F4, skip-by-default) runs against preview URL or synthetic live session for at least 45s without fatal error; 2 contexts see chip `NN% via peers · M pares` OR degrade gracefully to provider-only path (documented), never terminal failure
  Operator-run gate (not CI-gated yet — that's Phase 5 TEST-01 scope).

- **D-04: Fix-forward only — no formal rollback script.**
  Rollback plan is rely-on-Strong-gate-to-catch-early: the Playwright smoke and `/healthz` hash check should surface wire-format regressions before they land in viewer path. If a regression does slip through:
  1. Identify the offending commit (`git bisect` or log inspection against the last-known-good deploy)
  2. `git revert` on the main branch, rebuild, redeploy the previous binary across the 6 providers
  3. File an incident memory note in `.../memory/` documenting the escape for future gate hardening
  Operational failure is visible in prod but bounded — acceptable given this is a consolidation phase, not a long-running runtime change.

### Claude's Discretion (gray areas the user intentionally skipped — defaults applied)

- **Execution parallelism** (frontend-merge track + backend-deploy track): Default **run in parallel**. The two worktrees (`aevia-frontend-phase2`, `aevia-backend-2`) are already independent by design. Paralelizing cuts the critical path by ~30% and blast radius is naturally contained (frontend regression affects only Pages, backend regression affects only providers). If the plan-phase research surfaces coupling I missed, revisit.

- **Backend deploy procedure** (6-node rollout after B4 is complete): Default **rolling 1 → validate → 5**. Justification: B4 changes mirror wire format; a single-node canary catches protocol-level regressions against 5 peers running the same new binary, without risking total mesh black-out from a simultaneous 6-node deploy. Each node restart takes ~3-5s; full rolling cycle ~15-20min vs ~5min big-bang. Acceptable tradeoff given wire-format change semantics. Plan-phase may downgrade to big-bang if it validates D-02 chose silent-JSON-extension (no breaking-change path).

### Folded Todos

None — no pending todos matched Phase 0 scope via `gsd-sdk query todo.match-phase 0` during discussion.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope anchors

- `.planning/PROJECT.md` — Validated requirements (premises) + Active requirements for Phase 0 (DEPLOY-01/02/03) + Key Decisions (worktree strategy, CGO_ENABLED=0 invariant, commit-convention enforcement)
- `.planning/REQUIREMENTS.md` — REQ-IDs DEPLOY-01 (frontend merge + prod Pages), DEPLOY-02 (backend push + 6-node deploy of B1-B3), DEPLOY-03 (B4 SPS/PPS forward)
- `.planning/ROADMAP.md` §Phase 0 — goal, depends-on, success criteria, plan slots
- `.planning/STATE.md` — current position, blockers, deferred items

### Codebase map (brownfield reference)

- `.planning/codebase/ARCHITECTURE.md` — 6-layer system architecture, where Phase 0 changes land
- `.planning/codebase/CONVENTIONS.md` — commit scopes enforced by commitlint (`provider-node`, `video`, `infra`, etc.), Biome rules, lefthook hooks
- `.planning/codebase/STACK.md` — CGO_ENABLED=0 cross-compile invariant, Go 1.26 + pnpm 10 + Turbo
- `.planning/codebase/TESTING.md` — test naming conventions, integration test patterns in `internal/integration/`

### B4 implementation targets

- `services/provider-node/internal/mirror/server.go` — mirror protocol implementation; `WriteHeaderRaw` helper lives here
- `services/provider-node/internal/mirror/protocol.go` (or equivalent) — current FrameType constants (0x00 Header, 0x01 RTP, 0x02 Close, 0x05 Probe, 0x06 ProbeEcho); B4 may add a new type or extend Frame 0
- `services/provider-node/internal/integration/` — integration tests in-process libp2p; `TestMirrorHeaderForwardSPS` should live here
- `services/provider-node/internal/whep/whep.go` + `whep_test.go` — B1 per-viewer UUID + DELETE (already in aevia-backend-2 commit `ea593f1`), validation reference

### Validation gate references

- `apps/video/e2e/p2p-hls-multiviewer.spec.ts` — F4 smoke spec, skip-by-default via `AEVIA_E2E_LIVE_URL` env
- `apps/video/e2e/` directory — existing Playwright harness conventions
- `deploy/scripts/deploy-3nodes.sh` (if present) — multi-node binary sync pattern; canonical for cross-compile + SCP + systemctl restart
- `deploy/scripts/install-user-service.sh` — systemd per-user pattern (used on rtx4090/rtx2080/GH200-2)

### Prior art (shipped phases — do not re-research)

- ADR 0010 (HLS muxer via gohlslib, origin path)
- ADR 0011 (Mirror-side HLSMuxer, origin-failure tolerance) — `docs/adr/0011-*.md`
- Commit `55b19b0` (mirror HLSMuxer wire-up, reference pattern for `OnSession` callback ordering)
- Commit `d4217f4` (provider-node GossipSub mesh `internal/mesh/mesh.go` wrap pattern)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`mirror.Server.OnSession` callback** (`services/provider-node/internal/mirror/server.go`) — ordering-race-free registration pattern from ADR 0011 / commit `84c6302`. B4 plumbing registers in the same hook so header injection runs after mirror session start but before first RTP frame.
- **`TeeReadSessionTrack` in WHIP `whip.Session`** — tee pattern for multi-consumer tracks; reusable if B4 needs to intercept SPS/PPS from upstream sender before forwarding.
- **`deploy/scripts/deploy-3nodes.sh`** (if present) — existing multi-node deploy is a canonical script; rolling-deploy variant for Phase 0 can extend it rather than fork.
- **F4 Playwright spec `p2p-hls-multiviewer.spec.ts`** (commit `b444ed7`, on `feat/frontend-phase2`) — gate check #6 uses this exact spec.

### Established Patterns

- **Frame-based wire format in `internal/mirror/`**: every frame is `FrameType(u8) + Length(u32 BE) + Body`; `ReadAnyFrame` returns tagged-union, legacy `ReadFrame` deprecated. Any B4 extension must pick between new FrameType or silent JSON extension on Frame 0.
- **Integration tests in-process libp2p** (`internal/integration/libp2p_mesh_test.go`, `whep_multiviewer_test.go`): spawn multiple nodes in a single Go test, exchange real RTP, assert packet count. `TestMirrorHeaderForwardSPS` should follow this pattern.
- **Commit scope enforcement via commitlint**: valid scopes `[video, network, provider-node, recorder, manifest-svc, indexer, protocol, ui, auth, libp2p-config, contracts, infra, ci, docs, deps, repo, release]`. Plans must use these, not ad-hoc (discovered earlier this session — `claude` scope got rejected).
- **Worktree-per-task discipline**: `aevia-backend-2` and `aevia-frontend-phase2` are single-purpose; destroy after merge. Phase 0 plans should target these worktrees directly, not create new ones.

### Integration Points

- **Backend**: `services/provider-node/cmd/provider/main.go` — mirror.Server + mesh.Service + WHIP/WHEP servers wire up here. B4 changes get added to mirrorSrv.OnSession hook.
- **Frontend**: `apps/video/src/lib/webrtc/whep.ts` + `apps/video/src/lib/mesh/{resolve,rank,probe,latency}.ts` — frontend phase-2 commits already integrated; merge brings them into main path.
- **Deploy**: `deploy/scripts/` directory — binary cross-compile runs on dev machine (Mac), SCP to each VPS or GPU host, `systemctl --user restart aevia-node` (or system unit on R1/R2).
- **Gate validation**: `curl https://provider.aevia.network/healthz` (R1), + 5 equivalent URLs for R2, Mac, rtx4090, rtx2080, GH200-2. Binary hash in response must match HEAD of `main`.
</code_context>

<specifics>
## Specific Ideas

- **Wire-format change in B4 justifies rolling deploy**, not big-bang — per D-04's fix-forward posture, a rolling deploy gives the Strong gate a chance to surface wire-format regressions on one node before the other five join. The plan should make this explicit in the deploy-procedure plan.
- **B4 backward-compat ambiguity (D-02) is a research thread, not a binary gate** — the plan can research both routes, recommend one, and document the rejected route in a short ADR (0012 or inline) so the rationale survives.
- **`TestMirrorHeaderForwardSPS` should assert that a mirror-recipient binary compiled with B4 can join mid-session and render the first IDR without decode error** — this is the non-regression target for the wire-format change.
- **Preview-to-prod promotion for frontend is a simple `merge + redeploy`** — CF Pages has no staging-promote step; production pointer is bound to the main branch. The plan should reflect that the preview URL (`f049801b.aevia-video.pages.dev`) is informational only once merge lands.
</specifics>

<deferred>
## Deferred Ideas

### Noted for future phases (not Phase 0 scope)

- **Formal rollback script** (`deploy/scripts/rollback.sh`) — D-04 locked fix-forward for Phase 0. A reusable rollback script + systemd dual-binary pattern would reduce operational risk for Phase 1+ and beyond. Estimated ~1h to create + ~30m to validate. Belongs in Phase 5 Robustness or a stand-alone infra plan.
- **CI-gated Playwright stability spec** — gate check #6 is operator-run, not CI-gated. `whep-stability.spec.ts` + synthetic-live infrastructure is TEST-01 / Phase 5 scope.
- **Automated binary-hash verification in deploy scripts** — gate check #5 is currently a manual `curl | jq` loop. Inline in the deploy script as a post-restart verification step (fails the deploy if hash ≠ expected). Small improvement, ~30m, not blocking.
- **Cross-worktree commit provenance** — both `aevia-backend-2` and `aevia-frontend-phase2` commit under Leandro's `git config` identity; no attribution trail is needed. If worktree merge ever includes agent contributions we want to flag, add a lightweight `.git/hooks/commit-msg` guard. Not needed here — CLAUDE.md's attribution rule already enforces this at the author level.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 0 scope during `cross_reference_todos` check.
</deferred>

---

*Phase: 00-consolidation*
*Context gathered: 2026-04-20*
