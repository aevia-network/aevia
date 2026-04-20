# ADR 0010 — HLS muxing via gohlslib (replace hand-rolled CMAF)

- **Status**: accepted
- **Date**: 2026-04-19
- **Deciders**: Leandro Barbosa
- **Supersedes**: the hand-rolled `whip.CMAFSegmenter` as the HLS serving surface (M8-i3). CMAFSegmenter stays alive alongside gohlslib for the purpose of feeding Merkle leaves into `LivePinSink` (VOD manifest signing path).

## Context

Milestone 8 (M8) shipped a self-contained Go pipeline that takes WHIP H.264 frames from pion and writes CMAF fmp4 segments for HLS playback. It worked well enough for `hls.js` on Chrome — viewers on `aevia.video/live/mesh/{id}?hls=1` saw video — but produced bitstreams that strict decoders (VLC, ffplay, Apple VideoToolbox) rejected:

- `tfdt` baseMediaDecodeTime drifted between fragments.
- `mfhd.sequence_number` wasn't monotonic across concurrent sessions.
- H.264 start-code emulation prevention was implemented inconsistently.
- NAL ordering inside AUs occasionally put SPS/PPS after the IDR instead of before.
- `sample_size` in `trun` disagreed with the actual payload size when keyframes spanned multiple partial fragments.

Every one of those is fixable, but the cumulative debugging cost was reaching the same territory as the full HLS spec surface. At the same time, sub-3s latency (LL-HLS) was becoming a requirement for the VOD→live handoff UX, which would have demanded another rewrite layer.

MediaMTX has solved this problem publicly with `bluenviron/gohlslib` v2 — 100k+ production deployments, MIT license, covering MPEG-TS + fmp4 + LL-HLS variants with a single muxer interface. Our RTP-from-pion pipeline maps cleanly onto gohlslib's `Muxer.WriteH264(track, ntp, pts, au [][]byte)` signature.

## Decision

1. Replace the hand-rolled CMAF writer on the serving path with `bluenviron/gohlslib/v2 v2.2.9`.
2. Keep `whip.CMAFSegmenter` wired into `LivePinSink` as a **pinning tap** — its output is not served to HTTP viewers; it populates the content store with per-chunk CIDs that anchor the VOD `manifest.json` Merkle root.
3. Fan RTP-derived frames into both consumers via a new `whip.TeeFrameSink` (see `services/provider-node/internal/whip/frames.go`). One ingest, two receivers, no double packetization cost.
4. Register HLS under `/live/{id}/hls/{file}` so gohlslib owns its own URL root (`index.m3u8`, `main_stream.m3u8`, `{prefix}_seg{N}.ts`, `{prefix}_init.mp4`). The legacy `/live/{id}/playlist.m3u8` + `/init.mp4` + `/segment/{n}[/part/{p}]` stay live for backwards compat during rollout; the frontend (`apps/video/src/app/live/mesh/[id]/page.tsx`) points at `/hls/index.m3u8` as of this ADR.
5. Variant selection via env `AEVIA_HLS_VARIANT`:
   - `mpegts` (default) — widest decoder compat, ~6–12s latency
   - `fmp4` — CMAF without parts
   - `low-latency` — LL-HLS with EXT-X-PART, sub-3s latency

Default mpegts because WHEP already covers the sub-500ms viewer path; HLS is the fallback where 6s is acceptable. Operators flip to `low-latency` via env without a rebuild.

## Consequences

### Bugs surfaced + fixed during migration

The migration itself uncovered three bugs that the hand-rolled code had been masking:

1. **Multivariant playlist hung forever** (`4133dd5` → `549e33e`). pion's H264Packet depacketizer emits a single buffer where multiple NALs are concatenated with `00 00 00 01` start codes (STAP-A aggregation). gohlslib's segmenter reads `au[0][0] & 0x1F` to detect NAL type — if the first element is the concatenated blob starting with SPS (type 7), it never sees the IDR (type 5) inside. `randomAccess` stays false, no segment boundary ever fires, and the `handleMultivariantPlaylist` handler blocks on `cond.Wait()` indefinitely. Fix: `splitAnnexBNALs` in `hls_muxer.go` decomposes the buffer into separate NALs per element.

2. **SPS/PPS capture + injection** (`bae2e5f` → `455c418`). When encoders ship H.264 parameter sets out-of-band via `sprop-parameter-sets` in SDP (common for native WebRTC SDKs), we parse and pre-populate `codecs.H264{SPS,PPS}`. When they ship inline via STAP-A (Chrome's default under packetization-mode=1), we cache first-seen SPS/PPS in the muxer and inject them ahead of any IDR AU that lacks them. Evidence via `nal_census` debug log proved Chrome emits 1 SPS : 1 PPS : 1 IDR through STAP-A, so the injection path is defense-in-depth — but valid for encoders that only ship params at stream start.

3. **RTCP NACK not advertised** (`b01f70c`) ← **the real prod blocker**. Prod segments were structurally correct (AUD→SPS→PPS→IDR→slices, matching NAL counts) yet every decoder failed with "non-existing PPS 0 referenced" on the first few tests and later "out of range intra chroma pred mode" / "concealing 240 DC errors" / "mb_type out of range" once the SPS/PPS capture was in place. The minimal-GOP ffprobe test (ship just the SPS+PPS+IDR, try to decode) reported `concealing 240 DC, 240 AC, 240 MV errors in I frame` — the IDR **slice entropy bytes** were corrupt despite valid framing. Root cause isolated by comparing Mac localhost (0% loss, decode clean) vs prod CF Tunnel (packet loss, decode fails) with identical binary: pion's H264Packet silently accumulates `fuaBuffer` when FU-A fragments are lost, producing gap-bearing NALs. Our MediaEngine registered H.264 with `RTCPFeedback: nil`, so the answer SDP never advertised `a=rtcp-fb:PT nack`, so Chrome never retransmitted. Fix: advertise `nack / nack pli / ccm fir / goog-remb / transport-cc` on H.264, `transport-cc` on Opus, and wire `RegisterDefaultInterceptors` + `WithInterceptorRegistry` so pion's NACK generator actually runs. Prod decode dropped from 32+ errors per 20s to 0.

### Trade-offs accepted

- **Dependency footprint**: +~2.5MB binary from gohlslib + mediacommon. Worth it against ~1500 LOC of deleted CMAF writer code.
- **AU batching discipline**: our `OnVideoFrame` now has to honor RTP timestamp boundaries (flush when ts advances) because gohlslib expects one `WriteH264` call per AU. This is stricter than the old per-NAL streaming the hand-rolled code did, but matches H.264 spec more faithfully.
- **Merkle path duplicated**: LivePinSink still runs the old segmenter to accumulate `ContentStore` CIDs for the VOD manifest. That's wasted work when the HTTP path doesn't serve those chunks. Acceptable because the Merkle root is on-chain-anchored and can't be sacrificed; a follow-up could lift the CID accumulator into an independent `MerkleSink` that observes raw byte windows without running a full CMAF segmenter, but that's scope outside this ADR.

### What's still missing (tracked separately)

- **Mirror-side HLSMuxer** — only the WHIP origin currently has a muxer; mirror-recipient providers receive RTP via libp2p but don't serve `/hls/*`. Viewer HLS failover between providers breaks on origin loss. Planned next milestone.
- **Frontend HLS failover** — `resolveSessionProvider` returns DHT candidates but `hls.js` doesn't rotate to a fallback URL on 404. Pending once mirror-side muxer ships.
- **Audio in HLS** — MPEG-TS expects AAC; WHIP delivers Opus. Today we register video-only on the gohlslib track list. M9 adds Opus→AAC transcode or a move to fmp4 variant. WHEP viewers get Opus natively via RTP and are unaffected.
- **LL-HLS flip** — `AEVIA_HLS_VARIANT=low-latency` in each provider's env drops latency from ~10s to sub-3s. Deferred until LL-HLS player coverage is validated across hls.js / Safari / VLC / aevia.video.

## Alternatives considered

- **Fix the hand-rolled CMAF writer in place** — the bugs were findable (tfdt, mfhd, sample_size) but the exercise doesn't end; LL-HLS adds EXT-X-PART framing, segment rotation under part boundaries, `#EXT-X-PRELOAD-HINT`, blocking playlist reload semantics (`_HLS_msn` / `_HLS_part`), all of which gohlslib implements. Rejected because the marginal cost per feature would exceed the gohlslib import.
- **MediaMTX as a sidecar** — full MediaMTX daemon in front of each provider, our binary streams RTP to it. Rejected because it inverts the ownership model (we want provider-node to be the single point of truth for ingest + serving), adds an IPC hop (RTP over UDP or RTMP ingest), and doubles the operational surface (another process, another config).
- **fmp4 as default variant** — superior to MPEG-TS for CDN caching + LL-HLS, but Opus-in-fmp4 is the path-of-least-resistance for audio (AAC in TS would require transcode). We punted on audio for this migration and kept MPEG-TS, which has the widest static-player coverage. Revisit when audio lands.

## References

- Upstream library: <https://github.com/bluenviron/gohlslib>
- MediaMTX: <https://github.com/bluenviron/mediamtx>
- Pion H264 depacketizer: `github.com/pion/rtp/codecs/h264_packet.go`
- Pion interceptor defaults: `github.com/pion/webrtc/v4.RegisterDefaultInterceptors`
- RFC 6184 — RTP Payload Format for H.264 Video
- RFC 8216 — HTTP Live Streaming
- Apple HLS spec — Low-Latency HLS additions: <https://developer.apple.com/documentation/http-live-streaming/enabling-low-latency-http-live-streaming-hls>
- Commit range on branch `feat/gohlslib-migration`: `4133dd5` (initial tee) → `549e33e` (split NALs) → `bae2e5f` (SDP sprop parse) → `455c418` (inline capture + inject) → `b01f70c` (RTCP NACK + interceptors)
