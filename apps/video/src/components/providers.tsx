'use client';

import { clientEnv } from '@/lib/env';
import { AeviaPrivyProvider } from '@aevia/auth/client';
import type { ReactNode } from 'react';
import { UploadProvider } from './upload-context';

export function Providers({ children }: { children: ReactNode }) {
  const appId = clientEnv.privyAppId;
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
