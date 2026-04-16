import { LoginButton } from '@/components/login-button';
import { readAeviaSession } from '@aevia/auth/server';
import { MeshDot } from '@aevia/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const runtime = 'edge';

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await readAeviaSession();
  const { next } = await searchParams;

  if (session) {
    redirect(next?.startsWith('/') ? next : '/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col px-6 py-8">
      <header className="flex items-center gap-2">
        <span className="font-headline text-[20px] font-semibold tracking-tight">aevia</span>
        <MeshDot />
      </header>

      <section className="flex flex-1 flex-col items-start justify-center gap-8">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
          protocolo soberano de vídeo
        </p>
        <h1 className="font-headline text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          transmita sem
          <br />
          intermediários.
        </h1>
        <p className="max-w-lg text-lg text-on-surface-variant md:text-xl">
          live de baixa latência, vod automático, clips compartilháveis. seu conteúdo, sua
          audiência, seu protocolo — sem app store, sem derrubada arbitrária.
        </p>

        <LoginButton size="lg" next={next} />

        <p className="max-w-md text-on-surface-variant/70 text-xs">
          entre com e-mail, google, apple, passkey ou carteira. sua identidade soberana vive numa
          smart wallet embutida na base l2 — você assina seus conteúdos on-chain.
        </p>
      </section>

      {next && (
        <footer className="pt-6 text-on-surface-variant text-xs">
          você será redirecionado para{' '}
          <Link href={next} className="underline underline-offset-4">
            {next}
          </Link>{' '}
          após entrar.
        </footer>
      )}
    </main>
  );
}
