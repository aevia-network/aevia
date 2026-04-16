'use server';

import { clearSession, createAnonSession } from '@/lib/session/cookie';
import { redirect } from 'next/navigation';

export async function continueAsGuestAction() {
  await createAnonSession();
  redirect('/dashboard');
}

export async function signOutAction() {
  await clearSession();
  redirect('/');
}
