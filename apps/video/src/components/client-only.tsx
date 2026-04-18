'use client';

import { type ReactNode, useEffect, useState } from 'react';

/**
 * Render `children` only after the component has mounted on the client.
 *
 * Why this exists:
 * `apps/video/src/components/providers.tsx` loads `AeviaPrivyProvider` via
 * `next/dynamic({ ssr: false })` so `@walletconnect/*` (a transitive dep
 * pulled in by Privy's React SDK) does not poison the SSR chunk. The
 * dynamic provider is `null` during SSR and resolves on the client; in
 * theory its children only render after the lazy chunk has loaded, so
 * Privy hooks called inside those children should be safe.
 *
 * In practice, browser back/forward navigation in production builds (RSC +
 * App Router) opens a window where the page subtree re-mounts before the
 * dynamic Privy provider re-establishes its context, and any leaf component
 * that calls `useLogout` / `useWallets` / `useSignTypedData` reads
 * `undefined.current` and crashes with the standard
 * "Cannot read properties of undefined (reading 'current')". The error
 * surfaces as the generic Next "Application error" in production.
 *
 * Wrapping the Privy-hook-using leaves in `<ClientOnly>` defers their
 * first render by one tick (the `useEffect` post-mount setState), giving
 * the dynamic chunk time to settle. The `fallback` prop lets the parent
 * render a same-shape placeholder so layout doesn't reflow.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  /** Rendered until the component has mounted on the client. Defaults to `null`. */
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
