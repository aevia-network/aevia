import { SignInScreen } from '@/components/signin-screen';
import { safeNextPath } from '@/lib/safe-next';
import { readAeviaSession } from '@aevia/auth/server';
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
    redirect(safeNextPath(next, '/feed'));
  }

  return <SignInScreen next={next} />;
}
