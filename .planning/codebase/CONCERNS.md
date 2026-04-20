# Codebase Concerns

**Analysis Date:** 2026-04-20

## Security Concerns

### Dev-bypass authentication leaking to production

**Risk:** High  
**Type:** Security / Process  
**Files:** 
- `apps/video/src/middleware.ts` (line 38-41)
- `apps/video/src/lib/env.ts` (line 128)
- `.env.example` (line 60-61)

**Issue:**  
The `AEVIA_DEV_BYPASS_AUTH` flag (and its `NEXT_PUBLIC_` variant) bypasses Privy authentication entirely:
- When `NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH=true`, middleware skips cookie gates and renders protected routes (`/dashboard`, `/live/new`, `/wallet`) without authentication
- The flag is checked in both `middleware.ts` (server-side) and `env.ts` (client-side)
- If this flag is accidentally set to `true` in a Cloudflare Pages production deploy, the entire application becomes unauthenticated

**Current Mitigation:**  
- Comments state "MUST stay false in production" and "MUST be empty/false in prod deploys"
- No automated CI gate enforces this before `pnpm pages:deploy`
- Manual discipline only

**Recommendation:**  
- Add a pre-deploy check in CI (`pages:deploy` hook) that fails if `AEVIA_DEV_BYPASS_AUTH=true` or `NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH=true`
- Consider removing `NEXT_PUBLIC_` variant entirely since it's harder to guarantee at deploy time (inlined at build)
- Document in SETUP.md the exact verification step (`grep "AEVIA_DEV_BYPASS_AUTH" .env.local` must be empty/false)

---

### Base Sepolia contracts un-audited, Mainnet blocked on external audit

**Risk:** Blocker (for mainnet)  
**Type:** Security / Audit  
**Files:**
- `docs/adr/0008-boost-router-design.md` (line 178)
- `docs/adr/0009-risk-oracle-design.md` (line 205-206)
- `packages/contracts/src/BoostRouter.sol`
- `packages/contracts/src/RiskOracle.sol`

**Issue:**  
- `BoostRouter.sol` and `RiskOracle.sol` are feature-complete and deployed on Base Sepolia, but explicitly marked un-audited
- ADR 0008 and ADR 0009 both state: "Deploy after external audit"
- Mainnet (`chainId = 1`) deployment is gated on passing a third-party security review
- Current deployments on Base Sepolia are for testing only; they should not be used for real economic activity

**Current State:**  
- Sepolia addresses captured in codebase (live but pre-audit)
- No audit engagement confirmed in visible docs
- Contracts implement economic claims (boosts, Risk Score oracle) that require trust

**Recommendation:**  
- Document audit timeline and vendor selection in TODO.md
- Add a comment in contract constructor or contract header stating "DO NOT USE MAINNET ADDRESS" if ever instantiated
- Track audit completion as a hard blocker for mainnet migration (separate ADR)

---

### OpenZeppelin lib submodule status unclear (modified, uncommitted)

**Risk:** Medium  
**Type:** Correctness / Build  
**Files:** `packages/contracts/lib/openzeppelin-contracts` (git status: `m` — modified)

**Issue:**  
- Git status shows `m packages/contracts/lib/openzeppelin-contracts` (modified submodule)
- The submodule pointer has diverged from the canonical commit
- No documentation in ADRs or SETUP.md explaining why the lib is modified or what changes are pinned
- Could cause build inconsistency or dependency drift

**Current State:**  
- Submodule is present and functional (tests pass)
- But the modification is not tracked or documented

**Recommendation:**  
- Either commit the submodule to a specific commit (run `git add packages/contracts/lib/openzeppelin-contracts` if intentional) or revert it
- Document in SETUP.md if the submodule requires a custom patch (and why)
- Add a `.gitmodules` comment explaining the pinned version and any deviations

---

## Test Coverage Gaps

### Authenticated e2e tests deferred to Sprint 3

**Risk:** Medium  
**Type:** Testing / Coverage  
**Files:**
- `apps/video/e2e/smoke.spec.ts` (line 53-56)
- `packages/auth/src/__tests__/verify-edge.test.ts` (line 63-65)

**Issue:**  
- Smoke suite skips all authenticated flows with `test.skip('authenticated flow — sprint 3')`
- Critical auth path (Privy login → registration → on-chain signing) is not end-to-end tested
- JWKS verification happy-path is not tested; only rejection paths are covered
- The happy-path gap is explicitly acknowledged but deferred

**What's not tested:**  
- Privy session cookie handling in real login flow
- Dashboard visibility after authentication
- Typed-data signing with Privy wallet
- Content registration on-chain after upload

**Recommendation:**  
- Block Sprint 3 start with a clear task: "Wire Privy test fixtures and add authenticated e2e tests"
- Use `Privy.createAppUser` (test API) + session injection via `context.addCookies`
- Add a JWKS fixture in test setup that allows signing with embedded keys (or use Privy's test mode)

---

### Upload retry logic stubbed out, not implemented

**Risk:** Medium  
**Type:** Feature Gap  
**Files:** `apps/video/src/components/upload-banner.tsx` (line 63-66)

**Issue:**  
- Retry button on failed uploads simply dismisses the error row and bounces user to `/live/{id}` page
- Original blob is not retained in memory after page navigation
- Clicking "retry" is a UX antipattern: it clears the error without actually retrying
- No actual retry mechanism exists; the user must manually re-record

**Current Workaround:**  
- Error rows are sticky (not auto-dismissed); user must click `X` or "retry"
- "Retry" is a euphemism for "clear this error and go upload again"

**Recommendation:**  
- Implement true retry by storing the original Blob in a Context or IndexedDB backing
- Add a `state` to `UploadState` that tracks "retrying" separately from "uploading"
- Alternatively, rename the button to "upload again" to clarify the UX intent

---

### Test file count low, concentrated in packages/auth

**Risk:** Medium  
**Type:** Testing / Coverage  
**Files:**
- `apps/video/e2e/smoke.spec.ts` (1 file, 3 real tests + 1 skipped)
- `apps/video/e2e/p2p.spec.ts` (1 file, existence unknown)
- `packages/auth/src/__tests__/` (3 test files: verify-edge, register-content, did)
- `packages/contracts/` (Foundry tests in `test/`)

**Issue:**  
- Only 5 test files across `apps/` and `packages/` (excluding `services/` Go tests)
- Most tests are in `packages/auth` (server-side crypto)
- Frontend components (upload, player, wallet screen) have zero tests
- E2E suite is minimal (smoke tests only)

**Coverage Reality:**  
- `packages/auth`: well-tested (crypto + signature verification)
- `apps/video` components: no unit tests
- `apps/video` pages: no unit tests
- Integration tests: smoke suite only (unauthenticated paths)

**Recommendation:**  
- Add Vitest+@testing-library to `apps/video` in Sprint 3 (after authenticated flow is testable)
- Start with critical paths: `<WalletScreen>`, `<UploadBanner>`, `<GoLiveScreen>` (backend selection logic)
- Set a target of 60%+ coverage for `apps/video/src` before mainnet migration

---

## Known Deferred Work (TODO Markers)

### CIDv1 manifest generation deferred to Sprint 3

**Impact:** High  
**Files:** `docs/adr/0002-content-registry-deployment.md` (line 102)

**Issue:**  
- Current registration flow uses a deterministic keccak256 placeholder as the manifest CID:  
  ```
  manifestCid = keccak256(abi.encodePacked(
    bytes32(videoUid), address(creator), uint64(createdAtSeconds)
  ))
  ```
- This is NOT a valid IPFS CIDv1 raw (does not start with multibase/multicodec prefix)
- The placeholder cannot collide with future real CIDv1s (by design), but it's a temporary shim
- Sprint 3 must implement the Cloudflare Stream webhook pipeline to emit real CIDv1 hashes

**Current State:**  
- Placeholder CIDs are already registered on-chain (live on Sepolia)
- Mainnet migration will also use placeholders until Sprint 3 ships

**Path Forward:**  
- Stream webhook route: `POST /api/stream-webhook` → receives VOD metadata → computes CIDv1 raw + binary-Merkle SHA-256 over assembled MP4
- Re-register or supersede placeholder entries via a clip/re-register flow
- Documented in `docs/adr/0002` and expected in `TODO.md §5`

---

### Wallet screen credits mocked until CreditToken ships

**Impact:** Medium  
**Files:** `apps/video/src/components/wallet-screen.tsx` (line 79-85)

**Issue:**  
- `WalletScreen` displays a hardcoded welcome bonus of 20 credits
- Actual balance reads from non-existent `CreditToken` contract (Sprint 3)
- History is a stubbed list with no on-chain backing
- UX is correct (Stitch design matches) but data is fake

**Current Behavior:**  
- Shows `creditsBalance = 20`, `creditsReceived = 20`, `creditsSent = 0`
- Every user sees the same fake state
- No transactions are rendered

**Recommendation:**  
- Document in code comment that this is demo-only until `CreditToken` and `PersistencePool` operations ship
- Add a feature flag to hide the wallet screen from production if needed (currently off by default, good)

---

### WHEP Location headers not unique per viewer (integration test TODO)

**Impact:** Low (Spec compliance)  
**Files:** `services/provider-node/internal/integration/whep_multiviewer_test.go` (line 347-353)

**Issue:**  
- Integration test logs a TODO: "WHEP Location headers not unique across multiple viewers"
- RFC 8590 requires each WHEP session to have a unique Location header with a distinct resource path
- Current implementation may return the same URL for multiple simultaneous viewers on the same live

**Current Workaround:**  
- Viewers can still play (HLS fallback works)
- But spec compliance is incomplete

**Recommendation:**  
- Assign to provider-node maintainer for Sprint 3
- Implement per-viewer UUID generation in WHEP route
- Add assertion to multiviewer test that verifies > 1 distinct Location headers

---

## Performance Bottlenecks & Fragile Areas

### Client-side RPC calls for ETH balance (blocking, no timeout)

**Risk:** Medium  
**Type:** Performance  
**Files:** `apps/video/src/components/wallet-screen.tsx` (line 47-76)

**Issue:**  
- `WalletScreen` fetches ETH balance via a `fetch()` POST to the public RPC in a `useEffect`
- No timeout is set; if the RPC is slow or unresponsive, the effect hangs
- The request runs on every client render (no caching)
- Slow RPC = visual stall on `/wallet` page load

**Current Mitigation:**  
- Catch block silently falls back to "—" (dash) on network errors
- Cancellation token prevents stale updates after unmount
- But no timeout means a slow-but-responsive RPC can still stall

**Recommendation:**  
- Add a 3–5 second timeout to the fetch request
- Consider moving balance fetch to a server-side loader or RSC (no client RPC call at all)
- Cache the result in sessionStorage or a Context to avoid re-fetching on every navigation

---

### Privy embedded-wallet bundle weight + SSR 500 requires dev bypass

**Risk:** Medium  
**Type:** Build / Integration  
**Files:**
- `apps/video/src/lib/env.ts` (line 118-128)
- `apps/video/src/components/providers.tsx` (inferred from comments)
- `.env.example` (line 54-61)

**Issue:**  
- Next.js dev server (`npm run dev`) crashes with a 500 SSR error when importing `@walletconnect/*` on the server side
- Root cause: `@walletconnect/types` or dependent packages bundle browser-only APIs (e.g., `window`, `localStorage`)
- Workaround: set `AEVIA_DEV_BYPASS_AUTH=true` to skip the `AeviaPrivyProvider` entirely in dev, so WalletConnect is never imported during SSR
- Production builds work fine (SSR runs during static generation, not at request time)

**Impact:**  
- Local development requires the bypass flag to be enabled
- New developers unfamiliar with this workaround will see a confusing 500 error
- The bypass flag accidentally reaching production would disable auth for everyone

**Recommendation:**  
- Document this in SETUP.md under "Common Issues"
- Consider wrapping `AeviaPrivyProvider` in a dynamic import with `ssr: false` in `providers.tsx` to avoid the workaround entirely
- Or: Move Privy provider into a client-only boundary (a non-RSC component tree)

---

### libp2p mesh discovery has a SPOF if only one DHT relay is configured

**Risk:** Medium  
**Type:** Architecture / Resilience  
**Files:**
- `apps/video/src/lib/mesh/resolve.ts` (line 11-12)
- `.env.example` (line 26-32)

**Issue:**  
- `NEXT_PUBLIC_AEVIA_DHT_RELAYS` is a comma-separated list of relay HTTP URLs used for DHT discovery
- If only one relay is configured (or if all relays are unreachable), the mesh falls back to `NEXT_PUBLIC_AEVIA_MESH_URL`
- If `NEXT_PUBLIC_AEVIA_MESH_URL` is also unavailable, viewers cannot discover provider nodes
- The thesis ("persistência ≠ distribuição") requires at least 2 relays to hold true

**Current Documentation:**  
- `.env.example` explicitly states: "More than one entry is required for the thesis… to hold — otherwise the single URL remains a SPOF"

**Current Deployment State:**  
- Unknown if production Cloudflare Pages config has >1 relay configured
- Likely a single relay on a VPS with limited redundancy (per memory `aevia_vps_constraints.md`)

**Recommendation:**  
- Verify that production env has >=2 distinct DHT relays configured
- Add a startup assertion to the mesh provider (`app/live/mesh/[id]/page.tsx`) that warns if relays.length < 2
- Document in ops runbook: "Maintain >=2 live DHT relays for mesh resilience"

---

## Untracked / Uncommitted Files (Noise & Risk)

### Screenshot files in repo root (untracked)

**Risk:** Low  
**Type:** Process / Cleanliness  
**Files:**  
- `hamburger-closed.png`, `hamburger-opaque.png`, `hamburger-open.png`, `hamburger-portal-fixed.png`
- `landing-mobile-*.png`, `landing-preview-fullpage.png`
- `mock-labels-*.png`, `network-mobile.png`
- `prod-*.png`, `reframe-*.png`, `roadmap-*.png`, `studio-wallet-entry.png`
- Total: 21 image files (git status `??`)

**Issue:**  
- These are design/mockup screenshots from Stitch or other design tools
- They clutter the repo root and should be in a dedicated `docs/screenshots/` or `.design/` folder (and `.gitignore`d)
- They are not referenced in any code or documentation
- Likely artifacts from UI design iteration

**Recommendation:**  
- Move to `docs/screenshots/` if they should be preserved, or delete if they're stale
- Add `*.png`, `*.jpg`, `*.jpeg` to `.gitignore` if screenshots are not meant to be committed
- Or add a `.gitignore` rule for design artifacts: `.design/`, `docs/mockups/`

---

### `.env.local.bak*` backups in repo root (untracked)

**Risk:** Low  
**Type:** Process  
**Files:**  
- `.env.local.bak`
- `.env.local.bak.bypass`

**Issue:**  
- These are manual backups of `.env.local` (not git-ignored, but untracked)
- Should never be committed (they may contain secrets)
- Suggest developer manually created them as a safeguard before changing `.env.local`

**Recommendation:**  
- Add `.env.local.bak*` to `.gitignore` (already applies via `*.bak` glob if present)
- Educate developers: use git branches or `git stash` for env backup, not file copies
- These files can be safely deleted

---

### `OPPORTUNITY.md` file (untracked)

**Risk:** Low  
**Type:** Process  
**Files:** `OPPORTUNITY.md` (untracked, `??`)

**Issue:**  
- Single untracked `.md` file in repo root
- Name suggests a design doc or business opportunity note
- No reference in CLAUDE.md, README, or other canonical docs
- Likely a work-in-progress or scratchpad

**Recommendation:**  
- If it's a formal design doc, move to `docs/` and add to `.gitignore` or commit it properly
- If it's a scratchpad, move to a branch or delete
- Verify it doesn't contain sensitive business information

---

## Deprecated Code (Not Removed)

### Mirror selection metrics marked DEPRECATED

**Risk:** Low  
**Type:** Code Quality  
**Files:** `services/provider-node/internal/mirror/hop_metrics.go` (multiple lines: 15, 72, 84, 122, 129, 144, 150, 156)

**Issue:**  
- Multiple fields and methods in `hop_metrics.go` are marked `// DEPRECATED — ...` but still present:
  - `videoRTT`, `audioRTT` (wall-clock drift issue)
  - `RecordAudio` method
  - Multiple echo-time accessors (EchoP50Nanos, EchoP95Nanos, EchoP99Nanos)
  - Full-stream counter
- Code is not removed, just marked deprecated
- Likely kept for backwards compatibility with existing mirror nodes

**Current Behavior:**  
- Old metrics are still calculated and available
- New code should use the newer echo metrics, but old code may still call deprecated accessors

**Recommendation:**  
- Add a removal target in TODO.md: "Remove deprecated hop_metrics accessors in Sprint 4" (after all nodes have upgraded)
- Annotate with `DeprecatedSince("0.9.0")` or similar (Go convention)
- Or: Remove now if no production mirrors use these fields (verify with ops)

---

## Environment Configuration Gaps

### Missing optional integrations have no clear defaults

**Risk:** Low  
**Type:** Configuration  
**Files:**
- `.env.example` (multiple optional sections)
- `apps/video/src/lib/env.ts` (optional schema fields)

**Issue:**  
- `LIVEPEER_API_KEY`, `AEVIA_PUBLISHER_TOKEN_SECRET`, `CLOUDFLARE_REALTIME_TURN_*` are all optional
- When absent, the app degrades gracefully (400/503 responses)
- But `.env.example` does not document the **fallback behavior** clearly
- New developers may not realize which features are disabled when a var is missing

**Examples:**  
- Missing `LIVEPEER_API_KEY` → POST `/api/lives` with `backend: 'livepeer'` returns a 502
- Missing `AEVIA_PUBLISHER_TOKEN_SECRET` → `/api/lives/[id]/publisher-token` returns a 503
- Missing `CLOUDFLARE_REALTIME_TURN_*` → `/api/webrtc/ice-servers` returns STUN only (no TURN relay)

**Recommendation:**  
- Add a comment in `.env.example` next to each optional var documenting the fallback
- Example: `# Leave empty to disable Livepeer option in /live/new UI and return 502 on submission`
- Update SETUP.md with a "Feature Flag Matrix" showing which vars enable which features

---

## Audit & Compliance Gaps

### AUP (Acceptable Use Policy) is incomplete, still in docs/aup/

**Risk:** Medium  
**Type:** Process / Policy  
**Files:** `docs/aup/` (in progress)

**Issue:**  
- CLAUDE.md references an "Acceptable Use Policy (AUP)" with hard exclusions for pornography, violence, etc.
- `docs/aup/` is marked "in progress" in the protocol spec
- The actual policy doc is not yet published or enforced
- The UI placeholder page `/app/aup` references `TODO §6` and notes the full v0.1 is pending

**Current State:**  
- `/app/aup/page.tsx` renders a temporary placeholder
- No content moderation rules are encoded in the runtime yet
- Risk Score oracle (`RiskOracle.sol`) will eventually gate pinning/ranking based on AUP compliance, but the policy itself is not finalized

**Recommendation:**  
- Complete `docs/aup/0.1` in a dedicated ADR or RFC
- Add explicit content categories and moderation rules
- Update `/app/aup/page.tsx` to render the canonical doc once it's ready
- Consider adding a lint rule to catch violations early (though this is out of scope for now)

---

## Summary Table

| Area | Severity | Type | Blocker? |
|------|----------|------|----------|
| Dev bypass auth leak risk | High | Security | No (process fix) |
| Smart contracts un-audited | Blocker | Audit | **Yes (for mainnet)** |
| OpenZeppelin lib modified | Medium | Correctness | No |
| Auth e2e tests deferred | Medium | Testing | No (Sprint 3) |
| Upload retry not implemented | Medium | Feature | No |
| Test coverage low | Medium | Testing | No |
| CIDv1 manifest deferred | High | Feature | No (Sprint 3) |
| RPC call stalls on slow network | Medium | Perf | No |
| Mesh relay SPOF risk | Medium | Resilience | No |
| Screenshot clutter | Low | Cleanliness | No |
| Deprecated code not removed | Low | Quality | No |

---

*Concerns audit: 2026-04-20*
