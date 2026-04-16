# Aevia Protocol Specification

> Persistence does not imply distribution.

This directory contains the RFC-style specification for the Aevia sovereign video protocol.

## Documents

| # | Document | Status |
|---|---|---|
| 0 | `0-overview.md` | To be written last (Sprint 1) |
| 1 | `1-manifest-schema.md` | Sprint 1 — in progress |
| 2 | `2-content-addressing.md` | Sprint 1 — in progress |
| 3 | `3-authentication.md` | Sprint 1 — in progress |
| 4 | `4-wire-format.md` | Sprint 1 |
| 5 | `5-peer-discovery.md` | Sprint 1 |
| 6 | `6-content-registry.md` | Sprint 1 |
| 7 | `7-economy.md` | Sprint 1 |
| 8 | `8-moderation.md` | Sprint 1 |
| 9 | `9-resilience.md` | Sprint 1 |

## Conventions

- Normative language follows [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119): MUST, SHOULD, MAY.
- Sections are numbered (1., 1.1., 1.1.1.).
- External references (W3C, IETF, ERC) are linked inline.
- Breaking changes to the wire format or manifest schema bump the `@context` URL or protocol ID major version.

## Status

Sprint 0 — scaffold only. Writing begins in Sprint 1 per dependency graph: `1` → `3` → `2` → `4` → `5` → `6` → `7` → `8` → `9` → `0`.
