# recorder

Bridges Cloudflare Stream live outputs to Cloudflare R2 persistent storage.

## Status

Sprint 0 — placeholder. Full implementation in Sprint 2 (VOD + Identity slice).

## Pipeline

1. Receives Cloudflare Stream webhook `video.ready`.
2. Pulls VOD from Cloudflare Stream API.
3. Re-fragments into CMAF ~2s chunks per `2-content-addressing.md`.
4. Computes per-chunk SHA-256 and Merkle root.
5. Uploads chunks to R2 under deterministic CID paths.
6. Publishes chunk index and merkleRoot to manifest-svc.
