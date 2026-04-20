# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**
- TypeScript 5.9.3 — JavaScript compilation with strict typing
- Go 1.26 / 1.26.1 — Backend services and p2p infrastructure
- Solidity 0.8.24 (Cancun EVM) — Smart contracts on Base L2

**Secondary:**
- JavaScript (ES2022 target, module: ESNext) — Node.js scripts, config files
- Protocol Buffers — Cross-language wire format (buf)

## Runtime

**Environment:**
- Node.js 24 LTS (enforced via `mise.toml`)
- Go 1.26 runtime for services (provider-node, coordinator, recorder, manifest-svc, indexer)
- Cloudflare Workers (edge runtime) and Pages for Next.js deployment

**Package Manager:**
- pnpm 10.30.1 (monorepo package manager)
- Lockfile: `pnpm-lock.yaml` (v9.0, present and enforced)

## Frameworks

**Core Frontend:**
- Next.js 15.5.15 — App Router (React Server Components)
  - `@cloudflare/next-on-pages` 1.13.16 — Deployment adapter for Cloudflare Pages
  - Custom webpack config in `apps/video/next.config.ts` to handle cross-fetch/XMLHttpRequest polyfill conflicts on edge runtime
  - Sentry integration via `@sentry/nextjs` 10.49.0 with source-map upload and tunnel route (`/monitoring`) for ad-blocker bypass

**Core Backend (Go):**
- `libp2p` v0.48.0 — P2P networking core (provider-node, coordinator)
  - `@libp2p/go-libp2p-http` — HTTP transport
  - `@libp2p/go-libp2p-kad-dht` v0.39.0 — DHT for peer discovery
  - `@libp2p/go-libp2p-pubsub` — Pub/Sub messaging
  - Transport: websockets (browser), noise (peer-to-peer encryption)

**WebRTC & Media:**
- Pion WebRTC (`github.com/pion/webrtc/v4` v4.2.11) — Provider-side WHIP/WHEP
- HLS.js 1.6.16 — Browser HLS playback
- gohlslib (`github.com/bluenviron/gohlslib/v2` v2.2.9) — Go-based HLS muxing
- mp4ff (`github.com/Eyevinn/mp4ff` v0.51.0) — MP4 container manipulation (provider-node)

**Smart Contracts (Solidity):**
- Foundry — Build, test, deploy
  - Solc 0.8.24 pinned in `foundry.toml`
  - Profile: ci (fuzz runs 10,000x), fork (Base Sepolia replay), default (200 optimizer runs)
  - Format: 120-char lines, long int types, double quotes
- OpenZeppelin contracts (via `lib/openzeppelin-contracts` git submodule)

**Testing:**
- Vitest 3.2.4 (TS/JS unit tests, ES modules)
- Forge test (Solidity, foundry native)
- Playwright 1.59.1 (e2e tests in `apps/video/test:e2e`)

**Build/Dev:**
- Turbo 2.9.6 — Task orchestration across monorepo
  - Global deps: `tsconfig.base.json`, `biome.jsonc`, `mise.toml`
  - Global env: `NODE_ENV`, `CI`, chain/Privy/Cloudflare tokens, Sentry keys
  - Pass-through env: `NEXT_PUBLIC_*` vars (build-time inlined)
- Biome 1.9.4 — Code formatter and linter (replaces ESLint + Prettier)
  - Format: 2-space indent, 100-char width, LF line endings
  - Lint: strict TypeScript (no any, no unused imports/vars), import organization
  - Single quotes in JS, double in JSX, always semicolons, trailing commas
- lefthook 1.13.6 — Git hooks (pre-commit, commit-msg, pre-push)
  - Biome check on staged JS/TS/JSON
  - gofmt + go vet on Go files
  - forge fmt on Solidity (if foundry installed)
  - commitlint on commit messages
  - typecheck on pre-push (Turbo)

## Key Dependencies

**Critical (Frontend):**
- React 19.2.5, React DOM 19.2.5 — Component library
- Tailwind CSS 4.2.2 — Utility-first styling
  - `@tailwindcss/postcss` 4.2.2 — Postcss plugin for Tailwind v4
  - Tailwind preset in `@aevia/ui` for shared design system
- shadcn/ui (lucide-react icons, CVA, clsx, tailwind-merge) — Unstyled component system
  - Lucide React 0.468.0 — 400+ SVG icons
  - class-variance-authority 0.7.1 — Component style variants
  - clsx 2.1.1 — Conditional className merging
  - tailwind-merge 2.6.1 — Intelligent Tailwind class deduplication

**Protocol & Crypto (Frontend & Go):**
- viem 2.48.0 — Ethereum/EVM client (TypeScript, Base L2 RPC interactions)
- jose 5.10.0 — JSON Web Token/Signature (JWS/JWE)
- @bufbuild/protobuf 2.11.0 — Protobuf runtime (TS/JS, unmarshaling)
- multiformats 13.4.2 — Multiaddr, CID, multibase encoding
- go-ethereum (github.com/ethereum/go-ethereum v1.17.2) — Coordinator Go service (for contract ABI/events, RPC)

**Authentication:**
- @privy-io/react-auth 2.25.0 — Embedded smart wallet, Sign in with Wallet
- @privy-io/node 0.1.0 — Server-side session verification
- Privy app credentials via env vars `PRIVY_APP_ID` (client), `PRIVY_APP_SECRET` (server)
- Dev bypass via `AEVIA_DEV_BYPASS_AUTH` to skip auth in local e2e

**Media & P2P (Frontend):**
- p2p-media-loader-core 2.2.2, p2p-media-loader-hlsjs 2.2.2 — P2P-assisted HLS playback
- tus-js-client 4.3.1 — TUS protocol resumable uploads (not yet integrated in prod)

**Storage (Go):**
- badger/v4 v4.9.1 — Embedded key-value store (provider-node DHT cache, session state)

**Observability:**
- @sentry/nextjs 10.49.0 — Error tracking, source-map upload, browser console tunneling
- zerolog (github.com/rs/zerolog v1.35.0) — Structured logging in Go services

**Protocol & Code Generation:**
- buf — Protobuf code generation
  - `@bufbuild/protoc-gen-es` 2.11.0 — Protobuf → TypeScript/JavaScript
  - buf.work.yaml, buf.yaml, buf.gen.yaml define modules and code-gen targets
  - Generated code: `src/gen/pb/**` (workspace level)

**Infrastructure (CLI):**
- Wrangler 3.114.17 — Cloudflare CLI (Pages deploy, local dev with `pages dev`, Workers testing)
- TypeScript 5.9.3 — Type-checking compiler

## Configuration

**Environment:**
- `.env.local` — Developer credentials (Cloudflare API token, R2 keys, Privy secret, RPC URLs)
- `.env.example` — Template for all required vars (no secrets)
- Turbo `globalEnv` watches: `NODE_ENV`, `CI`, `CLOUDFLARE_ACCOUNT_ID`, `STREAM_API_TOKEN`, `STREAM_WEBHOOK_SECRET`, `SESSION_SIGNING_KEY`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `BASE_RPC_URL`, `BASE_CHAIN_ID`, `BASESCAN_API_KEY`
- Turbo `globalPassThroughEnv`: `NEXT_PUBLIC_*` vars (build-time inlined in bundles)

**Build Configuration:**
- `tsconfig.base.json` — Root TypeScript config (ES2022 target, strict mode, path aliases)
- `biome.jsonc` — Monorepo linting/formatting (VCS-aware git)
- `turbo.json` — Task definitions and caching strategy
- `pnpm-lock.yaml` — Reproducible dependency versions
- `mise.toml` — Runtime version pinning (Node 24, pnpm 10.30.1, Go 1.26)
- `foundry.toml` — Solidity compile/test config
- `lefthook.yml` — Git hooks manifest
- `postcss.config.mjs` — Tailwind integration (apps/video)
- Next.js config: `apps/video/next.config.ts` with Sentry and Cloudflare Pages adaptations
- Wrangler config: `wrangler.toml` (if present, not listed here but used for Pages preview)

## Platform Requirements

**Development:**
- macOS / Linux with Node.js 24, pnpm 10, Go 1.26
- Foundry (foundryup) for Solidity compilation and testing
- mise for runtime version management (replaces nvm/asdf)
- Git + lefthook for pre-commit/pre-push hooks

**Production:**
- Cloudflare Pages (Next.js App Router via `next-on-pages`)
- Cloudflare Workers (edge runtime for sensitive API routes marked `export const runtime = 'edge'`)
- Cloudflare R2 (object storage for video assets, VoD uploads)
- Cloudflare Stream (WHIP/WHEP ingest, HLS playback, adaptive bitrate)
- Cloudflare KV (session storage, caching)
- Base L2 (Sepolia testnet, Mainnet after audit) for smart contracts
- Go services deployed as standalone binaries (provider-node, coordinator, recorder, indexer)
  - Provider-node: HTTPS via Let's Encrypt (DNS-01 via Cloudflare API token)
  - Coordinator: RPC client to Base Sepolia/Mainnet

**Deployment Pipeline:**
- Turbo build cache (optional remote via `TURBO_TOKEN` / `TURBO_TEAM`)
- Biome format check (pre-commit, CI must pass)
- Playwright e2e tests (manual for now, `/test:e2e:ui`)
- Forge test (100% coverage required for contracts per ADR)
- `wrangler pages deploy` for production (Cloudflare Pages)

---

*Stack analysis: 2026-04-20*
