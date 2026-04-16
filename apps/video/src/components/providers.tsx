'use client';

import { AeviaPrivyProvider } from '@aevia/auth/client';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  // Fail-open rendering when Privy is not configured so that the build can
  // complete without live credentials; the server session layer will return
  // null in that mode, pushing users through the landing page.
  if (!appId) return <>{children}</>;
  return <AeviaPrivyProvider appId={appId}>{children}</AeviaPrivyProvider>;
}
