import { expect, test } from '@playwright/test';

/**
 * Fase 3.1 P2P scaffold smoke tests. Locks the critical user-facing
 * behaviour:
 *
 *   1. /live/mesh/:id?p2p=1 loads without 5xx even for an unknown
 *      sessionID. Failover path falls back quietly.
 *   2. The libp2p browser node boots in < 8s and the debug chip
 *      "p2p · N conectado" renders with N >= 1 against the local
 *      provider-node WS listener.
 *   3. No unhandled rejections or loud errors hit the console. 400 KB
 *      libp2p bundle is a lot of moving parts; this guard keeps drift
 *      visible.
 *
 * These tests assume a local `aevia-node` is running with:
 *   AEVIA_WS_LISTEN=/ip4/0.0.0.0/tcp/4002/ws
 * and a dev server started with:
 *   NEXT_PUBLIC_AEVIA_LIBP2P_BOOTSTRAPS=/ip4/127.0.0.1/tcp/4002/ws/p2p/<peerID>
 *   NEXT_PUBLIC_AEVIA_MESH_URL=http://localhost:8090
 *   AEVIA_DEV_BYPASS_AUTH=true
 */

test('P2P opt-in: libp2p chip appears with at least one connected peer', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const response = await page.goto('/live/mesh/s_p2ptest?p2p=1');
  expect(response?.status(), 'mesh viewer must not 5xx').toBeLessThan(500);

  // libp2p dials WSS → handshakes Noise → Yamux → identify → subscribes
  // to the topic. On a warm laptop this fits comfortably inside 8s; give
  // it 15s of headroom on CI.
  const chip = page.locator('span', { hasText: /p2p · \d+ conectado/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });

  // Extract the connected count. Format: "p2p · 1 conectado · 0 na sala"
  const chipText = await chip.textContent();
  expect(chipText).toBeTruthy();
  const match = chipText?.match(/p2p · (\d+) conectado/);
  expect(match, 'chip format unchanged').toBeTruthy();
  const connected = Number(match?.[1] ?? '0');
  expect(connected, 'at least one libp2p connection established').toBeGreaterThanOrEqual(1);

  // No page-level exceptions (syntax errors, missing imports, etc.).
  expect(pageErrors, 'page errors must be empty').toHaveLength(0);

  // Console errors filter: the main viewer path expects WHEP to 404
  // against a fake session. That's fine. We only flag libp2p-related
  // or truly-unexpected errors.
  const libp2pErrors = consoleErrors.filter(
    (e) =>
      e.toLowerCase().includes('libp2p') ||
      e.toLowerCase().includes('websocket') ||
      e.toLowerCase().includes('gossipsub'),
  );
  expect(libp2pErrors, `no libp2p errors should surface: ${libp2pErrors.join(' | ')}`).toHaveLength(
    0,
  );
});

test('P2P opt-out: ?p2p=1 absent means no chip, no libp2p boot cost', async ({ page }) => {
  await page.goto('/live/mesh/s_p2ptest');

  // Chip must NOT render without the flag — Fase 3.1 is opt-in.
  const chip = page.locator('span', { hasText: /p2p · \d+ conectado/ });
  await expect(chip).toHaveCount(0);

  // Bundle cost check: the libp2p chunk should NOT have been fetched.
  // Next.js names dynamic import chunks with a hash + the original path
  // hint, so we assert no request to a URL containing "p2p" was made.
  const requests = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.map((e) => e.name);
  });
  const p2pChunks = requests.filter((r) => /\/(lib|chunks)\/.*p2p/.test(r));
  expect(p2pChunks, 'lazy libp2p chunk must not load without opt-in').toHaveLength(0);
});
