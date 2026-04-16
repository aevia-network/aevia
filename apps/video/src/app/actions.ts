'use server';

import {
  deleteLiveInput,
  deleteVideo,
  getLiveInput,
  updateLiveInput,
} from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { revalidatePath } from 'next/cache';

/**
 * Delete a live input AND its associated recording video (if one was uploaded
 * via the client-side MediaRecorder flow). Ownership verified before deletion.
 */
export async function deleteLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  if (!uid) return;

  const session = await readAeviaSession();
  if (!session) return;

  const live = await getLiveInput(uid).catch(() => null);
  if (!live || live.defaultCreator !== session.address) return;

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
  if (name.length > 120) return;

  const session = await readAeviaSession();
  if (!session) return;

  const live = await getLiveInput(uid).catch(() => null);
  if (!live || live.defaultCreator !== session.address) return;

  await updateLiveInput(uid, { meta: { name } });
  revalidatePath('/dashboard');
  revalidatePath(`/live/${uid}`);
}
