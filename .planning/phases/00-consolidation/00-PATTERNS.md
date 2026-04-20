# Phase 0: Consolidation — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 6 new/modified files across 3 tracks (DEPLOY-01, DEPLOY-02, DEPLOY-03)
**Analogs found:** 6 / 6 (100% — this is a brownfield debt-closure phase, every target has a sibling in the current tree)
**Upstream:** `00-CONTEXT.md` only (research intentionally skipped — see orchestrator)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|----------------|---------------|
| `services/provider-node/internal/mirror/server.go` (modify — add `WriteHeaderRaw` or extend `ReadHeader` + inject SPS/PPS into the outgoing header frame) | service (libp2p stream handler) | streaming (framed binary, read-loop) | self (existing `handleStream` + `toRTPCapability` in same file) | exact — extension, not rewrite |
| `services/provider-node/internal/mirror/protocol.go` (modify — either extend `Header` struct with `SPSPPSSet` JSON field OR add `FrameTypeSPSPPS = 0x07`) | protocol / wire format | transform (encode/decode) | self (`Header`, `WriteHeader`, `ReadHeader`, `writeFrame`, `readFrame` in same file) | exact |
| `services/provider-node/internal/mirror/protocol_test.go` (modify — add `TestHeaderRoundTripCarriesSPSPPS` OR `TestSPSPPSFrameRoundTrip`) | test | request-response (round-trip bytes.Buffer) | self (`TestHeaderRoundTrip`, `TestMultipleRTPFramesStreamCleanly` in same file) | exact |
| `services/provider-node/internal/integration/mirror_header_test.go` (new — `TestMirrorHeaderForwardSPS` spawns two in-process libp2p hosts, verifies SPS/PPS lands before first IDR) | integration test | event-driven (async libp2p streams) | `services/provider-node/internal/mirror/mirror_e2e_test.go` (`TestMirrorE2EVideoFrameSinkReceivesDemuxedNALs`) + `services/provider-node/internal/integration/libp2p_mesh_test.go` (in-process topology) | exact for libp2p spawn, exact for FrameSink assertion — combine both |
| `deploy/scripts/deploy-6nodes.sh` (new — extends existing 3-node script to cover the 3 GPU hosts; OR keep `deploy-3nodes.sh` + add a second pass for rtx4090/rtx2080/GH200-2; see D-04 rolling variant) | deploy script | batch (sequential SCP + remote-exec) | `deploy/scripts/deploy-3nodes.sh` + `deploy/scripts/install-user-service.sh` | exact for relays, exact for user-systemd GPU hosts |
| `apps/video/e2e/p2p-hls-multiviewer.spec.ts` (**already shipped** in `feat/frontend-phase2` commit `b444ed7` — only inspection + gate-run needed in Phase 0) | test (Playwright) | event-driven (browser PWA) | `apps/video/e2e/p2p.spec.ts` + `apps/video/e2e/smoke.spec.ts` | exact — sibling specs in same dir |

## Pattern Assignments

### `services/provider-node/internal/mirror/server.go` (modify, streaming)

**Analog:** self — the B4 header-injection hook extends the existing `handleStream` + `mirrorSrv.OnSession` pattern on the WRITER side (client.go `StartMirroringWithPeers`) and the READER side (server.go `handleStream`). ADR 0011 / commit `55b19b0` is the canonical reference for OnSession ordering.

**Imports pattern (lines 1-18):**
```go
package mirror

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/pion/rtp"
	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v4"

	"github.com/Leeaandrob/aevia/services/provider-node/internal/whip"
)
```

**OnSession callback pattern the B4 reader must follow — `handleStream` lines 83-137:**
```go
func (s *Server) handleStream(stream network.Stream) {
	remote := stream.Conn().RemotePeer().String()
	log := s.log.With("remote_peer", remote, "event", "mirror_stream")
	defer func() { _ = stream.Close() }()

	header, err := ReadHeader(stream)        // B4: ReadHeader yields SPS/PPS via extended Header struct or via pre-frame peek
	if err != nil {
		log.Warn("read header failed", "err", err.Error())
		_ = stream.Reset()
		return
	}
	// ... codec cap build + whip.NewMirrorSession + InjectSession ...
	if s.OnSession != nil {
		s.OnSession(sess)                    // B4: operator of OnSession (main.go:246) must see SPS/PPS so HLSMuxer.Configure() can prime the cache BEFORE first IDR packet lands on the FrameSink
	}
}
```

**Read-loop where B4 must inject SPS/PPS ONCE before the first RTP — lines 148-206:**
```go
videoDepack := &codecs.H264Packet{IsAVC: false}
for {
	frame, err := ReadAnyFrame(stream)
	if errors.Is(err, io.EOF) {
		return
	}
	if err != nil {
		log.Warn("read frame", "err", err.Error())
		return
	}
	switch frame.Type {
	case FrameTypeVideoRTP, FrameTypeAudioRTP:
		// B4 HOOK POINT: if SPS/PPS was carried in the extended Header
		// (D-02 route A), feed it to sess.VideoFrameSink() BEFORE the
		// first RTP payload so HLSMuxer emits the init segment with the
		// correct parameter set. If D-02 route B (new FrameType 0x07),
		// add a `case FrameTypeSPSPPS:` branch here.
		if sink := sess.VideoFrameSink(); sink != nil {
			if nal, err := videoDepack.Unmarshal(pkt.Payload); err == nil && len(nal) > 0 {
				sink.OnVideoFrame(whip.VideoFrame{
					NAL: nal, Timestamp: pkt.Timestamp, Arrived: time.Now(),
				})
			}
		}
		metrics.RecordVideo(hop)
	case FrameTypeProbe:
		// echo-back pattern — serialised writer invariant holds
	}
}
```

**Error handling (reader side, lines 86-95 + 122-137):**
```go
defer func() {
	_ = stream.Close()
}()
// ...
if err != nil {
	log.Warn("read header failed", "err", err.Error())
	_ = stream.Reset()       // libp2p: Reset on protocol error, Close on normal EOF
	return
}
defer func() {
	s.whipSrv.RemoveSession(sess.ID)
	if s.OnClose != nil { s.OnClose(sess.ID, metrics) }
	// structured log with per-session counters
}()
```

**Writer-side hook (for the `WriteHeaderRaw` helper)** — `client.go` lines 250-263:
```go
hdr := Header{
	SessionID:   sess.ID,
	StartedAtNS: sess.StartedAt.UnixNano(),
	Video:       fromRTPCapability(videoCodec),
	Audio:       fromRTPCapability(audioCodec),
	// B4 addition (D-02 route A): Video.SPSPPSSet populated from
	// the origin whip.Session's captured parameter sets. Origin
	// captures SPS/PPS from the incoming WHIP SDP (H264 sprop-parameter-sets)
	// OR by observing in-band NALs type 7 / 8 before the first IDR.
	// The Header struct gains `SPSPPSSet [][]byte `json:"sps_pps_set,omitempty"``.
}
if err := WriteHeader(stream, hdr); err != nil {        // Route A: existing helper carries the new JSON field automatically — no API break
	c.log.Warn("mirror write header failed", "peer_id", p.String(), "err", err.Error())
	_ = stream.Reset()
	continue
}
// B4 Route B alternative: invoke a new WriteHeaderRaw(stream, hdr, spsList, ppsList) that writes
// FrameTypeHeader THEN FrameTypeSPSPPS=0x07 back-to-back, so a non-B4 reader still gets a valid
// session but silently drops the unknown 0x07 frame (ReadAnyFrame's `default:` branch already
// returns an error — will need softening to `continue` for forward-compat).
```

---

### `services/provider-node/internal/mirror/protocol.go` (modify, transform)

**Analog:** self — the existing `Header`, `WriteHeader`, `ReadHeader`, `writeFrame`, `readFrame` pattern already handles JSON-bodied frames; B4 extends this with either a new field or a new FrameType.

**FrameType constants (lines 59-66) — B4 Route B would add here:**
```go
const (
	FrameTypeHeader    FrameType = 0x01
	FrameTypeVideoRTP  FrameType = 0x02
	FrameTypeAudioRTP  FrameType = 0x03
	FrameTypeClose     FrameType = 0x04
	FrameTypeProbe     FrameType = 0x05 // Fase 2.2 — origin → mirror probe
	FrameTypeProbeEcho FrameType = 0x06 // Fase 2.2 — mirror → origin echo
	// Route B addition (only if D-02 picks it):
	// FrameTypeSPSPPS    FrameType = 0x07 // B4 — origin → mirror SPS/PPS preload
)
```

**Header struct (lines 91-96) — B4 Route A would extend here:**
```go
type Header struct {
	SessionID   string    `json:"session_id"`
	StartedAtNS int64     `json:"started_at_ns"`
	Video       CodecInfo `json:"video,omitempty"`
	Audio       CodecInfo `json:"audio,omitempty"`
	// Route A addition (only if D-02 picks it):
	// SPSPPSSet []SPSPPSPair `json:"sps_pps_set,omitempty"`  // B4 — parameter sets captured at origin
}
// where SPSPPSPair mirrors the in-band shape:
// type SPSPPSPair struct { SPS []byte `json:"sps"`; PPS []byte `json:"pps"` }
```

**Why Route A fits the existing code:** `json.Unmarshal` on an older mirror-recipient (no B4 field in the struct) silently drops the unknown JSON key — zero breaking change, zero deploy-ordering requirement. This matches the thesis (persistence ≠ distribution): adding data does not break existing readers.

**`ReadAnyFrame` default branch (lines 283-286) — Route B would need softening:**
```go
default:
	return Frame{Type: ft}, fmt.Errorf("mirror: unknown frame type 0x%02x", ft)
	// Route B forward-compat: change to
	//   return Frame{Type: ft}, nil  // unknown frame, skip and continue
	// and let callers treat nil-Frame with non-terminal semantics. Bigger change than Route A.
```

**`writeFrame` low-level pattern (lines 291-309) — reuse verbatim for any new FrameType:**
```go
func writeFrame(w io.Writer, ft FrameType, prefix []byte, body []byte) error {
	hdr := make([]byte, 1+4)
	hdr[0] = byte(ft)
	binary.BigEndian.PutUint32(hdr[1:], uint32(len(body)))
	if _, err := w.Write(hdr); err != nil { return fmt.Errorf("mirror: write frame header: %w", err) }
	if len(prefix) > 0 {
		if _, err := w.Write(prefix); err != nil { return fmt.Errorf("mirror: write frame prefix: %w", err) }
	}
	if len(body) > 0 {
		if _, err := w.Write(body); err != nil { return fmt.Errorf("mirror: write frame body: %w", err) }
	}
	return nil
}
```

---

### `services/provider-node/internal/mirror/protocol_test.go` (modify, request-response round-trip)

**Analog:** self — `TestHeaderRoundTrip` (lines 12-42) is the exact template for a Route A unit test; `TestMultipleRTPFramesStreamCleanly` (lines 99-152) is the template for an end-to-end frame-sequence test.

**Template to copy and extend for Route A (`TestHeaderRoundTripCarriesSPSPPS`):**
```go
func TestHeaderRoundTripCarriesSPSPPS(t *testing.T) {
	in := mirror.Header{
		SessionID:   "s_b4",
		StartedAtNS: 1_700_000_000_000_000_000,
		Video: mirror.CodecInfo{
			MimeType:    "video/H264",
			ClockRate:   90_000,
			SDPFmtpLine: "packetization-mode=1",
		},
		// B4 Route A field — adjust to actual struct shape the planner picks.
		// SPSPPSSet: []mirror.SPSPPSPair{{SPS: []byte{0x67, 0x42, 0xC0, 0x1F}, PPS: []byte{0x68, 0xCE, 0x3C, 0x80}}},
	}
	var buf bytes.Buffer
	if err := mirror.WriteHeader(&buf, in); err != nil {
		t.Fatalf("WriteHeader: %v", err)
	}
	out, err := mirror.ReadHeader(&buf)
	if err != nil {
		t.Fatalf("ReadHeader: %v", err)
	}
	// assertions on SPSPPSSet length + byte equality
}
```

**Template to copy for Route B (`TestSPSPPSFrameRoundTrip`)** — model on `TestRTPFrameRoundTripCarriesOriginNS` (lines 44-69) — same shape but with the new FrameType constant and a body format the planner defines (suggest: 2-byte SPS count LE + `[SPS(u16 len + bytes), PPS(u16 len + bytes), ...]`).

**Backward-compat test shape (critical for D-02 evidence):**
```go
func TestHeaderReadsOlderBinaryWithoutSPSPPS(t *testing.T) {
	// Synthesize a Header JSON WITHOUT the new field — confirm a
	// B4-aware reader parses it cleanly and SPSPPSSet is zero-length.
	// This proves Route A is strictly forward-compatible.
}
```

---

### `services/provider-node/internal/integration/mirror_header_test.go` (new, event-driven integration)

**Analog A (libp2p spawn pattern):** `services/provider-node/internal/mirror/mirror_e2e_test.go` lines 26-150 — two hosts, origin dials mirror, `client.StartMirroring`, assert mirror-side injected session.

**Analog B (FrameSink assertion pattern):** same file lines 159-250 — `countingFrameSink` pattern captures OnVideoFrame count. For B4, the assertion evolves: count `whip.VideoFrame` entries whose NAL starts with `0x67` (SPS NAL type 7) or `0x68` (PPS NAL type 8), and require ≥ 1 of each to arrive BEFORE any IDR (NAL type 5, `0x65`).

**Host-build helpers to copy verbatim (lines 259-280):**
```go
func buildHost(t *testing.T) host.Host {
	t.Helper()
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0"),
		libp2p.DisableRelay(),
	)
	if err != nil { t.Fatalf("libp2p.New: %v", err) }
	return h
}

func buildNodeForMirror(t *testing.T) (host.Host, *whip.Server) {
	t.Helper()
	h := buildHost(t)
	srv, err := whip.NewServer(whip.Options{})
	if err != nil { t.Fatalf("whip.NewServer: %v", err) }
	return h, srv
}
```

**FrameSink capture + ordering assertion pattern (new, derived from `countingFrameSink`):**
```go
type spsPpsAwareFrameSink struct {
	mu        sync.Mutex
	seen      []whip.VideoFrame // full log, inspect after assertions
	firstIDR  int // index into seen where NAL type 5 first appeared, -1 if none
}

func (s *spsPpsAwareFrameSink) OnVideoFrame(f whip.VideoFrame) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seen = append(s.seen, f)
	if s.firstIDR < 0 && len(f.NAL) > 0 && (f.NAL[0]&0x1F) == 5 {
		s.firstIDR = len(s.seen) - 1
	}
}

// B4 invariant: at least one SPS (type 7) and one PPS (type 8) must
// appear in s.seen BEFORE s.firstIDR. This mirrors the HLSMuxer contract.
```

**Full test shape — compose Analog A harness + this sink:**
```go
func TestMirrorHeaderForwardSPS(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Two hosts, mirror-side srv.OnSession attaches spsPpsAwareFrameSink
	// 2. origin whip.NewMirrorSession with captured SPS/PPS (hard-coded test
	//    bytes: []byte{0x67, 0x42, 0xC0, 0x1F} / {0x68, 0xCE, 0x3C, 0x80})
	// 3. client.StartMirroring — header frame now carries SPSPPSSet (Route A)
	// 4. fanOutVideo with a mid-stream IDR (NAL type 5) packet — verify
	//    the sink received SPS+PPS frames BEFORE the IDR index
	// 5. bonus: disconnect-then-reconnect test to verify late joiners
	//    (viewer B joining mid-session) see SPS/PPS in the header of
	//    their own stream
}
```

**Error handling + cleanup (copy from mirror_e2e_test.go lines 144-149):**
```go
_ = originSess.Close()
time.Sleep(500 * time.Millisecond)
if _, err := mirrorWhip.GetSession("s_b4_sps"); err == nil {
	t.Fatal("mirror session not cleaned up after origin closed")
}
```

---

### `deploy/scripts/deploy-6nodes.sh` (new, batch)

**Analog A (relays):** `deploy/scripts/deploy-3nodes.sh` — the sequential SCP + `systemctl restart aevia-node` pattern for R1 (ARM, root+ubuntu, system unit) and R2 (AMD, leandro, system unit). Mac launchd block stays identical.

**Analog B (GPU hosts, user-level systemd):** `deploy/scripts/install-user-service.sh` — `systemctl --user` pattern for hosts where passwordless sudo isn't available (rtx2080 Nobara, rtx4090 Ubuntu, GH200-2 presumably similar).

**Sequential-rollout pattern to preserve (lines 57-93 per node):**
```bash
say "Relay 1 — ${RELAY1_USER}@${RELAY1_HOST} (linux/arm64)"

scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${BIN_ARM64}" "${RELAY1_USER}@${RELAY1_HOST}:/tmp/aevia-node.new"

ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${RELAY1_USER}@${RELAY1_HOST}" bash -se <<'REMOTE_R1'
set -euo pipefail
if [[ -f /usr/local/bin/aevia-node ]]; then
  sudo cp /usr/local/bin/aevia-node /usr/local/bin/aevia-node.bak
fi
sudo install -m 0755 /tmp/aevia-node.new /usr/local/bin/aevia-node
rm -f /tmp/aevia-node.new
sudo systemctl restart aevia-node
sleep 2
sudo journalctl -u aevia-node -n 15 --no-pager
systemctl is-active aevia-node
REMOTE_R1

# Health check — D-04 rolling gate: if /healthz fails, operator confirms
# before continuing to the next node.
if curl -s --max-time 5 "https://provider.aevia.network/healthz" | grep -q '"status"'; then
  ok "Relay 1 /healthz responded"
else
  warn "Relay 1 /healthz check failed"
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans:-N}" == "y" ]] || die "aborted by operator"
fi
```

**GPU-host variant (copy from `install-user-service.sh` lines 25-96):**
```bash
# Remote block for rtx4090/rtx2080/GH200-2 — user-level systemd.
# Operator MUST have run install-user-service.sh once to bootstrap.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "${GPU_USER}@${GPU_HOST}" bash -se <<REMOTE_GPU
set -euo pipefail
if [[ -f \${HOME}/.local/bin/aevia-node ]]; then
  cp \${HOME}/.local/bin/aevia-node \${HOME}/.local/bin/aevia-node.bak
fi
install -m 0755 /tmp/aevia-node.new \${HOME}/.local/bin/aevia-node
rm -f /tmp/aevia-node.new
systemctl --user daemon-reload
systemctl --user restart aevia-node.service
sleep 2
systemctl --user is-active aevia-node || true
journalctl --user -u aevia-node -n 15 --no-pager
REMOTE_GPU
```

**Rolling canary pattern the plan should adopt (per D-04, B4 is a wire-format change):**

Order the 6 hosts as: `R1 (canary) → wait 90s + gate-checks 4 & 5 → R2 → Mac → rtx4090 → rtx2080 → GH200-2`. Between R1 and R2 is the decision gate; between R2 onward the rollout is batch. Justification already encoded in CONTEXT.md §Specific Ideas.

**Binary-hash validation snippet (gate check #5) — add to the end of each remote block:**
```bash
EXPECTED=$(git -C "${REPO_ROOT}" rev-parse --short HEAD)
ACTUAL=$(curl -s --max-time 5 "${HEALTHZ_URL}" | jq -r '.build // empty')
if [[ "${ACTUAL}" != "${EXPECTED}" ]]; then
  warn "binary hash mismatch on ${HOST}: want ${EXPECTED}, got ${ACTUAL}"
fi
# NOTE: gate check #5 requires the `/healthz` response to include a `build`
# field. Currently `internal/httpx/server.go:248` healthResponse does NOT
# expose this. The planner MUST add a `Build string `json:"build,omitempty"`` field
# wired to `main.Version` (set via `-X main.Version=${VERSION}` in build-all.sh line 20).
# This is a DEPLOY-02 sub-task surfaced by the gate spec in CONTEXT.md.
```

---

### `apps/video/e2e/p2p-hls-multiviewer.spec.ts` (already shipped — Phase 0 only inspects + runs)

**Analog (sibling spec conventions):** `apps/video/e2e/p2p.spec.ts` + `apps/video/e2e/smoke.spec.ts`.

**Skip-by-default pattern CONTEXT.md describes via `AEVIA_E2E_LIVE_URL` env gate — convention to verify the shipped F4 spec follows:**
```typescript
import { expect, test } from '@playwright/test';

const liveUrl = process.env.AEVIA_E2E_LIVE_URL;
test.skip(!liveUrl, 'requires AEVIA_E2E_LIVE_URL env (preview or synthetic live session)');

test('2-viewer P2P assist: each chip eventually reads NN% via peers · M pares OR provider-only fallback', async ({ browser }) => {
  // ... two browser contexts, both navigate to liveUrl, each asserts
  // the chip format matches /(\d+)% via peers · (\d+) pares/ OR
  // the provider-only string "p2p · N conectado" without assist.
});
```

**Chip-text assertion pattern to copy from `p2p.spec.ts` lines 40-49:**
```typescript
const chip = page.locator('span', { hasText: /p2p · \d+ conectado/ });
await expect(chip).toBeVisible({ timeout: 15_000 });
const chipText = await chip.textContent();
const match = chipText?.match(/p2p · (\d+) conectado/);
expect(match, 'chip format unchanged').toBeTruthy();
```

**Console/pageerror guard pattern (copy from `p2p.spec.ts` lines 25-33 and 51-65):**
```typescript
const consoleErrors: string[] = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
const pageErrors: string[] = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); });
// ... at end:
expect(pageErrors, 'page errors must be empty').toHaveLength(0);
const libp2pErrors = consoleErrors.filter(e =>
  e.toLowerCase().includes('libp2p') || e.toLowerCase().includes('websocket') || e.toLowerCase().includes('gossipsub'),
);
expect(libp2pErrors).toHaveLength(0);
```

**Runtime invocation — `apps/video/playwright.config.ts` lines 18-23 + 35-42** already honor `PLAYWRIGHT_BASE_URL`, and `CI=1` triggers 2 retries + single worker. The gate-execution plan should set `AEVIA_E2E_LIVE_URL=<preview>` and `PLAYWRIGHT_BASE_URL=<preview>` OR point to a synthetic live session the operator starts before the gate.

---

## Shared Patterns

### Structured logging (slog + zerolog split)

**Source:** `internal/mirror/server.go:83-137` (slog) + `cmd/provider/main.go:238-305` (zerolog)
**Apply to:** Any new code in `internal/mirror/`, `internal/integration/`.

Convention: `mirror` package uses `slog` internally so its API stays library-friendly (pass nil → `slog.Default()`). `cmd/provider/main.go` wraps zerolog for the operator-visible event stream, but all logs flowing through the mirror package itself stay on slog. New B4 code MUST use the existing `log` chain:

```go
log := s.log.With("remote_peer", remote, "event", "mirror_stream", "session_id", header.SessionID)
log.Info("mirror session ready", "video_mime", header.Video.MimeType, "audio_mime", header.Audio.MimeType)
```

Event names are snake_case. Every log at Warn/Error level MUST carry the err string via `"err", err.Error()` (not `%v` wrapping), matching existing pattern across server.go and client.go.

### Error handling (libp2p streams)

**Source:** `internal/mirror/server.go:83-95`, `internal/mirror/client.go:241-261`
**Apply to:** Any new libp2p stream touch in B4.

```go
defer func() { _ = stream.Close() }()    // normal path
// ...
if err := expected(stream); err != nil {
	log.Warn("descriptive event", "err", err.Error())
	_ = stream.Reset()                    // protocol error → Reset, NOT Close
	return
}
```

`Reset` on protocol violation (malformed header, unknown frame). `Close` on EOF / happy-path teardown. Do not mix.

### Integration-test host spawn (in-process libp2p)

**Source:** `internal/mirror/mirror_e2e_test.go:259-280` + `internal/integration/libp2p_mesh_test.go:56-95`
**Apply to:** `TestMirrorHeaderForwardSPS` and any new integration test.

Use `libp2p.ListenAddrStrings("/ip4/127.0.0.1/tcp/0")` with `libp2p.DisableRelay()` for mirror tests (TCP direct, no relay overhead); use `/ip4/127.0.0.1/tcp/0/ws` + `libp2p.Transport(websocket.New)` + `libp2p.NoListenAddrs` on "browser-like" clients (mesh tests only).

### Test naming convention

**Source:** existing tests in `internal/mirror/` + `internal/integration/`
**Apply to:** all new tests in Phase 0.

- Unit tests: `Test<Noun><Verb>` — e.g. `TestHeaderRoundTrip`, `TestCloseFrameReturnsEOF`.
- Integration tests: `Test<Subsystem><Scenario>` — e.g. `TestMirrorE2EOriginToMirrorCarriesRTP`, `TestWhepMultiViewerFanout`.
- B4 targets: `TestHeaderRoundTripCarriesSPSPPS` (unit), `TestMirrorHeaderForwardSPS` (integration). Both already implied by CONTEXT.md D-01.

### Commit scope (enforced by commitlint)

**Source:** `.planning/codebase/CONVENTIONS.md` + CONTEXT.md Established Patterns
**Apply to:** every commit in Phase 0.

Valid scopes for the targets in this phase:
- mirror/server.go, mirror/protocol.go, mirror/protocol_test.go, integration/mirror_header_test.go → `provider-node`
- deploy/scripts/* → `infra`
- apps/video/e2e/* → `video`
- .planning/* → `docs` (or omit scope — planning dir is unscoped metadata)

`claude` is NOT a valid scope; was rejected earlier this session. Use the list above.

### Cross-compile invariants

**Source:** `deploy/scripts/build-all.sh:26-32`
**Apply to:** every binary produced in DEPLOY-02.

```bash
GOOS=linux   GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-linux-arm64" "${SRC}"
GOOS=linux   GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-linux-amd64" "${SRC}"
GOOS=darwin  GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="${LDFLAGS}" -o "${OUT}/aevia-node-darwin-arm64" "${SRC}"
```

`CGO_ENABLED=0` is invariant — documented in `.planning/codebase/STACK.md`. `-X main.Version=${VERSION}` wires the short SHA into the binary, which gate check #5 reads via `/healthz .build` (see note in the deploy-script section above about the `build` field that currently does NOT exist in `healthResponse`).

---

## No Analog Found

None. Every Phase 0 target has a direct or adjacent sibling in the current tree. The only "gap" (gate check #5's `/healthz .build` field) is a trivial additive change to `internal/httpx/server.go:248` + wire-up in `main.go` — surfaced inline in the deploy-script section above so the planner can fold it into DEPLOY-02.

---

## Metadata

**Analog search scope:**
- `services/provider-node/internal/mirror/` (all files)
- `services/provider-node/internal/integration/` (all files)
- `services/provider-node/internal/whep/`
- `services/provider-node/internal/httpx/`
- `services/provider-node/cmd/provider/main.go` (OnSession / FrameSink wire-up ref)
- `deploy/scripts/` (all scripts)
- `apps/video/e2e/` (all specs + playwright.config.ts)

**Files scanned:** ~30 Go files + 3 shell scripts + 3 TS specs + 1 Playwright config.
**Pattern extraction date:** 2026-04-20

**Notable context gaps the planner MUST resolve:**
1. D-02 wire-format route (Route A silent JSON extension vs Route B new FrameType 0x07) — evidence in this map strongly favors Route A (zero deploy-ordering, matches `json.Unmarshal` behavior, no `ReadAnyFrame` default-branch softening).
2. `/healthz` does not yet expose `build` — gate check #5 implies adding it. Trivial, but must be in the DEPLOY-02 plan, not deferred.
3. Origin SPS/PPS capture source — SDP `sprop-parameter-sets` OR in-band observation in `whip.Session`. The planner must pick; evidence to gather lives in `internal/whip/whip.go` (OnTrack pipeline) and the mirror HLSMuxer wire-up (`main.go:280` `whip.NewHLSMuxer(sess.ID, nil, nil)` — the two `nil`s are SPS/PPS positional args already in the signature, which suggests origin DOES already hand HLSMuxer parameter sets through some path; confirm).
