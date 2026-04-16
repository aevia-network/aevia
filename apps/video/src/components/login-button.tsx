'use client';

import { Button } from '@/components/ui/button';
import { useLogin, usePrivy } from '@aevia/auth/client';
import { useEffect } from 'react';

/**
 * LoginButton wires Privy's modal and navigates to the dashboard after the
 * session cookies settle.
 *
 * Why `window.location.href` instead of `router.replace`:
 * Privy sets `privy-id-token` + `privy-token` cookies after `onComplete`.
 * Next.js App Router's soft navigation re-renders the target RSC using its
 * current module cache, which can race against cookie propagation — the
 * server sees an empty cookie bag, `readAeviaSession` returns null,
 * middleware redirects back to `/`. A full-page navigation forces a clean
 * request with the newly-set cookies attached, eliminating the race.
 * Acceptable trade-off: this only happens once per login.
 */
export function LoginButton({
  size = 'lg',
  next,
}: {
  size?: 'sm' | 'default' | 'lg';
  next?: string;
}) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({
    onError: (err) => {
      // User dismissed the modal — not an error, don't log.
      if (typeof err === 'string' && err === 'exited_auth_flow') return;
      if (err && typeof err === 'object' && 'message' in err) {
        if ((err as { message?: string }).message === 'exited_auth_flow') return;
      }
      console.error('[privy] login failed:', err);
    },
  });

  useEffect(() => {
    if (!ready || !authenticated) return;
    const dest = next?.startsWith('/') ? next : '/dashboard';
    window.location.replace(dest);
  }, [ready, authenticated, next]);

  const disabled = !ready || authenticated;

  return (
    <Button type="button" size={size} disabled={disabled} onClick={() => login()}>
      entrar
    </Button>
  );
}
