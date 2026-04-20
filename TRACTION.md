# aevia — traction

> Verifiable snapshot of the `aevia` protocol and reference clients.
> Every row in this document points to an on-chain address, a file path,
> or a commit hash in `main`. Last synced: 2026-04-20.

## summary

- Repo public since 2026-04-18 at `github.com/aevia-network/aevia`.
- 2 apps live in production: [`aevia.video`](https://aevia.video), [`aevia.network`](https://aevia.network).
- 4 contracts deployed and Sourcify-verified on Base Sepolia (chainId 84532).
- 3 Gnosis Safes (2-of-2) controlling economic and governance entry points.
- 3 live WHIP ingest backends wired behind one API.
- 3 public libp2p WSS bootstraps for browser discovery.
- 10 RFCs published (RFC-0 through RFC-9) plus the mirror-selection spec.
- 8 accepted ADRs.
- 103 Foundry tests across 4 Solidity contracts.
- Sentry instrumentation in all three Next.js runtimes (browser, edge, server).

## contracts — Base Sepolia (chainId 84532)

All addresses verified on Sourcify; reproducible from `packages/contracts/deployments/base-sepolia.json`.

| contract | address | deploy tx | block | timestamp (UTC) |
| --- | --- | --- | --- | --- |
| ContentRegistry | `0x07ffbcB245bcD8aA08F8dA75B2AeDE750d5592F0` | `0xdfd8c57b…458562` | 40345592 | 2026-04-17 20:57 |
| PersistencePool | `0x735C363a6df4651ABD8b1081F0b73fdAd98a4a93` | `0x08e29517…f56a5125` | 40354805 | 2026-04-18 02:05 |
| RiskOracle | `0xa5E6c7d8F5964f76D9f875819652a1ad2aE963AD` | `0x835d4767…7d0a430a` | 40382423 | 2026-04-18 16:46 |
| BoostRouter | `0xf566C64a4052A21f95C267c58517E956fa2e8F82` | `0xb75a88cf…8cac1bdd` | 40382423 | 2026-04-18 16:46 |

Deployer EOA: `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca`.
PersistencePool reward token: USDC Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (issued by Circle, 6 decimals).

### BoostRouter constants

- `THETA_FEED_BPS = 3000` — Risk Score threshold below which a manifest qualifies for boost (RFC-6 §3).
- `MIN_BOOST = 500000` — minimum boost amount, equal to 0.50 USDC (6 decimals).
- Default revenue split (RFC-8 §4.3): **50 % creator · 30 % PersistencePool · 19 % LLCTreasury · 1 % CouncilFund**. Council-governable via `BoostRouter.setSplit`.

## multisigs — Gnosis Safe 2-of-2 (Base Sepolia)

| safe | address | role |
| --- | --- | --- |
| LLCTreasury | `0xA98A148bD5493ee6F1AF2344C384E77fAEF2a2Ef` | Receives 19 % of every boost. Governance-neutral operational treasury. |
| CouncilFund | `0x7F99fFA84589C40a0FFc15A9451205dbF4a93EB1` | Receives 1 % of every boost. Covers Council expenses. |
| Council | `0x4934f9BA21F7Af797d4b89ead35Cf28Cdc1E72Ae` | Sole authority on `BoostRouter.setSplit` / `setCouncil` and `RiskOracle.contestScore` / `resolveContest` / `rotateScoringServiceKey` / `setCouncil`. |

Both signers on each Safe are on a single operator's devices at the time of writing. Signer rotation is scheduled before any Safe holds mainnet value.

## ingest backends — `apps/video/src/app/api/lives/route.ts:13`

A single API accepts `body.backend` and dispatches to the selected stack:

| backend | status | billing model | notes |
| --- | --- | --- | --- |
| `cloudflare` | default, production | per-minute subscribed | Cloudflare Stream WebRTC beta. Managed SFU with global CDN reach. |
| `aevia-mesh` | opt-in via `NEXT_PUBLIC_AEVIA_MESH_URL` | infra-only | libp2p SFU running inside `services/provider-node`. Browser posts WHIP directly; provider mints `sessionID` in the `X-Aevia-Session-ID` response header. Zero Cloudflare dependency on the ingest path. |
| `livepeer` | opt-in via `NEXT_PUBLIC_LIVEPEER_AVAILABLE` + `LIVEPEER_API_KEY` | per-minute **encoded ingest** (~100× better than per-minute subscribed at high viewer fan-out) | Livepeer Studio WHIP. Validated end-to-end in production on 2026-04-19 (commits `73b68c8`, `87ce962`, `eca6591`, `28b64ce`). |

Per-backend URL dispatch: `/live/[id]` for cloudflare, `/live/mesh/[id]` for aevia-mesh, `/live/livepeer/[id]` for livepeer.

## libp2p mesh — 3 public WSS bootstraps

Configured in `NEXT_PUBLIC_AEVIA_LIBP2P_BOOTSTRAPS` and consumed by `apps/video/src/lib/mesh/p2p.ts`:

- `/dns4/provider.aevia.network/tcp/443/wss/p2p/12D3KooWSvprtPXxXHEASpKux1vLyxWpBRYTps39GQrTEpccMjyh`
- `/dns4/libp2p-fl.aevia.network/tcp/443/wss/p2p/12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS`
- `/dns4/libp2p-br.aevia.network/tcp/443/wss/p2p/12D3KooW9pUVkyEKnhB4HHGJbzk5E3cp72rfBK56JDePRkyaMm2k`

Additional backend provider nodes mirror RTP across libp2p without exposing a browser-reachable WSS endpoint; they participate in the mesh for redundancy but are not counted in the "public bootstrap" tally above.

Transports are routed through Cloudflare Tunnel + Caddy so home-lab or CGNAT-bound nodes can join without a public IPv4.

## specification — `docs/protocol-spec/` (8,301 lines total)

RFC-style, RFC-2119 language (`MUST` / `SHOULD` / `MAY`).

| file | id | title | lines |
| --- | --- | --- | --- |
| `0-overview.md` | RFC-0 | Aevia Protocol Overview (v0.1) | 395 |
| `1-manifest-schema.md` | RFC-1 | Manifest schema | 564 |
| `2-content-addressing.md` | RFC-2 | Content addressing | 439 |
| `3-authentication.md` | RFC-3 | DID authentication | 427 |
| `4-aup.md` | RFC-4 | Acceptable Use Policy | 714 |
| `5-persistence-pool.md` | RFC-5 | Persistence Pool | 817 |
| `6-risk-score.md` | RFC-6 | Risk Score | 912 |
| `7-moderation-jury.md` | RFC-7 | Moderation Jury | 911 |
| `8-economic-architecture.md` | RFC-8 | Economic architecture | 1,166 |
| `9-live-ingest.md` | RFC-9 | Live ingest and playback without Cloudflare (experimental; implementation in prod, hardening pending) | 172 |
| `mirror-selection-v1.md` | — | Mirror selection v1 — RTT echo-back + candidate ranking | 838 |

## decisions — `docs/adr/`

| ADR | title | status |
| --- | --- | --- |
| 0001 | Monorepo tooling | Accepted |
| 0002 | ContentRegistry deployment | Accepted |
| 0003 | PersistencePool deployment | Accepted |
| 0008 | BoostRouter design — non-custodial 4-way splitter | Accepted |
| 0009 | RiskOracle design | Accepted |
| 0010 | HLS muxer via gohlslib | Accepted |
| 0011 | Mirror-side HLSMuxer for origin-failure-tolerant HLS | Accepted |

ADRs 0004–0007 are reserved (private iterations or superseded drafts).

## observability — Sentry

Three Next.js runtimes instrumented in `apps/video`:

| runtime | init file | traces sample rate | session replay |
| --- | --- | --- | --- |
| browser | `src/instrumentation-client.ts` | 1.0 dev / 0.1 prod | `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0` |
| edge | `sentry.edge.config.ts` | 1.0 dev / 0.1 prod | n/a |
| server | `sentry.server.config.ts` | 1.0 dev / 0.1 prod | n/a |

Source maps are uploaded per release.

## tests — Foundry contracts

| suite | file | `function test` count |
| --- | --- | --- |
| BoostRouter | `packages/contracts/test/BoostRouter.t.sol` | 29 |
| RiskOracle | `packages/contracts/test/RiskOracle.t.sol` | 36 |
| ContentRegistry | `packages/contracts/test/ContentRegistry.t.sol` | 22 |
| PersistencePool | `packages/contracts/test/PersistencePool.t.sol` | 16 |
| **total** | — | **103** |

Reproduce: `cd packages/contracts && forge test --summary`.

## shipped — highlights (repo age: 4 days, roughly 260 commits)

First commit `e66c109` on 2026-04-16 scaffolded the monorepo. The repo was opened to the public on 2026-04-18. Selected substantive changes below:

| date | commit | description |
| --- | --- | --- |
| 2026-04-20 | `187108b` | `feat(provider-node): expose binary build hash on /healthz` |
| 2026-04-20 | `bccf70e` | `feat(video): hls.js failover rotation + pubsub tracker stub + F4 smoke` |
| 2026-04-19 | `73b68c8` | `feat(video): Livepeer como 3º backend — multi-backend WebRTC live` |
| 2026-04-19 | `43b7733` | `feat(video): OBS WHIP publisher — bearer-auth proxy + studio UI + docs` |
| 2026-04-19 | `2edd20d` | `feat(video): @sentry/nextjs — error monitoring + tracing + session replay` |
| 2026-04-19 | `55b19b0` | `feat(mirror): wire HLSMuxer on mirror-recipient providers` |
| 2026-04-19 | `f12e629` | `docs(adr): 0011 mirror-side HLSMuxer for origin-failure-tolerant HLS` |
| 2026-04-19 | `b7e762c` | `docs(adr): 0010 HLS muxer via gohlslib` |
| 2026-04-19 | `4133dd5` | `feat(whip): gohlslib HLS surface tee'd alongside Merkle sink` |
| 2026-04-19 | `455c418` | `feat(whip): inline SPS/PPS capture + injection for Chrome WHIP` |
| 2026-04-19 | `c909266` | `feat(network): /network page — live world map of provider-nodes` |
| 2026-04-19 | `4be7d18` | `feat(video): Fase 3.2 step 1 — HLS chunk relay via p2p-media-loader` |
| 2026-04-19 | `87051c7` | `feat: Fase 3.1 js-libp2p browser scaffold + WSS on provider-node` |
| 2026-04-19 | `f9a4c08` | `fix(auth): Privy embedded-only — drop external wallet, force createOnLogin` |
| 2026-04-18 | `66929fc` | `feat(video): Fase 2.3 viewer failover across DHT-resolved providers` |
| 2026-04-18 | `5bdb7f9` | `feat(video): Cloudflare Realtime TURN + WHIP simulcast + mobile bitrate cap` |
| 2026-04-18 | `9ab3260` | `feat(provider-node): Fase 2.2b mirror ranker + /mirrors/candidates` |
| 2026-04-18 | `a3a0068` | `feat(provider-node): Fase 2.2a RTT echo-back sub-protocol` |
| 2026-04-18 | `395e747` | `feat(provider-node): Fase 2.1 RTP mirror cross-node via libp2p` |

## status

- **Active milestone**: Phase 3 — decentralized viewer distribution (pre-cut).
- **Current phase inside the milestone**: Phase 0 — consolidation of phase-2 parallel agents into `main`.
- **Release tags**: none yet. `v0.1.0-alpha` is gated on the M9 audio transcoder (Opus on the WHIP ingest path, AAC on the HLS playback path; required because iOS Safari does not play fMP4 + Opus).
- **Audit**: not engaged. The economic contracts are deployed on Base Sepolia only; mainnet deployment is gated on an external security audit (rough scope: $50–100k, not yet budgeted).
- **Not yet normative**: `docs/aup/` contains only a README pointer; the full normative AUP text lives inside RFC-4 (`docs/protocol-spec/4-aup.md`, 714 lines) and the public summary at `aevia.network/aup`.

---

This document is meant to be reproducible. Every claim above can be checked by (a) running `git log` / `git show` against the listed commit hashes, (b) calling the listed contracts on Base Sepolia, or (c) reading the referenced source file at the stated path.
