import { readAeviaSession } from '@aevia/auth/server';
import { redirect } from 'next/navigation';
import { Producer } from './producer';

export const runtime = 'edge';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function NewLivePage() {
  console.error('[live/new] RSC entered');
  const session = await readAeviaSession();
  console.error('[live/new] session:', session ? `ok userId=${session.userId}` : 'null');
  if (!session) redirect('/');
  return <Producer displayName={session.displayName} address={session.address} did={session.did} />;
}
