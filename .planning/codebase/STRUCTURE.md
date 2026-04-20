# Codebase Structure

**Analysis Date:** 2026-04-20

## Directory Layout

```
videoengine/
├── apps/                           # Next.js + frontend applications
│   ├── video/                      # aevia.video PWA (consumer playback + creator dashboard)
│   │   ├── src/
│   │   │   ├── app/                # Next.js App Router pages + API routes
│   │   │   ├── lib/                # Shared client & server logic (WHIP/WHEP, mesh, WebRTC)
│   │   │   ├── components/         # React components (page-level, layouts)
│   │   │   └── middleware.ts       # Auth gate (Privy cookie check)
│   │   ├── e2e/                    # Playwright e2e tests
│   │   └── package.json
│   └── network/                    # aevia.network editorial (operator docs, protocol spec, AUP)
│       ├── src/
│       │   ├── app/                # Internationalized routes ([locale]/spec, /aup, /operators)
│       │   └── components/
│       └── package.json
│
├── packages/                       # Shared monorepo packages (TS, Solidity, Protobuf)
│   ├── contracts/                  # Smart contracts (Solidity 0.8.24, Foundry)
│   │   ├── src/                    # Contract source (BoostRouter, RiskOracle, ContentRegistry, etc.)
│   │   ├── test/                   # Foundry tests (forge test)
│   │   ├── script/                 # Deploy scripts (forge script)
│   │   ├── out/                    # Compiled artifacts (gitignored)
│   │   ├── deployments/            # Deployment records (addresses, tx hashes)
│   │   └── package.json
│   ├── protocol/                   # Protobuf + generated wire format
│   │   ├── proto/                  # .proto definitions (manifest.proto, etc.)
│   │   ├── src/                    # Generated TypeScript code + hand-written adapters
│   │   └── package.json
│   ├── auth/                       # Privy integration + session handling
│   │   ├── src/
│   │   │   ├── client.ts           # usePrivy hooks, wallet context
│   │   │   └── server.ts           # readAeviaSession (RSC helper)
│   │   └── package.json
│   ├── ui/                         # Design system components (shadcn/ui + custom)
│   │   ├── src/
│   │   │   ├── components/         # Reusable UI (MeshDot, PermanenceStrip, BoostButton, etc.)
│   │   │   └── lib/                # Tailwind utilities, theme
│   │   └── package.json
│   ├── libp2p-config/              # Shared libp2p bootstrap & peer configuration
│   │   ├── src/
│   │   │   ├── bootstrap.ts        # Provider multiaddrs, bootstrap peers
│   │   │   └── config.ts           # Shared node config
│   │   └── package.json
│   └── README.md
│
├── services/                       # Go backend services
│   ├── provider-node/              # Main media node (WHIP, WHEP, HLS, mirror, DHT)
│   │   ├── cmd/
│   │   │   ├── provider/main.go    # Provider node entry point
│   │   │   └── meshdebug/main.go   # Mesh debugging utility
│   │   ├── internal/
│   │   │   ├── whip/               # WHIP server + session lifecycle
│   │   │   ├── whep/               # WHEP server + WebRTC playback
│   │   │   ├── mirror/             # Mirror fan-out client/server (libp2p)
│   │   │   ├── node/               # Main libp2p host + lifecycle
│   │   │   ├── mesh/               # Mesh coordination (peer ranking, health checks)
│   │   │   ├── dht/                # DHT operations (announce, lookup)
│   │   │   ├── content/            # Content storage abstraction
│   │   │   ├── pinning/            # Merkle tree accumulation + manifest signing
│   │   │   ├── config/             # Config parsing
│   │   │   └── [other modules]
│   │   ├── storage/                # Storage backends (local filesystem, R2)
│   │   ├── por/                    # Proof-of-replication (reserved M3)
│   │   └── go.mod
│   ├── recorder/                   # Re-encode + archive to R2
│   │   ├── cmd/recorder/main.go
│   │   └── go.mod
│   ├── manifest-svc/               # Offline manifest CID + signing
│   │   ├── cmd/manifest/main.go
│   │   └── go.mod
│   ├── indexer/                    # Chain event polling + read-optimized DB
│   │   ├── cmd/indexer/main.go
│   │   └── go.mod
│   ├── coordinator/                # Session coordination (reserved M4)
│   │   ├── cmd/coordinator/main.go
│   │   └── go.mod
│   └── go.mod (workspace root, used by go.work)
│
├── infra/                          # Deployment & local dev orchestration
│   ├── local-dev/
│   │   ├── Procfile.dev            # overmind process definitions (video, network, provider, etc.)
│   │   └── .env.example            # Template env vars
│   ├── cloudflare/                 # Wrangler config (Pages deployment)
│   │   └── wrangler.toml
│   └── scripts/                    # Deployment helpers
│
├── docs/                           # Specification + decision records
│   ├── adr/                        # Architecture Decision Records (ADR-0001 through 0011)
│   ├── protocol-spec/              # RFC-style protocol specification
│   │   ├── 1-overview.md
│   │   ├── 3-content-model.md
│   │   ├── 4-moderation-values.md
│   │   ├── 6-risk-score.md
│   │   ├── 7-governance.md
│   │   └── 8-economic-architecture.md
│   ├── aup/                        # Acceptable Use Policy (in progress)
│   └── research/                   # Research notes
│
├── root config files
│   ├── turbo.json                  # Turborepo task graph + caching config
│   ├── go.work                     # Go workspace definition
│   ├── tsconfig.base.json          # Base TypeScript config (extended by apps/packages)
│   ├── biome.jsonc                 # Biome (linter + formatter) configuration
│   ├── package.json                # Root pnpm workspaces + scripts
│   ├── pnpm-lock.yaml              # Lockfile (committed)
│   ├── mise.toml                   # Runtime pinning (Node 24 LTS, pnpm 10, Go 1.26)
│   ├── lefthook.yml                # Git hooks (pre-commit, commit-msg)
│   ├── .env.example                # Template for .env (secrets) and .env.local (dev overrides)
│   ├── README.md                   # Project overview + quickstart
│   ├── SETUP.md                    # Detailed local setup + Cloudflare credentials
│   ├── CLAUDE.md                   # Authorship + conventions (this project)
│   ├── LICENSES.md                 # Per-workspace license split (Apache/AGPL/MIT)
│   └── SECURITY.md                 # Vulnerability reporting
│
└── .planning/codebase/             # Generated codebase analysis documents
    ├── ARCHITECTURE.md             # This document
    ├── STRUCTURE.md
    ├── CONVENTIONS.md
    ├── TESTING.md
    ├── STACK.md
    ├── INTEGRATIONS.md
    └── CONCERNS.md
```

## Directory Purposes

**apps/video:**
- Purpose: Consumer-facing Next.js PWA for live broadcast playback and creator dashboard
- Contains: Page layouts, API routes (WHIP/WHEP session creation), WebRTC client logic, mesh connectivity
- Key files: `src/app/layout.tsx` (root), `src/middleware.ts` (auth gate), `src/app/dashboard/page.tsx` (creator), `src/app/live/[id]/page.tsx` (viewer)

**apps/network:**
- Purpose: Editorial and protocol documentation website (internationalized)
- Contains: Dynamic routes for spec pages, operator docs, AUP, FAQ, roadmap
- Key files: `src/app/[locale]/spec/[slug]/page.tsx` (protocol spec navigation)

**packages/contracts:**
- Purpose: Smart contracts deployed to Base L2 (Sepolia → Mainnet)
- Contains: Solidity 0.8.24 sources, Foundry tests (100% coverage requirement per ADR 0008/0009), deploy scripts
- Key files: `src/BoostRouter.sol` (non-custodial split), `src/RiskOracle.sol` (score publication), `src/ContentRegistry.sol` (manifest registry)

**packages/protocol:**
- Purpose: Wire-format definitions and generated code (TypeScript + Go)
- Contains: Protobuf `.proto` files, auto-generated marshaling code
- Key files: `proto/aevia/v1/manifest.proto` (H.264 manifest schema)

**packages/auth:**
- Purpose: Privy wallet integration + session management
- Contains: Hooks (usePrivy, useSignMessage), server-side session reader for RSCs
- Key files: `src/client.ts` (client context), `src/server.ts` (readAeviaSession)

**packages/ui:**
- Purpose: Design system components (design language: Aevia Sovereign Editorial in Stitch)
- Contains: shadcn/ui + custom signature components (MeshDot, PermanenceStrip, VigilChip, ReactionStrip, RankingSwitcher, LiveTile)
- Key files: All in `src/components/` — built once, consumed by both apps/video and apps/network

**packages/libp2p-config:**
- Purpose: Shared peer bootstrap and node configuration for browser + provider-node
- Contains: Bootstrap multiaddrs, relay peers, DHT config
- Key files: `src/bootstrap.ts` (provider-node WSS multiaddrs), `src/config.ts` (GossipSub topic naming, codec setup)

**services/provider-node:**
- Purpose: Decentralized media node (WHIP ingest, HLS muxing, WHEP playback, mirror relay, DHT announce)
- Contains: Go modules for protocol servers, peer management, content storage
- Key internal modules:
  - `internal/whip/` — WHIP protocol server + session lifecycle
  - `internal/whep/` — WHEP playback server
  - `internal/mirror/` — Replication client/server via libp2p
  - `internal/node/` — libp2p host + routing
  - `internal/pinning/` — H.264 Merkle tree accumulation + CID publication
  - `storage/` — Pluggable content store (filesystem or R2)

**services/recorder:**
- Purpose: Batch re-encode live streams to H.265, write to R2 for fallback archival
- Contains: WHEP client, FFmpeg wrapper, R2 uploader

**services/manifest-svc:**
- Purpose: Offline manifest computation and signing
- Contains: CID computation, LLC key signing (for license assertion)

**services/indexer:**
- Purpose: Watch on-chain events, maintain read-optimized view of content + scores
- Contains: Base RPC polling, event parsing, database writes

**infra/local-dev:**
- Purpose: Local dev environment orchestration
- Contains: overmind Procfile (all processes: video app, network app, provider, recorder, manifest, indexer)
- Key file: `Procfile.dev` — defines process targets for `pnpm dev` + overmind

## Key File Locations

**Entry Points:**
- `apps/video/src/app/layout.tsx` — Root layout, Providers context setup, fonts, theme
- `apps/video/src/middleware.ts` — Privy auth gate (redirects to `/` if missing cookie)
- `apps/network/src/app/[locale]/layout.tsx` — Internationalized root layout
- `services/provider-node/cmd/provider/main.go` — Go provider-node main
- `services/recorder/cmd/recorder/main.go` — Re-encoder main
- `services/indexer/cmd/indexer/main.go` — Chain indexer main

**Configuration:**
- `turbo.json` — Monorepo task graph (build, dev, test, lint, typecheck, proto:generate)
- `go.work` — Go workspace (5 services: provider-node, recorder, manifest-svc, indexer, coordinator)
- `tsconfig.base.json` — Base TypeScript config with path aliases (`@aevia/*`, `@/`)
- `biome.jsonc` — Biome linter + formatter rules (replaces ESLint + Prettier)
- `mise.toml` — Runtime pinning (Node 24 LTS, pnpm 10.30.1, Go 1.26.1)
- `.env.example` — Template for env vars (Privy, Cloudflare, Base RPC, etc.)

**Core Logic:**
- `apps/video/src/app/api/lives/route.ts` — Live session creation (picks backend: cloudflare, livepeer, aevia-mesh)
- `apps/video/src/lib/webrtc/whip.ts` — WHIP client implementation
- `apps/video/src/lib/webrtc/whep.ts` — WHEP client with failover rotation
- `apps/video/src/lib/mesh/p2p.ts` — Browser libp2p node scaffold
- `apps/video/src/lib/p2p/chunk-relay.ts` — HLS chunk relay via p2p-media-loader-hlsjs
- `packages/auth/src/server.ts` — RSC helper to read Privy session
- `packages/contracts/src/BoostRouter.sol` — Non-custodial USDC splitter
- `packages/contracts/src/RiskOracle.sol` — On-chain score publication

**Testing:**
- `apps/video/e2e/` — Playwright e2e tests
- `packages/contracts/test/` — Foundry tests (100% coverage for BoostRouter, RiskOracle)

**Documentation:**
- `docs/adr/` — ADR-0001 through ADR-0011 decision records
- `docs/protocol-spec/` — RFC-style protocol specification
- `README.md` — Project overview + quickstart
- `SETUP.md` — Detailed local dev setup + Cloudflare credentials walkthrough

## Naming Conventions

**Files:**
- TypeScript/React: `camelCase.ts`, `camelCase.tsx`, `lowercase-dir/` (no uppercase in dir names)
  - API routes: `route.ts` (Next.js convention)
  - Components: `PascalCase` exports (e.g., `export function MeshDot() {}`)
  - Utilities: `camelCase` exports (e.g., `export function resolveSessionProvider() {}`)
- Go: `snake_case.go` (Go convention), `package main` for cmd entry points
  - Interfaces: `PascalCase` (e.g., `type FrameSink interface`)
  - Functions: `PascalCase` (exported) or `lowerCamelCase` (internal)
- Solidity: `PascalCase.sol` matching contract name (e.g., `BoostRouter.sol`)
- Protobuf: `snake_case.proto` (convention), messages in `PascalCase`

**Directories:**
- Feature dirs: `kebab-case` (e.g., `provider-node`, `manifest-svc`, `libp2p-config`)
- Internal modules: `snake_case` (e.g., `internal/content`, `internal/dht`)
- Page routes: Mirrors URL structure (e.g., `app/live/[id]/` for `/live/:id`)
- Layout groups: Parentheses (e.g., `app/(auth)/` for shared auth layout, not in URL)

**Identifiers (Code):**
- Variables: `camelCase` (both TS and Go)
- Constants: `UPPER_SNAKE_CASE` (Go convention), `camelCase` (TS with `const`)
- Type/Interface: `PascalCase` (TS + Go + Solidity)
- Enum variants: `UPPER_SNAKE_CASE` (Solidity), `PascalCase` (Go)

## Where to Add New Code

**New Feature (e.g., a new broadcast backend option):**
- Primary code: `apps/video/src/app/api/lives/route.ts` (backend enum), `apps/video/src/lib/webrtc/whip-*.ts` (new client)
- Tests: `apps/video/e2e/` (Playwright e2e for UI)
- Types: `packages/protocol/src/` if shared with Go; otherwise inline in app

**New Component/Module (UI):**
- Implementation: `packages/ui/src/components/PascalCase.tsx` (if reusable across apps) or `apps/video/src/components/PascalCase.tsx` (if video-specific)
- Tests: Co-located `.test.tsx` or in `apps/video/e2e/`
- Exports: Via `packages/ui/src/index.ts` barrel export if in shared lib

**New Utility (Shared):**
- Implementation: `packages/libp2p-config/src/` (if related to peer config), `packages/auth/src/` (if auth-related), or `apps/video/src/lib/` (if video-specific)
- Exports: Via barrel file or direct import

**New Go Service:**
- Location: `services/{service-name}/`
- Structure: Mirror provider-node layout (`cmd/`, `internal/`, `go.mod`)
- Integration: Add to `go.work` use directive + `infra/local-dev/Procfile.dev`
- Turbo: Add `package.json` with build/test/clean scripts (pass-through to Go)

**New Smart Contract:**
- Location: `packages/contracts/src/NewContract.sol`
- Tests: `packages/contracts/test/NewContract.t.sol` (Foundry)
- Deploy: Add script to `packages/contracts/script/DeployNewContract.s.sol`
- Coverage: Run `forge coverage` — must maintain 100% per ADR 0008/0009

**New Page Route (Editor/Operator docs):**
- Location: `apps/network/src/app/[locale]/new-section/page.tsx` (follows i18n pattern)
- Navigation: Update route manifest or sidebar if applicable
- Translations: Add locale variants in subdirectories if multi-lang required

**New Protocol Message:**
- Definition: `packages/protocol/proto/aevia/v1/new_message.proto`
- Generation: Run `pnpm proto:generate` (buf will update `packages/protocol/src/gen/`)
- TypeScript usage: Import from `@aevia/protocol`
- Go usage: Import from generated Go code in services

## Turbo Pipeline

**Global dependencies** (invalidate all tasks):
- `tsconfig.base.json`, `biome.jsonc`, `.env`, `.env.local`, `mise.toml`

**Global env vars** (available to all tasks):
- `NODE_ENV`, `CI`, `CLOUDFLARE_ACCOUNT_ID`, `STREAM_API_TOKEN`, `PRIVY_APP_ID`, `BASE_RPC_URL`, `BASE_CHAIN_ID`, `BASESCAN_API_KEY`

**Pass-through env vars** (available to NEXT_PUBLIC_* in build):
- `NEXT_PUBLIC_*` variables (any prefixed with this are available in browser)

**Key task definitions:**
- `build`: Depends on `^build` (deps first), `proto:generate`. Outputs `.next/**`, `dist/**`, `bin/**`, `out/**`.
- `dev`: Cache disabled, persistent, depends on `^build`. Runs each app/service in watch mode.
- `test`: Depends on `^build`. Outputs `coverage/**`.
- `lint`: Runs biome check
- `typecheck`: Depends on `^build`, `proto:generate`. No output (side-effect only).
- `proto:generate`: Inputs `proto/**/*.proto`, `buf.yaml`. Outputs `src/gen/**`, `**/gen/pb/**`.
- `clean`: Cache disabled. Wipes build artifacts.

**Run examples:**
```bash
pnpm build                         # Build all workspaces
pnpm --filter @aevia/video build   # Build only video app
pnpm dev                           # Dev all apps + services (via overmind)
pnpm test                          # Test all workspaces
pnpm lint                          # Lint all
pnpm proto:generate                # Regenerate .proto → TS/Go
```

## Go Workspaces

`go.work` at repo root defines:
```
use (
    ./services/provider-node
    ./services/recorder
    ./services/manifest-svc
    ./services/indexer
    ./services/coordinator
    ./deploy/e2e/whipclient       # e2e test client
)
```

Each service is an independent Go module with `go.mod`. The workspace enables:
- `go run ./services/provider-node/cmd/provider` works from repo root
- Import shared code via `github.com/Leeaandrob/aevia/services/provider-node/internal/...`
- Shared types in `packages/protocol/src/gen/pb/` (Protobuf-generated Go code)

**Running a service locally:**
```bash
cd services/provider-node && go run ./cmd/provider --data-dir /tmp/provider
# or via Procfile.dev: overmind start provider
```

## Special Directories

**apps/video/.vercel/**
- Purpose: Generated by `next-on-pages` (Cloudflare Pages adapter)
- Generated: Yes (build artifact)
- Committed: No (.gitignore)

**packages/contracts/out/**
- Purpose: Compiled Solidity artifacts (JSON ABIs + bytecode)
- Generated: Yes (`forge build`)
- Committed: No (.gitignore)

**packages/contracts/deployments/**
- Purpose: Deployment records (contract addresses, tx hashes, block numbers)
- Generated: No (manually created by deploy scripts + team consensus)
- Committed: Yes (source of truth for deployed contracts)

**services/provider-node/storage/**
- Purpose: Local content store (HLS segments, manifest CIDs, pinned frames)
- Generated: Yes (during runtime)
- Committed: No (.gitignore)

**docs/protocol-spec/**
- Purpose: Normative protocol specification (RFC-style, living document)
- Generated: No
- Committed: Yes (evolves with ADRs)

**.planning/codebase/**
- Purpose: Generated codebase analysis documents (ARCHITECTURE.md, etc.)
- Generated: Yes (`/gsd-map-codebase` command)
- Committed: Yes (for CI reference, but regenerated frequently)

---

*Structure analysis: 2026-04-20*
