# aevia

> sovereign video protocol — live low-latency, persistent VOD, creator ownership, ethical moderation.
>
> **persistence does not imply distribution.**

Aevia is a protocol and reference client stack for video creators who live under permanent deplatforming risk — from governments, from algorithms, from DMCA automation, from terms-of-service drift. Content registered on the protocol is cryptographically anchored to its creator, distributed across a hybrid libp2p mesh, and governed by a transparent moderation layer that regulates reach without erasing existence.

For the current verifiable state — contract addresses on Base Sepolia, live backends, published RFCs, test counts, selected shipped work — see [`TRACTION.md`](./TRACTION.md).

## domains

- [aevia.video](https://aevia.video) — consumer PWA for broadcasters, viewers, and creators.
- [aevia.network](https://aevia.network) — protocol home: whitepaper, RFCs, AUP, governance, Provider Node operator docs.

## at a glance (from `TRACTION.md`, 2026-04-20)

- 4 contracts deployed and Sourcify-verified on Base Sepolia: `ContentRegistry`, `PersistencePool`, `RiskOracle`, `BoostRouter`.
- 3 WHIP ingest backends behind one API: Cloudflare Stream (default), aevia-mesh (libp2p SFU), Livepeer.
- 3 public libp2p WSS bootstraps for browser discovery.
- 10 RFCs published under `docs/protocol-spec/` (RFC-0 through RFC-9 + `mirror-selection-v1`).
- 8 accepted ADRs under `docs/adr/`.
- 103 Foundry tests across 4 Solidity contracts.
- Sentry in all three Next.js runtimes (browser, edge, server).

## monorepo layout

```
apps/
  video/            Next.js PWA → aevia.video                      (AGPL-3.0-or-later)
  network/          Next.js → aevia.network                         (AGPL-3.0-or-later)
packages/
  protocol/         wire format (Protobuf) + manifest schema       (Apache-2.0)
  ui/               Tailwind + shadcn/ui shared components         (MIT)
  auth/             Privy-wrapped DID auth + EIP-191 signing       (Apache-2.0)
  libp2p-config/    shared libp2p transport + discovery config     (Apache-2.0)
  contracts/        Solidity (Foundry) — ContentRegistry /
                    PersistencePool / RiskOracle / BoostRouter     (Apache-2.0)
services/
  provider-node/    Go — libp2p SFU + HLS muxer + mirror + DHT     (AGPL-3.0-or-later)
  recorder/         Go — Cloudflare Stream → R2 bridge             (AGPL-3.0-or-later)
  manifest-svc/     Go — JSON-LD manifest signer                    (AGPL-3.0-or-later)
  indexer/          Go — ContentRegistry on-chain indexer          (AGPL-3.0-or-later)
docs/
  protocol-spec/    RFC-style specification (v0.1, 10 RFCs)
  aup/              Acceptable Use Policy (normative text in RFC-4)
  adr/              Architecture Decision Records
infra/
  cloudflare/       wrangler configs (Workers, Pages, R2, Stream, KV)
  base/             Foundry deployment scripts (Base L2)
  local-dev/        overmind Procfile + docker-compose for local orchestration
```

## prerequisites

- Node.js 24 LTS
- pnpm 10
- Go 1.26
- Foundry (latest, via `foundryup`)
- `wrangler` ships as a dev dependency of the root workspace

Use [mise](https://mise.jdx.dev/) to pin runtime versions automatically:

```bash
mise install
```

## quickstart

```bash
pnpm install
pnpm dev        # runs apps + services in parallel
pnpm build      # builds everything
pnpm test       # runs tests across the workspace
```

Contract tests:

```bash
cd packages/contracts
forge test --summary
```

## architecture layers

1. **Capture & live ingest.** WHIP (OBS Studio 30+ native) or WebRTC browser publish. Glass-to-glass under two seconds.
2. **Distribution.** Cloudflare Stream (default), `aevia-mesh` libp2p SFU (`services/provider-node`), or Livepeer — selectable per broadcast via `body.backend`. Per-backend URL dispatch.
3. **Persistence and addressing.** Cloudflare R2 as the ingest anchor, IPFS/libp2p as the replication mesh, Filecoin/Arweave as cold storage.
4. **Social graph.** DIDs (Privy embedded wallet on Base) + signed JSON-LD manifests + on-chain `ContentRegistry`.
5. **Economy.** `BoostRouter` non-custodial 4-way splitter (RFC-8 §4). `PersistencePool` stablecoin payouts to Provider Node operators. `RiskOracle` gates boost and ranking on Risk Score ≤ θ_feed (3000 bps).
6. **Trust and moderation.** Risk Score (RFC-6) + multi-denominational Jury (RFC-7). Governs reach, not existence — IPFS bits remain addressable regardless.

## license

Aevia uses a per-package license split:

- **Apache-2.0** — protocol layer (`packages/protocol`, `packages/contracts`, `packages/auth`, `packages/libp2p-config`). Maximises reimplementation and alternate clients.
- **MIT** — UI (`packages/ui`). Maximum permissibility for adoption in unrelated projects.
- **AGPL-3.0-or-later** — applications and network services (`apps/*`, `services/*`). Network copyleft prevents proprietary SaaS forks of the reference stack.

The root `LICENSE` file is Apache-2.0 and covers root-level configuration files (biome, tsconfig, turbo, mise, lefthook, commitlint, go.work). Each subdirectory carries its own `LICENSE` that overrides as scoped. Full map and rationale: [`LICENSES.md`](./LICENSES.md).

## status

- Active milestone: Phase 3 — decentralized viewer distribution.
- No release tags yet. `v0.1.0-alpha` is gated on the M9 audio transcoder (Opus → AAC) because iOS Safari does not play fMP4 + Opus.
- Audit: not engaged. Mainnet deployment of the economic contracts is gated on an external security review.

Further context: [`TRACTION.md`](./TRACTION.md), [`SECURITY.md`](./SECURITY.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`docs/protocol-spec/README.md`](./docs/protocol-spec/README.md).

---

Built in the open. No gatekeepers.
