# e2e — aevia.video

suíte playwright para o PWA. executa no browser, contra um servidor Next
de verdade. cobertura atual: smoke tests (landing, gate do dashboard, empty
state do discover).

## executar localmente

um terminal:

```bash
pnpm -C apps/video dev
```

outro terminal:

```bash
pnpm -C apps/video test:e2e
```

modo UI interativo (útil para depurar):

```bash
pnpm -C apps/video test:e2e:ui
```

## instalação dos browsers

na primeira vez numa máquina nova, instale o Chromium do Playwright:

```bash
pnpm exec playwright install chromium --with-deps
```

isso baixa ~170 MB de binários do Chromium para o cache do Playwright. não
é necessário repetir a cada `pnpm install` — só quando a versão do
`@playwright/test` sobe de minor.

## variáveis de ambiente

- `PLAYWRIGHT_BASE_URL` — URL alvo. padrão `http://localhost:3000`. em CI,
  aponte para o preview do Cloudflare Pages.
- `CI=1` — habilita 2 retries, worker único e relatório GitHub.

## escopo da sprint 2

os testes atuais **não** exercitam fluxo autenticado. login com Privy
real exige um fixture de sessão que a sprint 3 vai endereçar (Privy test
mode + cookie seeding). o placeholder `test.skip('authenticated flow —
sprint 3', ...)` em `smoke.spec.ts` marca o ponto de aterrissagem.

## smoke operador-só: p2p-hls-multiviewer

`p2p-hls-multiviewer.spec.ts` é uma suíte **skip-by-default**, não
gateada por CI. exige uma live real sendo servida por um
provider-node e roda contra a URL que o operador passar em
`AEVIA_E2E_LIVE_URL`.

executar manualmente (após subir uma live com `ffmpeg ... WHIP ...`):

```bash
AEVIA_E2E_LIVE_URL="https://aevia.video/live/mesh/s_abc123" \
  pnpm -C apps/video exec playwright test p2p-hls-multiviewer
```

cobre dois cenários impossíveis de validar em unit test:

1. dois browsers headless abrindo a mesma live com `?p2p=1&chunks=1`
   formam swarm e o chip `NN% via peers · M pares` aparece em pelo
   menos um dentro de 45s.
2. quando o provider top-ranked é bloqueado (`route().abort()` no
   `.m3u8`), o player rota via `loadSource` para o próximo candidato
   e entra em playback sem surfaceiar erro terminal.

se `AEVIA_E2E_LIVE_URL` não estiver setado, o describe inteiro é
skipado e o arquivo é no-op. `pnpm test:e2e` em CI continua verde.
