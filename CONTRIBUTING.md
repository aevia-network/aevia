# Contributing to Aevia

Thank you for your interest in Aevia. This document describes how to work on the codebase.

## Development setup

```bash
# install runtime versions (Node 24 LTS, pnpm 10, Go 1.26)
mise install

# install dependencies
pnpm install

# install git hooks
pnpm exec lefthook install

# start dev loop
pnpm dev
```

## Branch model

- `main` — protected. All changes land via pull request.
- Feature branches: `feat/<scope>-<short-description>` (e.g. `feat/video-whip-client`).
- Bugfix branches: `fix/<scope>-<short-description>`.
- All PRs must pass CI (lint, typecheck, tests, contracts, proto-breaking).

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) with enforced scopes.

Format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.

Allowed scopes (see `commitlint.config.mjs`):

- Apps: `video`, `network`
- Services: `provider-node`, `recorder`, `manifest-svc`, `indexer`
- Packages: `protocol`, `ui`, `auth`, `libp2p-config`, `contracts`
- Cross-cutting: `infra`, `ci`, `docs`, `deps`, `repo`, `release`

Example:

```
feat(video): add WHIP broadcast client with device selector
```

## Code style

- TypeScript: formatted and linted by [Biome](https://biomejs.dev/). Run `pnpm check` before committing.
- Go: formatted by `gofmt` and vetted by `go vet`. Enforced by lefthook pre-commit.
- Solidity: formatted by `forge fmt`. Enforced by lefthook pre-commit.

## Architecture Decision Records (ADRs)

Significant architectural choices are documented in `docs/adr/`. New proposals follow the template in `docs/adr/0000-template.md`.

## Security

See [SECURITY.md](./SECURITY.md) for the vulnerability reporting policy.

## Licensing

Contributions are accepted under the license of the directory in which they land. See [LICENSES.md](./LICENSES.md).

By submitting a pull request, you certify that you have the right to license your contribution under the applicable license.
