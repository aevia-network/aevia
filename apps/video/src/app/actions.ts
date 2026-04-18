'use server';

import { deleteLiveInput, deleteVideo, updateLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { revalidatePath } from 'next/cache';
import { resolveLiveOwnership } from './api/lives/[id]/_lib/register-meta';

/**
 * Delete a live input AND its associated recording video (if one was uploaded
 * via the client-side MediaRecorder flow). Ownership verified before deletion
 * via the canonical `resolveLiveOwnership` helper — checks both
 * `meta.creatorAddress` (round-trip safe) and `defaultCreator` (often null
 * because Cloudflare drops it on many tiers; see `stream-client.ts`).
 */
export async function deleteLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  if (!uid) return;

  const session = await readAeviaSession();
  if (!session) return;

  const ownership = await resolveLiveOwnership(uid, session.address);
  if (!ownership || !ownership.owned) return;

  const recordingVideoUid = ownership.live.meta?.recordingVideoUid;
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
 * Rename a live input (updates meta.name). Ownership verified via the
 * canonical `resolveLiveOwnership` helper for the same reason as
 * `deleteLiveAction` above.
 */
export async function renameLiveAction(formData: FormData) {
  const uid = formData.get('uid')?.toString();
  const name = formData.get('name')?.toString()?.trim();

  if (!uid || !name) return;
  if (name.length > 120) return;

  const session = await readAeviaSession();
  if (!session) return;

  const ownership = await resolveLiveOwnership(uid, session.address);
  if (!ownership || !ownership.owned) return;

  await updateLiveInput(uid, { meta: { name } });
  revalidatePath('/dashboard');
  revalidatePath(`/live/${uid}`);
}
