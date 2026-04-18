import { GoLiveScreen } from '@/components/go-live-screen';
import { readAeviaSession } from '@aevia/auth/server';
import { redirect } from 'next/navigation';

export const runtime = 'edge';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function NewLivePage() {
  const session = await readAeviaSession();
  if (!session) redirect('/');
  return (
    <GoLiveScreen displayName={session.displayName} address={session.address} did={session.did} />
  );
}
