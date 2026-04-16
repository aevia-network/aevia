# Aevia — repository conventions

## Authorship and attribution

Every commit, every file, every line of prose in this repository is authored by the person in the local `git config user.name` / `user.email`. That is the only identity that appears.

**Never add** any of the following to commit messages, code comments, docs, changelogs, or pull request descriptions:

- `Co-Authored-By: ...` trailer lines
- References to AI assistants, tools, or agents (by name, company, or generic label)
- Phrases like "generated with", "written by", "assisted by" in combination with a tool name
- Emoji robot/tool signatures (🤖, ⚡, etc.) as attribution markers
- Vendor names such as Anthropic, OpenAI, Google, Cursor, Copilot, etc.

The tooling used to author this repository is invisible. If a reader cannot tell how a file was produced, that is the correct result.

## Scope

This rule covers:

- Commit subject lines and bodies
- Inline code comments
- Markdown documentation committed to the repo (`*.md`)
- Architecture Decision Records (`docs/adr/*`)
- Protocol specifications (`docs/protocol-spec/*`)
- Acceptable Use Policy (`docs/aup/*`)
- README, CONTRIBUTING, SECURITY, LICENSES, and similar repo-level docs
- Pull request descriptions, issue comments, and release notes (when those move to a remote)

## When in doubt

Omit attribution entirely. The repository is the founder's work. Write in first person, in the founder's voice.
