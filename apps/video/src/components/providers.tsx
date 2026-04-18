'use client';

import { clientEnv } from '@/lib/env';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { UploadProvider } from './upload-context';

// Privy lives in @aevia/auth/client, which transitively imports
// @walletconnect/*. Any static import of that module drags walletconnect
// into the SSR chunk and triggers the "Class extends value [object
// Object] is not a constructor" error Next dev throws. Wrapping in
// next/dynamic with ssr:false scopes the import to the client bundle,
// so dev and tests can reach every page without the wallet dep exploding.
// The dynamic handle resolves lazily; the bypass path below never
// invokes it, so in dev-bypass mode walletconnect is never loaded.
const AeviaPrivyProvider = dynamic(
  () => import('@aevia/auth/client').then((m) => ({ default: m.AeviaPrivyProvider })),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  const appId = clientEnv.privyAppId;
  // Dev-bypass — when enabled we skip AeviaPrivyProvider entirely. Privy
  // pulls in @walletconnect/* which currently explodes in Next dev SSR
  // with "Class extends value [object Object] is not a constructor".
  // Skipping the import makes the app reachable for video e2e tests.
  // Server-side readAeviaSession also short-circuits to a mock session.
  if (clientEnv.devBypassAuth) {
    return <UploadProvider>{children}</UploadProvider>;
  }
  // Fail-open rendering when Privy is not configured so that the build can
  // complete without live credentials; the server session layer will return
  // null in that mode, pushing users through the landing page.
  //
  // `UploadProvider` wraps inside `AeviaPrivyProvider` (not outside) because
  // Privy's provider is the effective root for authenticated UI. Keeping the
  // upload context in the authenticated subtree is intentional: no upload
  // should survive a logout, and the provider unmounting on sign-out cleanly
  // aborts in-flight uploads via its cleanup effect.
  if (!appId) {
    return <UploadProvider>{children}</UploadProvider>;
  }
  return (
    <AeviaPrivyProvider appId={appId}>
      <UploadProvider>{children}</UploadProvider>
    </AeviaPrivyProvider>
  );
}
