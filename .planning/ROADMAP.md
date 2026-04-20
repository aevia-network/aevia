# Roadmap: aevia — Phase 3 Decentralized Viewer Distribution

## Overview

This milestone takes the "zero CDN, outperform CDN" delivery layer from ~60% (backend 100%, frontend preview deployed) to MVP — where any viewer can play an active live session from any of 6+ geo-distributed provider nodes, recover from node kills without reload, and share HLS chunks peer-to-peer. The journey is sequential: first consolidate the debt from the phase-2 parallel agents (deploy pending code to production), then close the audio gap blocking HLS coverage (M9), then ship the two decentralization pillars missing in the client (Circuit Relay v2 and sovereign chunk tracker), then make the client intelligent enough to rank and fail over providers on its own, then harden against long-session edge cases, then prove the whole system works across 3 regions × N viewers. Each phase is one worktree, one branch, one deploy. No speculative work — every REQ-ID has a measurable exit.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, 3, 4, 5, 6): Planned milestone work
- Decimal phases (e.g., 2.1): Reserved for urgent insertions during execution

Phase 0 is deliberately numbered 0 because it is debt-consolidation, not new feature work — a prerequisite that must land before Phase 1+ can run cleanly in production.

- [ ] **Phase 0: Consolidation** — Ship pending phase-2 work to production (frontend merge + backend deploy + B4 completion)
- [ ] **Phase 1: M9 Audio Opus→AAC** — Bundled jellyfin-ffmpeg sidecar sidecar closes HLS audio gap without breaking CGO_ENABLED=0 cross-compile
- [ ] **Phase 2: Circuit Relay v2** — Browser↔browser visibility via libp2p Relay v2; "N in room" chip reflects real peers ≥ 2
- [ ] **Phase 3: Chunk Tracker Sovereignty** — Replace public WebTorrent trackers with owned transport (A/B decision between embedded Go tracker vs patched p2p-media-loader-core)
- [ ] **Phase 4: Client Intelligence** — TypeScript parent-ranker port + upload caps + honest P2P ratio chip
- [ ] **Phase 5: Robustness** — WHEP adaptive ICE + long-session Go test + Playwright stability spec + observable P2PRatio/parentCount metrics
- [ ] **Phase 6: Exit Criteria** — 3-region × 5+ viewer acceptance, node-kill chaos, public ADRs + RFC-10, O(log N) load convergence demonstrated

## Phase Details

### Phase 0: Consolidation
**Goal**: Close the debt left by the two phase-2 parallel agents — merge frontend, push/deploy backend, complete B4 — so Phase 1 starts from a clean production baseline.
**Depends on**: Nothing (first phase, debt-only)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. `feat/frontend-phase2` merged into `main`; `aevia.video` production serves hls.js failover rotation + pubsub-tracker stub; preview URL `f049801b.aevia-video.pages.dev` no longer diverges from prod
  2. `feat/backend-phase2` pushed to origin; B1 (per-viewer WHEP UUID+DELETE) + B2 (DHT expiry + re-announce) + B3 (mirror FU-A gap drop) deployed across all 6 providers; `/healthz` on each returns binary build matching HEAD of `main`
  3. B4 (SPS/PPS forward in mirror protocol header) complete, committed, pushed, and deployed; `TestMirrorHeaderForwardSPS` green; no viewer sees stream-start decode failures when joining mid-session on a mirror-recipient provider
**Plans**: TBD (~2-3 plans)

Plans:
- [ ] 00-01: frontend merge + prod pages deploy
- [ ] 00-02: backend push + cross-compile + 6-node deploy
- [ ] 00-03: B4 SPS/PPS header completion + test + deploy

### Phase 1: M9 Audio Opus→AAC
**Goal**: Close the HLS audio gap blocking Cloudflare Stream and native-iOS playback by shipping Approach B (bundled jellyfin-ffmpeg sidecar in a tarball), preserving the CGO_ENABLED=0 cross-compile invariant.
**Depends on**: Phase 0
**Requirements**: M9-01, M9-02, M9-03, M9-04, M9-05
**Success Criteria** (what must be TRUE):
  1. ADR 0012 published in `docs/adr/` with the Approach B rationale and rejection notes for static libav / wazero / Rust FFI / fmp4+Opus; mirrored in `aevia.network/spec/*`
  2. `aevia-node-v0.1.0-{os}-{arch}.tar.gz` built for darwin-arm64 + linux-arm64 + linux-amd64 + windows-amd64; Go binary stays ~15 MB, total tarball ~50 MB, `LICENSES.md` includes FFmpeg LGPLv2.1 + jellyfin-ffmpeg attribution
  3. Viewer playing HLS via VLC, ffplay, native iOS Safari, and Chrome hears continuous audio throughout a 5-minute live session; `/live/{id}/hls/index.m3u8` carries both video and AAC audio tracks
  4. Operator onboarding is a single command pair (`tar xf ... && ./aevia-node`) on Linux/macOS; Windows equivalent documented in pt-BR quickstart
**Plans**: TBD (~3-4 plans)

Plans:
- [ ] 01-01: ADR 0012 + transcoder design doc
- [ ] 01-02: `internal/audio/transcoder.go` + pion/opus decoder wiring + gohlslib audio track integration
- [ ] 01-03: `deploy/scripts/package.sh` tarball pipeline + per-arch jellyfin-ffmpeg fetch + LICENSES + config template
- [ ] 01-04: docs pt-BR quickstart update + Windows variant

### Phase 2: Circuit Relay v2
**Goal**: Make browser↔browser visibility real by enabling libp2p Circuit Relay v2 on provider nodes and wiring reservation flow in the browser, so two browsers in the same `aevia-live-{sessionId}` topic actually see each other (precondition for real P2P chunk relay).
**Depends on**: Phase 1 (providers rebuilt with audio transcoder; relay service added alongside)
**Requirements**: RELAY-01, RELAY-02, RELAY-03
**Success Criteria** (what must be TRUE):
  1. `libp2p.EnableRelayService(...)` active on all 6 providers; each advertises relay service in its multiaddr set visible via `/healthz`
  2. Frontend `p2p.ts` accepts `relayDialAddrs` option; browser reserves a relay slot within 3s of `initMesh` return; reservation renews automatically before expiry
  3. Two browsers opening the same live session show chip `p2p · N conectado · ≥2 na sala`; either (a) the GossipSub registrar reciprocity bug (3.1-followup.e) is fixed upstream-or-via-patch with non-regression evidence, or (b) a formal deferral ADR documents the cosmetic-only impact with measurement proof
**Plans**: TBD (~2-3 plans)

Plans:
- [ ] 02-01: provider-node relay service enablement + multiaddr advertising
- [ ] 02-02: browser reservation flow + renewal + relayDialAddrs option
- [ ] 02-03: gossipsub registrar reciprocity resolution (patch + test, or deferral ADR)

### Phase 3: Chunk Tracker Sovereignty
**Goal**: Replace public WebTorrent trackers (`tracker.openwebtorrent.com` etc) with an owned transport — either an embedded BitTorrent WSS tracker in the provider node (route A) or a patched `p2p-media-loader-core` using the existing GossipSub topic (route B). Decision made formally inside plan-phase with research-backed A/B comparison.
**Depends on**: Phase 2 (Relay v2 required for real browser-to-browser chunk exchange)
**Requirements**: TRK-01, TRK-02, TRK-03
**Success Criteria** (what must be TRUE):
  1. ADR published selecting route A or B, with measured trade-offs across backend-LOC, fork-maintenance burden, sovereignty cleanliness, and upgrade exposure
  2. `apps/video/src/lib/p2p/chunk-relay.ts` no longer references any public tracker domain; tracker path is fully under `aevia.network` or via the `aevia-live-{sessionId}` GossipSub topic
  3. `pubsub-tracker.ts` stub + `?tracker=pubsub` feature flag removed; `git grep "openwebtorrent\|tracker.files.fm"` returns zero hits in `apps/video/src/`
  4. Two viewers on the same live exchange at least one HLS chunk via the owned tracker within 30s of joining, verified by debug logs and `P2PRatio > 0`
**Plans**: TBD (~3-4 plans)

Plans:
- [ ] 03-01: ADR A/B research + formal decision
- [ ] 03-02: implementation of chosen route (backend or frontend scope)
- [ ] 03-03: stub + feature flag removal + chunk-relay integration
- [ ] 03-04: two-viewer integration test + `P2PRatio > 0` validation

### Phase 4: Client Intelligence
**Goal**: Make the browser client smart — port the Go mirror ranker to TypeScript so the viewer re-parents on its own under drift, add honest upload caps and battery/visibility pauses, and make the P2P indicator truthful (L1 sage only when `P2PRatio > 0`).
**Depends on**: Phase 3 (P2PRatio signal must exist and be non-trivial for the ranker to act on)
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03
**Success Criteria** (what must be TRUE):
  1. TS ranker drops or re-parents a peer within 3s after either sustained P95 drift 1.5× baseline for 30s OR 5 consecutive lost probes; max 3-hop depth enforced; behavior matches Go reference on a shared scenario set
  2. Upload cap at 20% of `RTCPeerConnection.getStats()` available bandwidth enforced; upload pauses within 1s of `document.hidden` becoming true OR `battery.charging` going false; resumes on reversal
  3. `PermanenceStrip` shows "servindo N pares" chip only when `P2PRatio > 0`; the L1 sage indicator never lies (visual honesty check passes manual inspection)
**Plans**: TBD (~2-3 plans)

Plans:
- [ ] 04-01: TS port of `mirror.Ranker` (closest to Go reference, with parity tests)
- [ ] 04-02: upload cap + visibility/battery pause hooks
- [ ] 04-03: PermanenceStrip chip + L1 honesty gate + UI QA

### Phase 5: Robustness
**Goal**: Replace the "force TURN" band-aid with state-of-the-art adaptive ICE, add a long-session Go regression guard, wire Playwright stability spec, and make P2PRatio/parentCount observable so silent degradation never hides.
**Depends on**: Phase 4 (needs ranker in place so ICE restart can preempt-but-not-override parent selection)
**Requirements**: ICE-02, TEST-01, TEST-02, OBS-01
**Success Criteria** (what must be TRUE):
  1. WHEP uses trickle ICE by default; getStats()-driven candidate-pair degradation detection triggers `pc.restartIce({iceTransportPolicy:'relay'})` only on sustained 2s+ problems; direct path latency preserved on healthy networks
  2. `apps/video/e2e/whep-stability.spec.ts` passes — 2 minutes live with no transition out of `{connecting, connected}` against a synthetic production live session; gated in CI when synthetic infra is green
  3. `TestWhepLongSessionStability` Go test passes — 5 min WHIP+WHEP single viewer, packet continuity asserted, no hub starvation / RTP stall / session leak
  4. `P2PRatio` and `parentCount` are visible on `/healthz` and/or Sentry custom metrics; a dashboard query can answer "over the last 24h, did viewers silently degrade to provider-only?"
**Plans**: TBD (~3-4 plans)

Plans:
- [ ] 05-01: adaptive ICE implementation + regression tests
- [ ] 05-02: Go long-session stability test
- [ ] 05-03: Playwright whep-stability spec + CI gating spec
- [ ] 05-04: observability plumbing (P2PRatio + parentCount endpoint or metrics)

### Phase 6: Exit Criteria
**Goal**: Prove the whole system works in production across 3 regions × 5+ viewers, chaos-test node-kill recovery, publish ADRs + RFC-10, and demonstrate O(log N) origin-load convergence vs O(N) CDN baseline. This is the acceptance gate — no new features, only proofs.
**Depends on**: Phase 5
**Requirements**: EXIT-01, EXIT-02, EXIT-03, EXIT-04, EXIT-05
**Success Criteria** (what must be TRUE):
  1. 3-region × 5+ concurrent-viewer live session sustained `P2PRatio > 0`; a SIGKILL on the serving provider causes viewer recovery via DHT in < 10s end-to-end with no user action
  2. `aevia.video/live/mesh/{id}?hls=1` serves HLS from any ranker-selected provider; each provider's `/healthz` exposes `active_sessions + region + geo + rtt_p50`
  3. ADRs 0010/0011/0012 plus RFC-10 (mirror protocol) published in `docs/protocol-spec/`, mirrored in `aevia.network/spec/*`, and linked from the site navigation
  4. End-to-end 3 regions × 10 viewers measurement shows origin load growing sub-linearly (O(log N) trend-fit) vs a control CDN run growing linearly; results captured in a public post-mortem artifact
**Plans**: TBD (~3 plans)

Plans:
- [ ] 06-01: 3-region acceptance test harness + run + report
- [ ] 06-02: node-kill chaos test harness + run
- [ ] 06-03: ADRs + RFC-10 documentation + site publication + measurement dashboard

## Progress

**Execution Order:**
Phases execute sequentially: 0 → 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Consolidation | 0/TBD | Not started | - |
| 1. M9 Audio | 0/TBD | Not started | - |
| 2. Circuit Relay v2 | 0/TBD | Not started | - |
| 3. Chunk Tracker Sovereignty | 0/TBD | Not started | - |
| 4. Client Intelligence | 0/TBD | Not started | - |
| 5. Robustness | 0/TBD | Not started | - |
| 6. Exit Criteria | 0/TBD | Not started | - |

Plan counts refine during `/gsd-plan-phase <N>`. TBD is the correct initial state.
