'use client';

import { safeNextPath } from '@/lib/safe-next';
import { appChainId, useLogin, usePrivy } from '@aevia/auth/client';
import { MeshDot } from '@aevia/ui';
import { Apple, Fingerprint, HeartHandshake, Lock, Mail, Network, X } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';

type LoginMethod = 'email' | 'google' | 'apple' | 'passkey';

/**
 * Pre-auth landing + sign-in screen.
 *
 * Mirrors Stitch screen `96447c2358ae4a58aec59e5b24d2a1fc` ("Aevia — Entrada
 * & Login"). The design is a single editorial scroll: hero image → wordmark
 * with pulsing mesh dot → tagline → three value props → four auth buttons
 * (email primary + google / apple / passkey) → AUP acknowledgement.
 *
 * All auth options funnel through Privy's modal. Per-button `login({
 * loginMethods })` biases the modal toward the chosen method but still
 * accepts any configured option if the user pivots.
 */
export function SignInScreen({ next }: { next?: string }) {
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

  const loginWith = (method: LoginMethod) => {
    // Privy's `login({ loginMethods })` restricts the modal's offered flows.
    // `email` → OTP flow; `google` / `apple` → OAuth; `passkey` → WebAuthn.
    // We pass a single-method array because these buttons are deliberate
    // user choices. The "já tem conta? entrar" footer link below calls
    // `loginAll` instead so returning users see every method they may have
    // previously used.
    login({ loginMethods: [method] });
  };

  const loginAll = () => {
    login();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-12">
      {/* Top-right close icon. Follows Stitch's pre-auth chrome pattern; in
          our flow it navigates to aevia.network (the protocol home) rather
          than closing a modal — matches the two-site architecture where
          aevia.video is the creator app and aevia.network is the public
          protocol surface. */}
      <a
        href="https://aevia.network"
        aria-label="ir para aevia.network"
        className="fixed top-3 right-3 z-50 flex size-10 items-center justify-center text-primary transition-opacity hover:opacity-80 active:scale-95"
      >
        <X className="size-6" aria-hidden />
      </a>

      <div className="relative h-[280px] w-full overflow-hidden">
        <Image
          src="/hero/signin.jpg"
          alt="caneta tinteiro sobre manuscrito — símbolo editorial do criador soberano"
          fill
          priority
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
      </div>

      <div className="mt-8 flex items-baseline justify-center gap-2">
        <h1 className="font-headline font-semibold text-[44px] text-on-surface tracking-tight lowercase">
          aevia
        </h1>
        <MeshDot />
      </div>

      <div className="mt-4 px-8 text-center">
        <p className="font-body text-[18px] text-on-surface leading-snug">
          vídeo soberano pra quem cria.
          <br />
          <span className="opacity-60">
            seu canal continua seu, mesmo quando a plataforma muda.
          </span>
        </p>
      </div>

      <section className="mx-4 mt-10 flex flex-col gap-6 rounded-[12px] bg-surface-container-low p-5">
        <ValueProp
          icon={<Lock className="size-[22px] text-primary" aria-hidden />}
          title="sua identidade é sua"
          body="uma did criptográfica, não um login. você controla o que publica."
        />
        <ValueProp
          icon={<Network className="size-[22px] text-tertiary" aria-hidden />}
          title="seu conteúdo persiste"
          body="mesh de peers + provider nodes + backup permanente. ninguém pode apagar."
        />
        <ValueProp
          icon={<HeartHandshake className="size-[22px] text-secondary" aria-hidden />}
          title="sua comunidade te apoia"
          body="créditos que você escolhe dar. economia direta, sem intermediário."
        />
      </section>

      <div className="mt-10 w-full space-y-4 px-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => loginWith('email')}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-primary font-headline font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mail className="size-5" aria-hidden />
          entrar com e-mail
        </button>

        <div className="flex flex-col items-center gap-4">
          <span className="font-label text-[11px] text-on-surface/40 uppercase tracking-[0.15em]">
            ou continue com
          </span>
          <div className="flex gap-3">
            <IconButton
              label="entrar com google"
              disabled={disabled}
              onClick={() => loginWith('google')}
            >
              <GoogleG />
            </IconButton>
            <IconButton
              label="entrar com apple"
              disabled={disabled}
              onClick={() => loginWith('apple')}
            >
              <Apple className="size-6" aria-hidden />
            </IconButton>
            <IconButton
              label="entrar com passkey"
              disabled={disabled}
              onClick={() => loginWith('passkey')}
            >
              <Fingerprint className="size-6" aria-hidden />
            </IconButton>
          </div>
        </div>

        <p className="mt-4 px-6 text-center font-label text-[10px] text-on-surface/30 tracking-[0.02em] lowercase">
          criação de carteira embutida via privy · did:pkh:eip155:{appChainId()}:…
        </p>
      </div>

      <div className="mx-4 mt-8 flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
        <div className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-sm bg-primary">
          <svg
            className="size-3 text-on-primary"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
            focusable="false"
          >
            <title>concordo</title>
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-body text-xs text-on-surface/70 leading-relaxed lowercase">
          ao entrar, você concorda com a{' '}
          <a href="/aup" className="text-primary underline">
            política de uso da aevia
          </a>{' '}
          e a criação automática de uma carteira embutida. seus créditos iniciais:{' '}
          <span className="font-semibold text-primary">20 grátis</span>.
        </p>
      </div>

      <footer className="mt-12 flex w-full flex-col items-center gap-6 px-8">
        <p className="font-body text-sm text-on-surface lowercase">
          já tem conta?{' '}
          <button
            type="button"
            disabled={disabled}
            onClick={loginAll}
            className="cursor-pointer text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            entrar
          </button>
        </p>
        <div className="flex flex-col items-center gap-1 opacity-20">
          <p className="font-label text-[10px] uppercase tracking-[0.02em]">
            v0.1 · cloudflare + base l2 · aberto e auditável
          </p>
          <p className="font-label text-[10px] tracking-[0.02em] lowercase">
            aevia sovereign editorial
          </p>
        </div>
      </footer>
    </main>
  );
}

function ValueProp({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 flex-shrink-0">{icon}</div>
      <div>
        <h3 className="font-headline font-semibold text-base text-on-surface lowercase">{title}</h3>
        <p className="font-body text-sm text-on-surface/60 leading-relaxed lowercase">{body}</p>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-14 items-center justify-center rounded-lg bg-surface-high text-on-surface transition-colors hover:bg-surface-highest active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Google "G" glyph. Lucide does not ship brand marks; rendering the canonical
 * multicolor "G" inline is the standard pattern for third-party OAuth buttons
 * and complies with Google's brand guidelines at this size.
 */
function GoogleG() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11.02 11.02 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
