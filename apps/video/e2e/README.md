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
