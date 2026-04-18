'use client';

import { useLogout } from '@aevia/auth/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ClientOnly } from './client-only';

/**
 * Ghost logout chip aligned with the Sovereign Editorial DS — tonal layering,
 * no underline, lowercase pt-BR, line icon. Sized to sit in the top chrome
 * alongside back-button + title.
 *
 * Wraps the Privy-hook-using `<LogoutButtonInner>` in `<ClientOnly>` so the
 * `useLogout` call only fires after the component has mounted on the client.
 * This dodges the back-navigation race where the dynamic
 * `AeviaPrivyProvider` re-mounts after children, leaving Privy hooks
 * reading `undefined.current` for one frame and crashing the page.
 * Fallback is a same-shape disabled chip so the chrome layout stays stable.
 */
export function LogoutButton() {
  return (
    <ClientOnly fallback={<LogoutButtonChromeShell disabled>sair</LogoutButtonChromeShell>}>
      <LogoutButtonInner />
    </ClientOnly>
  );
}

function LogoutButtonInner() {
  const router = useRouter();
  const { logout } = useLogout({
    onSuccess: () => {
      router.replace('/');
    },
  });
  return <LogoutButtonChromeShell onClick={() => logout()}>sair</LogoutButtonChromeShell>;
}

/**
 * Shared chrome shell so the loading fallback and the live button share an
 * identical bounding box. Disabled state dims the text but keeps the icon
 * + chip background, preventing layout reflow when the gate flips open.
 */
function LogoutButtonChromeShell({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface/70 text-xs lowercase transition-colors hover:bg-surface-high hover:text-on-surface disabled:cursor-default disabled:hover:bg-surface-container disabled:hover:text-on-surface/70"
    >
      <LogOut className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}
