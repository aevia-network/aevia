# Aevia Protocol — RFC 9: Live ingest and playback without Cloudflare

**Status**: Experimental — implemented in M8. Production hardening in M8.5+.
**Audience**: Provider Node operators, apps/video frontend engineers, auditors
reading the Go sources in `services/provider-node/internal/whip`.

## 1. Scope

RFC 9 defines how creators stream live video to an Aevia Provider Node and
how viewers consume that stream, entirely off Cloudflare Stream. The pathway
reuses the content-addressing, persistence, DHT, and Proof-of-Relay layers
defined in RFCs 1–8; live ingest is the final piece that closes the
zero-Cloudflare loop for the creation side.

## 2. Transport

### 2.1 Ingest: WHIP (RFC 9725)

Creator browsers POST an SDP offer to `POST /whip` on a chosen Provider
Público. Provider replies `201 Created` with an SDP answer body, a
`Location` header (for subsequent `PATCH`/`DELETE` ICE trickle), and an
`X-Aevia-Session-ID` header carrying the ephemeral session identifier.

```
POST /whip HTTP/1.1
Content-Type: application/sdp
X-Aevia-DID: did:pkh:eip155:8453:0xabc...
[SDP offer]

HTTP/1.1 201 Created
Content-Type: application/sdp
Location: /whip/s_1745280000
X-Aevia-Session-ID: s_1745280000
[SDP answer]
```

The `X-Aevia-DID` header is an allowlist check in M8; M10 upgrades to an
EIP-191 signature over the offer hash which recovers to the DID.

### 2.2 Playback: HLS over HTTP

Viewers fetch `GET /live/{sessionID}/playlist.m3u8`, a classic HLS v7
media playlist with `EXT-X-MAP` pointing to the fMP4 init segment and
6s CMAF media segments at `/live/{sessionID}/segment/{n}`.

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="/live/s_1745280000/init.mp4"
#EXTINF:6.000,
/live/s_1745280000/segment/0
#EXTINF:6.000,
/live/s_1745280000/segment/1
```

While the session is open, `#EXT-X-ENDLIST` is **deliberately absent** — its
omission signals "live" to hls.js and keeps the client polling. Post-finalize
hook (M8.5) appends it on session end.

LL-HLS (`EXT-X-PART` + partial segments) is deferred to M8.5 for sub-3s
latency. Classic HLS yields ~10s latency, acceptable for M8 MVP.

### 2.3 Sub-second egress: WHEP (deferred to M8.5)

M8 omits the WHEP WebRTC playout path. Viewers use HLS exclusively. When
M8.5 adds `POST /whep`, browsers wanting sub-second latency (live Q&A,
interactive streaming) negotiate a second WebRTC session; the Provider
forwards incoming RTP from the ingest session to each viewer's PC.

## 3. Session lifecycle

1. **Handshake** — creator POSTs `/whip`; Provider allocates ephemeral
   `sessionID`, registers the WebRTC PeerConnection, invokes every
   `OnSession` callback so pipeline components (segmenter + pin sink)
   attach track handlers.
2. **Frames** — pion `OnTrack` fires per remote media track; the frame
   extractor depacketizes H.264 via `rtp/codecs.H264Packet` (NAL Annex-B)
   and forwards each frame to the `CMAFSegmenter`.
3. **Segmentation** — CMAFSegmenter emits an fMP4 init segment when the
   first SPS+PPS+IDR bundle arrives, then one media segment every 6s
   (at the next keyframe). Segments without an internal keyframe are
   discarded as un-seekable.
4. **Pinning** — `LivePinSink.OnMediaSegment` appends the segment's
   SHA-256 to a growing Merkle leaf set and persists the bytes in
   `pinning.ContentStore` under the session ID.
5. **Playback** — the LiveRouter serves the HLS playlist (regenerated
   on every request from the current snapshot), the fMP4 init, and
   each media segment.
6. **Finalize** — when the creator disconnects, `sink.Finalize()` pins
   the complete session under its canonical CID (Merkle root). The
   creator signs the final manifest via Privy and calls
   `ContentRegistry.registerContent(cid, ...)` to anchor on-chain. VOD
   playback continues against `/content/{cid}/...` under the M5 pathway.

## 4. Discovery

Browsers call `POST /dht/resolve` on any Relay Node to query the Kademlia
DHT without speaking libp2p themselves:

```
POST /dht/resolve HTTP/1.1
Content-Type: application/json
{"cid": "bafkrei...", "limit": 10}

HTTP/1.1 200 OK
Content-Type: application/json
{
  "cid": "bafkrei...",
  "providers": [
    {
      "peer_id": "12D3KooW...",
      "multiaddrs": ["/ip4/1.2.3.4/tcp/4001/p2p/12D3KooW..."]
    }
  ]
}
```

This sidesteps Safari's WebTransport gaps (see codemem `bw7VpIA9`). A
future M10 can layer js-libp2p in a Web Worker for clients wanting direct
DHT access.

For **live session discovery** specifically, the M8 MVP uses a hardcoded
list of ingest-friendly Provider Públicos in `apps/video`. The creator
picks the nearest (by RTT or geography); their browser POSTs WHIP to
that endpoint. M10 evolves this to a DHT rendezvous topic
`/aevia/ingest-offer/1.0.0` so any Provider can advertise willingness to
accept ingest without app-level coordination.

## 5. Authentication

M8 ships an allowlist: `whip.Options.AuthorisedDIDs` on the Provider
rejects any `POST /whip` whose `X-Aevia-DID` header isn't in the set.
Empty allowlist disables auth (dev/CI mode).

M10 production path: the `X-Aevia-DID` header plus an `X-Aevia-Signature`
header carrying an EIP-191 signature of `keccak256(offer_bytes)`. Provider
recovers the signer, compares to the declared DID, and accepts the
session when they match AND the signer has an active pre-registered
stake (future: on-chain `OperatorRegistry.canIngest(did)`).

## 6. Tech debt (logged here so M8.5+ can resolve)

- **Incremental Merkle**: `LivePinSink` rebuilds the tree on every
  segment (`O(N)` per segment). 14k-segment streams (24h) cost ~15s of
  CPU total — trivial today, unbounded growth tomorrow. Add incremental
  append in M9 if streams beyond 24h become a real use case.
- **Audio track**: M8 segments video only. Audio multiplex via Opus-
  in-MP4 boxes lands in M8.5 alongside LL-HLS partial segments.
- **ABR transcoding**: M8 serves source bitrate only. M9 adds a
  transcoder sidecar (GStreamer or FFmpeg pipe) producing 1080p/720p/
  480p variants with a master playlist.
- **WHEP**: deferred per above.

## 7. Tests that prove this flow

- `internal/whip/whip_test.go`: WHIP handshake with real pion client.
- `internal/whip/frames_test.go`: RTP → H.264 NAL extraction + keyframe
  detection.
- `internal/whip/segmenter_test.go`: fMP4 init + media segment round-
  trip with `mp4ff.DecodeFile`.
- `internal/whip/livepin_test.go`: Merkle manifest grows monotonically,
  Finalize produces verifiable manifest, round-trip pinning.
- `internal/whip/live_http_test.go`: HLS playlist shape, init/segment
  serving.
- `internal/dhtproxy/dhtproxy_test.go`: DHT proxy HTTP contract.
- `internal/integration/live_ingest_test.go`: **flagship end-to-end
  test** binding all of the above into one process.

When those pass, Cloudflare Stream has a provable drop-in Go replacement
for ingest + HLS playback.
