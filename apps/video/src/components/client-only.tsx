'use client';

import { clientEnv } from '@/lib/env';
import { type ReactNode, useEffect, useState } from 'react';

/**
 * Render `children` only after the component has mounted on the client.
 *
 * Two failure modes this guards against:
 *
 * 1. **Production race against the dynamic Privy provider.**
 *    `apps/video/src/components/providers.tsx` loads `AeviaPrivyProvider`
 *    via `next/dynamic({ ssr: false })` so `@walletconnect/*` (a transitive
 *    dep pulled in by Privy's React SDK) does not poison the SSR chunk.
 *    Browser back/forward navigation in production builds (RSC + App
 *    Router) opens a window where the page subtree re-mounts before the
 *    dynamic Privy provider re-establishes its context, and any leaf
 *    component that calls `useLogout` / `useWallets` / `useSignTypedData`
 *    reads `undefined.current` and crashes with the canonical
 *    "Cannot read properties of undefined (reading 'current')". The error
 *    surfaces as the generic Next "Application error" overlay in prod.
 *    Wrapping the Privy-hook-using leaves in `<ClientOnly>` defers their
 *    first render by one tick (the post-mount `setState`), giving the
 *    dynamic chunk time to settle.
 *
 * 2. **Dev-bypass mode (`AEVIA_DEV_BYPASS_AUTH=true`).**
 *    In that mode `providers.tsx` returns `<UploadProvider>{children}</UploadProvider>`
 *    with NO `<AeviaPrivyProvider>` wrapping the tree (so `@walletconnect/*`
 *    never enters the dev SSR chunk and the app stays reachable for video
 *    e2e tests). Any component calling a Privy hook in that state hits an
 *    undefined context and throws — exactly the same error pattern as (1),
 *    but for a structural reason rather than a timing one. We render the
 *    `fallback` indefinitely in this mode so the layout still paints and
 *    e2e flows can navigate freely without tripping the auth chrome.
 *    Cloudflare Pages does NOT define `NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH`
 *    (per `aevia_dev_bypass.md`), so `clientEnv.devBypassAuth` is `false`
 *    in production — the dev branch below is a no-op there.
 *
 * `fallback` lets the parent render a same-shape placeholder so layout
 * doesn't reflow when the gate flips open in production mode.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  /** Rendered until the component has mounted on the client (or always, in dev-bypass). */
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (clientEnv.devBypassAuth) return <>{fallback}</>;
  return <>{mounted ? children : fallback}</>;
}
