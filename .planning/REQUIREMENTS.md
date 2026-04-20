# Requirements: aevia — Phase 3 Decentralized Viewer Distribution

**Defined:** 2026-04-20
**Core Value:** A viewer must start and sustain playback of an active live session as long as at least one mesh provider is healthy — no reload, no perceived failure, with active P2P chunk sharing.

## v1 Requirements

### Deploy (Phase 0 — Consolidation)

- [ ] **DEPLOY-01**: Merge `feat/frontend-phase2` into main + redeploy `aevia.video` Cloudflare Pages (promotes hls.js failover rotation + pubsub-tracker stub + Playwright smoke)
- [ ] **DEPLOY-02**: Push `feat/backend-phase2` to origin; cross-compile ARM64 + AMD64 + Darwin; deploy B1+B2+B3 across all 6 providers
- [ ] **DEPLOY-03**: Complete B4 (SPS/PPS forward in mirror protocol header) via relaunched agent or manual continuation

### M9 Audio (Phase 1 — Opus→AAC transcode)

- [ ] **M9-01**: ADR 0012 documenting Approach B (bundled jellyfin-ffmpeg sidecar in tarball) with rejected-routes rationale
- [ ] **M9-02**: `services/provider-node/internal/audio/transcoder.go` wrapping `exec.Command("./ffmpeg" ...)` stdin Opus RTP → PCM → stdout AAC-ADTS, integrated with `gohlslib.Track` audio
- [ ] **M9-03**: `deploy/scripts/package.sh` producing `aevia-node-v0.1.0-{os}-{arch}.tar.gz` with Go binary + jellyfin-ffmpeg LGPL-static + LICENSES.md + config.default.toml
- [ ] **M9-04**: Pure-Go `pion/opus` decoder wired for Opus RTP → PCM 48kHz stereo
- [ ] **M9-05**: Operator quickstart docs in pt-BR (`tar xf && cd aevia-node && ./aevia-node`), Windows `.exe` variant documented

### Relay (Phase 2 — Circuit Relay v2 browser↔browser visibility)

- [ ] **RELAY-01**: `libp2p.EnableRelayService(...)` enabled on provider-node config — public providers become relay nodes for browsers
- [ ] **RELAY-02**: Frontend `p2p.ts` gains `relayDialAddrs` option + libp2p Circuit Relay v2 reservation flow
- [ ] **RELAY-03**: Resolve or definitively defer the GossipSub registrar reciprocity bug (3.1-followup.e) with non-regression evidence — "N in room" chip must reflect real peers ≥ 2

### Tracker (Phase 3 — P2P chunk relay sovereignty)

- [ ] **TRK-01**: A/B decision formalized in `/gsd-plan-phase` between embedded BT WSS tracker (backend) vs pnpm-patch p2p-media-loader-core (frontend), selected route captured in ADR
- [ ] **TRK-02**: Implementation of the chosen route replacing public WebTorrent trackers in `chunk-relay.ts`
- [ ] **TRK-03**: Remove `pubsub-tracker.ts` stub and `?tracker=pubsub` feature flag after cutover

### Client (Phase 4 — Client intelligence)

- [ ] **CLIENT-01**: TypeScript port of `services/provider-node/internal/mirror.Ranker` with automatic re-parent on sustained P95 drift 1.5× baseline 30s OR ≥ 5 lost probes, max 3-hop depth
- [ ] **CLIENT-02**: Upload cap at 20% via `RTCPeerConnection.getStats()` — pause on `document.hidden` OR `navigator.getBattery().charging === false`
- [ ] **CLIENT-03**: "Serving N peers" chip on `PermanenceStrip`; L1 sage indicator lights up only when `P2PRatio > 0`

### Robustness (Phase 5 — Stability + adaptive ICE + tests)

- [ ] **ICE-02**: WHEP adaptive ICE — trickle ICE + `getStats()` candidate-pair monitoring + `pc.restartIce({iceTransportPolicy:'relay'})` on sustained 2s+ degradation; replaces "force TURN" band-aid
- [ ] **TEST-01**: `apps/video/e2e/whep-stability.spec.ts` — 2min with no transition out of `{connecting, connected}`, CI-gated once synthetic production live exists
- [ ] **TEST-02**: `TestWhepLongSessionStability` Go — 5min WHIP+WHEP single viewer with packet-continuity assertion
- [ ] **OBS-01**: `P2PRatio` + `parentCount` published as endpoint or Sentry custom metrics

### Exit Criteria (Phase 6 — Acceptance)

- [ ] **EXIT-01**: Live session tested across 3 regions (BR + US-east + US-west) with 5+ concurrent viewers, sustained `P2PRatio > 0`, zero-reload provider-kill failover validated end-to-end
- [ ] **EXIT-02**: Node-kill chaos test — random provider-node SIGKILL during 2min live; viewers re-route via DHT in < 10s and recover playback
- [ ] **EXIT-03**: `aevia.video/live/mesh/{id}?hls=1` serves HLS from any ranker-selected provider; each `/healthz` exposes `active_sessions + region + geo + rtt_p50`
- [ ] **EXIT-04**: Public docs — ADRs 0010/0011/0012 + RFC-10 (mirror protocol) published in `docs/protocol-spec/` and mirrored in `aevia.network/spec/*`
- [ ] **EXIT-05**: End-to-end metrics demonstrated across 3 regions × 10 viewers: O(log N) origin load convergence vs O(N) CDN baseline

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Codec Coverage (Future milestone — Phase 4 of the mesh roadmap)

- **VP9-01**: Extend CMAFSegmenter for VP9 packaging — Chrome Android without H.264 HW encoder
- **VP8-01**: VP8 fallback for legacy Firefox Linux without H.264
- **AV1-01**: AV1 ingest support (Chrome 102+, Safari 17+; royalty-free, 30-50% better than H.264)

### GH200 GPU Pipeline (Future milestone — Phase 4b)

- **NVENC-01**: NVENC multi-codec transcoder on Relay 1 (H.264 re-encode + VP9 + AV1)
- **AI-MOD-01**: Realtime Whisper-large audio classification + CLIP/SigLIP thumbnail classification + small-LLM judge feeding R_values into RiskOracle
- **VOD-WHS-01**: Whisper-large VOD transcription generating `manifest.subtitles.vtt` and indexable full-text search

### P2P Extensions (Future — Sprint 6+)

- **POR-01**: Proof-of-Relay — viewers sign EIP-712 receipts of bytes delivered, aggregator contract, PersistencePool integration (requires external audit)
- **MSTREAM-01**: MediaStream relay WHEP viewer→viewer (deferred by design — PeerTube abandoned)

## Out of Scope

Explicitly excluded from Phase 3 milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Base mainnet deployment | Requires external contract audit; this milestone stays on Base Sepolia |
| Live chat on the player | Socket-based feature; Phase 3 focuses on video delivery |
| Ponder/Go indexer service | Handled by parallel economic-stack track (§19 of TODO.md) |
| iframe embed SDK | Commercial item; requires confirmed pilot customer |
| Server-side VOD clipping | Sprint 5+; viral nice-to-have, not delivery-critical |
| WebRTC Insertable Streams / DRM | Enterprise-specific; only if customer explicitly requests |
| js-libp2p uTP / raw TCP | Browser libp2p is WebSockets-only by design |
| HTTP↔libp2p bridge for NAT-bound home providers | Phase 2 / Sprint 5 of architectural roadmap; this milestone assumes 6 public providers |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 0 | Pending |
| DEPLOY-02 | Phase 0 | Pending |
| DEPLOY-03 | Phase 0 | Pending |
| M9-01 | Phase 1 | Pending |
| M9-02 | Phase 1 | Pending |
| M9-03 | Phase 1 | Pending |
| M9-04 | Phase 1 | Pending |
| M9-05 | Phase 1 | Pending |
| RELAY-01 | Phase 2 | Pending |
| RELAY-02 | Phase 2 | Pending |
| RELAY-03 | Phase 2 | Pending |
| TRK-01 | Phase 3 | Pending |
| TRK-02 | Phase 3 | Pending |
| TRK-03 | Phase 3 | Pending |
| CLIENT-01 | Phase 4 | Pending |
| CLIENT-02 | Phase 4 | Pending |
| CLIENT-03 | Phase 4 | Pending |
| ICE-02 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| OBS-01 | Phase 5 | Pending |
| EXIT-01 | Phase 6 | Pending |
| EXIT-02 | Phase 6 | Pending |
| EXIT-03 | Phase 6 | Pending |
| EXIT-04 | Phase 6 | Pending |
| EXIT-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

Validated requirements from prior Phases 0/1/2 (13 items) are captured in PROJECT.md `## Requirements → ### Validated` and do not appear here — they are premises for Phase 3, not scope to deliver.

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 after initial definition during GSD brownfield ingest*
