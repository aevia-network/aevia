'use client';

import { useLogout } from '@aevia/auth/client';
import { useRouter } from 'next/navigation';

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
      className="lowercase underline underline-offset-4"
    >
      sair
    </button>
  );
}
