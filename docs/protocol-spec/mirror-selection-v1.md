# Aevia Protocol — Mirror Selection v1 (Fase 2.2)

**Status**: Design — implementation target Fase 2.2.
**Supersedes**: static `AEVIA_MIRROR_PEERS` CSV configuration from Fase 2.1.
**Audience**: Provider Node operators, `services/provider-node/internal/mirror` maintainers, auditors
reviewing the Go sources grounded in this spec.

> Persistence does not imply distribution. Mirror selection regulates **distribution** only:
> it decides which nodes replicate the RTP stream for latency-aware egress. The set of
> candidates is bounded by protocol-level admission (Persistence Pool membership, AUP
> compliance of the operator), not by this document.

---

## 1. Scope

This RFC defines:

- A clock-independent **RTT echo-back** sub-protocol layered on the existing
  `/aevia/mirror/rtp/1.0.0` wire format (§4).
- A **candidate ranking algorithm** that replaces the static
  `AEVIA_MIRROR_PEERS` CSV with a dynamic, adaptive selection (§5).
- A new HTTP endpoint `/mirrors/candidates` on the Provider Node (§6).
- A **state machine** for peer discovery → probing → scoring → selection →
  degradation → re-selection (§7).
- A **deprecation path** for `AEVIA_MIRROR_PEERS` with migration notes (§8).
- A **test plan** covering unit, integration, and testnet E2E (§9).

It does NOT define:

- Mirror admission policy (who is allowed to mirror at all — that is the
  Persistence Pool membership check, RFC 5).
- Economic settlement for mirror work (that is the Proof-of-Relay pipeline,
  RFC 7/8).
- How viewers pick a mirror to consume from (that is already handled by
  DHT resolve + `/healthz` region tagging + Haversine ranking in the viewer
  client).

This RFC regulates only the **origin's choice of downstream mirror peers**.

---

## 2. Background and motivation

### 2.1 Fase 2.1 recap

Fase 2.1 (commits `395e747` + `08d0bf0`) shipped the RTP mirror wire protocol
at `services/provider-node/internal/mirror/protocol.go`. An origin WHIP-ingesting
provider fans out every video/audio RTP packet over libp2p streams to a
statically-configured list of peers. Each mirror injects a local `whip.Session`,
announces the same `sessionCID` in the DHT (different `peerID`), and serves
`/whep` viewers from its own hub.

Peer membership is governed by a single env var:

```bash
AEVIA_MIRROR_PEERS=12D3KooWAaa...,12D3KooWBbb...,12D3KooWCcc...
```

### 2.2 Why static CSV fails to scale

1. **No adaptation**: every live session replicates to the same N peers
   regardless of load, health, or viewer geography. The first operator to
   stream to a congested mirror pays the cost.
2. **No failure routing**: a flapping mirror remains on the list until the
   operator redeploys the origin.
3. **No geographic intelligence**: a BR-PB creator streaming to BR-SP viewers
   replicates to US-FL anyway because that peer is in the env.
4. **Operator burden**: every new Provider Node joining the network requires a
   fan-out of config changes across every origin.

### 2.3 Why the current hop latency number is unreliable

The Fase 2.1 wire format stamps every RTP frame with `origin_ns` (the origin's
wall-clock at tap time). The mirror computes

```
hop_latency = time.Now().UnixNano() - frame.OriginNS
```

This is the definition in `services/provider-node/internal/mirror/protocol.go`
(`RTPFrame.HopLatency()`) and the sample sink in
`services/provider-node/internal/mirror/server.go` (`handleStream`).

In the 3-node testnet on 2026-04-18 we measured:

| Origin  | Mirror    | Path               | Geo hop (km) | Measured p50 |
|---------|-----------|--------------------|--------------|--------------|
| Relay 1 | Mac       | US-VA → BR-PB      | ~6,800 km    | 29 ms        |
| Relay 1 | Relay 2   | US-VA → US-FL      | ~1,300 km    | 44 ms        |

Virginia → Florida is ~5× physically shorter than Virginia → Brazil, yet the
Florida hop reports ~1.5× **higher** latency. The number is corrupted by NTP
drift between hosts — we are effectively subtracting two unsynchronised clocks
and calling the difference a delay.

Any selection algorithm that consumes this signal is building on sand. Fase 2.2
MUST replace this with a clock-independent round-trip measurement.

---

## 3. Terminology

- **Origin**: the Provider Node ingesting WHIP from a creator.
- **Mirror**: a Provider Node receiving the RTP stream from an origin via
  `/aevia/mirror/rtp/1.0.0`.
- **Candidate**: a Provider Node the origin MAY elect as a mirror.
- **EMA**: exponentially weighted moving average. For a stream of samples
  `x_t`, `EMA_t = α·x_t + (1−α)·EMA_{t−1}` with `α ∈ (0, 1]`.
- **Probe**: a short frame sent from origin over an open mirror stream.
- **Echo**: the immediate reply from the mirror carrying the same `probe_id`.
- **RTT**: round-trip time — `(echo_received_ns − probe_sent_ns)` measured
  entirely with the origin's own clock. The one-way delay estimate is `RTT/2`.

Normative keywords MUST, SHOULD, MAY follow [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 4. RTT echo-back sub-protocol

### 4.1 New frame types

The wire format in `services/provider-node/internal/mirror/protocol.go`
reserves 8 bits for `FrameType`. Fase 2.1 uses `0x01..0x04`. Fase 2.2 adds:

```go
const (
    FrameTypeHeader    FrameType = 0x01 // existing
    FrameTypeVideoRTP  FrameType = 0x02 // existing
    FrameTypeAudioRTP  FrameType = 0x03 // existing
    FrameTypeClose     FrameType = 0x04 // existing
    FrameTypeProbe     FrameType = 0x05 // NEW — origin → mirror
    FrameTypeProbeEcho FrameType = 0x06 // NEW — mirror → origin
)
```

Any frame type outside the above range MUST be rejected with a stream reset
(same policy as today for unknown types).

### 4.2 Probe frame wire layout

The probe body is a fixed-length 16-byte payload — no JSON, no per-frame
allocation. Both sides MUST use big-endian (network byte order), consistent
with existing frames.

```
[FrameTypeProbe=0x05][body_len: u32 BE = 16][body]

body =
  [probe_id: u64 BE]    // monotonic sequence — origin-assigned
  [send_ns: u64 BE]     // origin's monotonic clock at send (diagnostic only)
```

`send_ns` is advisory — the mirror MUST NOT interpret it. The mirror copies
the probe body verbatim into the echo frame. The origin keeps its own
`probe_id → send_monotonic_ns` map keyed by id, so RTT is computed from the
origin's clock alone.

### 4.3 Echo frame wire layout

```
[FrameTypeProbeEcho=0x06][body_len: u32 BE = 16][body]

body =
  [probe_id: u64 BE]    // copied verbatim from the probe
  [echo_ns: u64 BE]     // mirror's monotonic clock at echo write (diagnostic only)
```

### 4.4 Round-trip semantics

1. Origin picks a monotonically-increasing `probe_id` (per-stream counter
   starting at 1). It records `send_monotonic_ns := monotonic.Now()` keyed by
   `probe_id` in a per-stream outstanding map.
2. Origin writes the probe frame on the **same libp2p stream** used for RTP
   fan-out. Same stream guarantees the probe traverses the same congestion
   window and queue state as RTP frames — this is the whole point. A
   sidechannel would measure a different path.
3. Mirror MUST echo within 10 ms of reading the probe, ahead of any queued
   RTP write for that stream. In practice this is a select-case priority in
   the server read loop (§4.7).
4. Origin, on reading an echo, looks up `probe_id` in its outstanding map and
   computes `rtt_ns := monotonic.Now() - send_monotonic_ns`. The value is
   handed to the mirror's `HopMetrics` ring buffer.
5. Outstanding probes older than 5 s (the inactivity timeout, §4.6) MUST be
   evicted to bound memory. An evicted probe counts as `loss`.

### 4.5 Probe frequency

The origin MUST send one probe per second per open mirror stream, jittered
by ±100 ms to avoid lockstep across many origins against the same mirror.
Exactly:

```
interval = 1000ms + uniform(-100ms, +100ms)
```

At 1 Hz the probe channel cost is ~40 B/s per stream — invisible compared to
1–4 Mbit/s of RTP. The value is a tradeoff:

- Higher (5 Hz) would converge faster on RTT changes but quintuples the side
  traffic and makes probe loss vs. RTP loss harder to disentangle.
- Lower (0.1 Hz) would under-sample — a 30-second EMA needs 3 samples, which
  is too coarse for the drop condition in §7.3.

1 Hz yields a 100-sample window in 100 seconds, enough for stable p50/p95
percentiles while staying responsive.

### 4.6 Timeouts and loss

- **Probe timeout**: 5 s with no echo → record the probe as lost, evict from
  the outstanding map. The stream is NOT reset on a single loss — WebRTC
  packets get lost, probes can too.
- **Sustained loss**: ≥5 consecutive probes lost (≥5 s of no round-trip
  signal) → treat the mirror as unreachable, tear down the stream, return the
  peer to the candidate pool marked with a cooldown (§7.3).

### 4.7 Integration with existing code

#### 4.7.1 `protocol.go` additions

```go
// ProbeFrame is an echo-back round-trip probe. Origin sends one per second
// per open mirror stream; mirror echoes with the same ProbeID.
type ProbeFrame struct {
    ProbeID uint64
    SendNS  uint64 // advisory — origin's send-time for diagnostic logs
}

// WriteProbe sends a probe frame (originator side).
func WriteProbe(w io.Writer, p ProbeFrame) error { ... }

// WriteProbeEcho sends an echo frame (mirror side). The caller MUST pass
// the parsed probe through unchanged so the originator can match by ID.
func WriteProbeEcho(w io.Writer, p ProbeFrame) error { ... }

// ReadProbe / ReadProbeEcho parse a pre-identified probe/echo body. The
// caller has already consumed the FrameType byte via ReadFrame's read loop.
func ReadProbe(body []byte) (ProbeFrame, error) { ... }
```

The existing `ReadFrame` MUST be extended to dispatch probes/echoes back to
callers without parsing them as RTP. The cleanest shape is a new
`ReadFrameAny` that returns a tagged union `{FrameType, *RTPFrame, *ProbeFrame}`
or, more idiomatically in Go, a callback interface. Implementation detail
left to the coding PR.

#### 4.7.2 `client.go` — origin side

`streamSink.run` already has a `select` loop draining `ch`. Add a
`time.Ticker` at 1 Hz:

```
select {
case <-ctx.Done(): return
case <-sess.Done(): return
case out := <-s.ch:     // existing RTP path
    ...
case t := <-probeTicker.C:
    id := nextProbeID()
    s.outstanding[id] = monotonic.Now()
    WriteProbe(s.stream, ProbeFrame{ProbeID: id, SendNS: uint64(t.UnixNano())})
}
```

A sibling read goroutine blocks on `ReadFrame(s.stream)` to pick up echoes
and hand them to `HopMetrics.RecordEcho(rtt)`.

#### 4.7.3 `server.go` — mirror side

In `handleStream`'s read loop, add:

```
case FrameTypeProbe:
    // Echo back immediately — do not enqueue behind RTP writes.
    // stream writes are serialised by a single writer goroutine
    // anyway, so "immediate" here means "next write slot".
    _ = WriteProbeEcho(stream, probe)
    continue
```

The mirror does NOT touch `HopMetrics` for probes — only the origin measures
RTT. The mirror never subtracts the origin's clock from its own.

#### 4.7.4 `hop_metrics.go` additions

The existing `HopMetrics` tracks `videoRTT` + `audioRTT` rolling windows over
wall-clock subtraction. Add a third window for echo-back RTT:

```go
type HopMetrics struct {
    mu       sync.Mutex
    videoRTT []time.Duration   // DEPRECATED — wall-clock, clock-drift corrupted
    audioRTT []time.Duration   // DEPRECATED — wall-clock, clock-drift corrupted
    probeRTT []time.Duration   // NEW — echo-back, clock-independent
    probeEMA time.Duration     // NEW — EMA(α=0.1) over probeRTT
    probeLoss uint32           // NEW — count of evicted (timed-out) probes
    ...
}

// RecordEcho appends one RTT sample from a matched probe/echo pair.
func (m *HopMetrics) RecordEcho(rtt time.Duration) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.probeRTT[m.probeIdx%len(m.probeRTT)] = rtt
    m.probeIdx++
    if m.probeN < len(m.probeRTT) { m.probeN++ }
    // EMA with α = 0.1 → ~10-sample effective window, fast reaction.
    const alpha = 0.1
    if m.probeEMA == 0 {
        m.probeEMA = rtt
    } else {
        m.probeEMA = time.Duration(alpha*float64(rtt) + (1-alpha)*float64(m.probeEMA))
    }
}

// EchoEMA returns the current EMA RTT. Zero when no samples yet.
func (m *HopMetrics) EchoEMA() time.Duration { ... }

// EchoP50/EchoP95 return percentiles over the rolling window. Reuse the
// existing percentile helper.
func (m *HopMetrics) EchoP50() time.Duration { ... }
func (m *HopMetrics) EchoP95() time.Duration { ... }
```

The `videoRTT`/`audioRTT` fields are retained for one minor release so
operators reading logs through the transition can verify the delta between
wall-clock and echo values. The logged `hop_p50_ns` field in
`server.go:handleStream` MUST be relabelled `hop_p50_walltime_ns` and a new
`hop_p50_echo_ns` MUST be emitted alongside. Fase 2.3 removes the walltime
variant.

---

## 5. Candidate ranking algorithm

### 5.1 Inputs

For every candidate peer `c`, the origin computes a vector:

| Input             | Source                                              | Type          |
|-------------------|-----------------------------------------------------|---------------|
| `rtt_ema_ms`      | `HopMetrics.EchoEMA()` over recent probes           | `float64` ms  |
| `load`            | `/healthz` extension: `active_sessions` count       | `uint32`      |
| `region`          | `/healthz` existing `region` field (e.g. `BR-SP`)   | `string`      |
| `lat`, `lng`      | `/healthz` existing `lat`, `lng` fields             | `float64`     |
| `viewer_region`   | optional hint from creator (`POST /whip` body)      | `string`      |

Peers that have not yet been probed (cold start, §7.4) have `rtt_ema_ms == 0`.
For these, the Haversine great-circle distance between origin and candidate
is used as a bootstrap proxy (converted to ms via `distance_km / 200` — a
coarse approximation of terrestrial fibre at 200 km/ms effective).

### 5.2 Score formula

```
score(c) = α · rtt_ms(c)
        + β · load(c)
        + γ · region_penalty(c)
```

Lower score is better. Picking the top-K mirrors means picking the K smallest
scores.

#### 5.2.1 `region_penalty`

```
region_penalty(c) =
    0    if region(c) == viewer_region        // same region as viewer hint
    25   if continent(c) == continent(viewer) // same continent, different region
    100  otherwise                            // cross-continent
```

If `viewer_region` is unset, the origin's own region is used instead. Region
strings use ISO 3166-2 subdivisions (e.g. `BR-SP`, `US-FL`, `DE-BE`). A
sidecar static map `continent_of(region_prefix)` is maintained in code —
trivial, ~250 entries, same approach the frontend already uses for Haversine
ranking.

#### 5.2.2 Default coefficients

| Coeff | Default | Rationale                                                       |
|-------|---------|-----------------------------------------------------------------|
| α     | 1.0     | 1 unit of score = 1 ms of RTT. Score becomes readable as "ms-equivalent". |
| β     | 10.0    | Each extra active session on the candidate costs 10 ms-equivalent. Penalises hot mirrors before they saturate. Empirically a busy mirror of 10 sessions adds ~30 ms of jitter under contention — the β=10 term catches that by session 3. |
| γ     | 50.0    | A different-continent peer needs to be ~50 ms faster on RTT than a same-region peer to be picked. At γ=100, the cross-continent penalty is 2 same-region sessions (via β). Combined with the `region_penalty` scale (0/25/100), this means: a cross-continent mirror would need to be 5,000 ms faster (impossible) to win over a same-region mirror, which is the intended behaviour — cross-continent is a last resort. |

Coefficients MUST be overridable via env vars for operator experimentation:

```
AEVIA_MIRROR_RANK_ALPHA=1.0
AEVIA_MIRROR_RANK_BETA=10.0
AEVIA_MIRROR_RANK_GAMMA=50.0
```

### 5.3 Selection rule

1. Origin pulls the candidate list (from DHT + bootstrap + existing peer-store
   connections — see §6.2).
2. Origin probes each candidate (§4), collects EMA RTT for 5 s or until it
   has ≥3 samples, whichever is first.
3. Origin computes `score(c)` for every candidate.
4. Origin selects the top `K` by lowest score. `K` default is **3**
   (three-way mirror fan-out matches the current testnet and provides
   redundancy without quadratic bandwidth cost). Configurable via
   `AEVIA_MIRROR_FANOUT_K`.
5. Origin opens mirror streams to exactly those K peers. Previously-selected
   peers absent from the new top-K are dropped gracefully (`WriteCloseFrame`).

Tie-breaker when two candidates have equal score: pick the one with lower
`peer_id` byte-lexicographic comparison. Deterministic across origins —
prevents two origins thrashing back and forth on the same pair.

### 5.4 Worked example

Suppose an origin in `BR-PB` starts a stream with `viewer_region=BR-SP` and
sees four candidates:

| Peer | Region  | RTT EMA | Sessions | RTT term | Load term | Region term | Score |
|------|---------|---------|----------|----------|-----------|-------------|-------|
| A    | BR-SP   | 18 ms   | 2        | 18       | 20        | 0           | **38**    |
| B    | BR-RJ   | 25 ms   | 0        | 25       | 0         | 25          | **50**    |
| C    | US-FL   | 120 ms  | 1        | 120      | 10        | 100         | **230**   |
| D    | BR-SP   | 21 ms   | 8        | 21       | 80        | 0           | **101**   |

Top-3 selection: `[A, B, D]`. Peer C never makes it past the continent
penalty. Peer D loses to B despite same region because its load term
dominates — exactly the adaptive pressure we want.

---

## 6. `GET /mirrors/candidates` endpoint

### 6.1 Request

```
GET /mirrors/candidates?viewer_region=BR-SP&limit=3 HTTP/1.1
Host: provider.example
Accept: application/json
```

Query parameters:

| Name            | Required | Default                  | Description                                  |
|-----------------|----------|--------------------------|----------------------------------------------|
| `viewer_region` | No       | origin's own region      | ISO 3166-2 region for the audience hint      |
| `limit`         | No       | `AEVIA_MIRROR_FANOUT_K`  | Max entries returned. Capped server-side at 10 to bound response size. |

Authentication: none required. The response reveals only what `/healthz`
already exposes; aggregation is a convenience, not a secret.

### 6.2 Candidate pool construction

The handler builds the candidate pool from three sources, in priority order:

1. **Live libp2p connections** (`host.Network().Peers()`) — these already
   have an open transport, zero dial cost.
2. **DHT bootstrap peers** and nodes currently advertising Aevia
   protocol IDs — reachable, known-compatible.
3. **Recently-seen mirror peers from the peerstore** — anyone this node
   has spoken `/aevia/mirror/rtp/1.0.0` with in the last 24 h.

Each candidate is queried for `/healthz` (already libp2p-HTTP, cheap) and
the current echo-RTT EMA is read from the origin's own `HopMetrics` table.
Unknown peers get a probe burst (3 probes over 300 ms) before the response
is built, bounded by a 2 s request deadline.

### 6.3 Response

```json
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "viewer_region": "BR-SP",
  "origin_region": "BR-PB",
  "limit": 3,
  "candidates": [
    {
      "peer_id": "12D3KooWA...",
      "https_base": "https://provider-a.example",
      "region": "BR-SP",
      "lat": -23.5505,
      "lng": -46.6333,
      "rtt_ema_ms": 18.4,
      "active_sessions": 2,
      "score": 38.4,
      "probe_loss_pct": 0.0
    },
    {
      "peer_id": "12D3KooWB...",
      "https_base": "https://provider-b.example",
      "region": "BR-RJ",
      "lat": -22.9068,
      "lng": -43.1729,
      "rtt_ema_ms": 25.1,
      "active_sessions": 0,
      "score": 50.1,
      "probe_loss_pct": 0.0
    },
    {
      "peer_id": "12D3KooWD...",
      "https_base": "https://provider-d.example",
      "region": "BR-SP",
      "lat": -23.5505,
      "lng": -46.6333,
      "rtt_ema_ms": 21.2,
      "active_sessions": 8,
      "score": 101.2,
      "probe_loss_pct": 0.0
    }
  ]
}
```

Entries are returned sorted by `score` ascending. `https_base` is the
operator-declared HTTPS root used by viewers to hit `/whep`, `/live/*`, and
the WHIP endpoint — it is distinct from the libp2p multiaddr.

### 6.4 Handler registration

The new handler is wired in `services/provider-node/internal/httpx/server.go`,
next to the existing `registerDefaults`:

```go
func (s *Server) registerDefaults() {
    s.mux.HandleFunc("GET /healthz", ...)
    s.mux.HandleFunc("GET /latency-probe", handleLatencyProbe)
    s.mux.HandleFunc("HEAD /latency-probe", handleLatencyProbe)
    s.mux.HandleFunc("GET /mirrors/candidates", s.handleMirrorCandidates) // NEW
}
```

Because `httpx.Server` today has no direct handle on the mirror subsystem,
Fase 2.2 MUST extend `NewServer` with a `WithMirrorRanker(r Ranker)` option
where `Ranker` is a narrow interface satisfied by the mirror package. This
keeps the httpx layer free of imports on the mirror package.

---

## 7. State machine

### 7.1 Top-level transitions

```
   +-----------+
   |   BOOT    |
   +-----+-----+
         |  node start; host.Network().Peers() populates
         v
   +-----------+   probe burst (3 probes)
   | DISCOVER  +-------------------------+
   +-----+-----+                         |
         |                               v
         |                        +-------------+
         |                        |   PROBING   |
         |                        +------+------+
         |                               | EMA stable (≥3 samples) OR 5s budget
         |                               v
         |                        +-------------+
         |                        |   SCORING   |
         |                        +------+------+
         |                               |
         |  pool < K                     | pick top-K by score
         |                               v
         v                        +-------------+
   +-----------+                  |  SELECTED   |
   | COLD_BOOT |----------------->+-------------+
   +-----------+  Haversine-only         ^ |
      fallback                           | |  RTT p95 > 1.5× baseline
                                         | |  sustained 30s
                                         | v
                                  +-------------+
                                  |  DEGRADED   |
                                  +------+------+
                                         |  continue streaming;
                                         |  re-run DISCOVER in background
                                         |  when replacement found, swap in
                                         |  and Close old stream
                                         v
                                  (loop back to SELECTED)
```

### 7.2 Per-peer states

Each candidate peer is in one of:

```
  UNKNOWN  --probe sent-->  PROBING  --≥3 echoes-->  SCORED
                               |                        |
                               |5s timeout / ≥5 losses  |
                               v                        v
                          COOLDOWN_60s            (available for selection)
```

A peer in `COOLDOWN_60s` is not probed again until the 60-second timer
elapses. This prevents hammering a flapping peer and gives it room to
recover.

### 7.3 Drop condition

A selected mirror MUST be dropped when its `EchoP95` exceeds **1.5× the
baseline** for a sustained **30 s**, where baseline is the median
`EchoP95` observed over the first 60 s after selection.

Rationale for 1.5× / 30 s:

- **1.5× threshold**: a mirror that got slightly worse (say, 1.2× baseline)
  is still probably the best choice — the alternatives may have degraded
  too. Requiring 50% worse filters out normal jitter while catching real
  regressions (congestion, CPU steal, peer overload).
- **30 s sustained**: WebRTC jitter buffers absorb short spikes already.
  Anything less than 30 s is noise. Anything longer than 60 s risks
  viewers suffering for a full minute before a swap.

On drop:

1. Origin writes a close frame to the bad mirror's stream (`WriteCloseFrame`).
2. Origin marks the peer as `COOLDOWN_60s`.
3. Origin re-runs DISCOVER → PROBING → SCORING on the remaining candidate
   pool and picks a replacement to restore K-fanout.
4. If no replacement is found (tiny network), the origin continues with
   K−1 mirrors and logs a warning. Not fatal — HLS fallback on the origin
   still covers viewers who can't use WHEP.

### 7.4 Cold start

On a brand-new node with no probe history for anyone, the origin cannot
compute RTT-based scores. It MUST fall back to **Haversine-only ranking**:

```
score_coldstart(c) = β·load + γ·region_penalty + haversine_ms(origin, c)
```

where `haversine_ms` is the great-circle distance in km divided by 200. This
picks geographically-plausible mirrors for the first ~10 seconds, after
which the echo-back probes converge and the algorithm transitions to the
full §5.2 formula transparently.

Cold-start MUST also kick in for a new candidate that appears mid-session
(e.g. a new Provider Node joined the DHT). The new peer gets a Haversine
score until it has ≥3 probe samples.

---

## 8. Deprecation of `AEVIA_MIRROR_PEERS`

### 8.1 Compatibility matrix

| `AEVIA_MIRROR_PEERS` value | Behaviour                                                   |
|----------------------------|-------------------------------------------------------------|
| Unset / empty              | **Dynamic selection enabled** — full §5 + §7 pipeline.      |
| Non-empty CSV              | **Static override** — peers forced; dynamic selection off. |
| `AUTO`                     | Same as empty — explicit opt-in to dynamic.                 |

The override exists so operators in testnet or manual-debug scenarios can
pin the fan-out exactly. It MUST NOT be used in production after Fase 2.2
ships — we will emit a WARN log on boot whenever the env is non-empty and
non-`AUTO`.

### 8.2 Migration note for operators

Current operators running:

```bash
AEVIA_MIRROR_PEERS=12D3KooWAaa...,12D3KooWBbb...
```

SHOULD unset the variable entirely (or set `AUTO`) on upgrade to Fase 2.2.
The dynamic selector uses the DHT + peerstore to find the same peers
automatically, and adapts when they degrade — something the static CSV
cannot do.

The variable is removed entirely in Fase 2.3. An ADR will accompany the
removal so the change is auditable.

---

## 9. Test plan

### 9.1 Unit tests — `mirror/protocol_test.go`

- **Echo-back round-trip**: write a probe frame to a `bytes.Buffer`, parse
  it, build an echo with the same probe_id, parse the echo. Assert probe_id
  round-trips and `body_len == 16` on the wire.
- **Frame-type dispatch**: an unknown frame type (`0x07`) MUST return an
  error from `ReadFrame`. A `FrameTypeProbe` with the wrong body length MUST
  return an error.
- **EMA convergence**: feed 100 samples of `50 ms ± 5 ms` to
  `HopMetrics.RecordEcho`. Assert `EchoEMA` converges to within 1 ms of
  50 ms.

### 9.2 Integration tests — `mirror/selection_test.go`

- **3-host in-process**: spin up 3 `libp2p.New` hosts in the same Go test
  binary. Artificial RTT is injected via a custom `muxer.Transport` adding
  a fixed delay per peer pair. Run the selection pipeline; assert the
  selected peers match the expected order based on injected RTTs.
- **Re-selection on degrade**: start with 3 mirrors selected. Inject a 3×
  RTT spike on one of them for 45 s. Assert origin drops it and re-selects
  the 4th candidate within 30 s of the sustained spike.
- **Cold start**: boot a 4th host with no probe history. Assert it is
  ranked by Haversine distance for the first ~10 s, then converges to
  RTT-based ranking after probes flow.

### 9.3 E2E — 3-node testnet (Relay 1 + Relay 2 + Mac)

1. Deploy Fase 2.2 binary to all three nodes.
2. Unset `AEVIA_MIRROR_PEERS` on all three.
3. Publish a live from `apps/video` against the Mac (BR-PB) origin.
4. Verify `GET /mirrors/candidates?viewer_region=BR-SP&limit=3` on Mac
   returns Relay 2 (US-FL) and Relay 1 (US-VA) with geographically-plausible
   RTT EMA values — US-FL MUST have lower RTT than US-VA once echo-back
   probes have converged (~10 s post-session-start).
5. Observe the `hop_p50_walltime_ns` and `hop_p50_echo_ns` log fields. The
   echo value MUST be within 10% of the `/latency-probe` Server-Timing RTT
   measured externally with `curl -w "%{time_total}"`.
6. Kill Relay 2's provider process for 45 s. Assert Mac logs drop, enters
   DEGRADED, and recovers when Relay 2 returns.

Acceptance: the geographic ordering flip (vs. the Fase 2.1 clock-drift
bug in §2.3) is the crisp signal that echo-back is working.

---

## 10. Go handler stub

Sketched signature for `handleMirrorCandidates`, grounded in the existing
`httpx.Server` shape. Not expected to compile as-is — this is spec scaffolding.

```go
// mirrorCandidate is the on-wire shape returned by /mirrors/candidates.
// Field order mirrors the JSON sample in §6.3 for easy diffing.
type mirrorCandidate struct {
    PeerID         string  `json:"peer_id"`
    HTTPSBase      string  `json:"https_base"`
    Region         string  `json:"region"`
    Lat            float64 `json:"lat"`
    Lng            float64 `json:"lng"`
    RTTEMAMillis   float64 `json:"rtt_ema_ms"`
    ActiveSessions uint32  `json:"active_sessions"`
    Score          float64 `json:"score"`
    ProbeLossPct   float64 `json:"probe_loss_pct"`
}

type mirrorCandidatesResponse struct {
    ViewerRegion string            `json:"viewer_region"`
    OriginRegion string            `json:"origin_region"`
    Limit        int               `json:"limit"`
    Candidates   []mirrorCandidate `json:"candidates"`
}

// Ranker is what the httpx layer needs from the mirror package. Kept narrow
// so the import graph stays one-directional (httpx → mirror, never back).
type Ranker interface {
    // Rank returns the top `limit` candidates ordered by ascending score.
    // originRegion + viewerRegion drive the region_penalty term (§5.2.1).
    Rank(ctx context.Context, originRegion, viewerRegion string, limit int) ([]mirrorCandidate, error)
}

func (s *Server) handleMirrorCandidates(w http.ResponseWriter, r *http.Request) {
    if s.ranker == nil {
        http.Error(w, "mirror ranker not configured", http.StatusServiceUnavailable)
        return
    }
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()

    viewerRegion := r.URL.Query().Get("viewer_region")
    if viewerRegion == "" {
        viewerRegion = s.region // fall back to origin's own region
    }
    limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
    if err != nil || limit <= 0 {
        limit = defaultFanoutK // 3
    }
    if limit > maxFanoutK { // 10
        limit = maxFanoutK
    }

    candidates, err := s.ranker.Rank(ctx, s.region, viewerRegion, limit)
    if err != nil {
        http.Error(w, "rank failed: "+err.Error(), http.StatusInternalServerError)
        return
    }

    resp := mirrorCandidatesResponse{
        ViewerRegion: viewerRegion,
        OriginRegion: s.region,
        Limit:        limit,
        Candidates:   candidates,
    }
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Cache-Control", "no-store")
    _ = json.NewEncoder(w).Encode(resp)
}
```

---

## 11. Open questions

Tracked for resolution before implementation PRs land:

1. **Probe-stream coupling vs. decoupling**: §4 places probes on the same
   stream as RTP so the measurement is honest. This means a stalled RTP
   write (flow control, slow mirror) also stalls probes, amplifying the
   drop signal. Is that desirable (fast failure) or problematic (false
   positives on bursty but otherwise-fine peers)? Revisit after E2E data.
2. **Continent mapping maintenance**: the `continent_of(region_prefix)`
   table is 250 entries but needs to stay in sync with any frontend
   equivalent. Ownership: live in `@aevia/ui` or in provider-node Go? TBD
   with the frontend maintainer.
3. **`viewer_region` trust**: today any client can POST a WHIP offer
   claiming `viewer_region=BR-SP`. That is a hint only, never elevated to
   policy. Worth revisiting if we see abuse (e.g. an operator boosting
   their own mirrors by claiming matching viewer regions).

---

## 12. References

- Fase 2.1 implementation: `services/provider-node/internal/mirror/protocol.go`,
  `client.go`, `server.go`, `hop_metrics.go`.
- HTTP server registration: `services/provider-node/internal/httpx/server.go`.
- Existing latency primitive: `GET /latency-probe` Server-Timing (Fase 2.0).
- Upstream libp2p: [go-libp2p stream semantics](https://github.com/libp2p/go-libp2p/blob/master/core/network/stream.go).
- Wire format conventions: [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)
  (normative keywords), all multi-byte integers big-endian per existing
  `protocol.go` invariant.
