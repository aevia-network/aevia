# Changelog

All notable changes to the aevia protocol and reference clients. Format based on [Keep a Changelog](https://keepachangelog.com). Versioning will follow SemVer once the first release tag is cut.

Every bullet is a commit hash reachable in `main` — `git show <hash>` reproduces it.

## [Unreleased] — week of 2026-04-16 → 2026-04-20

Pre-release. Repository made public on 2026-04-18. `v0.1.0-alpha` is blocked on the M9 audio transcoder (Opus → AAC). See [`TRACTION.md`](./TRACTION.md) for current deployed state.

### Contracts — Base Sepolia (chainId 84532)

- `617d2bb` deploy RiskOracle + BoostRouter on Base Sepolia
- `dae14f7` RiskOracle — on-chain R(c) publication per RFC-6 §8
- `29c31f6` BoostRouter — non-custodial 4-way boost splitter (experiment)
- `e8ee399` PersistencePool.sol with Storj-style payouts (experiment)
- `5b5cc96` record PersistencePool Base Sepolia deployment
- `35289fe` DeployPersistencePool script + ADR 0003 draft
- `262863d` accept `meta.creatorAddress` in ownership checks; fix EIP-712 uint256 encoding
- `14f05d1` gas-sponsored registration via relayer endpoint
- `ec68860` sprint 2 — direct upload + on-chain `register`

### Live ingest & mesh (services/provider-node, apps/video, whip, mirror)

- `66929fc` Fase 2.3 — viewer failover across DHT-resolved providers
- `73b68c8` Livepeer as third backend — multi-backend WebRTC live
- `43b7733` OBS WHIP publisher — bearer-auth proxy + studio UI + docs
- `d4217f4` GossipSub mesh + integration suite closing 3.1 gaps
- `87051c7` Fase 3.1 — js-libp2p browser scaffold + WSS on provider-node
- `4be7d18` Fase 3.2 step 1 — HLS chunk relay via `p2p-media-loader`
- `55b19b0` wire HLSMuxer on mirror-recipient providers
- `4133dd5` gohlslib HLS surface tee'd alongside Merkle sink
- `9ab3260` Fase 2.2b — mirror ranker + `/mirrors/candidates`
- `a3a0068` Fase 2.2a — RTT echo-back sub-protocol
- `a767ecd` Fase 2.2c — dynamic mirror selection + PoolFetcher
- `bd21e52` Fase 2.2d — drop condition + peer cooldown
- `30d6a49` Fase 2.2e — polishes (closes Fase 2.2)
- `395e747` Fase 2.1 — RTP mirror cross-node via libp2p
- `08d0bf0` wire mirror client + server in `main.go` + config
- `5bdb7f9` Cloudflare Realtime TURN + WHIP simulcast + mobile bitrate cap
- `e33b8d8` TURN polish — mobile cap up, ICE telemetry, Privy auth gate
- `e8edd9e` Fase 2.0 — `/latency-probe` + p50/p95 on `/trust` graph
- `a29bfa5` WHEP consumption-latency instrumentation (Fase 2.1b)
- `e2addb7` log origin-side echo-back RTT stats on stream close
- `c83c0fb` HTTPS hub + apps/video per-live backend picker
- `9569416` unblock apps/video on the Aevia mesh
- `34d5b09` wire WHIP + LiveRouter + dhtproxy + e2e orchestration
- `cd3bef4` VOD manifest endpoint + EXT-X-ENDLIST on finalize
- `536fc7c` pin manifest + DHT announce on session close
- `821e54b` CMAFSegmenter emits LL-HLS partial segments
- `8ce583f` LL-HLS playlist tags + part HTTP route
- `c02cc9d` expose region + lat/lng via `/healthz`
- `187108b` expose binary build hash on `/healthz`
- `eba10ed` WHEP egress via SFU fan-out (M8.5)
- `86466b1` DHT resolve client — sessionID → provider via Kademlia
- `66eeccb` `probeProvidersRTT` — Fase 1.2 RTT ranking
- `f1c996d` `rankProvidersByRegion` — geo-aware provider ordering
- `e6a3ff3` rotate hls.js `loadSource` across mesh failover candidates
- `7810ccc` pubsub tracker stub + `?tracker=pubsub` no-op flag
- `455c418` inline SPS/PPS capture + injection for Chrome WHIP
- `56fc18d` + `bc90495` + `c86ac05` EIP-191 signature verify — package, WHIP gate, frontend callback

### Frontend — creator/viewer product (apps/video)

- `2edd20d` `@sentry/nextjs` — error monitoring + tracing + session replay
- `70e272f` ReactionStrip — 3 actions aligned to the 3 protocol dimensions
- `23a92a5` `/trust` real mesh graph via `/healthz` server-fetch
- `f369d15` Hello Live slice (Sprint 1b)
- `9b15b5a` apply Sovereign Editorial DS from Stitch (ui + video)
- `f318deb` five Sovereign Editorial signature components
- `e016828` redesign studio + harmonize nav across all surfaces
- `55a0ad8` home feed at `/feed` with live-now strip + curated preview
- `3fa2f40` creator channel page at `/creator/[address]`
- `b537df2` public trust ledger at `/trust` with axiom, score, council
- `cc75691` stitch-derived sign-in landing at root
- `afd56b5` wallet page with real DID + on-chain balance + bottom nav
- `7304b6d` sign-in parity with Stitch (close icon, card tokens, pulse)
- `b8628c3` route `início → /feed`; `/dashboard` becomes studio-only
- `3716e0a` harmonize live player with Stitch chrome + signature components
- `a995a11` harmonize `/live/new` with Stitch chrome + editable title
- `edf942c` complete live CRUD — client-side recording, rename, confirm delete
- `a71afa7` my-lives list with delete on `/dashboard`
- `ed32847` VOD playback via Cloudflare videos endpoint
- `aaa7761` auto-handoff live → VOD when broadcaster ends mid-stream
- `e71e907` PWA install — manifest, icons, service worker
- `5b494aa` switch routes to edge runtime for Cloudflare Pages deploy
- `8674e42` upload banner UI mounted in root layout
- `61e9a44` AeviaVODManifest fetch + shape validation
- `53816b3` `<PersonasStrip>` + use in `/feed`
- `b040887` wallet entry visible in `/dashboard` studio

### Frontend — protocol site (apps/network)

- `06a345e` editorial landing with axiom hero, portal rows, roadmap band
- `8e057aa` editorial manifesto page at `/manifesto`
- `7a9f26b` whitepaper, spec index + slug, AUP, roadmap, providers, 404
- `b40324f` full i18n under `[locale]` segment — pt-BR default, en alternate
- `d010379` SEO, brand, `/transparency`, RFC bodies
- `0823223` privacy + terms surfaces
- `8bb2bf7` broaden landing + manifesto + AUP framing to universal TAM
- `e6c14ac` `/operator` page — formal LLC/protocol boundary
- `fc3ab2c` mirror RFC-6/7/8 into site spec rendering
- `c909266` `/network` page — live world map of provider-nodes
- `25377b4` SEO + favicon polish — apple-icon, manifest, JSON-LD, llms.txt
- `ee8b0fd` FAQ page + nav link + route
- `6f1fd56` mobile-responsive — px/text/spacing/grid breakpoints + nav 2-row mobile
- `193120f` hamburger mobile menu via React portal
- `a470501` legal review — Section 230, Howey, DSA, LGPD, NCII, arbitration
- `66bcf51` deploy `apps/network` to Cloudflare Pages

### Auth & identity

- `60b7ec9` Privy v2 integration + Protocol Spec v0.1 (auth + video + docs)
- `f9a4c08` Privy embedded-only — drop external wallet, force `createOnLogin`
- `241c99f` refresh Privy access token before `signTypedData`
- `4d30d9c` prefer identity tokens over access tokens
- `a0e157f` verify Privy JWTs locally with embedded JWKS
- `e1161cb` env-aware `appChainId()` helper
- `0d11ba3` `AEVIA_DEV_BYPASS_AUTH` flag — unblocks video e2e locally

### Protocol specification (`docs/protocol-spec/`)

- `6df19a1` RFC-4 AUP + RFC-5 PersistencePool (v0.1)
- `5eff656` RFC-6 Risk Score + RFC-7 Moderation & Jury (v0.1)
- `e35a529` RFC-8 Economic Architecture (v0.1)
- `cf5bd0e` RFC-9 — live ingest and playback without Cloudflare
- `6eefc7e` whitepaper §7 Inference Layer + renumber §8–§15
- `d199982` Fase 2.2 spec — mirror selection v1 (RTT echo-back + candidate ranking)
- `8a54b9a` Fase 4 research — codec matrix 2026 (browser support + pion + path)
- `8efa9d4` document how LLC receives and sweeps revenue
- `f554a09` mirror-selection §5.4 — fix worked-example γ inconsistency
- `ad699b6` lower relayer fee — $0.25 → $0.05, waived in bootstrap

### Architecture decision records (`docs/adr/`)

- `b7e762c` ADR-0010 — HLS muxer via gohlslib
- `f12e629` ADR-0011 — mirror-side HLSMuxer for origin-failure-tolerant HLS

### Experiments merged to main (covered by integration tests)

- `084c711d` TestKillSwitchViaDHT — flagship M3 proof
- `0c87352` TestProviderNATServedViaRelay — flagship M4 proof
- `e62d459` TestKillSwitchAcrossAllLayers — pitch demo proof
- `be73692` TestContentSurvivesNodeRestart — flagship M5 proof
- `5d7ea23` TestEconomicLoopEndToEnd — flagship M6 proof
- `bc14a3c` TestLiveIngestEndToEnd — flagship M8 proof
- `930aad8` TestClientRejectsTamperedSegment — tamper detection
- `61dfff3` TestKillSwitchHLSEndToEnd — lab-scale Kill Test

### Tests

- `9f081ce` add vitest unit coverage + Playwright e2e scaffold
- `3254e5c` test(mirror) — assert `VideoFrameSink` receives demuxed NALs
- `b444ed7` operator-run p2p + hls multi-viewer smoke

### Fixed

- `abe7760` VOD 401 on HLS manifest — flip `requireSignedURLs` after upload
- `d3467cf` unblock Pages build — patch next-on-pages dup shims + isolate libp2p
- `4e4d1e9` mirror — treat write failures as drop + peer cooldown
- `0686e19` bug-hunt sweep — hardcodes, hydration, redirects, ownership
- `52a4950` WHEP viewer `disconnected` treated as transient, not fatal
- `e31877a` WHIP `disconnected` treated as transient, not fatal
- `3ecc396` remove WHEP silence safety-net false-positive + add ICE policy lever
- `87ce962` Livepeer 404 — segment route `/live/livepeer/[id]`
- `eca6591` Livepeer cleanup — HEAD redirect + skip cross-origin DELETE
- `28b64ce` Livepeer viewer — force `state='connected'` in SSR
- `84c6302` mirror path joins session topic race-free
- `b520cb6` only send `X-Aevia-DID` on aevia-mesh WHIP, not on Cloudflare
- `549e33e` split Annex-B NALs before feeding gohlslib AU
- `bae2e5f` inject SDP-derived SPS/PPS into each IDR AU
- `b01f70c` advertise RTCP NACK + wire default interceptors
- `37777c8` chunk relay now actually intercepts hls fragments
- `08dff75` Fase 3.1 — libp2p dial bootstraps + pin multiaddr v12
- `0664eef` show native `<video>` controls in live, not just VOD
- `41e0abc` horizontal scroll on dashboard + creators (mobile viewport)
- `8e37609` mobile grids — page / roadmap / providers / spec / aup stack on mobile
- `767b093` nav mobile wraps + roadmap milestones stack
- `a01d0fe` alias `cross-fetch` to native fetch stub + share URL + case-insensitive owner filter
- `bcf01a4` CF Stream `live_inputs` GET returns bare array, not `{liveInputs:[]}`
- `84f25c2` resolve redirect loop between `/` and `/dashboard`
- `93f8316` middleware requires a real Privy token, not just `privy-session`
- `594e9ea` unblock `/live/new` — drop from middleware, force-dynamic page
- `7594d4d` post-login redirect race + service-worker manifest-request hiccup
- `ff1df16` + `7ec3768` + `8754f24` ClientOnly mount gate around Privy hook consumers (progressive fixes)
- `f334645` reframe positioning to match aevia.network generalist tone

### Tooling & infrastructure

- `e66c109` scaffold Aevia monorepo (Sprint 0)
- `c4bf203` deploy scripts for multi-node provider cluster
- `96bcc4a` 3-node testnet artifacts (2 VPS relays + Mac provider)
- `25d60b2` point TS/JSON references to `aevia-network/aevia`
- `c7fba30` add TRACTION snapshot + root LICENSE + refresh README
- `5517048` + `3df865e` CLAUDE.md — authorship conventions + project invariants
- `a0ca4a1` GSD workflow section to CLAUDE.md
- `aad8d25` label remaining mocks honestly

---

This document is meant to be read by someone catching up on aevia in one sitting. Filtered out: work-in-progress intermediates, GSD workflow meta-commits, go.work.sum syncs, and merge commits. Every hash above points to a substantive, reviewable change.
