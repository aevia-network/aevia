'use client';

import { useLogout } from '@aevia/auth/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Ghost logout chip aligned with the Sovereign Editorial DS — tonal layering,
 * no underline, lowercase pt-BR, line icon. Sized to sit in the top chrome
 * alongside back-button + title.
 */
export function LogoutButton() {
  const router = useRouter();
  const { logout } = useLogout({
    onSuccess: () => {
      router.replace('/');
    },
  });

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface/70 text-xs lowercase transition-colors hover:bg-surface-high hover:text-on-surface"
    >
      <LogOut className="size-3.5" aria-hidden />
      sair
    </button>
  );
}
