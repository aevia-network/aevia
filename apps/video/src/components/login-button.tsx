'use client';

import { ClientOnly } from '@/components/client-only';
import { Button } from '@/components/ui/button';
import { safeNextPath } from '@/lib/safe-next';
import { useLogin, usePrivy } from '@aevia/auth/client';
import { useRef } from 'react';

/**
 * LoginButton opens Privy's modal and — only for users who complete a fresh
 * login in this tab — navigates to the destination via a full-page load.
 *
 * Why only on fresh login (not on `authenticated === true` broadly):
 * If the client-side Privy state says `authenticated` but the server rejected
 * the session cookie (partial identity token, expired access token, Privy
 * server error), the server would render this component instead of redirecting
 * to `/dashboard`. An unconditional `useEffect` that navigated whenever
 * `authenticated` was true created a redirect loop: client → `/dashboard` →
 * server says no session → back to `/` → client says authenticated → back to
 * `/dashboard` → …
 *
 * Anchoring navigation to Privy's `onComplete` callback fires only once per
 * this tab's lifetime when the user finishes the flow; pre-existing
 * authenticated sessions are handled by the server redirect at the page level.
 *
 * Public component is a thin gate around `<LoginButtonWithHooks>`. Privy's
 * SDK can read an undefined ref for one frame during the dynamic load of
 * `AeviaPrivyProvider`, crashing the page. `<ClientOnly>` defers the hook
 * call by one tick, with a same-shape disabled fallback button so layout
 * stays stable.
 */
export function LoginButton({
  size = 'lg',
  next,
}: {
  size?: 'sm' | 'default' | 'lg';
  next?: string;
}) {
  return (
    <ClientOnly
      fallback={
        <Button type="button" size={size} disabled>
          entrar
        </Button>
      }
    >
      <LoginButtonWithHooks size={size} next={next} />
    </ClientOnly>
  );
}

function LoginButtonWithHooks({
  size,
  next,
}: {
  size: 'sm' | 'default' | 'lg';
  next?: string;
}) {
  const navigatedRef = useRef(false);
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({
    onComplete: () => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      window.location.replace(safeNextPath(next, '/dashboard'));
    },
    onError: (err) => {
      // User dismissed the modal — not a failure, don't log.
      if (typeof err === 'string' && err === 'exited_auth_flow') return;
      if (err && typeof err === 'object' && 'message' in err) {
        if ((err as { message?: string }).message === 'exited_auth_flow') return;
      }
      console.error('[privy] login failed:', err);
    },
  });

  const disabled = !ready || authenticated;

  return (
    <Button type="button" size={size} disabled={disabled} onClick={() => login()}>
      entrar
    </Button>
  );
}
