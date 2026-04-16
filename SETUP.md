# Aevia — Local Setup

Ship-it guide. After this, you can `pnpm dev`, open `http://localhost:3000`, click **Continue**, hit **Go live**, and watch from another device via the share link.

## 1. Tools

```bash
# Foundry (already installed if you followed Sprint 0)
export PATH="$HOME/.foundry/bin:$PATH"

# Optional: mise to pin Node / Go / pnpm
curl https://mise.run | sh
mise install
```

Verify:

```bash
node --version   # 24.x
pnpm --version   # 10.x
go version       # 1.26
forge --version  # 1.5+
```

## 2. Install deps

```bash
pnpm install
```

## 3. Cloudflare setup (one-time)

You need three things: an account ID, a Stream API token, and your customer subdomain code.

### 3a. Account ID

Dashboard → right sidebar → **Account ID** — copy the hex string.

### 3b. Stream API token

Dashboard → **My Profile** → **API Tokens** → **Create Token** → **Custom token**:

- Permissions:
  - `Account` → `Stream` → **Edit**
- Account resources: include only your aevia account
- Leave everything else default

Copy the token. You won't see it again.

### 3c. Stream customer subdomain

Dashboard → **Stream**. If prompted, enable Stream (there's a per-minute paid plan — delivery is $1/1k min, storage $5/1k min).
Top-right there's your customer code like `customer-xyz123abc.cloudflarestream.com`. Copy the `xyz123abc` part.

### 3d. WebRTC beta

Cloudflare Stream's WHIP/WHEP endpoints require no extra opt-in as of April 2026, but if `POST {webRTC.url}` returns 404 check **Stream → Settings → Live Inputs** and confirm WebRTC ingest is available on your account plan.

## 4. Env file

Copy `.env.example` to `.env.local` at the repo root:

```bash
cp .env.example .env.local
```

Fill in:

```
CLOUDFLARE_ACCOUNT_ID=<from 3a>
STREAM_API_TOKEN=<from 3b>
NEXT_PUBLIC_STREAM_CUSTOMER_CODE=<from 3c>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SIGNING_KEY=<run `openssl rand -hex 32`>
```

Privy + Base + blockchain secrets are not needed for Sprint 1. Leave them empty.

## 5. Run

```bash
pnpm dev:web
```

This starts `apps/video` on **:3000** and `apps/network` on **:3001** in parallel.

Open `http://localhost:3000`.

## 6. Test flow (end-to-end)

1. **Chrome desktop**: open `localhost:3000` → **Continue** → you land on `/dashboard` with a generated handle like "SwiftSparrow-7a2b".
2. Click **Start broadcast** → grant camera/mic permission → preview shows.
3. Click **Go live** → status flips to **LIVE** in a second or two → share URL appears.
4. Copy the share URL (e.g. `http://localhost:3000/live/abc123...`).
5. **iPhone Safari** (same network): open the URL → **Tap to unmute** → you see yourself with sub-second latency.
6. Click **Stop** on desktop → status goes Idle, stream ends.

### Known caveats (Sprint 1)

- **Camera permission must be granted each session** — no persistence yet.
- **No VOD UI yet** — recording is enabled in Cloudflare Stream but the "past lives" list is a stub (Sprint 2).
- **No Privy login** — sessions are anonymous cookie-based. Privy integration is Sprint 2.
- **No P2P** — traffic goes Cloudflare Stream → viewer. libp2p mesh is Sprint 3.
- **Signed URLs are off** — anyone with the live ID can watch. Sprint 2 adds signed tokens.

## 7. Services (Go)

The Go services (`provider-node`, `recorder`, `manifest-svc`, `indexer`) are Sprint 0 stubs only. They log "Sprint 0 stub" and idle on SIGINT. Real implementations start in Sprint 2/3.

To run them anyway (useful for validating the Procfile):

```bash
brew install overmind
overmind s -f infra/local-dev/Procfile.dev
```

## 8. Contracts

Foundry workspace lives in `packages/contracts`. Sprint 0 ships a `ContentRegistry` stub + 3 passing tests.

```bash
cd packages/contracts
forge build --sizes
forge test -vvv
```

Deploy to Base Sepolia happens in Sprint 2 after the real `ContentRegistry` (with full invariants + access control) lands.

## 9. Troubleshooting

**`Invalid server environment` on API call** — check `.env.local` has all required keys and restart `pnpm dev`.

**WHIP returns 4xx** — `STREAM_API_TOKEN` probably doesn't have Stream:Edit. Re-create with the exact permission.

**Camera prompt never appears** — Chrome/Safari require `https` or `localhost`. `localhost:3000` is fine, but `127.0.0.1:3000` or an IP won't trigger the prompt.

**Viewer shows "Broadcaster not streaming"** — the broadcaster's WHIP connection state is still negotiating. Wait 2-3 seconds and click Retry.

**Latency >1s on iPhone** — iOS Safari sometimes chooses slow ICE candidates. Close and re-open the viewer tab.

---

Ping me (in the chat) if anything doesn't match this doc — I'll adjust the code or the doc.
