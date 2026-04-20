# aevia — phase 3: decentralized viewer distribution to production

## What This Is

aevia is a sovereign live and persistent video protocol built on WHIP/WHEP + libp2p + Base L2 + Cloudflare R2/Stream. This milestone (Phase 3) delivers the **decentralized distribution layer** where viewers pull HLS and WHEP from a mesh of 6+ geo-distributed provider nodes, with automatic failover when a node dies, P2P chunk relay between nearby viewers, and zero single-CDN dependency on the delivery path. It complements — but does not replace — the origin ingest backend (WHIP publisher path).

## Core Value

**A viewer must start and sustain playback of an active live session as long as at least one provider node in the mesh is healthy, with no reload, no perceived failure, and with P2P chunk sharing reducing aggregate load on providers in multi-viewer setups.** If everything else fails, this cannot fail — it is the delivery-path materialization of the thesis "persistence ≠ distribution".

## Requirements

### Validated

<!-- Shipped to production (6 active providers: Relay 1 US-VA GH200, Relay 2 US-FL AMD, Mac BR-PB, rtx4090 BR-SP, rtx2080 BR-SP, GH200-2 US-VA). -->

- ✓ **REQ-ING-01**: WHIP publish via pion SFU in provider node (Hello Live — Sprint 1)
- ✓ **REQ-HLS-01**: HLS origin path via gohlslib + CMAF segmenter + MPEG-TS (Phase 0.3 + 3.1-followup.h)
- ✓ **REQ-HLS-02**: LL-HLS EXT-X-PART (2s parts, EXT-X-VERSION:9) targeting ~3-4s latency (Phase 0.3)
- ✓ **REQ-MIR-01**: Cross-provider RTP mirror via libp2p stream `/aevia/mirror/rtp/1.0.0` with honest hop latency via RTT echo-back sub-protocol (Phase 2.1 + 2.2a)
- ✓ **REQ-MIR-02**: Mirror-side HLSMuxer — every mirror recipient also serves `/live/{id}/hls/*` after receiving demuxed NALs via `FrameSink` (Phase 3.1-followup.i, ADR 0011)
- ✓ **REQ-MIR-03**: NACK/seq tracking in the mirror protocol — FU-A gap drop prevents corrupt reassembly in lossy networks (Phase 3.1-followup.h, RTCP NACK + default interceptors)
- ✓ **REQ-DHT-01**: Provider discovery via Kademlia — viewer resolves `sessionCID` to a peerID list with no centralized HTTP route (commit `86466b1`)
- ✓ **REQ-RANK-01**: Mirror ranker scoring `α·rtt + β·load + γ·region_penalty` with continent-aware Haversine fallback and peer cooldown after 5 probe losses (Phase 2.2b-e)
- ✓ **REQ-FAIL-01**: Viewer failover via DHT candidates — `playWhepWithFailover` orchestrates `connectTimeout=6s` + `silenceTimeout=8s` + srcObject swap with zero reload (Phase 2.3)
- ✓ **REQ-P2P-01**: Browser libp2p scaffold — Next.js dynamic import of `@libp2p/websockets` + Noise + Yamux + GossipSub + bootstrap to 3 public WSS nodes (Phase 3.1)
- ✓ **REQ-MESH-01**: Provider-node GossipSub backbone — topic `aevia-live-{sessionId}` reusable as chunk-tracker transport without a new route (Phase 3.1-followup.d)
- ✓ **REQ-SIG-01**: Manifest signing via EIP-191 on WHIP — creator signs the SDP offer, provider validates via ecrecover (Phase 0.1)
- ✓ **REQ-ICE-01**: WHEP `disconnected` treated as transient (only `failed`/`closed` tear down); silence safety-net cap removed; `iceTransportPolicy` configurable (Phase 3.1-followup.f)

### Active

<!-- Scope for the Phase 3 MVP "acceptable decentralized viewer in production". Organized as 6 sequential phases, with intra-phase parallelization when possible. -->

**Phase 0 — Consolidation (deploy pending work from phase-2 agents)**

- [ ] **REQ-DEPLOY-01**: Merge `feat/frontend-phase2` into `main` + redeploy `aevia.video` Pages to production (promotes F2 hls.js failover rotation + F3 pubsub-tracker stub + F4 Playwright smoke)
- [ ] **REQ-DEPLOY-02**: Push `feat/backend-phase2` to origin; cross-compile ARM64 + AMD64 + Darwin; deploy B1 (WHEP per-viewer UUID + DELETE) + B2 (DHT expiry + re-announce 10min) + B3 (mirror FU-A gap drop) across the 6 providers
- [ ] **REQ-DEPLOY-03**: Relaunch agent or continue manually to close **B4** (SPS/PPS forward in the mirror protocol header) — completes spec compliance for the mirror protocol

**Phase 1 — M9 audio Opus→AAC (research-backed, Approach B)**

- [ ] **REQ-M9-01**: ADR 0013 documenting the choice of Approach B (bundled jellyfin-ffmpeg sidecar in a single tarball) over rejected alternatives (static libav in-process, wazero WASM, Rust FFI, fmp4+Opus). Note: ADR 0012 is claimed by Phase 0 B4 wire format Route A.
- [ ] **REQ-M9-02**: `services/provider-node/internal/audio/transcoder.go` — wrapper over `exec.Command("./ffmpeg" ...)` with stdin Opus RTP → PCM → stdout AAC-ADTS, integrated with `gohlslib.Track` audio
- [ ] **REQ-M9-03**: `deploy/scripts/package.sh` packages the release tarball `aevia-node-v0.1.0-{os}-{arch}.tar.gz` containing the Go binary + jellyfin-ffmpeg LGPL-static per arch + `LICENSES.md` + `config.default.toml`
- [ ] **REQ-M9-04**: Pure-Go `pion/opus` decoder wired for Opus RTP → PCM 48kHz stereo (replaces placeholder)
- [ ] **REQ-M9-05**: Operator quickstart docs updated in pt-BR — `tar xf && cd aevia-node && ./aevia-node` as a single line, Windows `.exe` variant

**Phase 2 — Browser mesh visibility (3.1c Circuit Relay v2)**

- [ ] **REQ-RELAY-01**: `libp2p.EnableRelayService(...)` on the provider-node config — public providers become relay nodes for browsers
- [ ] **REQ-RELAY-02**: Frontend `p2p.ts` gains a `relayDialAddrs` option + reservation flow via libp2p Circuit Relay v2
- [ ] **REQ-RELAY-03**: Resolve the upstream cosmetic bug 3.1-followup.e (GossipSub registrar reciprocity) OR document definitive deferral with non-regression evidence — the "N in room" chip must reflect real peers ≥ 2

**Phase 3 — P2P chunk relay sovereignty (3.2b)**

- [ ] **REQ-TRK-01**: A/B decision formalized in `/gsd-plan-phase` between route 3.2b-A (embedded BitTorrent WSS tracker in the provider node, ~400 LOC Go, clean sovereignty, backend work) vs 3.2b-B (pnpm-patch `p2p-media-loader-core` exposing `trackerClientConstructor`, ~20 LOC upstream diff, zero new backend but fork maintenance)
- [ ] **REQ-TRK-02**: Implementation of the chosen route — replaces public WebTorrent trackers (`tracker.openwebtorrent.com` and similar) in `chunk-relay.ts`
- [ ] **REQ-TRK-03**: Remove the `pubsub-tracker.ts` stub and the `?tracker=pubsub` feature flag — cut over to the real implementation

**Phase 4 — Client intelligence (3.4 + 3.5)**

- [ ] **REQ-CLIENT-01**: Port `services/provider-node/internal/mirror.Ranker` (shipped in 2.2b-e, RFC-8 §7) to TypeScript — automatic re-parent on sustained P95 drift 1.5× baseline for 30s OR ≥ 5 lost probes, max 3-hop depth
- [ ] **REQ-CLIENT-02**: Upload cap at 20% via `RTCPeerConnection.getStats()` — pause when `document.hidden` OR `navigator.getBattery().charging === false`
- [ ] **REQ-CLIENT-03**: "Serving N peers" chip on `PermanenceStrip`; the L1 sage indicator lights up **only** when `P2PRatio > 0` (visual honesty — never lie about P2P being active)

**Phase 5 — Robustness + test harness**

- [ ] **REQ-ICE-02**: WHEP adaptive ICE — trickle ICE + `getStats()` candidate-pair monitoring + `pc.restartIce({iceTransportPolicy:'relay'})` under sustained 2s+ degradation. Replaces the "force TURN" band-aid while preserving direct-path latency on healthy networks
- [ ] **REQ-TEST-01**: `apps/video/e2e/whep-stability.spec.ts` — 2min with no transition out of `{connecting, connected}`, CI-gated once a synthetic production live stream exists
- [ ] **REQ-TEST-02**: `TestWhepLongSessionStability` Go — 5min WHIP+WHEP with a single viewer, packet-continuity assertion; catches hub starvation, RTP stall, session leak
- [ ] **REQ-OBS-01**: `P2PRatio` + `parentCount` published as an endpoint or Sentry custom metrics — without this we cannot detect silent degradation to a provider-only path in production

**Phase 6 — Exit criteria (acceptance)**

- [ ] **REQ-EXIT-01**: Live session tested across 3 regions (BR + US-east + US-west) with 5+ concurrent viewers, sustained `P2PRatio > 0`, zero-reload provider-kill failover validated end to end
- [ ] **REQ-EXIT-02**: Node-kill chaos test — random provider-node SIGKILL during a 2-minute live; viewers re-route via DHT in < 10s and recover playback
- [ ] **REQ-EXIT-03**: `aevia.video/live/mesh/{id}?hls=1` serves HLS from any of the 6+ ranker-selected providers; every provider's `/healthz` response exposes `active_sessions + region + geo + rtt_p50`
- [ ] **REQ-EXIT-04**: Public docs — ADRs 0010/0011/0012/0013 + RFC-10 (mirror protocol) published in `docs/protocol-spec/` and mirrored in `aevia.network/spec/*`
- [ ] **REQ-EXIT-05**: End-to-end metrics shown across 3 regions × 10 viewers: O(log N) convergence of origin load vs the O(N) CDN baseline

### Out of Scope

<!-- Explicit exclusions with reasoning, to prevent re-addition. -->

- **Phase 3.3 MediaStream relay WHEP viewer→viewer** — negative ROI; PeerTube tried and abandoned. Phase 3 delivers the P2P ratio via chunk relay (3.2) without WebRTC renegotiation complexity
- **Phase 3.6 Proof-of-Relay anti-free-rider** — Sprint 6+ scope; requires external audit (~$50-100k); does not gate decentralized viewer MVP
- **Phase 4 codec coverage (VP9/VP8/AV1 packaging)** — separate milestone after Phase 3 MVP; H.264 covers >95% of the current TAM
- **Phase 4b GH200 GPU pipeline (NVENC multi-codec, AI moderation, Whisper VOD)** — separate post-seed milestone; hardware idle on Relay 1 but Phase 3 completion is the priority
- **Base mainnet deployment** — blocked on external contract audit; this milestone stays on Base Sepolia
- **Live chat on the player** — deferred; Phase 3 focuses on video delivery, not socket-based features
- **Ponder/Go indexer service** — Phase 19 (economic stack wiring) handles this on a parallel track outside this milestone
- **iframe embed SDK** — commercial item from OPPORTUNITY.md §4.1; requires a confirmed pilot customer; does not gate Phase 3 MVP
- **Server-side VOD clipping** — Sprint 5+; viral nice-to-have; does not gate distribution
- **WebRTC Insertable Streams for DRM** — only if a customer explicitly requests it; enterprise-specific scope
- **js-libp2p uTP / raw TCP** — browser libp2p is WebSockets-only by design; no alternative browser transport
- **Relay v2 HTTP↔libp2p bridge for NAT-bound home provider nodes** — Phase 2 / Sprint 5 of the architectural roadmap (~3 days); this milestone assumes 6 public providers

## Context

**Advanced brownfield.** The repository already carries:

- **Shipped stack** documented in `.planning/codebase/` (ARCHITECTURE, CONCERNS, CONVENTIONS, INTEGRATIONS, STACK, STRUCTURE, TESTING) generated via `/gsd-map-codebase` on 2026-04-20
- **Source-of-truth roadmap** at `/Users/leandrobarbosa/Personal/aevia-planning/TODO.md` §18 — "zero CDN, outperform CDN", 142KB, last updated 2026-04-20
- **Parked future items** in `OPPORTUNITY.md` (esports/gaming niche) — out of scope here
- **Economic stack** deployed on Base Sepolia (ContentRegistry + PersistencePool + RiskOracle + BoostRouter + 3 2-of-2 Gnosis Safes) — consumed via parallel tracks (§19 of the TODO)
- **6 active production providers**: Relay 1 ARM GH200 US-VA, Relay 2 AMD US-FL, Mac BR-PB, rtx4090 BR-SP, rtx2080 BR-SP, GH200-2 US-VA
- **3 public WSS bootstraps** via CF Zero Trust: `libp2p-fl.aevia.network`, `libp2p-br.aevia.network`, plus one pending (GPU hosts)
- **Active worktrees**: `aevia-backend-2` (feat/backend-phase2, 3 local commits + B4 incomplete), `aevia-frontend-phase2` (feat/frontend-phase2, pushed, preview deployed, production pending). The `aevia-phase-1.1` worktree was removed on 2026-04-20 (zero commits ahead of main, ghost)

**Architectural decisions already normative** in RFC-0 (6-layer architecture), RFC-3 (DID auth), RFC-6 (Risk Score), RFC-7 (Moderation Jury), RFC-8 (Economic Architecture), RFC-9 (Live Ingest). Phase 3 can treat these RFCs as premises.

**M9 research** (Opus→AAC) concluded on 2026-04-20 via a 10-thread deep dive — Approach B chosen with evidence from Apple Developer Forums (fmp4+Opus breaks iOS), Red Hat legal clearance (AAC-LC patent expiry in 2017), and the bundled-sidecar industry pattern (Plex/Jellyfin/OBS). Rejected routes captured with clear rationale.

**Critical observability gap**: without `P2PRatio` and `parentCount` emitted as metrics, Phase 3 can silently degrade to a provider-only path in production. REQ-OBS-01 closes this before we declare the MVP complete.

## Constraints

- **Stack (invariant, gated by ADR)**: Cloudflare-only hosting (Pages + Workers + R2 + Stream + KV), **zero Vercel**; Next.js 15 App Router + TypeScript + Tailwind 4 + shadcn/ui; Go 1.26 + go-libp2p + pion; Foundry + Solidity 0.8.24 + Cancun EVM; Base L2 Sepolia
- **Build invariant**: `CGO_ENABLED=0` cross-compile on macOS producing 3 targets (darwin-arm64 + linux-arm64 + linux-amd64) in a single shell with no Docker. The M9 audio pipeline MUST NOT break this — the reason Approach B was chosen over static libav in-process
- **Formatting**: Biome 1.9 (not ESLint+Prettier); git hooks via lefthook (not Husky); runtime pinning via mise (`mise.toml`)
- **Language**: user-facing copy in lowercase pt-BR; code identifiers, comments and planning/ADR/spec docs in English; protocol spec in English RFC 2119 style; commit messages in English Conventional Commits. Chat with the founder stays in pt-BR by default
- **Design system**: Stitch project `12044695711077109600`, DS "Aevia — Sovereign Editorial" — Verdigris primary, Creamy Gold secondary, Sage tertiary (mesh indicators), Ink/Bone background, Garnet error. Radius ≤ 8px. Sora for headlines, Inter for body, Geist for labels. No-Line rule (1px borders forbidden except the 2px primary_dim Live Tile). Lucide icons only
- **AUP**: hard exclusions enforced in the R_values score; does not block bits on IPFS, but blocks pinning subsidy and ranking boost
- **Authorship**: no `Co-Authored-By`, no references to AI tools, no vendor attribution. Identity comes from `git config` only
- **Performance**: WHIP glass-to-glass target ~1-2s (vs Twitch 5-10s, Kick 3-5s); HLS target ~3-4s via LL-HLS EXT-X-PART; viewer failover < 10s; mirror hop latency p50 < 120ms on BR↔US paths
- **Security**: `AEVIA_DEV_BYPASS_AUTH=true` must never leak into a production build (`NEXT_PUBLIC_*` vars are inlined at build time — already a documented incident class in memory `feedback_env_local_leak_prod.md`)
- **Compatibility**: HLS must play on native iOS + Safari + Chrome + Firefox on both desktop and mobile; the reason fmp4+Opus was rejected for M9 (breaks 100% of iOS)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| M9 audio via Approach B (bundled jellyfin-ffmpeg sidecar in tarball) | Preserves `CGO_ENABLED=0` cross-compile; industry convergence (Plex/Jellyfin/OBS); AAC-LC patent expiry 2017 removes the FDK-AAC need; rejected routes: static libav (2-3 week bring-up), wazero WASM (GPLv3 + slow), Rust FFI (2 stacks). | — Pending (Phase 1 impl) |
| Phase 3 MVP scope = 3.1c + 3.1d deploy + 3.1e + 3.2b + 3.4 + 3.5 + M9 + E2E suite | Minimum viable cut for "viewer pulls from any provider with no reload + active P2P chunk sharing". 3.3 and 3.6 deferred due to negative ROI / audit scope. | — Pending |
| 3.2b route A vs B decided in `/gsd-plan-phase` | The A/B tradeoff (backend scope vs fork maintenance) cannot be settled without a formal ADR; parked for the planning phase with research-backed comparison | — Pending |
| Mirror-side HLSMuxer on every provider (ADR 0011, shipped 2026-04-19) | Origin-failure tolerance — any mesh provider serves HLS as long as mirror RTP arrives. Eliminates single-point-of-failure on the WHIP publisher | ✓ Good |
| gohlslib v2.2.9 (MediaMTX-derived) over hand-rolled CMAFSegmenter (ADR 0010) | MIT license, production-tested (MediaMTX); resolved Chrome macroblock errors when combined with splitAnnexBNALs + RTCP NACK interceptors | ✓ Good |
| RTT echo-back sub-protocol (Phase 2.2a) over NTP-drift wall clocks | NTP-based wall-clock hop latency was lying by 4.2× (US-VA→Mac showed 26.6ms real=110ms); echo-back with a 16-byte ProbeID fixed it without any time-dependency | ✓ Good |
| libp2p WSS-only transport in the browser | WebSockets is the only browser-safe transport; browser QUIC is still immature; CF Tunnel + Caddy covers WSS for NAT-bound nodes | ✓ Good |
| Per-phase worktree strategy | `aevia-backend-2` + `aevia-frontend-phase2` active; `aevia-phase-1.1` removed 2026-04-20 (zero commits ahead of main, ghost). Each phase in this milestone can spawn its own worktree via `use_worktrees=true` in config.json | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → move to Out of Scope with reason
2. Requirements validated? → move to Validated with phase reference
3. New requirements emerged? → add to Active
4. Decisions to log? → add to Key Decisions
5. "What This Is" still accurate? → update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-20 after GSD initialization (brownfield ingest: Phase 3 of the "zero CDN, outperform CDN" roadmap, 6 production providers, 2 in-flight phase-2 worktrees, M9 research concluded)*
