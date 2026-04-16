'use client';

import { Button } from '@/components/ui/button';
import { useLogin, usePrivy } from '@aevia/auth/client';
import { useRouter } from 'next/navigation';

export function LoginButton({
  size = 'lg',
  next,
}: {
  size?: 'sm' | 'default' | 'lg';
  next?: string;
}) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({
    onComplete: () => {
      router.replace(next?.startsWith('/') ? next : '/dashboard');
    },
    onError: (err) => {
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
