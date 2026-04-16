# manifest-svc

Generates and signs canonical JSON-LD manifests for Aevia content.

## Status

Sprint 0 — placeholder. Full implementation in Sprint 2.

## Responsibilities

1. Compose manifest per `docs/protocol-spec/1-manifest-schema.md`.
2. Apply RFC 8785 JCS canonicalization.
3. Compute EIP-712 typed-data hash.
4. Coordinate signature with creator's wallet (client-side via Privy in most flows; this service holds the schema authority and validates signatures).
5. Publish manifest to IPFS/R2 and obtain CID.
6. Emit event to indexer + ContentRegistry submitter.
