import { getServerEnv } from '../env';
import type {
  CloudflareStreamApiEnvelope,
  LiveInput,
  LiveInputListItem,
  StreamVideo,
} from './types';

const API_BASE = 'https://api.cloudflare.com/client/v4';

function streamUrl(...segments: string[]): string {
  const { CLOUDFLARE_ACCOUNT_ID } = getServerEnv();
  return `${API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${segments.join('/')}`;
}

function jsonHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getServerEnv().STREAM_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function authHeader(): HeadersInit {
  return {
    Authorization: `Bearer ${getServerEnv().STREAM_API_TOKEN}`,
  };
}

async function handle<T>(res: Response): Promise<T> {
  const envelope = (await res.json()) as CloudflareStreamApiEnvelope<T>;
  if (!res.ok || !envelope.success) {
    const msg = envelope.errors?.map((e) => `${e.code}: ${e.message}`).join(', ') ?? res.statusText;
    throw new Error(`Cloudflare Stream API error (${res.status}): ${msg}`);
  }
  return envelope.result;
}

// ---- Live Input CRUD -----------------------------------------------------

export async function createLiveInput(opts: {
  creatorHandle: string;
  title?: string;
  deleteRecordingAfterDays?: number;
}): Promise<LiveInput> {
  const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production';
  const autoDelete = opts.deleteRecordingAfterDays ?? (isProd ? undefined : 30);

  const res = await fetch(streamUrl('live_inputs'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      meta: {
        name: opts.title ?? `aevia-${opts.creatorHandle}-${Date.now()}`,
        creator: opts.creatorHandle,
      },
      recording: {
        mode: 'automatic',
        timeoutSeconds: 30,
        requireSignedURLs: false,
      },
      defaultCreator: opts.creatorHandle,
      ...(autoDelete !== undefined && { deleteRecordingAfterDays: autoDelete }),
    }),
  });
  return handle<LiveInput>(res);
}

export async function getLiveInput(uid: string): Promise<LiveInput> {
  const res = await fetch(streamUrl('live_inputs', uid), {
    method: 'GET',
    headers: jsonHeaders(),
  });
  return handle<LiveInput>(res);
}

export async function listLiveInputs(): Promise<LiveInputListItem[]> {
  const res = await fetch(streamUrl('live_inputs'), {
    method: 'GET',
    headers: jsonHeaders(),
  });
  const result = await handle<{ liveInputs: LiveInputListItem[] }>(res);
  return result.liveInputs ?? [];
}

/**
 * Update a live input. Cloudflare merges the provided `meta` object with the
 * existing meta (does not replace), so partial updates of individual keys are
 * safe. Name updates go through `meta.name`.
 */
export async function updateLiveInput(
  uid: string,
  patch: { meta?: Record<string, string>; defaultCreator?: string },
): Promise<LiveInput> {
  // Read-modify-write of meta to preserve existing keys (name, creator, etc.)
  const current = await getLiveInput(uid);
  const mergedMeta = { ...(current.meta ?? {}), ...(patch.meta ?? {}) };

  const res = await fetch(streamUrl('live_inputs', uid), {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({
      meta: mergedMeta,
      ...(patch.defaultCreator !== undefined && { defaultCreator: patch.defaultCreator }),
      recording: current.recording,
    }),
  });
  return handle<LiveInput>(res);
}

export async function deleteLiveInput(uid: string): Promise<void> {
  const res = await fetch(streamUrl('live_inputs', uid), {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete live input ${uid}: ${res.status}`);
  }
}

export async function listLiveInputVideos(uid: string): Promise<StreamVideo[]> {
  const res = await fetch(streamUrl('live_inputs', uid, 'videos'), {
    method: 'GET',
    headers: jsonHeaders(),
  });
  const result = await handle<StreamVideo[] | { videos: StreamVideo[] }>(res);
  if (Array.isArray(result)) return result;
  return result.videos ?? [];
}

// ---- Video (VOD) CRUD ----------------------------------------------------

export async function getVideo(uid: string): Promise<StreamVideo> {
  const res = await fetch(streamUrl(uid), {
    method: 'GET',
    headers: jsonHeaders(),
  });
  return handle<StreamVideo>(res);
}

export async function deleteVideo(uid: string): Promise<void> {
  const res = await fetch(streamUrl(uid), {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete video ${uid}: ${res.status}`);
  }
}

/**
 * Upload a video blob to Cloudflare Stream using the basic upload endpoint.
 * Cloudflare transcodes the result to HLS + DASH automatically.
 *
 * Used by the MediaRecorder client-side path because Cloudflare Stream's
 * WebRTC (WHIP) beta does not yet produce server-side recordings.
 *
 * Limits: file size ≤ 200 MiB, request body ≤ 100 MiB for Workers free tier.
 * For alpha broadcasts (<5 min at 2.5 Mbps) the payload is well under both.
 */
export async function uploadVideoBlob(
  file: File | Blob,
  meta: Record<string, string>,
): Promise<StreamVideo> {
  const form = new FormData();
  form.append(
    'file',
    file instanceof File ? file : new File([file], 'recording.webm', { type: file.type }),
  );
  form.append('meta', JSON.stringify(meta));
  form.append('requireSignedURLs', 'false');

  const res = await fetch(streamUrl(), {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  return handle<StreamVideo>(res);
}
