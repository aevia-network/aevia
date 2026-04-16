# provider-node

The Aevia Provider Node. Binary that third parties run to:

- Pin content (CIDs) announced in the Aevia DHT.
- Serve chunks to browser PWAs via libp2p WebRTC direct transport.
- Collect Proof-of-Relay tickets signed by viewers.
- Submit ticket batches to `PersistencePool` for USDC settlement.

## Status

Sprint 0 — placeholder `main()` only. Real implementation in Sprint 3 after the Hello Live slice (Sprint 1) proves the end-to-end live → VOD pipeline against Cloudflare Stream.

## Development

```bash
cd services/provider-node
go run ./cmd/provider
```

## Dependencies (planned)

- `github.com/libp2p/go-libp2p` — P2P host with WebRTC transport
- `github.com/dgraph-io/badger/v4` — local CID store
- `github.com/ethereum/go-ethereum` — EIP-712 signature verification for tickets
- GStreamer Go bindings (TBD) — chunk re-transcoding

## Configuration

Environment variables (final list TBD, documented here as they're added):

- `AEVIA_BOOTSTRAP_PEERS` — multiaddrs of libp2p bootstrap nodes
- `AEVIA_RPC_URL` — Base L2 RPC for on-chain verification
- `AEVIA_DATA_DIR` — path for BadgerDB store
