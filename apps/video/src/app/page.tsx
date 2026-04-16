import { Button } from '@/components/ui/button';
import { readSession } from '@/lib/session/cookie';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { continueAsGuestAction } from './actions';

export const runtime = 'nodejs';

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await readSession();
  const { next } = await searchParams;

  if (session) {
    redirect(next?.startsWith('/') ? next : '/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="text-muted text-xs uppercase tracking-[0.3em]">Aevia</p>
        <h1 className="font-semibold text-5xl tracking-tight md:text-6xl">
          Go live without the gatekeepers.
        </h1>
        <p className="text-lg text-muted md:text-xl">
          Low-latency live, automatic VOD, viral clips. Your content, your audience, your protocol.
        </p>
      </div>

      <form action={continueAsGuestAction}>
        <Button type="submit" size="lg">
          Continue
        </Button>
      </form>

      <p className="max-w-lg text-center text-muted text-xs">
        No email. No password. We generate an anonymous handle so you can start broadcasting in
        seconds. Identity and wallet come later.
      </p>

      {next && (
        <p className="text-muted text-xs">
          You&apos;ll be redirected to{' '}
          <Link href={next} className="underline">
            {next}
          </Link>{' '}
          after sign-in.
        </p>
      )}
    </main>
  );
}
