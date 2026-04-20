# provider-node

Go binary that joins the aevia libp2p mesh and serves live + VOD video to browser clients.

A Provider Node handles:

- **WHIP ingest** — accepts WHIP publish requests from browsers or OBS Studio 30+ (pion/webrtc v4).
- **WHEP egress** — fan-out WebRTC playback to connected viewers with a simple SFU.
- **HLS serving** — low-latency HLS via `gohlslib` (MediaMTX-derived) with LL-HLS `EXT-X-PART`.
- **Mesh membership** — libp2p host (WebSockets + Noise + Yamux), Kademlia DHT for `sessionID → peerID` resolution, GossipSub per-session topic.
- **Cross-node mirroring** — the `/aevia/mirror/rtp/1.0.0` protocol replicates RTP across nodes with an RTT echo-back sub-protocol and a ranker scoring `α·rtt + β·load + γ·region_penalty`. Every mirror-recipient also runs an `HLSMuxer`, so any healthy provider can serve HLS even if the original WHIP origin dies.
- **NAT traversal** — Circuit Relay v2 + AutoRelay for home-lab operators behind CGNAT.
- **Content pinning** — local `BadgerDB` content store with `Quota{MaxBytes, MaxPins}` and atomic `PinPayloads`.
- **EIP-191 signing verification** — validates WHIP publisher signatures against the DID recorded in `ContentRegistry`.
- **Proof-of-Relay** — issues dual-Ed25519 Receipts for viewer sessions, aggregates into a Merkle settlement, and submits to `PersistencePool` on Base Sepolia for USDC payout (economic loop proven in `TestEconomicLoopEndToEnd`).

See [`TRACTION.md`](../../TRACTION.md) for the current deployed mesh (3 public WSS bootstraps + additional backend-only providers), contract addresses, and verifiable on-chain state.

## status

**No release binary yet.** Build from source. `v0.1.0-alpha` is gated on the M9 audio transcoder (Opus → AAC on the HLS playback path; required because iOS Safari does not play fMP4 + Opus). Until M9 lands, HLS playback is video-only; WebRTC (WHEP) playback carries audio.

Browser libp2p is WebSockets-only, which means a Provider Node must expose a public **WSS** endpoint. Cloudflare Tunnel + Caddy works for home-lab and CGNAT-bound operators — the three production bootstraps listed in `TRACTION.md` are routed that way.

## build

```bash
# from the repo root
cd services/provider-node
CGO_ENABLED=0 go build -o aevia-node ./cmd/provider
```

Cross-compile (no Docker required):

```bash
GOOS=linux   GOARCH=amd64 CGO_ENABLED=0 go build -o aevia-node-linux-amd64  ./cmd/provider
GOOS=linux   GOARCH=arm64 CGO_ENABLED=0 go build -o aevia-node-linux-arm64  ./cmd/provider
GOOS=darwin  GOARCH=arm64 CGO_ENABLED=0 go build -o aevia-node-darwin-arm64 ./cmd/provider
```

## run

```bash
AEVIA_REGION=us-va \
AEVIA_LAT=38.48 \
AEVIA_LON=-77.86 \
AEVIA_DATA_DIR=./data \
AEVIA_BOOTSTRAP_PEERS=/dns4/libp2p-fl.aevia.network/tcp/443/wss/p2p/12D3KooWEs9TrvY9Bq59bqLAYxZ3yWJpw33CAggDJ6YpekNvQXSS \
AEVIA_RPC_URL=https://sepolia.base.org \
./aevia-node --mode=provider
```

Modes:

- `--mode=provider` — full node: WHIP + WHEP + HLS + DHT + mirror.
- `--mode=relay` — libp2p Circuit Relay v2 service only. Lets home-lab providers reach the browser network via your public node.

Key environment variables (evolving — current list is authoritative in `internal/config/`):

- `AEVIA_BOOTSTRAP_PEERS` — comma-separated list of libp2p multiaddrs.
- `AEVIA_RPC_URL` — Base L2 RPC endpoint (Sepolia for the current milestone).
- `AEVIA_DATA_DIR` — BadgerDB storage path.
- `AEVIA_REGION`, `AEVIA_LAT`, `AEVIA_LON` — advertised via `/healthz` and used by the ranker for region penalty.
- `AEVIA_RELAY_PEERS` — optional; peer IDs to advertise as public relays.

Health endpoint:

```bash
curl -s http://localhost:8080/healthz | jq .
```

Returns `region`, `lat/lng`, `active_sessions`, `rtt_p50`, and the binary build hash.

## minimum host requirements

- Linux/macOS with `go 1.26+`.
- 2–4 GB RAM idle; scales with concurrent sessions.
- Bandwidth — rough ceiling (ignoring P2P chunk relay, which lowers provider upload by O(log N) vs N): `viewers × per-viewer-bitrate`. Example: 100 viewers × 1080p60 at 4.5 Mbps ≈ 450 Mbps sustained.
- **Public WSS endpoint required** for browser clients. Cloudflare Tunnel + Caddy is the recommended home-lab path. Corporate/CGNAT without a public IPv4 → join via Circuit Relay v2 (`--mode=relay` on a public node, `AEVIA_RELAY_PEERS` on yours).
- UDP open for WebRTC STUN/TURN candidates on the ingest path.

## scripts

Multi-node cluster deploy scripts live in `deploy/` at the repo root (added in commit `c4bf203`). They cover VPS provisioning with `systemd`, `caddy` reverse-proxy for WSS, and the mirror-protocol peer list.

## development

```bash
go run ./cmd/provider --mode=provider

# run the integration suite (covers the flagship proofs M3-M8):
go test ./...
```

Integration tests of note (all reference-pass in `main`):

| test | proof |
|---|---|
| `TestKillSwitchHLSEndToEnd` | lab-scale kill switch on HLS |
| `TestKillSwitchViaDHT` (M3) | CID resolution survives central-HTTP failure |
| `TestProviderNATServedViaRelay` (M4) | node behind NAT serves via Circuit Relay v2 |
| `TestContentSurvivesNodeRestart` (M5) | pinned content survives process restart |
| `TestEconomicLoopEndToEnd` (M6) | PoR tickets → Merkle settlement → `PersistencePool` payout |
| `TestLiveIngestEndToEnd` (M8) | browser WHIP → provider → HLS playback |

## dependencies (runtime)

- `github.com/libp2p/go-libp2p` — host, WebSockets transport, Noise, Yamux, Circuit Relay v2, AutoRelay.
- `github.com/libp2p/go-libp2p-kad-dht` — Kademlia DHT.
- `github.com/libp2p/go-libp2p-pubsub` — GossipSub.
- `github.com/pion/webrtc/v4` — WebRTC stack (WHIP/WHEP).
- `github.com/bluenviron/gohlslib/v2` — HLS muxer (MediaMTX-derived, MIT).
- `github.com/dgraph-io/badger/v4` — content store.
- `github.com/ethereum/go-ethereum` — EIP-191 ecrecover + `PersistencePool` ABI client.

## license

[AGPL-3.0-or-later](./LICENSE). This license applies to the Provider Node binary and source — the network copyleft is intentional to prevent proprietary SaaS forks of the reference stack while keeping the protocol itself (Apache-2.0 in `packages/protocol`, `packages/contracts`, etc.) fully reimplementable.
