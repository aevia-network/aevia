# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

**Overall:** Layered monorepo with clean separation between frontend (browser + PWA), backend services (Go + libp2p mesh), smart contracts (Solidity + Base L2), and shared protocol definitions (Protobuf).

**Key Characteristics:**
- **Persistence ≠ Distribution** — Content registered on-protocol via merkle roots (on-chain) is permanent; distribution (feed ranking, promotion, visibility) is regulated off-chain via Risk Score governance
- **Decentralized media distribution** — WHIP ingest → libp2p mirror fan-out → WHEP playback + P2P chunk relay (p2p-media-loader-hlsjs)
- **Provider-node mesh as sovereign alternative** — Browser can publish directly to aevia-mesh (Go provider-node) and bypass Cloudflare entirely, with full libp2p peer discovery via DHT
- **Non-custodial economic split** — BoostRouter atomically splits paid amplification across creator/Persistence Pool/LLC treasury/Council without holding balances
- **Risk Score governance gate** — RiskOracle on-chain publishes content moderation scores (R_legal, R_abuse, R_values); BoostRouter refuses boosts above θ_feed threshold

## Layers

**Frontend (PWA + Editorial):**
- Purpose: User-facing consumption and creation surfaces
- Location: `apps/video/` (aevia.video consumer PWA), `apps/network/` (aevia.network editorial/operator/protocol docs)
- Contains: Next.js App Router pages, API routes, WebRTC client logic, mesh connectivity scaffolding
- Depends on: `@aevia/auth` (Privy wallet integration), `@aevia/ui` (design system), `@aevia/protocol` (wire format), viem (Base RPC interaction)
- Used by: Browser clients only

**Backend Services (Go + libp2p):**
- Purpose: Media ingestion, replication, DHT announcement, manifest signing, event indexing
- Location: `services/provider-node/`, `services/recorder/`, `services/manifest-svc/`, `services/indexer/`, `services/coordinator/`
- Contains: Go binaries with libp2p node, WHIP/WHEP protocol servers, HLS muxing, P2P stream relay
- Depends on: go-libp2p, pion/webrtc, gohlslib, Base RPC via ethclient, Cloudflare R2 (direct HTTP SDK)
- Used by: Distributed mesh of provider nodes, Cloudflare Tunnel ingress, recorder cluster

**Smart Contracts (Solidity + Base L2):**
- Purpose: Content registry, persistence pool subsidy allocation, risk oracle publication, boost splitting
- Location: `packages/contracts/src/`
- Contains: Solidity 0.8.24 contracts deployed to Base Sepolia/Mainnet
- Depends on: OpenZeppelin ERC20/SafeERC20, Council multisigs (governance), IContentRegistry + IRiskOracle interfaces
- Used by: BoostRouter (boost splitting), RiskOracle (score publication), off-chain scorer (RiskOracle updates), Gnosis Safes (treasury + Council)

**Shared Protocol & Types:**
- Purpose: Wire-format definitions and type bridges across TypeScript and Go
- Location: `packages/protocol/` (Protobuf + generated code), `packages/auth/` (Privy integration), `packages/libp2p-config/` (bootstrap/peer config)
- Contains: `.proto` files with message definitions, generated TypeScript/Go code, JSON manifests
- Depends on: protoc compiler (buf for linting + code generation), jose (JWT validation)
- Used by: All frontend and backend components

**Deployment & Infrastructure:**
- Purpose: Local dev orchestration, Cloudflare Pages/Workers integration, Foundry forge scripts
- Location: `infra/local-dev/` (Procfile.dev + overmind config), root config files (turbo.json, go.work, mise.toml)
- Contains: Process definitions, environment templates, Cloudflare wrangler config, Foundry forge scripts
- Depends on: pnpm workspaces, Go workspaces, overmind process manager, Cloudflare toolchain
- Used by: Developers during local setup + CI pipelines

## Data Flow

**Live Broadcast WHIP → Mirror Mesh → WHEP Playback:**

1. **Ingestion (Browser → Provider):**
   - Broadcaster (creator) on `apps/video/dashboard` initiates a broadcast on `/live/new`
   - Selects backend: `cloudflare` (Cloudflare Stream), `aevia-mesh` (sovereign), or `livepeer` (decentralized)
   - For aevia-mesh: POST `/api/lives` creates a WHIP session and returns provider multiaddr from env (`NEXT_PUBLIC_AEVIA_MESH_URL`)
   - Browser `WhipSession` established via `apps/video/src/lib/webrtc/whip.ts` — MediaStream → RTC peer → WHIP POST to provider-node

2. **Provider-Node Reception & Session Lifecycle (`services/provider-node/internal/whip`):**
   - Provider receives WHIP POST at `POST /whip`
   - `whip.Server` creates a session, extracts H.264 + Opus RTP payloads via pion/webrtc depacketizer
   - Session minted with ID returned as `X-Aevia-Session-ID` response header
   - `whip.Session` attached to `LiveRouter` so subsequent viewer requests match this session

3. **HLS Muxing & Segment Serving (`services/provider-node/internal/mirror + gohlslib`):**
   - `HLSMuxer` (gohlslib instance) consumes video RTP frames via `FrameSink` interface
   - Builds CMAF segments (1s base segment, per RFC 8216 §7.4), writes to in-memory ring buffer
   - Viewers request `/live/{sessionId}/hls/index.m3u8` — gohlslib MediaPlaylist returned, segments via `GET /live/{sessionId}/hls/seg/{n}.m4s`
   - Audio muxing reserved for M9 (Opus → AAC fmp4)

4. **Mirror Fan-Out via libp2p (`services/provider-node/internal/mirror/client.go`):**
   - When a session is registered on provider-origin, `MirrorClient` dials 3–5 mirror-recipient providers via libp2p GossipSub bootstrap
   - Opens a libp2p stream at `/aevia/mirror/1.0.0` per provider
   - Streams H.264 RTP packets continuously; mirror-recipient receives and demuxes to same `HLSMuxer` pipeline (ADR 0011)
   - No intermediate buffering — deterministic low-latency replication

5. **DHT Announcement (`services/provider-node/internal/dht`):**
   - When session ends, `LivePinSink` has accumulated H.264 frame Merkle leaves
   - Final manifest CID published to Base + announced via libp2p Kademlia DHT
   - Any subsequent `/vod/{manifestCid}` request can be served by any provider pinning that content

6. **Viewer Playback (WHEP + Chunk Relay):**
   - Viewer navigates to `/live/mesh/[id]` (for aevia-mesh) or equivalent Cloudflare/Livepeer URL
   - Browser calls `resolveSessionProvider` (`apps/video/src/lib/mesh/resolve.ts`) to DHT-query for provider candidates
   - WHEP session established to selected provider via `WhepSession` (`apps/video/src/lib/webrtc/whep.ts`)
   - Simultaneously, `initMesh` (`apps/video/src/lib/mesh/p2p.ts`) spins up a libp2p node in the browser, joins GossipSub topic `aevia-live-{sessionId}`
   - `ChunkRelayOptions` wraps hls.js with `HlsJsP2PEngine` (`apps/video/src/lib/p2p/chunk-relay.ts`) — viewers fetch HLS parts from each other over WebRTC DataChannel using p2p-media-loader-core
   - Running P2P ratio published to UI (PermanenceStrip L1 indicator), typically 20–40% of chunks from peers during healthy mesh

**Risk Score & Boost Flow:**

1. **Scoring (Off-Chain Batch):**
   - Classifier service evaluates manifests against `R_legal`, `R_abuse`, `R_values` criteria (RFC-6 §3)
   - Produces `Score` struct with composite R(c) ∈ [0, 10_000] bps

2. **On-Chain Publication (`RiskOracle`):**
   - Scoring service (authorized key) calls `publishScore(manifestHash, score)` on Base
   - Council may contest scores within window; `resolveContest` updates after dispute
   - `BoostRouter` reads via `oracle.scoreBps(manifestHash)` during boost transaction

3. **Boost Routing (`BoostRouter`):**
   - User sends USDC via `boost(manifestHash, amountUsdc)` at `/live/[id]` page
   - Router checks: `scoreBps < θ_feed` (gate, default ~3000 bps = moderate risk threshold)
   - If gate passes, atomically splits USDC: `creatorBps`% → creator, `poolBps`% → Persistence Pool, `llcBps`% → LLC Treasury, `councilBps`% → Council fund
   - Split ratios governance-mutable only by Council (no LLC unilateral redirect)
   - Entire transaction reverts if any transfer fails — no partial execution

**State Management:**

- **Session State (Ephemeral):** In-memory libp2p gossip, RTC peer connection state, libp2p node identity — all lost on provider restart
- **Content State (Persistent):** H.264 frame tree (Merkle accumulation), final manifest CID, segment CIDs pinned to local ContentStore (`services/provider-node/storage`)
- **On-Chain State:** ContentRegistry (manifestHash → creator), RiskOracle (manifestHash → Score), Persistence Pool subsidy balance, Council fund balance
- **Off-Chain Indexer:** `services/indexer` polls Base chain, maintains a read-optimized database of live sessions + finished VOD manifests

## Key Abstractions

**WhipSession / WhepSession:**
- Purpose: Encapsulates a single publisher or viewer's RTC lifecycle
- Examples: `services/provider-node/internal/whip/session.go`, `services/provider-node/internal/whep/session.go`
- Pattern: Session holds RTCPeerConnection, attach FrameSinks on video/audio, lifecycle hooks on peer connect/disconnect

**FrameSink:**
- Purpose: Pluggable callback for demuxed media frames (video AU, audio packet)
- Examples: HLSMuxer consumes FrameSink, Mirror client consumes FrameSink for fan-out
- Pattern: Each frame routed to multiple sinks atomically (TeeFrameSink)

**LiveRouter:**
- Purpose: Route incoming HTTP requests to the correct WhipSession / WhepSession based on sessionId
- Examples: `services/provider-node/internal/node/live_router.go`
- Pattern: Concurrent-safe map of sessionId → handler; muxer attachment/detachment on session lifecycle

**MirrorServer / MirrorClient:**
- Purpose: Replicate active session RTP across mesh
- Examples: `services/provider-node/internal/mirror/server.go`, `services/provider-node/internal/mirror/client.go`
- Pattern: Client opens libp2p stream to recipient, demuxes RTP on arrival, feeds to HLSMuxer; Server accepts stream, reassembles H.264 packets, feeds FrameSink

**LivePinSink:**
- Purpose: Accumulate H.264 Merkle tree (per RFC 3 frame hashing)
- Examples: `services/provider-node/internal/pinning/sink.go`
- Pattern: Every IAU hashed and added to tree; on close, final root published to Base + DHT

**HLSMuxer (gohlslib):**
- Purpose: In-memory MPEG-DASH CMAF segment builder
- Examples: Instantiated in `services/provider-node/cmd/provider/main.go`, attached per-session
- Pattern: Consumes FrameSink (H.264 AU + RTP timestamp), emits CMAF segments + HLS playlist, queries via HTTP MediaPlaylist handler

**MeshHandle / InitMesh (Browser):**
- Purpose: Browser-side libp2p node lifecycle
- Examples: `apps/video/src/lib/mesh/p2p.ts` exports InitMesh + MeshHandle interface
- Pattern: Lazy initialization on `/live/mesh/[id]` page load; joins GossipSub `aevia-live-{sessionId}`, heartbeat every 5s, provides peer announcements for chunk relay

**RiskOracle / BoostRouter (On-Chain):**
- Purpose: Immutable moderation + non-custodial split logic
- Examples: `packages/contracts/src/RiskOracle.sol`, `packages/contracts/src/BoostRouter.sol`
- Pattern: Stateless routing (BoostRouter), governance-mutable parameters (Council-only), atomic all-or-nothing disbursement

## Entry Points

**Frontend PWA (`apps/video`):**
- Location: `apps/video/src/app/layout.tsx` (root layout), `apps/video/src/middleware.ts` (auth gate)
- Triggers: User navigates to aevia.video
- Responsibilities: Privy auth cookie gate, Providers context (Privy wallet, viem chain client), global fonts/styles, RSC boundary setup

**Creator Dashboard:**
- Location: `apps/video/src/app/dashboard/page.tsx`
- Triggers: Authenticated user clicks "Dashboard" or navigates `/dashboard`
- Responsibilities: List active broadcasts, start new broadcast, display RTMP/WHIP URLs, OBS panel with server/key

**Live Broadcast Page (Viewer):**
- Location: `apps/video/src/app/live/[id]/page.tsx` (Cloudflare), `/live/mesh/[id]` (aevia-mesh), `/live/livepeer/[id]` (Livepeer)
- Triggers: Unauthenticated viewer opens broadcast link
- Responsibilities: Render playback UI, establish WHEP session, spin up browser libp2p for chunk relay, display Risk Score / boost UI

**API Route: Create Live Session:**
- Location: `apps/video/src/app/api/lives/route.ts`
- Triggers: Broadcaster submits `/live/new` form
- Responsibilities: Call chosen backend SDK (Cloudflare Stream, Livepeer, or aevia-mesh), return WHIP URL + session ID

**API Route: WHIP Publisher Token:**
- Location: `apps/video/src/app/api/lives/[id]/publisher-token/route.ts`
- Triggers: OBS broadcaster requests fresh token (JWT)
- Responsibilities: Issue Cloudflare Stream publisher token for RTMP → WHIP bridge

**Provider-Node Main:**
- Location: `services/provider-node/cmd/provider/main.go`
- Triggers: `go run ./cmd/provider` (local) or binary on provider host
- Responsibilities: Parse config (data dir, identity, bootstrap peers), initialize libp2p node, start WHIP/WHEP/HLS servers, begin mirror fan-out, announce to DHT on session end

**Recorder Service:**
- Location: `services/recorder/cmd/recorder/main.go`
- Triggers: Batch job (scheduled) or event-driven from indexer
- Responsibilities: Consume WHEP playback stream, re-encode to H.265, write to R2 for fallback archival

**Manifest Signer:**
- Location: `services/manifest-svc/cmd/manifest/main.go`
- Triggers: Offline or on-demand from indexer
- Responsibilities: Compute final manifest Merkle root, sign with LLC key for CC0 license assertion, output CID

**Indexer Service:**
- Location: `services/indexer/cmd/indexer/main.go`
- Triggers: Continuous polling of Base chain events
- Responsibilities: Watch ContentRegistry + RiskOracle events, maintain read-optimized view, trigger recorder + manifest jobs

**Network Editorial App (`apps/network`):**
- Location: `apps/network/src/app/[locale]/layout.tsx`
- Triggers: User navigates to aevia.network
- Responsibilities: Internationalized (i18n) routes, render protocol spec, operator docs, AUP, terms, provider registry

## Error Handling

**Strategy:** Defensive at network boundaries; fail-fast on data inconsistency; graceful degradation on transient failures.

**Patterns:**

- **WHIP Negotiation Failure:** Broadcaster's RTCPeerConnection state monitored; on `failed` or `disconnected`, client displays "connection lost" and allows retry. Provider-side: session auto-closed after 10s of no RTP activity.

- **Mirror Stream Broken:** If mirror-client cannot dial a provider or stream closes mid-session, client silently rotates to next candidate in ranked list. Mirrors already receiving RTP continue serving HLS from buffered segments (grace period ~20s).

- **HLS Segment Not Found:** Gohlslib returns 404 if segment index out of range (viewer too far behind or ahead of live edge). Viewer hls.js seeks to highest available segment and resumes.

- **Risk Score Gate (Boost):** BoostRouter reverts entire transaction if `scoreBps >= θ_feed`. Frontend disables boost button; tooltip explains restriction. User must wait for Council appeal or score reduction.

- **Privy Auth Expiry:** Middleware checks for `privy-id-token` (long-lived) first, falls back to `privy-session` (refresh token). If both absent, redirect to `/` (public). Client SDK auto-refreshes on next interaction.

- **DHT Lookup Timeout:** `resolveSessionProvider` races multiple DHT queries (5s timeout). If none return candidates, fallback to origin provider (stored during session creation) or Cloudflare fallback.

- **Foundry Deploy Revert:** forge deploy scripts output error details; manual inspection of `deployments/` JSON for previous state. ADR 0007 specifies multisig ceremony pre-deploy.

## Cross-Cutting Concerns

**Logging:** 
- TypeScript: `console.*` in browser (mocked in tests), structured JSON via Sentry in prod
- Go: `github.com/rs/zerolog` with configurable level; JSON output to stdout for log aggregation
- Solidity: Event emission for all state transitions (immutable audit trail)

**Validation:**
- TypeScript: `zod` schema validation at API boundaries (`apps/video/src/app/api/*/route.ts`)
- Go: Manual input validation in HTTP handlers; Protobuf messages self-validate at unmarshaling
- Solidity: OpenZeppelin contracts (SafeERC20 for transfer safety), require() guards on governance operations

**Authentication:**
- Browser: Privy wallet connection (embedded smart wallet on Base), JWT cookies set by Privy callback
- Provider-Node: Optional DID + EIP-191 signature validation on WHIP POST (for allowlist enforcement)
- Off-Chain Services: Base chain RPC key (env var `BASE_RPC_URL`), Cloudflare API token for R2/Stream

**Consensus & Governance:**
- Risk Score contests resolved via Council multisig (2-of-3 or 7-of-12, spec TBD in ADR 0007)
- BoostRouter split parameters changeable only by Council via `updateSplit` call
- Content registry maintained by on-chain event indexer (not directly user-writable)

---

*Architecture analysis: 2026-04-20*
