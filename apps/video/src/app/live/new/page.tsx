import { readSession } from '@/lib/session/cookie';
import { redirect } from 'next/navigation';
import { Producer } from './producer';

export const runtime = 'nodejs';

export default async function NewLivePage() {
  const session = await readSession();
  if (!session) redirect('/');
  return <Producer handle={session.handle} />;
}
