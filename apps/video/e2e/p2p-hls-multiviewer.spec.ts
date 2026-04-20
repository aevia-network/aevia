import { type Browser, type BrowserContext, expect, test } from '@playwright/test';

/**
 * ─── OPERATOR-RUN SMOKE TEST ────────────────────────────────────────
 *
 * THIS SPEC IS SKIPPED BY DEFAULT AND IS NOT CI-GATED.
 *
 * It runs only when the operator sets `AEVIA_E2E_LIVE_URL` to a live
 * mesh viewer URL served by a real provider-node that is actively
 * publishing. Example:
 *
 *   AEVIA_E2E_LIVE_URL="https://aevia.video/live/mesh/s_abc123" \
 *     pnpm -C apps/video exec playwright test p2p-hls-multiviewer
 *
 * Purpose: validate two overlapping user-visible behaviours that cannot
 * be covered by unit or component tests because they depend on real
 * network + a real WebTorrent swarm forming between browsers:
 *
 *   1. HLS + chunk relay multi-viewer path. When two headless viewers
 *      open the same mesh live with `?p2p=1&chunks=1`, the P2P
 *      chunk-relay ratio chip (`NN% via peers · M pares`) must appear
 *      on at least one of them within a 45s warm-up window. That chip
 *      is the honest metric we gate PermanenceStrip L1 sage on — if it
 *      never shows up in a two-viewer smoke, something in the tracker
 *      / DataChannel handshake path regressed.
 *
 *   2. HLS failover rotation. When the top-ranked candidate is
 *      blackholed (we simulate this with a `route().abort()` on its
 *      `.m3u8` URL inside one context), the player must NOT surface a
 *      terminal error — it must rotate to the next candidate and
 *      resume playback. This exercises the failover loop added in the
 *      Fase 2.3 HLS rotation commit.
 *
 * Why not CI-gated: a real live stream is a prerequisite. Spinning one
 * up in CI means provisioning an ingest tool (ffmpeg pushing a
 * test pattern via WHIP) + provider-node + network routing per run.
 * That's Sprint-4+ territory. Today this is a manual smoke the
 * operator runs before + after every frontend release that touches
 * the HLS path.
 *
 * If the env var is absent, the describe block skips wholesale and
 * the test file is a no-op — keeps `pnpm test:e2e` green on CI.
 */

const LIVE_URL = process.env.AEVIA_E2E_LIVE_URL?.trim() ?? '';

test.describe('p2p hls multi-viewer smoke (operator-run)', () => {
  test.skip(
    !LIVE_URL,
    'AEVIA_E2E_LIVE_URL not set — set it to a real mesh viewer URL to run this smoke',
  );

  test.describe.configure({ mode: 'serial' });

  test('two headless viewers form a swarm and the chunk-relay chip appears', async ({
    browser,
  }) => {
    const [ctxA, ctxB] = await openTwoIsolatedContexts(browser);
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      const consoleErrorsA: string[] = [];
      const consoleErrorsB: string[] = [];
      pageA.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrorsA.push(msg.text());
      });
      pageB.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrorsB.push(msg.text());
      });

      const url = appendQuery(LIVE_URL, { p2p: '1', chunks: '1', hls: '1' });
      await Promise.all([pageA.goto(url), pageB.goto(url)]);

      // Wait for the P2P chunk-relay ratio chip on either viewer.
      // Chip format (see PlayerFrame): "NN% via peers · M pares".
      // WebTorrent swarm formation over public trackers typically
      // converges inside 10-20s on a warm laptop; 45s gives us
      // headroom for operator-run WAN conditions + cold trackers.
      const chipRegex = /\d+% via peers · \d+ pares/;
      const chipA = pageA.locator('span', { hasText: chipRegex });
      const chipB = pageB.locator('span', { hasText: chipRegex });
      await expect
        .poll(async () => (await chipA.count()) + (await chipB.count()), {
          timeout: 45_000,
          intervals: [1_000, 2_000, 5_000],
        })
        .toBeGreaterThan(0);

      // No unhandled page errors on either viewer. Chunk-relay wire
      // failures surface as console.error with '[p2p:chunk-relay]'
      // prefix — flag those explicitly.
      const relayErrors = [...consoleErrorsA, ...consoleErrorsB].filter((e) =>
        e.includes('[p2p:chunk-relay]'),
      );
      expect(
        relayErrors,
        `no chunk-relay wire errors allowed: ${relayErrors.join(' | ')}`,
      ).toHaveLength(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('hls failover rotates past a blackholed candidate', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();

      // Blackhole the first .m3u8 fetch we see (top-ranked candidate
      // in the failover order). The player's hls.js instance must
      // rotate `loadSource` to the next candidate once its internal
      // retry budget exhausts (10 × 1.5s ≈ 15s). On success the
      // "ao vivo" chip renders inside the 60s window; on failure the
      // player surfaces an error string matching "mesh: ...".
      let blackholedOnce = false;
      await page.route(/\.m3u8(\?|$)/, async (route) => {
        if (!blackholedOnce) {
          blackholedOnce = true;
          await route.abort('internetdisconnected');
          return;
        }
        await route.continue();
      });

      await page.goto(appendQuery(LIVE_URL, { hls: '1' }));

      // Success criteria: player reaches playing state after rotation.
      // `ao vivo · <elapsed>` chip is the render-side proof.
      const liveChip = page.locator('span', { hasText: /ao vivo ·/ });
      await expect(liveChip).toBeVisible({ timeout: 60_000 });

      // Negative criteria: error string must NOT appear before the chip.
      const errorMsg = page.locator('text=/mesh: .+provedores indispon/i');
      await expect(errorMsg).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});

async function openTwoIsolatedContexts(
  browser: Browser,
): Promise<[BrowserContext, BrowserContext]> {
  const a = await browser.newContext();
  const b = await browser.newContext();
  return [a, b];
}

function appendQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}
