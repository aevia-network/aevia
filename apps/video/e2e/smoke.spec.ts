import { expect, test } from '@playwright/test';

/**
 * Sprint 2 smoke suite. Asserts the three edges of the unauthenticated
 * surface behave correctly:
 *
 *   1. `/` renders the landing hero and login entry point.
 *   2. `/dashboard` is gated by `middleware.ts` for anonymous callers and
 *      redirects to `/?next=/dashboard`.
 *   3. `/discover` degrades gracefully when the Cloudflare Stream API is
 *      unreachable (empty state, no 500).
 *
 * Authenticated flows (signing in with a Privy fixture, registering on-chain)
 * are deferred to Sprint 3 — see the skipped placeholder at the bottom.
 */

test('root renders the landing copy', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status(), 'landing page must not 5xx').toBeLessThan(500);

  await expect(
    page.getByRole('heading', { name: /transmita sem\s+intermediários\./i }),
  ).toBeVisible();

  await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
});

test('dashboard requires auth and redirects anonymous visitors to the landing', async ({
  page,
}) => {
  const response = await page.goto('/dashboard');
  expect(response?.status(), 'redirect target must not 5xx').toBeLessThan(500);

  // middleware.ts redirects to `/?next=/dashboard` for anonymous visitors.
  await expect(page).toHaveURL(/\/(\?|$)/);
  await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
});

test('discover renders an empty state gracefully', async ({ page }) => {
  const response = await page.goto('/discover');
  expect(response?.status(), 'discover must not 5xx when Stream API is unreachable').toBeLessThan(
    500,
  );

  await expect(page.getByRole('heading', { name: /live now/i })).toBeVisible();
});

// Privy login in e2e requires a fixture that the Sprint 3 plan will tackle:
// enable Privy test mode (server-side `Privy.createAppUser` via the test API
// key) and seed a session cookie directly via `context.addCookies`, bypassing
// the embedded-wallet OAuth dance. Documented here so the fixture work has a
// concrete landing spot when Sprint 3 opens.
test.skip('authenticated flow — sprint 3', async () => {
  // TODO (Sprint 3): seed a Privy session fixture, assert the dashboard
  // renders the creator tools and the `/live/new` gate succeeds.
});
