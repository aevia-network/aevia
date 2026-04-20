---
phase: 00-consolidation
plan: 01
subsystem: infra
tags: [git-merge, cloudflare-pages, frontend, deploy, hls.js, p2p, playwright]

# Dependency graph
requires: []
provides:
  - "feat/frontend-phase2 integrated into main at commit bccf70e"
  - "hls.js loadSource rotation across mesh failover candidates (e6a3ff3) on main"
  - "pubsub tracker stub + ?tracker=pubsub no-op flag (7810ccc) on main"
  - "F4 p2p-hls-multiviewer Playwright smoke spec (b444ed7) on main"
affects: [00-06-PLAN, 01-m9-audio, Phase-1]

# Tech tracking
tech-stack:
  added: []
  patterns: [merge-then-deploy]

key-files:
  created:
    - apps/video/e2e/p2p-hls-multiviewer.spec.ts
    - apps/video/src/lib/p2p/pubsub-tracker.ts
  modified:
    - apps/video/e2e/README.md
    - apps/video/src/components/player-screen.tsx

key-decisions:
  - "Dry-run merge aborted clean before the real merge (Codex HIGH concern from 00-REVIEWS.md applied inline — removed ambiguity of 'staged OR aborted')"
  - "Pre-existing uncommitted work on main (chunk-relay.ts tracker list, sw.js empty, STATE.md execution marker, httpx/server.go build field) was left untouched — none of it overlapped with the 4 files the merge actually wrote"
  - "Production Pages deploy step blocked: CF Pages auto-deploy from main is NOT configured for project aevia-video (no git integration, no CI job) — plan's assumption contradicted by wrangler.toml + absence of .github/workflows/pages.yml; deploy requires manual pnpm pages:deploy"

patterns-established:
  - "Merge commit for phase-branch consolidation uses scope 'video' (not 'consolidation' — rejected by commitlint); body enumerates absorbed commits verbatim for forensics"

requirements-completed: [DEPLOY-01]  # merge + CF Pages production deploy both complete — see "Task 3 Resolution" section below

# Metrics
duration: ~7min
completed: 2026-04-20
---

# Phase 0 Plan 01: Frontend Phase-2 Merge to Main Summary

**Merged feat/frontend-phase2 into main as bccf70e with Leandro-only attribution; production bundle deploy blocked — CF Pages does not auto-deploy from main push in this project and requires operator-run `pnpm pages:deploy`.**

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-04-20T20:53:00Z (approx)
- **Completed:** 2026-04-20T21:00:00Z (checkpoint reached)
- **Tasks:** 2 / 3 (Task 3 reached checkpoint)
- **Files modified:** 4 (via the merge commit tree write)

## Accomplishments

- Dry-run merge of `feat/frontend-phase2` into `main` surfaced ZERO conflicts (the four feature files — `apps/video/e2e/README.md`, `apps/video/e2e/p2p-hls-multiviewer.spec.ts`, `apps/video/src/components/player-screen.tsx`, `apps/video/src/lib/p2p/pubsub-tracker.ts` — are non-overlapping with any of the uncommitted dirty files on main's working tree).
- `pnpm -w run typecheck` exit 0 across 11 packages on `feat/frontend-phase2` tip (cache miss 9, cache hit 2). `pnpm -w exec biome check apps/video` exit 0 (7 pre-existing warnings, 0 errors).
- Real merge landed as `bccf70e` with subject `feat(video): hls.js failover rotation + pubsub tracker stub + F4 smoke`, Leandro-only author identity, NO Co-Authored-By / AI / vendor trailers, passed the commitlint pre-commit hook.
- Push to `origin/main` succeeded (`d424fa4..bccf70e main -> main`), pre-push `typecheck` hook passed (3.74s, 2 successful). `origin/main` now contains the three frontend-phase-2 commits (`e6a3ff3`, `7810ccc`, `b444ed7`) transitively through the merge.

## Task Commits

1. **Task 1: Dry-run merge → aborted clean** — no commit (dry-run verified and aborted; Codex HIGH concern inline fix applied)
2. **Task 2: Real merge + push** — `bccf70e` (feat(video) merge commit)

**Plan metadata commit:** pending (operator must deploy before plan is closed — see checkpoint)

## Files Created/Modified

**By the merge commit `bccf70e` (3-way merge of feat/frontend-phase2):**

- `apps/video/e2e/p2p-hls-multiviewer.spec.ts` — F4 operator-run smoke spec (`AEVIA_E2E_LIVE_URL` skip-by-default) created
- `apps/video/src/lib/p2p/pubsub-tracker.ts` — pubsub tracker stub + `?tracker=pubsub` no-op flag created
- `apps/video/src/components/player-screen.tsx` — hls.js failover rotation logic modified (loadSource rotates across mesh candidates)
- `apps/video/e2e/README.md` — documentation for the F4 spec modified

## Decisions Made

- **Codex HIGH concern applied inline (per executor instructions from orchestrator):** Task 1 endstate was tightened from "staged OR aborted" to "aborted clean" — the dry-run was aborted before the real merge, giving Task 2 a single, unambiguous starting state.
- **Pre-existing dirty working tree on main left untouched:** five files were modified in the working tree before this plan started (chunk-relay.ts tracker-URL list, sw.js emptied, hero image swapped, STATE.md "executing" flip, openzeppelin submodule pointer) and seven more were added as untracked (.env.local backups, screenshot PNGs, OPPORTUNITY.md). NONE of them overlap with the 4 files the merge actually wrote (verified via `git diff --name-only d424fa4..feat/frontend-phase2`). They are external context from prior sessions and are not in scope for Plan 00-01.

## Deviations from Plan

### Concurrent external activity

**1. Parallel commit landed on main between my merge and push** — `187108b feat(provider-node): expose binary build hash on /healthz` (the Plan 00-02 commit) was committed locally by another process between my `git merge` and `git push`, and subsequently pushed to origin. This was NOT my action (reflog + commit author confirm). Effect: `origin/main` is now at `187108b`, which has `bccf70e` (my merge) as its parent. The frontend phase-2 changes are intact in origin's tree because `187108b` only modifies backend Go files (`internal/httpx/server.go` and `server_test.go`) — no impact on the frontend bundle that CF Pages builds. Plan 00-02 effectively ran in parallel and the two commits composed cleanly.

### Rule 3 - Blocking issue surfaced, NOT auto-fixed (checkpoint instead)

**2. CF Pages production deploy did NOT auto-trigger** — this is the critical finding.

- **Plan assumption:** "CF Pages has a git integration bound to the `aevia-video` project's production branch = `main`. The push automatically triggers a production build. No manual `wrangler pages deploy` is required — CF Pages handles it."
- **Reality:** Evidence collected during Task 3 bundle grep verification contradicts this assumption:
  - Production webpack chunk `/_next/static/chunks/webpack-5cf4ebc64532d37d.js` has `age: 77171` (~21.4 hours cached at the CF edge) — far older than the 90-180s wait window. No new bundle has been deployed since my push.
  - Grep across ALL 90 webpack chunks on production (via chunk id/hash map extracted from the runtime) returns ZERO matches for `hls/index` (any variant) and ZERO matches for `playlist.m3u8`. Both counts are 0, whereas the plan requires `/hls/index.m3u8` ≥ 1.
  - `apps/video/package.json` defines `"pages:deploy": "wrangler pages deploy .vercel/output/static"` — a manual deploy script invoked from a dev machine.
  - `.github/workflows/ci.yml` has NO Pages deploy job. Only typecheck / lint / test / build jobs. No `wrangler pages deploy` step, no `cloudflare/pages-action`, no `cloudflare/wrangler-action` anywhere in CI.
  - No `[deploy]` config in `wrangler.toml` pointing to a git-connected branch.
- **Why I did NOT auto-fix this (Rule 3 deferred to checkpoint):** Running `pnpm pages:deploy` from a dev machine is an **irreversible public action** (production deploy) and CLAUDE.md explicitly requires "Ask before ... deploying to production". The plan's assumption that CF Pages would auto-deploy removed this from the explicit scope. Unilaterally running prod deploy would violate CLAUDE.md's operating pattern. Operator approval is required.
- **Files modified:** none (no fix applied — checkpoint instead)

---

**Total deviations:** 1 blocking issue surfaced and deferred to operator checkpoint (plan assumption was incorrect about CF Pages auto-deploy topology).
**Impact on plan:** Task 3 (production bundle verification) cannot complete until a production deploy lands. The merge-commit objective of DEPLOY-01 is achieved; the production-bundle objective is pending an explicit operator decision on the deploy mechanism.

## Issues Encountered

- Plan's Task 3 assumption of CF Pages git integration was incorrect — see deviation #2 above.
- Discovery was forensic, not failure-mode: all bundle grep counts were zero because the deployed bundle is ~21 hours old, pre-dating even the merge.

## CHECKPOINT NEEDED: Production Deploy Path

**Status:** Merge landed on `origin/main` (commit `bccf70e`, parent of `187108b`); production `aevia.video` still serves a pre-merge bundle because no deploy automation fired.

**What the operator must decide:**

**Option A — Manual deploy now (recommended, matches current project reality):**

```bash
cd /Users/leandrobarbosa/Personal/videoengine
pnpm -F @aevia/video build                  # next build
pnpm -F @aevia/video pages:build            # next-on-pages (if required)
cd apps/video && wrangler pages deploy .vercel/output/static --project-name=aevia-video --branch=main
```

Then rerun the bundle grep verification loop from Plan 00-01 Task 3 §`<how-to-verify>` step 2. This is the historically-used path (see commit `d3467cf fix(video): unblock Pages build`, which patches `next-on-pages`).

**Option B — Configure CF Pages git integration** (longer-term fix; aligns with plan's assumption; out of scope for this plan):

1. Cloudflare Dashboard → Pages → aevia-video → Settings → Builds & deployments → Git → connect to `Leeaandrob/aevia` (or the org equivalent) → production branch = `main`, build command = `pnpm -F @aevia/video build && pnpm -F @aevia/video pages:build`, output = `apps/video/.vercel/output/static`.
2. Trigger a manual re-deploy from the dashboard (or push an empty commit) to exercise the new path.
3. Update `.planning/codebase/STACK.md` + create ADR documenting the git-triggered deploy as normative for the project.

**Option C — Wire CF Pages deploy into GitHub Actions** (also longer-term; would live in a new plan):

- Add a `deploy-pages` job to `.github/workflows/ci.yml` (or a separate workflow file) that runs on `push: branches: [main]` and invokes `cloudflare/wrangler-action@v3` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets.

**My recommendation:** Option A now (unblocks Phase 0 today), Option B or C in a follow-up infra plan (eliminates the manual-deploy gap for Phase 1+).

## Next Phase Readiness

- **Merge objective of DEPLOY-01:** achieved — main has the three frontend-phase-2 commits, Leandro-only attribution.
- **Production-bundle objective of DEPLOY-01:** pending operator deploy (Option A/B/C above).
- **Blockers for downstream plans:** none — Plan 00-02 already ran in parallel; Plan 00-03 depends on backend merge (separate track); Plan 00-06's Strong gate check #4 (bundle grep) will fail until production is deployed.
- **Worktree `aevia-frontend-phase2`:** retained per plan instruction; cleanup deferred to Plan 00-06.

## Self-Check: PASSED

- `apps/video/e2e/p2p-hls-multiviewer.spec.ts` on main: FOUND
- `apps/video/src/lib/p2p/pubsub-tracker.ts` on main: FOUND
- Merge commit `bccf70e`: FOUND in `git log --all`
- `bccf70e` is ancestor of `origin/main`: CONFIRMED (origin/main is now `c44aede` via Plan 00-02 summary commit landing on top)
- SUMMARY file `.planning/phases/00-consolidation/00-01-SUMMARY.md`: WRITTEN

All git-level and code-level claims verified. The production-bundle claim is NOT verified — explicitly marked as the checkpoint below.

---

## Task 3 Resolution (2026-04-20, post-checkpoint)

Operator authorized Option A (manual deploy via `pnpm pages:deploy`). Orchestrator ran the deploy sequence directly with session-level control:

```bash
set -a; source .env.local; set +a   # CLOUDFLARE_ACCOUNT_ID from .env.local
cd apps/video
pnpm build                          # next build — 23 routes, 227 KB shared
pnpm pages:build                    # next-on-pages — _worker.js generated, 3.38s
pnpm exec wrangler pages deploy .vercel/output/static --project-name=aevia-video --branch=main
```

**Preflight (env leak guard per memory `feedback_env_local_leak_prod`):**
- `apps/video/.env.local` → symlink to `/videoengine/.env.local`
- `grep AEVIA_DEV_BYPASS_AUTH` on the symlink target: ABSENT
- `.env.local.bak` + `.env.local.bak.bypass` are untracked backups; NOT read by `next build`. Safe.

**Local bundle preflight (`.vercel/output/static`):**
- `/hls/index.m3u8` hits: 2 (expect ≥ 1) ✓
- `/playlist.m3u8` hits: 0 (expect = 0) ✓

**Deploy result:**
- New deployment URL: `https://52a0ce13.aevia-video.pages.dev`
- Environment: **Production** (branch `main`, source commit `c7fba30`)
- CF Pages `deployment list` confirms: previous production was `3c4ae273` from commit `8766535` (21h ago); new prod is `52a0ce13` from `c7fba30` (48s after upload)

**Post-deploy bundle verification (targeted chunk grep):**

| URL | `/hls/index.m3u8` hits | `/playlist.m3u8` hits | `age` |
|---|---|---|---|
| `https://52a0ce13.aevia-video.pages.dev` | 1 | 0 | fresh |
| `https://aevia.video` | 1 | 0 | 0 (cf-cache-status HIT, date now) |

The initial checkpoint's 0-hit count was a false negative: it grepped the homepage initial bundle, but the player chunk carrying `hls.loadSource("/live/.../hls/index.m3u8")` is lazy-loaded on `/live/mesh/[id]` routes — chunk `5817-e7c5de750de98983.js`. Grepping that chunk directly on both preview and prod URLs returns the expected string. Plan 00-01 exit criteria met.

**Methodology note for Plan 00-06 Strong gate check #4:** the bundle grep should target lazy-loaded player chunks (5817-*.js or equivalent in future builds), NOT just the home page. Task 3's how-to-verify should be refined in future phases to fetch `/live/mesh/<any-id>`, extract the script list, grep each. Filed as a small improvement in the Phase 0 gate-result artifact.

**Deploy mechanism insight:** `wrangler pages deploy --branch=main` DOES promote to production — CF Pages treats `--branch=main` as the production-branch alias, not a preview. The plan's original assumption ("auto-deploy on push") was wrong (no git integration configured), but the `wrangler` manual deploy path correctly lands on the production URL. Option A is the normative deploy path for this project until git integration is added (deferred to a future infra plan).

**DEPLOY-01 status:** COMPLETE. Merge + production bundle both live; `aevia.video` preview URL (`f049801b`) and production have converged onto the same code (commit ancestry `bccf70e` → `c7fba30`).

---

*Phase: 00-consolidation*
*Plan: 01*
*Completed: 2026-04-20 (Task 1-3 all green after operator-authorized Option A deploy)*
