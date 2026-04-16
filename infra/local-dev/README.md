# Local development

## Run everything in parallel

Install [overmind](https://github.com/DarthSim/overmind) (`brew install overmind`) then:

```bash
overmind s -f infra/local-dev/Procfile.dev
```

Services:

- `aevia.video` → http://localhost:3000
- `aevia.network` → http://localhost:3001
- provider-node, recorder, manifest-svc, indexer — logs in overmind panes

## Alternative: turbo filter

```bash
pnpm dev              # runs all `dev` scripts in parallel
pnpm dev:web          # apps only
pnpm dev:services     # Go services only
```

## Environment

Copy `/Users/leandrobarbosa/Personal/videoengine/.env.example` to `.env.local` at the root and fill in the required values:

- Cloudflare Account ID, API token, Stream credentials
- Privy App ID and Secret
- Base Sepolia RPC URL (public ok for read)

## Cloudflare bindings

For `apps/video` KV session storage:

```bash
wrangler kv namespace create AEVIA_SESSIONS --preview
```

Copy the returned IDs into `apps/video/wrangler.toml`.
