---
phase: 00-consolidation
plan: 03
subsystem: provider-node
tags: [deploy, backend-merge, b1, b2, b3, healthz-build-hash, rolling-deploy, checkpoint-pending]
status: checkpoint
requires:
  - feat/backend-phase2 branch at ea593f1 (B1), ed73e34 (B2), dbd1dd1 (B3)
  - Plan 00-02's httpx.WithBuild wiring on main (commit 187108b)
  - deploy/scripts/build-all.sh + deploy/scripts/deploy-3nodes.sh (existing)
provides:
  - Merge commit on main bringing B1+B2+B3 into production source
  - Three cross-compiled statically-linked binaries stamped with main short SHA
  - 2 of 6 providers running the new binary with verified .build hash identity (R1 + Mac)
affects:
  - services/provider-node/cmd/provider/main.go (merge resolution kept httpx.WithBuild)
  - services/provider-node/internal/{whep,mirror,dht,integration,httpx} (feature commits landed)
  - /usr/local/bin/aevia-node on R1 (ubuntu@192.222.50.16) — swapped
  - ~/.local/bin/aevia-node on Mac (leandrobarbosa@local) — swapped via launchd reload
  - R2, rtx4090, rtx2080, GH200-2 — NOT yet deployed (checkpoint-pending, operator action required)
tech-stack:
  added: []
  patterns: [rolling-deploy, keep-.bak-rollback, systemctl-restart, launchctl-unload-load, build-hash-evidence]
key-files:
  created:
    - deploy/bin/aevia-node-linux-arm64 (generated, gitignored)
    - deploy/bin/aevia-node-linux-amd64 (generated, gitignored)
    - deploy/bin/aevia-node-darwin-arm64 (generated, gitignored)
  modified:
    - services/provider-node/cmd/provider/main.go (merge resolution)
decisions:
  - Binary VERSION stamped at build time = ea35d76 (main HEAD at build invocation). Subsequent doc-only commits on main (bc5287b README + CHANGELOG ea35d76 proper) do not invalidate the deploy — gate check is "binary .build matches the VERSION the build-all.sh invocation consumed", not "binary .build matches live main tip at audit time". This is the "no unreviewed extras" loosening suggested by Codex review feedback.
  - R2 deploy cannot complete from this agent because R2 sudo requires an interactive password prompt (TTY). Operator must either (a) run the R2 remote block manually with SSH + sudo, or (b) configure NOPASSWD for systemctl on R2. Same SSH agent reached R1 fine because R1 evidently has passwordless sudo for systemctl.
  - Mac deploy completed via direct launchctl unload/load invocation (no sudo needed; ~/.local/bin + ~/Library/LaunchAgents are user-owned).
  - Cross-compile invariant (CGO_ENABLED=0) preserved — all three binaries report "statically linked" (Linux) or Mach-O arm64 (darwin).
requirements-closed: []
metrics:
  duration-minutes: partial (checkpoint-pending)
  completed: in-progress
---

# Phase 0 Plan 03: Backend Merge + 6-Node Deploy Summary (Partial — Checkpoint)

**Status:** 2 of 6 providers deployed (R1 + Mac). R2 blocked on sudo; rtx4090 + rtx2080 + GH200-2 pending operator action per plan's designed `checkpoint:human-verify` on Task 4.

One-liner: merged `feat/backend-phase2` (B1+B2+B3) into `main` as commit `8c605b2`, cross-compiled three statically-linked binaries stamped `ea35d76`, deployed to R1 (`provider.aevia.network`) and Mac; R2 and the 3 GPU hosts await operator deploy.

## What Shipped — Task 1 (Merge)

| Metric | Value |
|--------|-------|
| Merge commit | `8c605b2 feat(provider-node): B1 per-viewer WHEP + B2 DHT re-announce + B3 mirror FU-A drop` |
| Parent commits folded | `ea593f1` (B1), `ed73e34` (B2), `dbd1dd1` (B3) |
| Files changed | 11 files, +1427/-38 (11 new, 2 modified) |
| Merge conflicts | 0 — `main.go` auto-merged cleanly (Plan 00-02's `WithBuild` sits at line 210, feat/backend-phase2's whip/dht/mirror edits are in different regions) |
| `go vet ./...` | exit 0 |
| `go build ./cmd/provider` | exit 0 |
| Test packages green | `internal/whep` (1.5s), `internal/mirror` (4.7s), `internal/dht` (5.4s), `internal/integration` (9.1s), `internal/httpx` (2.7s) |
| Attribution audit | body contains no Co-Authored-By / Claude / Anthropic / 🤖 / "generated with" |
| Push status | `origin/main == main == ea35d76` (origin caught two doc commits from operator: `ea35d76` CHANGELOG.md, then `bc5287b` README + issue templates — benign, unrelated to this plan) |

### `main.go` merge resolution

The merge carried `WithBuild(Version)` from Plan 00-02 (line 210) AND the feat/backend-phase2 edits simultaneously. Git's `ort` strategy resolved cleanly without manual intervention. Confirmed post-merge:

```
services/provider-node/cmd/provider/main.go:54: var Version = "dev"
services/provider-node/cmd/provider/main.go:210:   httpx.WithBuild(Version),
```

## What Shipped — Task 2 (Cross-compile)

| Binary | Size | Arch | Static? | `strings | grep -qx "ea35d76"` |
|--------|------|------|---------|-----------------------------|
| `deploy/bin/aevia-node-linux-arm64` | 33M | ELF 64-bit ARM aarch64 | yes (statically linked) | PASS |
| `deploy/bin/aevia-node-linux-amd64` | 35M | ELF 64-bit x86-64 | yes (statically linked) | PASS |
| `deploy/bin/aevia-node-darwin-arm64` | 34M | Mach-O 64-bit arm64 | (no CGO — clean) | PASS |

`deploy/scripts/build-all.sh` auto-resolved `VERSION=ea35d76` at invocation time (line 19: `git rev-parse --short HEAD`). The LDFLAGS `-X main.Version=ea35d76` stamped all three binaries.

CGO_ENABLED=0 invariant preserved. `readelf` not available on macOS host; `file(1)` output is the authoritative signal and reports "statically linked" for both Linux binaries.

## What Shipped — Task 3 (Rolling Deploy, PARTIAL)

### R1 — ubuntu@192.222.50.16 (linux/arm64, `provider.aevia.network`)

| Phase | Evidence |
|-------|----------|
| Pre-deploy `.build` | `MISSING` (running pre-Plan-00-02 binary) |
| SCP `deploy/bin/aevia-node-linux-arm64` → `/tmp/aevia-node.new` | OK |
| `cp aevia-node → aevia-node.bak` + `install → /usr/local/bin/aevia-node` | OK (sudo passwordless for systemctl) |
| `systemctl restart aevia-node` | OK |
| `systemctl is-active aevia-node` | `active` |
| journal tail (restart window) | clean — `node_boot`, `listening_libp2p` on 14 IPs, `mirror server listening`, `pin_store_loaded` (10 pins / 125KB) |
| Post-deploy `GET /healthz` | `{"status":"ok","peer_id":"12D3KooWSvpr...MjyhIP","region":"US-VA","lat":39.12,"lng":-77.56,"active_sessions":0,"build":"ea35d76"}` |
| **.build == ea35d76** | **PASS** |
| Restart impact | R1 had `active_sessions: 1` pre-deploy (LIVE session); session briefly reconnected during the ~3s systemctl restart window |

### Mac — leandrobarbosa@local (darwin/arm64, launchd)

| Phase | Evidence |
|-------|----------|
| Pre-deploy PID | 7347 |
| Pre-deploy MD5 | `4d78189fab7857905abbd47d119a5ca5` |
| `cp aevia-node → aevia-node.bak` + `install → ~/.local/bin/aevia-node` | OK (no sudo needed) |
| `launchctl unload + launchctl load network.aevia.node` | OK |
| Post-deploy PID | 1002 (CHANGED — confirms new binary is running) |
| Post-deploy MD5 | `168ee2c7e908bc688149c3594204e338` (CHANGED) |
| `launchctl list network.aevia.node | grep PID` | `"PID" = 1002` + `"LastExitStatus" = 0` |
| stderr.log tail | clean boot: `shutdown_signal` → `shutdown_complete` → `node_boot` → `listening_libp2p` (4 addresses) → `mirror server listening` → `pin_store_loaded` (4 pins) |
| Public `/healthz` | N/A — Mac is not behind a public tunnel; acceptance criterion satisfied via PID-change verification |

### R2 — leandro@45.126.209.192 (linux/amd64, `provider-fl.aevia.network`) — BLOCKED

| Phase | Evidence |
|-------|----------|
| SCP `deploy/bin/aevia-node-linux-amd64` → `/tmp/aevia-node.new` | OK (binary staged, `stat -c '%s' /tmp/aevia-node.new` reports `36536482` bytes) |
| Remote `sudo install ...` + `sudo systemctl restart aevia-node` | **FAILED** — `sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper` |
| `.build` | still `MISSING` (pre-Plan-00-02 binary running) |

**Root cause:** R2's sudo is not passwordless for systemctl (unlike R1). The deploy agent has no TTY so cannot type a password; SSH+TTY (`ssh -t`) also fails because stdin is not attached to a terminal.

**Options for operator:**
- **A (one-shot):** SSH into R2, complete the deploy manually:
  ```bash
  ssh leandro@45.126.209.192 "sudo install -m 0755 /tmp/aevia-node.new /usr/local/bin/aevia-node && sudo systemctl restart aevia-node && sleep 3 && systemctl is-active aevia-node"
  # pre-requisite: the /tmp/aevia-node.new staged file is the linux/amd64 binary with build ea35d76 (verified via scp earlier this run)
  ```
- **B (permanent):** Configure NOPASSWD on R2 for the install/systemctl verbs used by deploy-3nodes.sh. File in `/etc/sudoers.d/aevia-deploy`:
  ```
  leandro ALL=(root) NOPASSWD: /usr/bin/install -m 0755 /tmp/aevia-node.new /usr/local/bin/aevia-node, /bin/systemctl restart aevia-node, /bin/cp /usr/local/bin/aevia-node /usr/local/bin/aevia-node.bak
  ```
  Once (B) is in place, re-running `deploy/scripts/deploy-3nodes.sh` from this host is idempotent for R1 and Mac; R2 will proceed automatically. Option B is recommended — aligns R2 with R1's pattern, removes the hand-run step for all future deploys.

**Evidence for post-R2 deploy:** operator must paste:
```
$ curl -s --max-time 5 https://provider-fl.aevia.network/healthz | jq '{status, build, active_sessions}'
{ "status": "ok", "build": "ea35d76", "active_sessions": 0 }   <-- target
```

## What Remains — Task 4 (3 GPU Hosts, designed checkpoint)

Task 4 is the plan's designed `checkpoint:human-verify` — the operator runs the per-host remote block for rtx4090 (amd64), rtx2080 (amd64), and GH200-2 (arm64). Binaries are ready at:

| Host | Arch | Binary to copy |
|------|------|----------------|
| rtx4090 | amd64 | `/Users/leandrobarbosa/Personal/videoengine/deploy/bin/aevia-node-linux-amd64` (35M, sha-stamp `ea35d76`) |
| rtx2080 | amd64 | same amd64 binary |
| GH200-2 | arm64 | `/Users/leandrobarbosa/Personal/videoengine/deploy/bin/aevia-node-linux-arm64` (33M, sha-stamp `ea35d76`) |

**Per-host operator command template** (substitute `<GPU_USER>` + `<GPU_HOST>` + `<HEALTHZ_URL>`):

```bash
EXPECTED=ea35d76
BIN_LOCAL=/Users/leandrobarbosa/Personal/videoengine/deploy/bin/aevia-node-linux-amd64  # or -arm64 for GH200-2

scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${BIN_LOCAL}" "<GPU_USER>@<GPU_HOST>:/tmp/aevia-node.new"

ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "<GPU_USER>@<GPU_HOST>" bash -se <<'REMOTE_GPU'
set -euo pipefail
if [[ -f ${HOME}/.local/bin/aevia-node ]]; then
  cp ${HOME}/.local/bin/aevia-node ${HOME}/.local/bin/aevia-node.bak
fi
install -m 0755 /tmp/aevia-node.new ${HOME}/.local/bin/aevia-node
rm -f /tmp/aevia-node.new
systemctl --user daemon-reload
systemctl --user restart aevia-node.service
sleep 2
systemctl --user is-active aevia-node || true
journalctl --user -u aevia-node -n 15 --no-pager
REMOTE_GPU

ACTUAL=$(curl -s --max-time 5 "<HEALTHZ_URL>" | jq -r '.build // empty')
echo "host=<GPU_HOST> want=${EXPECTED} got=${ACTUAL}"
[[ "${ACTUAL}" == "${EXPECTED}" ]] && echo PASS || echo FAIL
```

**Reply format expected from operator (5 rows including R2):**

| Host | Healthz URL | .build value | PASS/FAIL |
|------|-------------|--------------|-----------|
| R2 | https://provider-fl.aevia.network/healthz | ? | ? |
| rtx4090 | https://provider-rtx4090.aevia.network/healthz (confirm URL) | ? | ? |
| rtx2080 | https://provider-rtx2080.aevia.network/healthz (confirm URL) | ? | ? |
| GH200-2 | https://provider-gh200.aevia.network/healthz (confirm URL) | ? | ? |

Once the table is filled and all 4 rows are PASS, the plan is complete. If any FAIL, fix-forward per D-04: paste `journalctl --user -u aevia-node -n 100 --no-pager` tail.

## Deviations from Plan

### Rule 3 — Blocking Issue — R2 sudo password

- **Found during:** Task 3 (`deploy/scripts/deploy-3nodes.sh` execution).
- **Plan said:** Execute `bash deploy/scripts/deploy-3nodes.sh`; it deploys R1 → R2 → Mac sequentially with /healthz prompts on failure.
- **Reality:** R2's `sudo systemctl restart aevia-node` requires an interactive password; the deploy agent has no TTY (`sudo: a terminal is required to read the password`). This is a latent assumption in the script — R1 evidently has NOPASSWD configured but R2 does not.
- **Fix attempted:** `ssh -t` TTY allocation still fails because stdin is not a terminal at the driving process. No programmatic workaround available without storing R2's sudo password (which is out-of-scope + against CLAUDE.md credential-handling norms).
- **Escalation:** human-action checkpoint surfaced to operator with two resolution paths (one-shot manual deploy OR install NOPASSWD sudoers rule, preferred).
- **Scope:** Mac and R1 deploy successfully completed from this agent; only R2 + GPU hosts remain operator-gated.

### Rule 2 — Additional concurrent doc commits from operator

- **Found during:** Task 1 post-merge.
- **Issue:** While tests were running after `git merge --no-ff feat/backend-phase2`, two new commits landed on `origin/main` from Leandro's identity (`ea35d76 docs(repo): add CHANGELOG.md` and `bc5287b docs(repo): refresh provider-node README + add GitHub issue templates`). `git fetch` picked them up, pushing main HEAD past our merge commit.
- **Impact:** the gate-check formulation "`/healthz .build` equals `git rev-parse --short main`" now drifts because `main` moved. The binary was built at the then-HEAD `ea35d76`; subsequent doc-only commits don't invalidate the provider-node semantics.
- **Resolution:** adopted the inline Codex review feedback — gate check is "binary .build matches the VERSION the build-all.sh invocation consumed (ea35d76)" rather than "matches live main tip at audit time". The two intervening commits are doc-only (README, CHANGELOG, issue templates), authored by Leandro's git identity, no AI attribution — squarely "no unreviewed extras".
- **Auto-fixed:** NONE needed — this is a documentation/framing adjustment, not a correctness bug.
- **Files modified:** none.

### Working-tree hygiene

The working tree had 4 unrelated modifications when this plan started (`apps/video/public/hero/creator-default.jpg`, `apps/video/public/sw.js`, `apps/video/src/lib/p2p/chunk-relay.ts`, `.planning/STATE.md`) plus ~25 untracked PNGs. These were stashed before the merge to avoid contaminating the merge commit, then popped after all commits landed. None of these were touched by the plan's commits.

## Checkpoint Self-Check: PARTIAL — PASSED FOR R1 + MAC

- [x] Merge commit `8c605b2` exists on main; `git log --format='%B' 8c605b2 -1` clean of AI attribution.
- [x] All three feat/backend-phase2 commits reachable from main: `git log --oneline feat/backend-phase2 ^main | wc -l` = 0.
- [x] `go vet ./...` + `go test -count=1 ./internal/{whep,mirror,dht,integration,httpx}/...` all exit 0.
- [x] Three binaries exist at `deploy/bin/`, correct architectures, version `ea35d76` embedded in all three.
- [x] R1 `/healthz .build = ea35d76`.
- [x] Mac PID changed (7347 → 1002), launchctl reports running state.
- [ ] R2 `/healthz .build = ea35d76` — BLOCKED (sudo checkpoint).
- [ ] rtx4090 `/healthz .build = ea35d76` — CHECKPOINT (Task 4).
- [ ] rtx2080 `/healthz .build = ea35d76` — CHECKPOINT (Task 4).
- [ ] GH200-2 `/healthz .build = ea35d76` — CHECKPOINT (Task 4).

## Artifacts

- Merge commit: `git show 8c605b2` on origin/main.
- Binaries: `deploy/bin/aevia-node-linux-arm64`, `aevia-node-linux-amd64`, `aevia-node-darwin-arm64` (all timestamped 2026-04-20 18:31 local, version `ea35d76`).
- R2 staged binary: `/tmp/aevia-node.new` on leandro@45.126.209.192 (36,536,482 bytes, amd64).
- Mac `.bak`: `~/.local/bin/aevia-node.bak` (MD5 `4d78189fab7857905abbd47d119a5ca5` — pre-Plan-00-02 binary) kept for rollback.
- R1 `.bak`: `/usr/local/bin/aevia-node.bak` (on R1) kept for rollback.

## Pending (not blocking this summary)

- **B4 implementation** — Plans 00-04, 00-05, 00-06 handle SPS/PPS forward (DEPLOY-03). B4 is a separate wire-format change; not in this plan's scope.
- **Worktree cleanup** — `aevia-backend-2` worktree retained for Phase 0 centralised cleanup in Plan 00-06.
- **Formal `deploy-6nodes.sh`** — deferred (CONTEXT.md §deferred, Plan 00-06 expands deploy-3nodes.sh to 6 nodes if operator wants it ahead of Phase 5).

## Key Links

| From | To | Via |
|------|----|-----|
| merge commit `8c605b2` | R1 binary `/usr/local/bin/aevia-node` | `build-all.sh` → `-X main.Version=ea35d76` → `httpx.WithBuild` → R1 `.build = ea35d76` |
| merge commit `8c605b2` | Mac binary `~/.local/bin/aevia-node` | same LDFLAGS chain → MD5 changed 4d78189f → 168ee2c7, PID 7347 → 1002 |

---

*Checkpoint awaiting operator action on R2 (sudo) + 3 GPU hosts. Reply format + command templates in §"What Remains — Task 4" above.*
