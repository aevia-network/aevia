# Phase 0: Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 00-consolidation
**Areas discussed:** B4 recovery strategy, Validation gate
**Areas skipped with defaults applied:** Execution parallelism, Backend deploy procedure

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Execution parallelism | Frontend merge + backend push/deploy in parallel (2 independent worktrees) OR sequential (frontend first, backend after F2 validated in prod)? Parallel gains ~30% time but doubles blast radius if something breaks. | |
| B4 recovery strategy | Task B4 (SPS/PPS forward in mirror protocol header) stalled in agent stream-watchdog 600s. Relaunch agent with longer timeout, continue manually in interactive session, or scope to plan-phase for fresh context? | ✓ |
| Backend deploy procedure | Deploy B1+B2+B3+B4 across 6 providers: (a) rolling 1→validate→5 (~20min), (b) big-bang via deploy-3nodes.sh (~5min), (c) canary 1 node for 24h before the other 5 (safest, slowest). Mirror protocol changed in B4 — backward compat? | |
| Validation gate | How do we declare Phase 0 done? (a) typecheck + biome + TestMirror* + bundle grep, (b) Playwright smoke on /live/mesh/{id}?hls=1, (c) smoke + real 2+ viewer live session, (d) combination. Prior incidents (env leak, NACK fix) suggest a strong gate is needed. | ✓ |

**User's selection:** B4 recovery strategy, Validation gate

---

## B4 Recovery Strategy

### Question 1: How to resolve B4 (SPS/PPS forward in mirror protocol header)?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual in session | Continue B4 manually in this session (pick up the agent's partial state in aevia-backend-2, finish WriteHeaderRaw helper + tests + backward-compat). Full control, ~1-2h of session time. Recommended if you want to see the wire-format change. | |
| Relaunch agent (longer timeout) | Spawn a new agent with a 900s+ timeout and context from where it stalled. Faster if the agent doesn't restall; risk of re-stall if WriteHeaderRaw is intrinsically complex (common in codec-level code). | |
| Defer to plan-phase | Plan-phase decides the B4 route with research-backed evidence (there are established pion/gohlslib patterns). The planner breaks B4 into 2-3 smaller subtasks (helper, tests, wire format), each its own plan. Safer if B4 turns into 3-4h of work. | ✓ |
| Split: manual helper, agent tests | Claude finishes WriteHeaderRaw helper manually (critical wire-format code), then spawns an agent to write `TestMirrorHeaderForwardSPS` + integration test. Divides effort between mechanical (tests) and protocol-level (wire). | |

**User's choice:** Defer to plan-phase
**Notes:** User prefers to carry the implementation ambiguity into the plan with codebase evidence rather than lock an approach in discuss.

### Question 2: Wire-format change in B4 — backward compat with B1-B3 binaries in prod?

| Option | Description | Selected |
|--------|-------------|----------|
| Frame version bump | New `FrameType=0x07` (FrameTypeHeader) + sender negotiates via initial header. B4-aware mirror reads 0x07, B1-B3-only mirrors ignore it. Clean, extensible, but requires all providers to run B4 before any B4 sender enables emission. | |
| Silent extension on FrameTypeHeader JSON | Frame 0 (FrameTypeHeader) is already JSON. Add optional `sps_pps_set: [{sps, pps}]` field. B1-B3 mirrors ignore unknown fields (Go default behavior). Zero breaking change, zero deploy-ordering requirement. | |
| Decide in plan-phase | Plan-phase analyzes codebase context (pion msg types, gohlslib h264 codec params, existing wire format) and chooses. Claude carries the ambiguity as an open question in CONTEXT.md; the planner decides with evidence. | ✓ |

**User's choice:** Decide in plan-phase
**Notes:** Both routes are viable; evidence from the codebase will clarify the right pick. The planner also gets the option of documenting the rejected route in a short ADR.

---

## Validation Gate

### Question 1: Minimum validation gate to declare Phase 0 "done"?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard: build + tests + bundle grep | typecheck + biome + TestMirror* + TestWhepPerViewer green + grep `/hls/index.m3u8 ≥1, /playlist.m3u8 =0` + `/healthz` returns new binary hash on 6/6 nodes. 100% automated, ~5min. Risk: doesn't catch runtime failures (ICE, mirror in prod). | |
| Strong: standard + Playwright smoke | Everything in Standard + `p2p-hls-multiviewer.spec.ts` (F4 shipped) running for 45s against a preview URL or synthetic live. Catches client-side regressions in hls.js failover + mesh chip. Operator-run (skip-by-default), ~3min extra. | ✓ |
| Comprehensive: strong + real live session | Everything in Strong + 1 real manual live session at `aevia.video/live/new` using the aevia-mesh backend, 2+ viewers (chrome + safari/ios) for 2min, verify audio+video continuity, zero-reload failover, correct peers chip. Operator-manual, ~10min extra. Recommended after a wire-format change. | |
| Canary-first: comprehensive + 24h soak | Everything in Comprehensive + the new binary stays on 1 provider (Relay 1 or Mac) for 24h before the other 5. Catches session leak / hub starvation / RTP stall that only surface under sustained load. Safer, slower. | |

**User's choice:** Strong: standard + Playwright smoke
**Notes:** The Strong gate balances ~8min total runtime with coverage of the most likely failure classes (wire-format regressions visible via Playwright multi-viewer).

### Question 2: Rollback plan if the gate fails mid-deploy (e.g., 3/6 providers OK, 4th hits a regression)?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-revert to previous binary | systemd keeps the old binary path; the script switches the symlink back and restarts. ~30s recovery. Needs `deploy/scripts/rollback.sh`, which doesn't exist yet (~1h to create). | |
| Manual: git revert + rebuild + redeploy | If the gate fails, Claude (human) does a git revert on the offending commit, rebuilds, redeploys. Recovery ~10-15min. Zero new artifacts to maintain, but operational failure is visible in prod. | |
| Fix-forward only | No formal rollback plan; if the gate fails, fix the bug in place. Works for code-level bugs, not for wire-format regressions (which affect mirror-to-mirror connectivity). | ✓ |

**User's choice:** Fix-forward only
**Notes:** Combined with the Strong gate (Playwright smoke catching wire regressions before scale-out), fix-forward is acceptable for a consolidation phase. A formal rollback script is deferred to Phase 5 Robustness.

---

## Claude's Discretion

The user skipped two gray areas and left Claude to apply sensible defaults:

- **Execution parallelism** — default: run frontend merge and backend deploy in parallel (two independent worktrees, blast radius contained).
- **Backend deploy procedure** — default: rolling 1 → validate → 5 (wire-format change justifies single-node canary before the other five; plan-phase may downgrade to big-bang if D-02 lands on silent-JSON-extension).

Both defaults are documented in the `<decisions>` section of CONTEXT.md under "Claude's Discretion".

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- Formal rollback script (`deploy/scripts/rollback.sh`) — Phase 5 Robustness
- CI-gated Playwright stability spec — TEST-01 / Phase 5
- Automated binary-hash verification in deploy scripts — small improvement, not blocking Phase 0
- Cross-worktree commit provenance — not needed, CLAUDE.md attribution rule already enforces at the author level

No reviewed-but-deferred todos — nothing matched Phase 0 scope.
