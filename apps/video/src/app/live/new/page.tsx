import { readAeviaSession } from '@aevia/auth/server';
import { redirect } from 'next/navigation';
import { Producer } from './producer';

export const runtime = 'edge';

export default async function NewLivePage() {
  const session = await readAeviaSession();
  if (!session) redirect('/');
  return <Producer displayName={session.displayName} address={session.address} did={session.did} />;
}
