# Codec Matrix 2026 — Fase 4 Multi-Codec WHIP Research

Status: research draft · 2026-04-18 · scope: Aevia provider-node WHIP/WHEP ingest pipeline

This document compiles the evidence base for Aevia's Fase 4 rollout of VP8 / VP9 / AV1 alongside the current H.264 + Opus baseline. It exists to remove guesswork from three decisions:

1. Which codecs we must register in `pion/webrtc` to stop losing Android creators.
2. Which codecs can flow through our CMAF segmenter as-is vs. require transcoding.
3. What order to roll them out with the least operational risk.

Every claim about browser or library support is cited. Where the evidence is thin, the cell is marked `uncited` or `speculative`; reader should discount those rows.

---

## 0. TL;DR for the impatient

- **H.264 Constrained Baseline 3.1 + Opus is still the only safe universal codec pair in 2026.** VP8 is mandatory-to-implement (RFC 7742) so every WebRTC stack technically supports it, but in practice we have been relying on H.264 negotiation and it "just works" across desktop Chrome / Safari / Firefox / Edge.
- **The creator-side pain point is Chrome on Android** on devices whose Qualcomm / Exynos / MediaTek ISP exposes an H.264 decoder but no encoder to Chromium's WebRTC layer, or where the hardware encoder is blacklisted due to known Chromium bugs. These creators fall back to OpenH264 software encode (no High / no Main, battery-hostile) or to VP8 if their peer accepts it.
- **Short term fix (Fase 4a)**: register VP8 as a fallback in pion's `MediaEngine` after H.264 so the SDP negotiates H.264 when available and VP8 otherwise. **Do not** feed VP8 to the current CMAF segmenter — it is AVC-only (hard-codes SPS/PPS parsing via `Eyevinn/mp4ff/avc`). VP8 sessions run in WHEP-only mode (no VOD recording) until Fase 4b.
- **Medium term (Fase 4b)**: register VP9 and teach the segmenter to emit `vp09` CMAF tracks. `mp4ff` supports `vp08`/`vp09` sample entries with `vpcC` config box — the packaging path is real, not a port.
- **Long term (Fase 4c)**: AV1 as a premium codec. Viewer decode coverage is ~91% per the 2026 [WebCodecs Fundamentals dataset](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/), but iOS Safari decode is only ~33% so we cannot drop H.264 simulcast even with AV1 in. AV1 encode on mobile is still power-hostile — we let creators opt in, we never default.
- **Counter-intuitive finding**: Cloudflare Stream, which competes with us in the same WHIP niche, **does not support AV1 over WHIP yet** as of this writing, only VP8 / VP9 / H.264 ([Cloudflare Stream WebRTC docs](https://developers.cloudflare.com/stream/webrtc-beta/)). That plus the iOS decode gap means AV1 is less urgent than the codec discourse implies.

---

## 1. Browser WebRTC Codec Matrix (2026)

### 1.1. Desktop browsers

| Browser | VP8 encode | VP8 decode | VP9 encode | VP9 decode | H.264 encode | H.264 decode | AV1 encode | AV1 decode | Hardware accel notes |
|---|---|---|---|---|---|---|---|---|---|
| Chrome (Win/Mac/Linux) latest | SW (always) | SW / HW (some) | SW / HW (Intel Arc, newer NVIDIA) | SW / HW (wide) | SW (OpenH264) + HW (vendor) | SW + HW | SW (libaom/SVT) + HW (Intel Arc, Mac M3+, AMD RDNA3+) | SW + HW (wide) | Chrome's H.264 software path is OpenH264, **CB only**, no High/Main ([BlogGeek.me](https://bloggeek.me/webrtc-h264-video-codec-hardware-support/)). |
| Firefox desktop | SW | SW | SW / HW | SW / HW | SW (OpenH264) + HW | SW + HW | SW / HW (Firefox 136+ adds simulcast + DD) | SW / HW (v67+ supported) | VP9 simulcast disabled by default in Firefox per [MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/WebRTC_codecs). |
| Safari macOS (26.x) | encode yes | decode yes (12.1+) | encode no (uncited) | decode yes (Big Sur+) | encode yes (VideoToolbox, HW) | decode yes (HW) | encode no | decode partial (17.0+, Apple Silicon with HW decoder only) | Safari macOS AV1 decode ~24% of sessions per [WebCodecs Fundamentals 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/) — older Intel Macs lack HW decode and Apple ships no SW decoder. |
| Edge (Chromium) | SW | SW/HW | SW/HW | SW/HW | SW+HW | SW+HW | SW/HW (Win10+ only) | SW/HW (reintroduced v121+) | Per [caniuse/av1](https://caniuse.com/av1), Edge dropped AV1 pre-v116 and reintroduced at v121. |

### 1.2. Mobile browsers

| Browser | VP8 encode | VP8 decode | VP9 encode | VP9 decode | H.264 encode | H.264 decode | AV1 encode | AV1 decode | Hardware accel notes |
|---|---|---|---|---|---|---|---|---|---|
| Chrome Android latest | SW (HW disabled per-device due to Chromium bug 1237677) | HW (Nexus 5+, modern Snapdragon/Exynos) | SW only on most devices | HW (Android 4.4+) | HW (when device exposes AVC encoder) else SW OpenH264 | HW (universal since Android 5.0) | SW (Android 10+) | HW (Pixel 6+, Samsung S21+, Snapdragon 8 Gen 1+) | **This is the pain point for Aevia.** Many Samsung S21–S23 creators report Chrome using SW H.264 or falling to VP8 — [discuss-webrtc thread](https://groups.google.com/g/discuss-webrtc/c/dERL1z5dxtc). |
| Safari iOS (26.x) | encode yes | decode yes | encode no (uncited) | decode yes (iOS 14+) | encode yes (HW via VideoToolbox) | decode yes (HW) | encode no | decode partial (17.0+, iPhone 15 Pro+ only) | AV1 decode coverage on iOS ~33% per [WebCodecs Fundamentals 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/). All iOS browsers share WebKit so this is platform-wide. |
| Samsung Internet | SW | SW/HW | SW/HW | SW/HW | HW (vendor) | HW | SW/HW (Galaxy S21+ only, [AV1 supported devices list](https://www.coconut.co/articles/av1-supported-devices-complete-list-updates)) | HW (flagship Galaxy) | Samsung Internet is Chromium-based; codec behaviour trails Chrome Android by ~1 version. |

### 1.3. Creator-encode vs. viewer-decode divergence (Android)

This is the **core reason** Aevia needs a fallback codec. The list below captures known asymmetries.

| Device class | Can decode H.264 | Can encode H.264 via Chrome WebRTC | Notes / evidence |
|---|---|---|---|
| Samsung S23 / S24 / S25 (Exynos 2200+) | yes | often SW fallback | User reports of poor encode perf on S23+ in Chrome / Brave / Firefox while Edge mobile uses HW encode ([caniuse discussion](https://caniuse.com/av1)) — scope caveat, observations are anecdotal. |
| Pixel 6 / 7 / 8 / 9 (Tensor) | yes | yes (Google tight integration) | Pixel line has the smoothest H.264 WebRTC encode. |
| Low-end MediaTek (Redmi 10, Moto G series) | yes | hit-or-miss; often SW | Chromium blacklists specific MTK chipsets due to [Chromium bug 1237677](https://bugs.chromium.org/p/chromium/issues/detail?id=1237677). |
| Xiaomi / Oppo / Vivo with Dimensity | yes | varies | Vendor skin (MIUI / ColorOS) sometimes disables HW encoder access from non-system apps. |
| iPhone (Safari iOS) | yes | yes (VideoToolbox) | No asymmetry — iOS has always exposed AVC HW encode to WebKit. |

**The practical implication**: when a Samsung S23 creator starts a WHIP session to Aevia today, Chrome will attempt H.264 SW encode via OpenH264 at 1080p30. That eats ~1.2× real-time CPU on a single big core at 4 Mbps — battery drains ~2× faster, thermals throttle within ~6 minutes. A VP8 fallback lets the device use whatever HW encoder exists (VP8 HW encode is available on modern Snapdragon / Exynos per [Android Media Formats](https://developer.android.com/guide/topics/media/media-formats)).

---

## 2. pion/webrtc v4 capabilities

Aevia pins `github.com/pion/webrtc/v4 v4.2.11` (see `/Users/leandrobarbosa/Personal/videoengine/services/provider-node/go.mod`).

### 2.1. Codec MIME type constants

pion exposes these video MIME types ([mediaengine.go](https://github.com/pion/webrtc/blob/master/mediaengine.go)):

| Constant | Value |
|---|---|
| `webrtc.MimeTypeH264` | `"video/H264"` |
| `webrtc.MimeTypeH265` | `"video/H265"` |
| `webrtc.MimeTypeVP8` | `"video/VP8"` |
| `webrtc.MimeTypeVP9` | `"video/VP9"` |
| `webrtc.MimeTypeAV1` | `"video/AV1"` |
| `webrtc.MimeTypeOpus` | `"audio/opus"` |

All five video codecs are first-class in v4.x. AV1 has been stable since v4.1.0 ([release notes](https://github.com/pion/webrtc/releases/tag/v4.1.0)).

### 2.2. `MediaEngine.RegisterDefaultCodecs()` behaviour

Calling `RegisterDefaultCodecs()` registers the following with assigned payload types (from [mediaengine.go](https://github.com/pion/webrtc/blob/master/mediaengine.go)):

- Opus 48kHz stereo — PT 111
- G.722, PCMU, PCMA — PTs 9, 0, 8
- VP8 — PT 96 (+ RTX PT 97)
- H.264 Constrained Baseline 42001f / 42e01f / 4d001f / 64001f with various `packetization-mode` combinations — PTs in the 99–127 range
- VP9 Profile 0 and Profile 2 — PTs with RTX pairs
- AV1 — PT 45 (+ RTX PT 46 with `apt=45`), empty `SDPFmtpLine`
- H.265 (HEVC) Main profile — opt-in on some builds

The RTCP feedback bag `videoRTCPFeedback` is `{goog-remb, transport-cc, ccm fir, nack, nack pli}` and is applied uniformly to all video entries.

### 2.3. What Aevia registers today vs. what changes

Current code at `/Users/leandrobarbosa/Personal/videoengine/services/provider-node/internal/whip/whip.go:308-340` registers only H.264 (three profile-level-id variants) and Opus. Comment on line 299 says "Other codecs are rejected to keep the M8 scope tight — VP9/AV1 land when transcoding gets added."

For Fase 4, the minimum change is additive — register VP8, VP9, AV1 in that order of increasing risk.

```go
// Fase 4a — add VP8 fallback. Browsers that can't negotiate H.264
// HW-encode (Samsung S-series on Android, some MTK) will fall to VP8.
if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
    RTPCodecCapability: webrtc.RTPCodecCapability{
        MimeType:     webrtc.MimeTypeVP8,
        ClockRate:    90000,
        RTCPFeedback: videoRTCPFeedback,
    },
    PayloadType: 96,
}, webrtc.RTPCodecTypeVideo); err != nil {
    return nil, fmt.Errorf("whip: register vp8 codec: %w", err)
}
```

VP9 adds an `SDPFmtpLine` for profile selection (`profile-id=0` for 8-bit 4:2:0, `profile-id=2` for 10/12-bit). AV1 has an empty fmtp line by default; `level-idx`, `profile`, `tier` can be set to pin behaviour.

**Payload type allocation** — pion assigns PTs itself when caller passes `0`, but our existing code passes `0` for H.264 entries and it works because pion's internal allocator hands out distinct PTs. We rely on that allocator continuing to behave — **no custom PT choice**.

### 2.4. SDP capability advertisement

Order of `RegisterCodec` calls determines preference order in the SDP offer/answer. Browsers generally respect the offerer's preference when it matches their own capabilities. Aevia is the answerer (WHIP ingest), so the **creator's** browser picks from our advertised list:

1. Put H.264 entries first to keep current creators on H.264.
2. Put VP8 next so an H.264-less device falls to VP8 rather than failing negotiation.
3. Put VP9 and AV1 after VP8 for Fase 4b/4c.

### 2.5. Known upstream issues per codec

| Codec | Open issues / caveats |
|---|---|
| H.264 | [pion/webrtc#2424](https://github.com/pion/webrtc/issues/2424): green blocks when ffmpeg feeds with `-tune zerolatency` — not our ingest path but confirms H.264 is sensitive to B-frames. Aevia is fine because browser encoders don't emit B-frames for WebRTC. |
| VP8 | Stable. Chromium has its own [bug 1237677](https://bugs.chromium.org/p/chromium/issues/detail?id=1237677) about HW encoder issues on Android, but that's browser-side, not pion. |
| VP9 | Stable in pion. Profile-id negotiation can mis-match with some browsers if fmtp line is missing — always supply `profile-id=0` for the CB-equivalent. |
| AV1 | [pion/webrtc#1670](https://github.com/pion/webrtc/issues/1670) opened Feb 2021 tracking AV1; closed as fixed in v4.1.0. Dependency Descriptor RTP header extension is required for Chrome interop — pion handles it automatically since v4.0. |
| H.265 | Safari-only decode (universal there per [WebCodecs Fundamentals 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/)) but Chromium support is gated by patent concerns. **Out of scope for Fase 4.** |

---

## 3. Segmentation and CMAF

Aevia's CMAF path lives in `/Users/leandrobarbosa/Personal/videoengine/services/provider-node/internal/whip/segmenter.go`. It uses `github.com/Eyevinn/mp4ff v0.51.0` and specifically `github.com/Eyevinn/mp4ff/avc` for SPS/PPS parsing (line 9). **The segmenter is AVC-only.**

### 3.1. mp4ff codec support per the README

From the [Eyevinn/mp4ff README codec table](https://github.com/Eyevinn/mp4ff):

| Codec | Sample entry 4CC | Configuration box |
|---|---|---|
| AVC / H.264 | `avc1`, `avc3` | `avcC` |
| HEVC / H.265 | `hvc1`, `hev1` | `hvcC` |
| AV1 | `av01` | `av1C` |
| VP8 / VP9 | `vp08`, `vp09` | `vpcC` |
| VVC / H.266 | `vvc1`, `vvi1` | `vvcC` |
| AVS3 | — | — |

**Note**: the mp4ff changelog itself does not explicitly log VP or AV1 adds ([checked directly](https://github.com/Eyevinn/mp4ff/blob/master/CHANGELOG.md)). They are listed in the README capability matrix. The `av1` subpackage is documented as "basic support for AV1 video packaging" — we should validate it end-to-end before depending on it.

### 3.2. Per-codec CMAF packaging

| Codec | mp4ff sample entry | Config box from RTP frames | Keyframe quirks |
|---|---|---|---|
| H.264 | `avc1` | `avcC` built from SPS/PPS NAL units (what Aevia does today) | IDR frame detection via NAL unit type 5. Browsers emit keyframes ~20–60s apart unless PLI'd; Aevia PLI's every 2s (`KeyframeRequestInterval`). |
| VP8 | **not CMAF-standard** | — | VP8 was never standardized into CMAF per ISO/IEC 23000-19. Packaging into fMP4 is possible via legacy `vp08` but HLS and DASH clients rarely decode it. Viable only for internal hub path, not VOD. |
| VP9 | `vp09` | `vpcC` box with profile, level, bit-depth, chroma-subsampling ([WebM VP9 MP4 binding](https://www.webmproject.org/vp9/mp4/)) | Keyframe = "key frame" flag in VP9 uncompressed header. mp4ff's `vp9` package parses this. Segment on keyframe boundaries as with H.264. |
| AV1 | `av01` | `av1C` box with `seq_profile`, `seq_level_idx`, etc. | Keyframe = OBU sequence header + frame header with `frame_type=KEY_FRAME`. mp4ff's `av1` package is "basic support" — needs validation. |

### 3.3. MIME types for CMAF fMP4 playback

For HLS / DASH manifests referring to our CMAF segments:

| Codec | `codecs` parameter example |
|---|---|
| H.264 CB 3.1 | `avc1.42c01f` (current Aevia) |
| VP9 Profile 0 1080p | `vp09.00.10.08` (profile=0, level=10 for 1080p60, 8-bit) |
| AV1 Main 1080p | `av01.0.08M.08` (profile=0 Main, level 4.0, 8-bit; Mintlify-doc guide for codec strings) |
| HEVC (out of scope) | `hvc1.2.4.L120.B0` |

**All three fit into CMAF**; what's missing in Aevia's code is:

1. A codec-aware keyframe detector (currently hardcoded to AVC NAL types).
2. A codec-aware init-segment builder (currently builds only `avcC`).
3. A codec-aware sample entry writer (currently writes only `avc1`).

Roughly ~400 LOC new Go code to generalize the segmenter, plus tests.

### 3.4. VP8 is the odd one out

VP8 in fMP4 was a WebM-project extension and is not in mainstream CMAF profiles. Shaka Player supports it ([shaka-project/shaka-player#944](https://github.com/google/shaka-player/issues/944)) but hls.js and native HLS on iOS do not. **Practical consequence**: Fase 4a VP8 ingest = WHEP live-only; no VOD recording / no HLS playlist. This matches the plan in the user's task.

---

## 4. Server-side transcoding fallback options

When a creator sends VP9 but a viewer decodes only H.264 (e.g. older Intel Mac Safari, or an iOS 15 device), we have three architectural choices. All three are **expensive** in different dimensions.

### 4.1. Option A — server-side transcode (VP9/AV1 → H.264)

FFmpeg in the provider-node's transcode loop. One transcoder per unique output variant per session.

| Source | Target | CPU cost (real-time 1080p30) | Latency added | Source |
|---|---|---|---|---|
| VP9 → H.264 | 1080p30 CBR 4 Mbps | ~1.5–2 dedicated x86 cores (x264 `preset=veryfast`) | 200–400 ms | [VP9 is ~4× x264 to decode at same profile](https://www.rtcbits.com/2021/02/webrtc-video-codecs-performance.html); re-encode with x264 veryfast is close to real-time. |
| AV1 → H.264 | 1080p30 CBR 4 Mbps | ~3–4 cores AV1 decode + 1 core H.264 encode | 400–800 ms | [SVT-AV1 preset 8 at 1080p60 ≈ 40–50% CPU on i7-13700H](https://streaminglearningcenter.com/encoding/svt-av1-vs-libaom.html); decode is lighter than encode but still heavy. |
| VP9 → VP9 (transmux only) | no re-encode | negligible | ~50 ms | Transmux into CMAF fMP4 — this is what Fase 4b actually ships. No transcode. |

**Aevia's current hosting assumption** is small provider nodes (Mac mini, Hetzner CAX21, Raspberry Pi 5). A 2-core real-time VP9→H.264 transcode dominates the machine; running 5 concurrent sessions is infeasible. **Transcoding is not a viable default path for Aevia's PoC stage.**

[Cloudflare's AV1 encode benchmark](https://blog.cloudflare.com/av1-cloudflare-stream-beta/): encoding 2 seconds of 4K video at 30fps with libaom-av1 single-threaded took 30+ minutes; 48-core parallelism brought it to 43 seconds — still 21× slower than real-time. Cloudflare shipped AV1 by using **dedicated hardware encoders**, not CPU.

### 4.2. Option B — negotiate down-cycle (creator re-encode on REMB/CCM)

Viewer-side browser reports `a=recv` codec list; provider relays REMB / CCM-FIR to creator requesting renegotiation. Creator re-offers with H.264.

- Works today in theory — WebRTC negotiation is bidirectional.
- **Broken in practice**: after the initial SDP is committed, most browsers refuse to re-offer a different codec without a full `pc.close()` + new session. Chrome's `setCodecPreferences` allows this but requires the application to rebuild the transceivers.
- Creators hate this — visible glitch + re-prompt for camera permission in some browser versions.

Not recommended as primary fallback.

### 4.3. Option C — creator-side simulcast (multi-bitrate at ingest)

Chrome's simulcast extension has the creator encode **N simultaneous streams** (H.264 1080p + H.264 720p + H.264 360p, or VP9 SVC L3T3). Provider picks the layer to forward per viewer.

| Codec | Simulcast support | SVC support | Notes |
|---|---|---|---|
| H.264 | yes, distinct SSRC per layer | temporal only | Mandatory per [W3C webrtc-svc](https://w3c.github.io/webrtc-svc/). |
| VP8 | yes | temporal only | Same as H.264 |
| VP9 | yes | full spatial+temporal SVC (L3T3 etc.) | **40–60% bitrate savings vs. VP8 simulcast** per [BlogGeek.me](https://bloggeek.me/scalability-vp9-webrtc/). Single RTP stream. |
| AV1 | yes | full SVC | Chrome 113+ per [Meetecho blog](https://www.meetecho.com/blog/vp9-av1-simulcast-svc/). Firefox 136+ gained simulcast. |
| H.265 | no — simulcast-only | temporal only | — |

**Implication for Aevia**: if we go VP9, we get SVC for free on the ingest side. The creator's device encodes once in SVC mode, sends one RTP stream, the provider-node pulls out layers. That's substantially cheaper for the creator's battery than simulcast with VP8 or H.264, and zero server CPU cost.

### 4.4. Latency reference numbers

| Path | End-to-end latency (glass-to-glass) |
|---|---|
| Current Aevia H.264 WHIP → WHEP | ~400–800 ms (Sprint 1 validated 2026-04-16) |
| H.264 WHIP → WHEP with CMAF DVR | +2–4 s (CMAF segment buffering) |
| VP9 WHIP → VP9 WHEP (no transcode) | ~400–800 ms (unchanged) |
| VP9 WHIP → H.264 WHEP (transcode) | +200–400 ms + re-encode latency |
| AV1 WHIP → AV1 WHEP (native) | ~500–1000 ms (decode cost higher) |
| AV1 WHIP → H.264 WHEP (transcode) | +400–800 ms (AV1 decode expensive) |

Numbers are order-of-magnitude — actual depends on creator network RTT and receiver hardware.

---

## 5. Recommended path for Fase 4

### 5.1. Fase 4a — VP8 fallback (lowest risk)

**Goal**: stop losing Samsung / MediaTek creators who can't H.264-encode in Chrome Android.

**Scope**:
- Register `webrtc.MimeTypeVP8` in `NewServer`'s `MediaEngine`, after the three H.264 profiles.
- SDP ordering: H.264 first, VP8 second, so well-supported devices stay on H.264 and only Android-with-no-AVC-encoder falls to VP8.
- **No segmenter change** — keep CMAF path H.264-only.
- **VP8 sessions run WHEP-only**. `segmenter` inspects track codec and skips if not H.264. No HLS playlist, no VOD pinning.
- UI warning in `apps/video`: "sua sessão está em modo vp8 — a gravação vod não estará disponível" (pt-BR per CLAUDE.md).

**Effort**: ~3–5 days at the existing pion layer.
- 0.5 day pion `MediaEngine` update + tests (`whip_test.go`)
- 1 day: segmenter codec-type guard + telemetry counter for "skipped VOD due to non-H.264 ingest"
- 1 day: WHEP handler verification — it already forwards whatever `VideoHub` contains, but we should confirm VP8 negotiates cleanly on the viewer side with Safari iOS (which decodes VP8 since iOS 12.1)
- 1 day: UX copy + dashboard warning banner

**Compatibility risk**:
- VP8 decode is universal (mandatory-to-implement per RFC 7742).
- **No viewer drops** expected.

**Operational cost**: zero additional CPU. VP8 is lighter than H.264 on both decode and encode.

**Failure mode to watch**: some enterprise proxies strip `a=rtpmap:96 VP8/90000` lines from SDP offers they don't understand. Unlikely affects consumer creators but worth a telemetry probe.

### 5.2. Fase 4b — VP9 first-class (moderate risk, highest ROI)

**Goal**: 30% less creator upload bandwidth; SVC for free on the wire; full VOD support.

**Scope**:
- Register VP9 Profile 0 (`profile-id=0`) in pion, ordered **above** H.264 so it becomes preferred when available.
- Teach `segmenter.go` to handle `vp09` fMP4 sample entries using `Eyevinn/mp4ff/vp9`.
- Add VP9 keyframe parsing (VP9 uncompressed header bit for key frame).
- Generalize the init-segment builder to dispatch on codec MIME type.
- HLS playlist writer emits codecs string `vp09.XX.YY.08` when session's track is VP9.
- LL-HLS parts keep working because CMAF part boundaries are codec-agnostic.

**Effort**: ~2–3 weeks.
- 1 week: segmenter refactor (split AVC-specific into `avc_segmenter.go`, add `vp9_segmenter.go`, common interface)
- 3–4 days: init-segment generator for `vp09` + tests
- 2–3 days: HLS manifest writer codec-string branching
- 2–3 days: WHEP transceiver codec negotiation — currently answers whatever creator sends, but we should exercise the VP9 path end-to-end with iOS Safari (VP9 decode since iOS 14)
- 2–3 days: integration tests + QA across Chrome / Safari / Firefox / Safari iOS

**Compatibility risk**:
- Safari macOS and iOS decode VP9 in CMAF since iOS 14 / macOS Big Sur (2020). **Universal decode in 2026.**
- Samsung Internet: decodes VP9 HW since 2019. Fine.
- Edge: decodes VP9. Fine.
- **No viewer drops expected** for VP9 decode.
- **Creator-side**: some older iOS (< 14) can't WebRTC-encode VP9. They stay on H.264 which is still registered.

**Operational cost**: zero additional CPU (transmux, no transcode). Bandwidth savings ~30% on upload = lower R2 egress if we egress from R2. Wins every direction.

### 5.3. Fase 4c — AV1 for premium (high risk, speculative value)

**Goal**: royalty-free forward-looking codec; ~46% bandwidth savings vs. H.264 per [Cloudflare's claim](https://blog.cloudflare.com/av1-cloudflare-stream-beta/).

**Scope**:
- Register `webrtc.MimeTypeAV1` in pion. Do **not** make it preferred — leave as opt-in per creator (flag in WHIP offer SDP via `a=rid` / creator toggle).
- Teach segmenter to emit `av01` CMAF sample entries using `Eyevinn/mp4ff/av1`.
- Add AV1 keyframe detection (OBU sequence header + `frame_type=KEY_FRAME`).
- HLS playlist emits `av01.0.08M.08` codec string.
- Explicit H.264 simulcast fallback for viewers that can't decode AV1 (iOS Safari on iPhone < 15 Pro, older Macs): in the HLS multivariant playlist, list H.264 variant alongside AV1 variant.

**Effort**: ~3–4 weeks.
- 1 week: segmenter AV1 path + init segment
- 1 week: HLS multivariant playlist with H.264 + AV1 alternates
- 3–5 days: WHEP handler AV1 Dependency Descriptor pass-through (pion handles it but we need to validate our hub track advertises it)
- 1 week: cross-device QA — Pixel 6+, S21+, M3 Mac, iPhone 15 Pro, older iPhones for fallback path

**Compatibility risk**:
- **iOS Safari AV1 decode is ~33% of sessions** ([WebCodecs Fundamentals 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/)). Without H.264 fallback in the HLS manifest, **we lose 2/3 of iOS viewers**. This is non-negotiable — if we ship AV1 we MUST simulcast or transcode H.264 alongside.
- macOS Safari AV1 decode ~24% (older Intel + pre-M3 Apple Silicon).
- Chrome / Edge / Firefox: universal decode.
- Samsung flagships: decode fine.

**Operational cost** — this is the killer:
- If we run AV1-only, viewer-side compatibility collapses.
- If we simulcast AV1 + H.264 at ingest, creator's device encodes twice. On Pixel 9 / S24 this is feasible (both have AV1 HW encode). On anything else, battery burns.
- If we transcode AV1→H.264 server-side, Cloudflare's numbers suggest ~21× real-time per stream on CPU. Would need hardware encoders (Intel Arc, NVIDIA NVENC with AV1 capability) on every provider-node. **Not feasible with Aevia's current provider-node hardware profile** (see `/Users/leandrobarbosa/.claude/projects/-Users-leandrobarbosa-Personal-videoengine/memory/aevia_testnet_3node.md`).

**Recommendation**: defer AV1 until at least Sprint 6. By then iOS Safari AV1 decode coverage should exceed 60% (natural device refresh) and/or we have GPU encode in provider-node hardware SKUs.

### 5.4. Summary rollout table

| Phase | Codec added | Weeks of eng | Viewer drop risk | New CPU cost per session | Blockers |
|---|---|---|---|---|---|
| 4a | VP8 fallback | 0.6–1 | 0% (VP8 MTI) | 0 (no transcode) | none — ship after auth hardening |
| 4b | VP9 first-class | 2–3 | 0% (Safari VP9 since iOS 14) | 0 (transmux only) | mp4ff vp9 validation; QA matrix |
| 4c | AV1 premium | 3–4 | up to 66% iOS without fallback path | simulcast: doubles creator encode cost; transcode: ~2–4 cores/stream | iOS decode coverage; GPU encode in provider-node |

---

## 6. Open questions — need real experiments

These cannot be answered from documentation and caniuse alone. Each should become a Sprint-scheduled experiment.

1. **Samsung S23 / S24 / S25 Chrome Android**: what's the actual success rate of H.264 HW encode on a current 2026 device fleet? Anecdotal reports are noisy. Need a telemetry probe on our `apps/video` creator page that records `RTCRtpSender.getStats().codecImplementation` for the first 10 minutes of a session, histogrammed by user-agent / GPU model.

2. **VP8 fallback success rate**: when we add VP8 in Fase 4a, what fraction of Android Chrome sessions actually fall to VP8 vs. stay on H.264? Expected <10% but worth measuring. Probe: same stats endpoint as #1, record negotiated codec in the WHIP server on first RTP packet.

3. **Safari iOS 18 / 19 reliability for WebRTC VP9 decode**: MDN / caniuse state VP9 decode since iOS 14 but WebRTC-specific behavior can differ. Need: two-browser test harness — creator on Chrome Android publishing VP9, viewer on iPhone 13 / 14 / 15 / 16 running latest Safari, measure decode success + frame-drop rate over 5 minutes.

4. **Eyevinn/mp4ff AV1 `av1C` round-trip fidelity**: the README claims AV1 support but the subpackage is described as "basic." Before Fase 4c, we need a test: feed a known-good AV1 OBU sequence into mp4ff, write `av01` fMP4, read back, compare bit-for-bit against ffmpeg's output. Failure modes to probe: `seq_profile`, `seq_level_idx_0`, `monochrome`, HDR metadata.

5. **VP9 SVC ingest from Chrome Android**: if Aevia adopts VP9 and the creator's Chrome enables SVC (`scalabilityMode: "L3T3"`), does pion correctly expose the spatial layers via `TrackRemote.Codec().SDPFmtpLine` or do we need to parse the Dependency Descriptor ourselves? Experiment: Chrome 113+ creator, inspect RTP header extensions received by pion.

6. **Firefox Android H.264 fallback**: Firefox for Android only gained HW H.264 in v73 and only on some devices. If a creator is on Firefox Android < current, do we negotiate H.264 SW or does it fail entirely? Probe on the telemetry endpoint.

7. **CMAF VP9 init-segment interop with iOS Safari native HLS**: Safari historically didn't decode VP9-in-fMP4 via native HLS (only via MSE). Need to verify 2026 behaviour — does current iOS Safari handle `codecs="vp09.00.10.08"` in an HLS multivariant playlist, or do we still need hls.js shim + MSE?

8. **LL-HLS EXT-X-PART with VP9**: Aevia's part emission logic is in `parts.go`. Does part-boundary alignment math still hold when keyframes come from VP9 uncompressed header bit instead of H.264 NAL type 5? Needs integration test before Fase 4b ships.

9. **AV1 Dependency Descriptor forwarding**: pion handles DD automatically but our `TrackLocalStaticRTP` hub may or may not propagate the DD header extension to WHEP viewers. If it doesn't, Chrome viewers see AV1 but can't decode temporal layers correctly. Test: AV1 ingest, two WHEP viewers, inspect their received RTP extensions.

10. **Provider-node AV1 decode performance**: we claim "transmux only" for Fase 4b VP9 — for AV1 we also plan transmux. But if we ever need to decode AV1 for keyframe extraction or thumbnail generation, the CPU cost is ~3× VP9 decode ([Streaming Learning Center benchmarks](https://streaminglearningcenter.com/encoding/svt-av1-vs-libaom.html)). Need: measure mp4ff parse cost for 1080p AV1 segments on provider-node target hardware.

---

## 7. Sources

- [WebRTC Browser Support 2026: Complete Compatibility Guide — Ant Media](https://antmedia.io/webrtc-browser-support/)
- [AV1, H265 support in 2026: Data from 1M+ devices — WebCodecs Fundamentals](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/)
- [Codecs used by WebRTC — MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/WebRTC_codecs)
- [caniuse AV1 support](https://caniuse.com/av1)
- [The Challenging Path to WebRTC H.264 Video Codec Hardware Support — BlogGeek.me](https://bloggeek.me/webrtc-h264-video-codec-hardware-support/)
- [VP8 hardware support in Android Chrome — discuss-webrtc](https://groups.google.com/g/discuss-webrtc/c/dERL1z5dxtc)
- [Chromium bug 1237677 — VP8 encoder issue when hardware acceleration](https://bugs.chromium.org/p/chromium/issues/detail?id=1237677)
- [Android supported media formats — Android Developers](https://developer.android.com/guide/topics/media/media-formats)
- [pion/webrtc v4 — pkg.go.dev](https://pkg.go.dev/github.com/pion/webrtc/v4)
- [pion/webrtc mediaengine.go source](https://github.com/pion/webrtc/blob/master/mediaengine.go)
- [pion/webrtc v4.1.0 release notes — AV1 stable](https://github.com/pion/webrtc/releases/tag/v4.1.0)
- [pion/webrtc issue #1670 — AV1 support](https://github.com/pion/webrtc/issues/1670)
- [pion/webrtc issue #2424 — H.264 green blocks](https://github.com/pion/webrtc/issues/2424)
- [Eyevinn/mp4ff README — codec support table](https://github.com/Eyevinn/mp4ff)
- [Eyevinn/mp4ff CHANGELOG](https://github.com/Eyevinn/mp4ff/blob/master/CHANGELOG.md)
- [WebM Project VP9 MP4 binding](https://www.webmproject.org/vp9/mp4/)
- [VP Codec ISO Media File Format Binding — webmproject/vp9-dash](https://github.com/webmproject/vp9-dash/blob/main/VPCodecISOMediaFileFormatBinding.md)
- [CMAF VP9 media file format binding draft — WebM Project PDF](https://storage.googleapis.com/downloads.webmproject.org/docs/vp9/vp-codec-cmaf-media-file-format-binding-20171010-draft.pdf)
- [shaka-player issue #944 — VP9 in ISO-BMFF codec string](https://github.com/google/shaka-player/issues/944)
- [Cloudflare Stream WebRTC docs](https://developers.cloudflare.com/stream/webrtc-beta/)
- [Cloudflare AV1 Stream beta blog](https://blog.cloudflare.com/av1-cloudflare-stream-beta/)
- [Bringing WebRTC to Cloudflare Stream via WHIP / WHEP](https://blog.cloudflare.com/webrtc-whip-whep-cloudflare-stream/)
- [WebRTC Video Codecs performance evaluation — rtcbits](https://www.rtcbits.com/2021/02/webrtc-video-codecs-performance.html)
- [SVT-AV1 vs LibAOM — Streaming Learning Center](https://streaminglearningcenter.com/encoding/svt-av1-vs-libaom.html)
- [W3C webrtc-svc Scalable Video Coding Extension](https://w3c.github.io/webrtc-svc/)
- [Scalability, VP9, and what it means for WebRTC — BlogGeek.me](https://bloggeek.me/scalability-vp9-webrtc/)
- [Playing with VP9/AV1 simulcast — Meetecho blog](https://www.meetecho.com/blog/vp9-av1-simulcast-svc/)
- [AV1 Supported Devices — Coconut](https://www.coconut.co/articles/av1-supported-devices-complete-list-updates)
- [AV1 For WebRTC benchmarks — Visionular](https://visionular.ai/av1-for-webrtc/)
- [Evaluation of Hardware-based Video Encoders on Modern GPUs for UHD Live-Streaming — arXiv:2511.18686](https://arxiv.org/html/2511.18686v1)
- [Chrome 90 Beta AV1 Encoder for WebRTC — Chromium Blog](https://blog.chromium.org/2021/03/chrome-90-beta-av1-encoder-for-webrtc.html)
- [VP9/AV1 Simulcast in Chrome 113 — Phoronix](https://www.phoronix.com/news/VP9-AV1-Simulcast-Chrome-113)
- [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)

---

*Research doc compiled 2026-04-18 for Aevia Fase 4 planning. Update when new pion / mp4ff versions ship or when iOS AV1 decode coverage crosses 60%.*
