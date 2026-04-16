# ADR-0001: Monorepo tooling

- **Status:** Accepted
- **Date:** 2026-04-16
- **Authors:** @Leeaandrob

## Context

Aevia is polyglot from day 1: TypeScript apps (Next.js PWAs), Go services (Provider Node, recorder, manifest signer, indexer), Solidity contracts (Base L2), and shared schema/wire-format packages consumed across both TS and Go. The repository is greenfield; we need to pick tooling that:

- Enforces lockstep evolution of shared types between TypeScript and Go
- Runs tests, builds, and dev loops efficiently for a solo-to-small-team cadence
- Keeps CI fast by caching intelligently
- Does not lock the project into proprietary SaaS beyond what we already accept (Cloudflare)

## Decision

- **Monorepo orchestration:** [Turborepo](https://turbo.build/) over Nx or plain pnpm workspaces. Turbo is minimal, invisible when idle, supports pass-through scripts for Go services via each package's `package.json`, and integrates cleanly with remote caching.
- **Package manager:** pnpm 10 with workspaces + [catalogs](https://pnpm.io/catalogs) to eliminate version drift across React/Next/TypeScript versions.
- **Go orchestration:** `go.work` Go workspaces for local cross-service development; each service remains an independent Go module.
- **Language-agnostic wire format:** Protobuf v3 via [buf](https://buf.build/) — generated code is committed to the repository for diffability and to avoid a build-time dependency on `buf` in consumer projects.
- **Linter + formatter:** [Biome 1.9.x](https://biomejs.dev/) replaces ESLint + Prettier for TypeScript/JSON. Go uses `gofmt` + `go vet`. Solidity uses `forge fmt`.
- **Git hooks:** [lefthook](https://github.com/evilmartians/lefthook) over Husky — faster, YAML-configured, parallel by default, and written in Go (no Node runtime dependency at hook time).
- **Runtime pinning:** [mise](https://mise.jdx.dev/) replaces `nvm`/`asdf`, pinning Node 24 LTS, pnpm 10.30.1, and Go 1.26 in a single `mise.toml`.
- **Versioning:** [changesets](https://github.com/changesets/changesets) for publishable packages (`packages/*`); apps and services are versioned by git tags. No publishing to npm in Sprint 0 — infrastructure set up but gated.

## Alternatives considered

- **Nx:** Overkill for the current team size. Generator/plugin complexity adds friction; Nx shines for Angular/large TS-only monorepos.
- **pnpm workspaces alone:** Viable but loses caching of task graphs, remote cache, and declarative pipeline semantics that Turbo provides.
- **Hardhat instead of Foundry:** See future ADR-0002 for contract tooling. Summary: Foundry wins on fuzz/invariant testing and compile speed.
- **Turbopack for dev:** Next.js default in v15. Adopted by app builds; no monorepo implication.
- **ESLint + Prettier:** Works but is slower, requires plugin juggling, and produces Prettier↔ESLint conflicts. Biome is Rust, unified, and 30-50× faster.
- **Vercel for hosting:** Rejected by founder decision (D2) in favor of 100% Cloudflare stack to preserve sovereignty posture and tooling coherence with Stream/R2/KV/Pages.

## Consequences

**Positive**

- Dev loop: `pnpm dev` runs all apps + services in parallel via Turbo filters + overmind.
- CI: path-filtered jobs with Turbo remote cache target sub-5min PR feedback.
- Type safety: shared types from Protobuf mean wire-format regressions are caught at compile time in both TypeScript and Go.
- License strategy (see `LICENSES.md`) is cleanly enforced at the workspace boundary.

**Negative / cost**

- Turbo passthrough for Go requires one-time learning curve for contributors unfamiliar with mixed-language monorepos.
- Biome is newer than ESLint; some edge rules (e.g., `@next/eslint-plugin-next` granularity, deep `jsx-a11y`) have no exact Biome equivalent. Mitigation: run `next lint` in CI for Next.js apps; Biome as the workspace default.
- mise requires a one-line install for new contributors. Trivial.

**Reversibility**

- Moving off Turbo to Nx: possible but costly (scripts rewrite).
- Moving off Biome to ESLint+Prettier: trivial (rules portable).
- Moving off Protobuf to JSON Schema or OpenAPI: costly (rewrites generated code).

## References

- [Turborepo docs](https://turbo.build/repo/docs)
- [pnpm catalogs](https://pnpm.io/catalogs)
- [Go workspaces (1.18+)](https://go.dev/ref/mod#workspaces)
- [Biome migration guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [buf — protobuf workflow](https://buf.build/docs/introduction)
- Agent A (Plan) synthesis — Sprint 0 planning session 2026-04-16
