# ADR 0011 — Mirror-side HLSMuxer for origin-failure-tolerant HLS

- **Status**: accepted
- **Date**: 2026-04-19
- **Deciders**: Leandro Barbosa
- **Related**: ADR 0010 (HLS muxing via gohlslib) — this ADR extends the same muxer to run on mirror-recipient providers, not only the WHIP origin.

## Context

Fase 3 asserts that Aevia's HLS delivery is decentralized — any viewer should be able to reach any provider and get the same live stream. ADR 0010 shipped the gohlslib-based `HLSMuxer` that serves `/live/{id}/hls/*`, but wired it only on the WHIP origin path (`main.go whipSrv.OnSession`). The five other providers in the prod mesh received the session's RTP via the existing `mirror.Server` libp2p stream and fanned it out to WHEP viewers via `videoHub`, but had no `HLSMuxer` attached to their `LiveRouter`. Result: every request to `/live/{id}/hls/index.m3u8` on a mirror-recipient node returned the literal string `live: no muxer for session`.

This broke the decentralization story on three vectors:

1. **Origin SPOF**. If the WHIP origin lost its peer connection mid-stream (network flap, CGNAT NAT rebinding, Chrome tab crash), the RTP stream died AND the HLS path died simultaneously — mirrors kept relaying RTP to WHEP viewers for a few seconds on buffered hub state but nobody was serving new HLS segments anywhere. Viewer playback stalled.
2. **Geographic routing negated**. `resolveSessionProvider` returned DHT candidates sorted by proximity. A BR-SP viewer routed to `provider-sp.aevia.network` would see the chip light up (DHT resolved) and immediately hit `no muxer for session`, forcing the client to fall back to origin anyway.
3. **P2P chunk relay can't be validated**. p2p-media-loader on the browser fetches parts from the HLS URL. If only origin serves HLS, every "have" message in the GossipSub mesh points back at the same provider — no fan-out pressure relief, no real P2P ratio demonstration.

## Decision

Run the exact same HLS pipeline on every mirror-recipient provider that runs on the WHIP origin:

1. `whip.Session` gains `AttachVideoFrameSink(FrameSink)` + `VideoFrameSink() FrameSink`. Same for audio (reserved for M9). A per-session FrameSink above pion's H264 depacketizer, distinct from the RTP-level `videoSinks` already used by the mirror client for libp2p fan-out.
2. `mirror/server.go handleStream` keeps a per-session `codecs.H264Packet` (FU-A / STAP-A reassembly state must not cross sessions) and, for each video RTP packet, pulls `sess.VideoFrameSink()` and feeds it with the demuxed NAL plus RTP timestamp.
3. `main.go mirrorSrv.OnSession` now mirrors `whipSrv.OnSession` line-for-line: `NewLivePinSink` for Merkle-leaf accumulation, `NewCMAFSegmenter` feeding that sink, `NewHLSMuxer(sess.ID, nil, nil)` for gohlslib serving, `TeeFrameSink` fanning one demuxed AU into both. `liveRouter.AttachSession` + `liveRouter.AttachMuxer` wire it into `/live/{id}/hls/*`. Close hook on `sess.Done()` drains seg + muxer, detaches the muxer from the router. The `LivePinSink` stays attached post-close so late viewers still get VOD `manifest.json`.
4. Zero new HTTP routes, zero new libp2p protocols. The mirror RTP stream opened by `mirror.Client StartMirroring` already carries every packet; we just demux on the receiving end instead of only writing to `videoHub`.

## Consequences

### Wins

- **Origin failure tolerance**: when origin dies, `resolveSessionProvider` rotates to a mirror-recipient candidate and HLS continues from there. Latency may shift by a few hundred ms (mirror sees RTP via libp2p hop, buffers a fresh first segment) but playback doesn't break.
- **Geographic routing now delivers**: a BR-SP viewer routed to `provider-sp.aevia.network` gets a real HLS response, not a 404.
- **P2P chunk relay targets multiple origins**: browsers fetching parts from different mirror providers produce genuine fan-out, so p2p-media-loader's `have` / `want` gossip has varied peers to satisfy.
- **Merkle manifest also gets replicated**: each mirror now builds its own `LivePinSink` and announces the manifest CID on session close. Multiple providers can serve the VOD `manifest.json` independently — stronger on-chain anchoring story for the "persistence ≠ distribution" thesis.

### Trade-offs accepted

- **Duplicated pipeline per provider**: each mirror-recipient now runs gohlslib + CMAFSegmenter per live session. CPU + memory scale linearly with simultaneous sessions × mirror fan-out (typically 3 peers). For the 6-provider test mesh this is trivial; at scale the mirror ranker should probably cap `MirrorFanoutK` at 3 to keep this bounded.
- **Extra disk pressure**: every mirror provider pins segments via its `ContentStore`. The Merkle root they compute should match origin's — but a race between origin and mirrors writing the same final manifest CID to DHT is now possible. `dht.Provide` is idempotent so the race is harmless, just redundant. Future: dedup via a leader-elect or first-writer-wins policy.
- **SPS/PPS capture relies on inline STAP-A**: mirror has no SDP, so `NewHLSMuxer(sess.ID, nil, nil)` starts with empty SPS/PPS caches. The inline-capture path added in ADR 0010 picks them up from the first IDR AU that lands. Validated via `nal_census` earlier (Chrome emits 1:1 SPS:PPS:IDR under packetization-mode=1). Encoders that ship params only via `sprop-parameter-sets` would produce IDR-without-params on mirror — we'd need to forward SPS/PPS from origin → mirror (e.g., prepend to the mirror stream header), which is out of scope here.

### Known gaps (for next sessions)

- **Frontend hls.js failover rotation**: `resolveSessionProvider` returns candidates but hls.js currently doesn't rotate on 404 / network-error events. Mirror HLS existence is necessary but not sufficient.
- **Cloudflare Pages deploy**: the `apps/video/src/app/live/mesh/[id]/page.tsx` URL was switched to `/hls/index.m3u8` in ADR 0010's branch but Pages has not been redeployed. Live still hits the legacy `/playlist.m3u8` until we push.
- **Audio**: still video-only in HLS. M9 Opus→AAC or fmp4+Opus variant.
- **LL-HLS variant flip**: `AEVIA_HLS_VARIANT=low-latency` in each provider's env drops perceived latency from ~10s to sub-3s. Pending validation across `hls.js` / Safari native / VLC.

## Alternatives considered

- **Mirror proxies HLS from origin**: every mirror provider forwards `/hls/*` requests to origin. Rejected because it reintroduces the SPOF — if origin dies, mirror's proxy 502s.
- **Client-side mux from WHEP**: browser builds its own MPEG-TS from the WHEP RTP feed. Rejected because it moves complexity into every viewer and requires MSE + per-client CPU (especially on mobile).
- **Segment-level replication via DHT**: origin writes segment bytes to IPFS/DHT, any provider serves them. Viable for VOD but not live (too much latency for ~6s segments). Might revisit for persistent replay once live phase ends.

## References

- Commit introducing the change: `55b19b0` on branch `feat/mirror-hls-muxer`
- Regression test: `3254e5c` — `TestMirrorE2EVideoFrameSinkReceivesDemuxedNALs` in `internal/mirror/mirror_e2e_test.go`
- ADR 0010 — HLS muxing via gohlslib (origin path)
- RFC 6184 — RTP Payload Format for H.264 Video
- `github.com/pion/rtp/codecs` — `H264Packet` with `IsAVC: false`
