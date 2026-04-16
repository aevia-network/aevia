# Aevia

> Sovereign video social protocol.
> Low-latency live · automatic VOD · viral clips · creator ownership · ethical moderation.
>
> **Persistence does not imply distribution.**

Aevia is a protocol and reference client stack for video creators who live under permanent deplatforming risk — from governments, from algorithms, from DMCA automation, from terms-of-service drift. Content registered on the protocol is cryptographically anchored to its creator, distributed across a hybrid P2P mesh, and governed by a transparent moderation layer that regulates reach without erasing existence.

## Domains

- [aevia.video](https://aevia.video) — consumer PWA (broadcasters, viewers, creators)
- [aevia.network](https://aevia.network) — protocol, docs, gateways, governance, Provider Node operators

## Monorepo layout

```
apps/
  video/            Next.js PWA → aevia.video
  network/          Next.js → aevia.network (docs, dev portal, gateway UI)
packages/
  protocol/         Wire format (Protobuf) + manifest schema (JSON-LD)
  ui/               Tailwind + shadcn/ui shared components
  auth/             Privy-wrapped auth helpers (DID, session, signing)
  libp2p-config/    Shared libp2p transport + discovery config (Sprint 3+)
  contracts/        Solidity (Foundry) — ContentRegistry, PersistencePool, CreditEscrow, ModerationRegistry
services/
  provider-node/    Go — infrastructure binary (pins content, earns credits)
  recorder/         Go — Cloudflare Stream → R2 bridge
  manifest-svc/     Go — JSON-LD manifest signer
  indexer/          Go — reads Content Registry on-chain
docs/
  protocol-spec/    RFC-style specification (v0.1)
  aup/              Acceptable Use Policy
  adr/              Architecture Decision Records
infra/
  cloudflare/       wrangler configs (Workers, Pages, R2, Stream, KV)
  base/             Foundry deployment scripts (Base L2)
  local-dev/        docker-compose + Procfile for local orchestration
```

## Prerequisites

- Node.js 24 LTS
- pnpm 10
- Go 1.26
- Foundry (latest, via `foundryup`)
- `wrangler` is included as a dev dependency

Use [mise](https://mise.jdx.dev/) to pin runtime versions automatically:

```bash
mise install
```

## Quickstart

```bash
pnpm install
pnpm dev        # runs apps + services in parallel
pnpm build      # builds everything
pnpm test       # runs tests across the workspace
```

## Architecture layers

1. **Capture & Live** — WHIP/WHEP (WebRTC over HTTP), sub-500ms latency
2. **Media Processing** — Cloudflare Stream (day 1), evolving to self-hosted GStreamer
3. **Persistence & Addressing** — Cloudflare R2 (anchor) + IPFS/libp2p (mesh) + Filecoin/Arweave (cold)
4. **Social Graph** — DIDs + signed JSON-LD manifests + on-chain Content Registry
5. **Economy** — credits (fiat-abstracted) → USDC on Base L2; social engagement funds pinning
6. **Trust & Moderation** — multimodal AI + Risk Score + governance with appeal

## License

Aevia uses a per-package license split. See [LICENSES.md](./LICENSES.md).

## Status

Phase 0 — architecture blueprint consolidated.
Sprint 0 — monorepo scaffold (this commit).
Sprint 1 — Hello Live + Protocol Spec v0.1 (in progress).

---

Built in the open. No gatekeepers.
