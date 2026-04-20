# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**Cloudflare (Primary Infrastructure):**
- Cloudflare Stream — Live video ingest (WHIP) and playback (WHEP/HLS)
  - SDK/Client: Cloudflare native HTTP API (custom client in `apps/video/src/lib/cloudflare/stream-client.ts`)
  - Auth: `STREAM_API_TOKEN` (server-only)
  - Webhook secret: `STREAM_WEBHOOK_SECRET` for payload verification
  - Customer code: `NEXT_PUBLIC_STREAM_CUSTOMER_CODE` (client-side for analytics)
  - Usage: Primary live broadcast backend when user selects "cloudflare" on /live/new

- Cloudflare Pages — Static site hosting + serverless functions
  - SDK/Client: `@cloudflare/next-on-pages`, `wrangler`
  - Integration: `next-on-pages` adapter patches Next.js for Cloudflare edge runtime (nodejs_compat)
  - Deploy: `wrangler pages deploy`
  - Runtime: Cloudflare Workers (V8 isolate, nodejs polyfills)

- Cloudflare R2 — Object storage (video assets, VOD uploads)
  - Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - Account ID: `CLOUDFLARE_ACCOUNT_ID`
  - Usage: Secondary option for creator VOD archival (not integrated in production yet)

- Cloudflare KV — Distributed key-value store
  - Integration: Potential for session caching (currently using other methods)

- Cloudflare DNS API — TLS certificate auto-renewal (provider-node)
  - Auth: `AEVIA_CF_API_TOKEN` (Zone > DNS > Edit scoped API token)
  - Usage: Let's Encrypt DNS-01 challenge solver on provider-node startup
  - Library: `libdns/cloudflare` (Go) in provider-node

**Livepeer Studio (Multi-Backend Option):**
- Live stream creation and encoding
  - SDK/Client: HTTP REST API (custom client in `apps/video/src/lib/livepeer/stream-client.ts`)
  - Auth: `LIVEPEER_API_KEY` (server-only)
  - Feature flag: `NEXT_PUBLIC_LIVEPEER_AVAILABLE` toggles UI radio option
  - Usage: Alternative to Cloudflare when selected on /live/new
  - Rationale: Per-minute encoded ingest (not per-minute subscribed); better unit economics at high viewer fan-out (OPPORTUNITY.md §6)
  - Endpoints:
    - Create stream: `POST /api/stream`
    - Ingest URL: WHIP-compatible URL returned in response
    - Playback: `https://livepeer.studio/api/playback/<playbackId>` (m3u8 HLS)

**Privy (Authentication & Smart Wallet):**
- Sign in with Wallet (Web3 auth)
  - SDK/Client: `@privy-io/react-auth` 2.25.0 (browser), `@privy-io/node` 0.1.0 (server)
  - App credentials: `NEXT_PUBLIC_PRIVY_APP_ID` (client), `PRIVY_APP_SECRET` (server)
  - Integration: AeviaPrivyProvider wraps app in `apps/video/src/components/providers.tsx`
  - Session verification: `readAeviaSession()` in `@aevia/auth/server.ts`
  - Dev bypass: `AEVIA_DEV_BYPASS_AUTH=true` skips Privy for local e2e (fixes walletconnect SSR 500)
  - User identification: DID resolution and EIP-712 signature verification

**Base L2 (Blockchain - Sepolia Testnet & Mainnet):**
- Smart contract deployment and interaction
  - SDK/Client: viem 2.48.0 (TypeScript/JS), go-ethereum (Go coordinator)
  - RPC endpoints:
    - Base Sepolia (testnet): `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`
    - Base Mainnet: `BASE_MAINNET_RPC_URL=https://mainnet.base.org`
  - Chain ID: `BASE_CHAIN_ID=84532` (Sepolia), `84532` for public (Mainnet: `8453`)
  - Verification: `BASESCAN_API_KEY` for Basescan API (contract verification, ABI lookup)

**Contract Addresses (Sepolia):**
- ContentRegistry: `0x07ffbcB245bcD8aA08F8dA75B2AeDE750d5592F0` — On-chain content anchor (manifest CIDs)
- PersistencePool: `0x735C363a6df4651ABD8b1081F0b73fdAd98a4a93` — cUSDC deposits + settlements
- RiskOracle: `0xa5E6c7d8F5964f76D9f875819652a1ad2aE963AD` — Risk score publication (RFC-6 §8)
- BoostRouter: `0xf566C64a4052A21f95C267c58517E956fa2e8F82` — 4-way boost splitter (RFC-8 §4)
- Coordinator: `0xe58ee3d7b6FF359dc5c8A67f3862362F9F4080ca` — Settlement submitter (MVP = deployer)
- USDC (cUSDC native on Base): `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Sepolia)

**Gnosis Safe Multisigs (Sepolia):**
- LLC Treasury Safe: `0xA98A148bD5493ee6F1AF2344C384E77fAEF2a2Ef` — Receives llcBps of boosts
- Council Fund Safe: `0x7F99fFA84589C40a0FFc15A9451205dbF4a93EB1` — Receives councilBps (1% of boosts)
- Council Governance Safe: `0x4934f9BA21F7Af797d4b89ead35Cf28Cdc1E72Ae` — Controls splits and scoring service key rotation
- Signer configuration: 2-of-2 (deployer EOA + MM Account 1 on Sepolia; rotate to real spouse before mainnet)

## Data Storage

**Databases:**
- Badger v4 (embedded key-value) — Provider-node local state
  - Path: ~/.badger/ (or configured in provider-node startup)
  - Use: DHT cache, live session index, chunk metadata
  - No external DB; single-instance by design

**File Storage:**
- Cloudflare Stream — Primary media output (HLS manifests, segment playlists)
- Cloudflare R2 — Optional creator VOD archival
- Local filesystem — Provider-node chunk staging (WHIP ingest → HLS muxing)
- IPFS (planned) — Content-addressed manifest storage (protocol spec in progress)

**Caching:**
- Cloudflare KV — Distributed cache (not yet integrated; available for session/auth caching)
- Browser IndexedDB — P2P chunk cache via p2p-media-loader (EXPERIMENTAL)

## Authentication & Identity

**Auth Provider:**
- Privy — Embedded smart wallet, Sign in with Wallet via Base
  - Implementation: EIP-712 typed data signing + ECDSA verification
  - Session persistence: Privy manages browser localStorage + HTTP-only cookies
  - Server validation: `readAeviaSession()` decodes Privy JWT via `@privy-io/node`
  - DID resolution: BDI (Base DID) via `readDID()` in `@aevia/auth`

**Authorization:**
- Session cookie enforcement via Next.js middleware (`apps/video/src/middleware.ts`)
- Route protection: Dashboard, /live/new, /wallet routes gated behind session
- Dev bypass: `AEVIA_DEV_BYPASS_AUTH=true` + mock session for testing (LOCAL ONLY)

**Publisher Token (OBS/External WHIP):**
- Token signing: HS256 (HMAC-SHA256) in `packages/auth/src/publisher-token.ts`
- Secret: `AEVIA_PUBLISHER_TOKEN_SECRET` (min 32 chars, generated via `openssl rand -base64 48`)
- TTL: 30 minutes per token
- Route: `POST /api/lives/[id]/publisher-token` (absent disables with 503 if secret not set)
- Use: Allows OBS/external WHIP tools to authenticate without Web3 wallet

## Monitoring & Observability

**Error Tracking:**
- Sentry — Browser + server error aggregation
  - SDK: `@sentry/nextjs` 10.49.0
  - Project: aevia-video (org: dgl-tech)
  - Auth token: `SENTRY_AUTH_TOKEN` (build-time, gitignored via `.env.sentry-build-plugin`)
  - Features:
    - Source-map upload on build
    - Tunnel route: `/monitoring` (proxies browser errors to dodge ad-blockers)
    - Disabled Vercel-specific monitors (`automaticVercelMonitors: false`)
    - Widens client file upload for better stack trace resolution
    - Debug logging stripped in prod via `removeDebugLogging`

**Logs:**
- Server-side: console.log (Next.js edge runtime buffers and sends to Cloudflare)
- Go services: zerolog with structured JSON output
- Client-side: Browser console (no centralized sink yet; Sentry captures errors)

**Metrics:**
- Not yet integrated (no APM configured)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages — Primary frontend (Next.js)
  - Deployment: `wrangler pages deploy .vercel/output/static` (after `next-on-pages` build)
  - Environment: Cloudflare Workers edge runtime (V8 isolate + nodejs_compat)
  - Custom domain: `aevia.video` (creator app)

- Go Services — Standalone binaries on external servers (not Cloudflare-native)
  - provider-node — User-operated nodes for P2P mesh (optional broadcaster infrastructure)
  - coordinator — Settles transactions on-chain (runs by Aevia team)
  - recorder — Captures WHEP streams for archival (not yet deployed)
  - indexer — Indexes on-chain events (not yet deployed)

**CI Pipeline:**
- GitHub Actions (not yet configured; all checks run locally via lefthook)
- Pre-commit hooks: biome check, gofmt, solidity fmt, go vet
- Pre-push hooks: turbo typecheck (affected)
- Manual: `pnpm test` (vitest), `pnpm test:contracts` (forge), `pnpm test:e2e` (playwright)

## Environment Configuration

**Required env vars (production):**
- `NEXT_PUBLIC_APP_URL` — Public app URL (used in metadata, redirects)
- `NEXT_PUBLIC_APP_ENV` — "development" | "production" (feature gates)
- `STREAM_API_TOKEN` — Cloudflare Stream API key
- `STREAM_WEBHOOK_SECRET` — Webhook signature validation
- `NEXT_PUBLIC_STREAM_CUSTOMER_CODE` — Stream customer analytics
- `NEXT_PUBLIC_PRIVY_APP_ID` — Privy app ID (public)
- `PRIVY_APP_SECRET` — Privy secret (server-only, edge runtime)
- `BASE_RPC_URL` — Base L2 RPC endpoint (Sepolia or Mainnet)
- `BASE_CHAIN_ID` — Chain ID (84532 Sepolia, 8453 Mainnet)
- `BASESCAN_API_KEY` — Basescan API for contract verification
- `SESSION_SIGNING_KEY` — HS256 key for session cookie (openssl rand -hex 32)
- `AEVIA_PUBLISHER_TOKEN_SECRET` — HS256 secret for publisher tokens (min 32 chars)
- `RELAYER_PRIVATE_KEY` — Gas-sponsored relay signer (viem generatePrivateKey())
- `DEPLOYER_PRIVATE_KEY` — Contract deployment key (prefer keystore over inline)

**Feature flags:**
- `NEXT_PUBLIC_AEVIA_MESH_URL` — Enable P2P mesh backend (leave empty to hide radio option)
- `NEXT_PUBLIC_AEVIA_DHT_RELAYS` — Comma-separated relay URLs for peer discovery
- `NEXT_PUBLIC_AEVIA_PROVIDER_REGISTRY` — JSON mapping peerID → HTTPS base URL
- `LIVEPEER_API_KEY` + `NEXT_PUBLIC_LIVEPEER_AVAILABLE` — Enable Livepeer backend
- `AEVIA_DEV_BYPASS_AUTH` — Skip Privy (LOCAL ONLY; MUST be false/empty in prod)

**Cloudflare Infrastructure:**
- `CLOUDFLARE_ACCOUNT_ID` — Account ID
- `CLOUDFLARE_API_TOKEN` — API token for general use (Auth > Tokens > Create)
- `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — R2 bucket credentials
- `AEVIA_CF_API_TOKEN` — Scoped DNS API token (provider-node cert renewal)

**Turbo Remote Cache (optional):**
- `TURBO_TOKEN` — Authentication token for remote cache backend
- `TURBO_TEAM` — Team slug on cache service

**Build Secrets:**
- `.env.sentry-build-plugin` (gitignored) — `SENTRY_AUTH_TOKEN` for source-map upload

## Webhooks & Callbacks

**Incoming:**
- Cloudflare Stream webhooks — Live input lifecycle events (unused in current code; feature flag: `STREAM_WEBHOOK_SECRET`)
  - Expected endpoints: `/api/webhooks/stream` (not yet implemented)

**Outgoing:**
- RPC calls to Base L2 — Contract reads/writes, event filtering
- Livepeer Studio API — Stream creation, playback URL generation
- Basescan API — Contract source verification (deployment script)

## Protocol Specification References

All integration decisions derive from:
- RFC-1 to RFC-8 (protocol specs in `docs/protocol-spec/`)
- ADR-0001 to ADR-0011 (architecture decision records in `docs/adr/`)
- OPPORTUNITY.md — Multi-backend design rationale (Cloudflare vs Livepeer economics)
- AUP (Acceptable Use Policy in `docs/aup/`) — Content moderation rules (governs Risk Score dimensions)

---

*Integration audit: 2026-04-20*
