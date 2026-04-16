'use server';

import {
  deleteLiveInput,
  deleteVideo,
  getLiveInput,
  updateLiveInput,
} from '@/lib/cloudflare/stream-client';
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

/**
 * Delete a live input AND its associated recording video (if one was uploaded
 * via the client-side MediaRecorder flow). Ownership verified before deletion.
 */
export async function deleteLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  if (!uid) return;

  const session = await readSession();
  if (!session) return;

  const live = await getLiveInput(uid).catch(() => null);
  if (!live || live.defaultCreator !== session.handle) return;

  const recordingVideoUid = live.meta?.recordingVideoUid;
  if (recordingVideoUid) {
    await deleteVideo(recordingVideoUid).catch(() => {
      // Non-fatal — orphaned video will be cleaned up by Cloudflare's
      // deleteRecordingAfterDays policy or manually later.
    });
  }

  await deleteLiveInput(uid);
  revalidatePath('/dashboard');
}

/**
 * Rename a live input (updates meta.name). Ownership verified before change.
 */
export async function renameLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  const name = formData.get('name')?.toString()?.trim();

  if (!uid || !name) return;
  if (name.length > 120) return; // conservative limit — Cloudflare accepts longer but UX breaks

  const session = await readSession();
  if (!session) return;

  const live = await getLiveInput(uid).catch(() => null);
  if (!live || live.defaultCreator !== session.handle) return;

  await updateLiveInput(uid, { meta: { name } });
  revalidatePath('/dashboard');
  revalidatePath(`/live/${uid}`);
}
