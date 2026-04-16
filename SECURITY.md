# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Aevia, please report it privately and responsibly.

**Do not** open a public GitHub issue for security-sensitive reports.

### How to report

- Email: `security@aevia.network` (temporary: `leandrobar93@gmail.com` with subject `[AEVIA-SECURITY]`)
- PGP key: to be published at `aevia.network/.well-known/security-contact.asc` before public launch

Include:

- Description of the issue and potential impact
- Steps to reproduce or proof-of-concept
- Affected component (app, service, package, or contract)
- Your contact for follow-up
- Whether you wish to be credited in the public advisory

### What to expect

- Acknowledgement within 72 hours
- Initial triage assessment within 7 days
- Coordinated disclosure timeline proportional to severity
- Public advisory + CVE request for qualifying issues
- Bug bounty program planned post-mainnet deployment (Immunefi)

## Scope

In scope:

- `apps/video`, `apps/network` — client-side and server-side
- `services/*` — Provider Node, recorder, manifest-svc, indexer
- `packages/contracts` — on-chain protocol (Base)
- `packages/protocol` — wire format and manifest schema
- Deployment infrastructure (Cloudflare Pages, Workers, R2, Stream, KV)

Out of scope:

- Third-party dependencies (report upstream)
- Social engineering
- Physical attacks

## Hall of fame

Coming soon.
