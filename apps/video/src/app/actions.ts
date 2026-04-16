'use server';

import { deleteLiveInput, getLiveInput } from '@/lib/cloudflare/stream-client';
import { clearSession, createAnonSession, readSession } from '@/lib/session/cookie';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function continueAsGuestAction() {
  await createAnonSession();
  redirect('/dashboard');
}

export async function signOutAction() {
  await clearSession();
  redirect('/');
}

export async function deleteLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  if (!uid) return;

  const session = await readSession();
  if (!session) return;

  // Verify ownership before deleting — prevents CSRF-from-other-users.
  const live = await getLiveInput(uid).catch(() => null);
  if (!live || live.defaultCreator !== session.handle) return;

  await deleteLiveInput(uid);
  revalidatePath('/dashboard');
}
