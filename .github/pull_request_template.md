## What

<!-- One-paragraph summary of the change. -->

## Why

<!-- Motivation, context, linked issue. -->

## How

<!-- Key implementation decisions, tradeoffs, design notes. -->

## Check

- [ ] Commit messages follow Conventional Commits (`<type>(<scope>): <subject>`)
- [ ] Relevant tests added or updated
- [ ] `pnpm check && pnpm typecheck && pnpm test` passes locally
- [ ] Documentation updated (spec, ADR, README) when behavior changes
- [ ] For contract changes: invariants documented, tests cover happy + unhappy paths
- [ ] For protocol changes: wire-format breaking changes flagged; `@context` versioned if JSON-LD schema changes
- [ ] Thesis respected: "Persistence does not imply distribution."
