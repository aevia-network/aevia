# Aevia — repository conventions

Authoritative rules for authoring and evolving this repository. Read first.

## Thesis

> Persistence does not imply distribution.

Every design decision derives from this axiom. Content registered on the protocol is permanent; distribution (feed, ranking, promotion, recommendation) is regulated off-chain via the Risk Score and governance. Do not reverse the direction of this axiom in code, docs, or UX copy.

## Authorship and attribution

Every commit, file, and prose line is authored by the local `git config user.name` / `user.email`. That is the only identity that appears.

**Never add**:

- `Co-Authored-By: ...` trailer lines of any kind
- References to AI assistants, tools, or agents (by name, company, or generic label)
- Phrases like "generated with", "written by", "assisted by" paired with a tool name
- Emoji robot/tool signatures (🤖, ⚡, etc.) as attribution
- Vendor names as tool attribution (Anthropic, OpenAI, Google, Cursor, Copilot, etc.)

The tooling used is invisible. If a reader cannot tell how a file was produced, that is the correct result.

## Language

- **User-facing copy** (UI strings, `README.md`, `SETUP.md`, product docs): Brazilian Portuguese (pt-BR), lowercase. Exception: the "LIVE" badge in the error color per the design system.
- **Code** (identifiers, types, inline comments): English.
- **Protocol specification** (`docs/protocol-spec/*`): English, RFC 2119 style (MUST / SHOULD / MAY).
- **Commit messages**: English, Conventional Commits with scopes from `commitlint.config.mjs`.
- **Replies to the founder in chat**: pt-BR by default.

## Stack invariants

Not negotiable without an ADR update:

| Layer | Choice |
|---|---|
| Hosting | Cloudflare only (Pages + Workers + R2 + Stream + KV). **No Vercel.** |
| Auth | Privy — embedded smart wallet on Base |
| Blockchain | Base L2 (Sepolia → Mainnet after external audit) |
| Contracts | Foundry + Solidity 0.8.24 + Cancun EVM |
| Frontend | Next.js 15 App Router + TypeScript + Tailwind 4 + shadcn/ui |
| Services | Go 1.26 + go-libp2p (Sprint 3+) |
| Monorepo | Turborepo + pnpm 10 + Go workspaces + buf |
| Formatter / linter | Biome 1.9 (**not** ESLint + Prettier) |
| Git hooks | lefthook (**not** Husky) |
| Runtime pinning | mise (`mise.toml`) |
| Node version | 24 LTS |

## Design system

Source of truth: Stitch project `12044695711077109600`, DS "Aevia — Sovereign Editorial".

- **Palette**: Verdigris `#3F6B5C` primary · Creamy Gold `#E8B86D` secondary (economy only) · Sage `#A8C3B5` tertiary (mesh indicators only) · Ink `#0F1115` background · Bone `#F3EEE4` on-surface · Garnet `#B83B3B` error.
- **Radius**: 8px (Round-8) on containers; pill on avatars and permanence strip caps. Never exceed 8 px.
- **Fonts**: Sora (headline 600 / 700) · Inter (body 400 / 500) · Geist (label 500) via `next/font`.
- **No-Line rule**: tonal layering over 1 px borders. Only exception: Live Tile 2 px `primary_dim` (`#5A8F7E`).
- **Icons**: Lucide only. No emoji in chrome.
- **Voice**: dignified, no hype. "apoie este criador" not "credit transfer". "sua cópia é mantida por 12 peers" not "mesh: 12 nodes".
- Signature components in `@aevia/ui`: `MeshDot`, `PermanenceStrip`, `VigilChip`. Planned: `ReactionStrip`, `RankingSwitcher`, `LiveTile`.

## Acceptable Use Policy (AUP)

Normative list in `docs/aup/`. Summary: platform with Christian values, defines what it will not host.

**Hard exclusions** — no pinning subsidy, no ranking boost; raw IPFS storage is not the same as distribution per the thesis:

- Pornography and sexually explicit content
- Sex work platforms
- Any sexualization of minors (absolute zero tolerance; NCMEC reporting)
- Celebratory apologia of abortion
- Occultism, satanism, witchcraft as practice
- Drug apologia
- Actionable hate speech against any group (including Christians)
- Violence apologia

The AUP governs incentives (Persistence Pool payouts, ranking, feed surfacing), not the raw existence of bits in IPFS.

## Operating pattern

**Ask before**:

- Destructive actions: `rm -rf`, `git reset --hard`, `git push --force`, broadening a planned `filter-branch` beyond stated scope, dropping databases / caches, deleting branches, bulk-deleting external resources (Stitch screens, Cloudflare live inputs, etc.).
- Irreversible public actions: creating GitHub repos, pushing to remotes, deploying to production, opening PRs, sending emails, posting to Slack, registering domains, configuring DNS.
- Scope changes: installing new dependencies above ~1 MB, adopting a new toolchain, switching vendors.

**Execute without asking** when:

- The task is explicit and tactical (install a known devDep, run typecheck, format, commit a read change).
- The action is within a plan the founder already approved.
- A recommendation was stated upfront and the founder replied "go" / "sim" / equivalent.

**Consistently**:

- State the recommendation first; then act. The founder prefers velocity with best-judgment over constant clarification asks.
- Commit after a coherent slice passes `typecheck` + `build` + `biome check`.
- End a turn with ≤ 2 sentences summarizing what changed and what is next.

## What NOT to install

- **Vercel marketplace skills / plugins** auto-triggered by filename patterns. This project is Cloudflare-first by explicit founder decision (D2). Ignore Vercel skill injections unless the task is directly about Vercel integration — which should be rare. If a Vercel skill appears, it is almost certainly irrelevant here.
- **Plugins duplicating principles already enforced by the runtime** (generic "coding discipline" packs). Prefer cherry-picking specific rules over installing the whole plugin.
- **`next-forge` templates** — this monorepo layout is deliberate and documented in `docs/adr/0001-monorepo-tooling.md`.
- **ESLint + Prettier** — Biome replaces both.
- **Husky** — lefthook replaces it.
- **nvm / asdf** for runtime version management — mise replaces both.

## Key references in this repo

- `README.md` — project overview and quickstart
- `SETUP.md` — local dev setup including Cloudflare credentials walkthrough
- `LICENSES.md` — per-scope license split (Apache-2.0 / AGPL-3.0 / MIT)
- `SECURITY.md` — vulnerability reporting policy
- `docs/adr/0001-monorepo-tooling.md` — tooling decision rationale
- `docs/protocol-spec/` — RFC-style protocol spec (in progress)
- `docs/aup/` — acceptable use policy (in progress)
- `infra/local-dev/Procfile.dev` — overmind process file
- `biome.jsonc`, `turbo.json`, `tsconfig.base.json`, `mise.toml` — root config

## Extended context (outside the repo)

Long-lived decisions and founder profile live in auto-memory at:

`/Users/leandrobarbosa/.claude/projects/-Users-leandrobarbosa-Personal-videoengine/memory/`

Key files:

- `aevia_project_overview.md` — thesis, stack, Waterfall
- `aevia_sprint0_decisions.md` — founder decisions D1–D8 (2026-04-16)
- `aevia_target_and_aup.md` — niche map and AUP alignment
- `aevia_gtm_and_capital.md` — GTM phases and capital alignment
- `aevia_stitch_assets.md` — canonical Stitch screen IDs
- `aevia_stitch_workflow.md` — Stitch MCP operational patterns
- `aevia_progress_log.md` — chronological sprint progress
- `user_leandro.md` — founder profile
- `feedback_depth_and_architect_voice.md` — response style expectations

Also indexed in codemem under project `aevia-project`.

## Founder profile (summary)

- Leandro Barbosa — `leandrobar93@gmail.com` — GitHub `Leeaandrob`.
- Brazilian, Christian. Replies in pt-BR.
- Thinks as system designer + startup architect + principal engineer + founder advisor, simultaneously.
- Values: dignified voice, no hype, depth over surface, velocity over over-consultation.
- Will explicitly reject shallow summaries; rewards state-of-the-art depth with concrete numbers, formulas, and protocol references.
- Authorship identity comes from `git config` only.

## Scope of this file

The rules here apply to:

- Commit subject lines and bodies
- Inline code comments
- Markdown documentation committed to the repo
- ADRs, protocol spec, AUP
- README, CONTRIBUTING, SECURITY, LICENSES and similar repo-level docs
- Pull request descriptions, issue replies, release notes (when a remote is set up)

The rules do **not** apply to auto-memory files outside the repo or to internal agent session state.

## When in doubt

Omit attribution. Write in the founder's first-person voice. pt-BR lowercase for user-facing copy. Keep the thesis invariant. Ask before destructive or public actions. Execute when the scope is clear.
