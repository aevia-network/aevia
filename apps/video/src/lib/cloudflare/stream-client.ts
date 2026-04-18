import { clientEnv, getServerEnv } from '../env';
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
  /** Ethereum address of the creator (lowercase). Used as `defaultCreator` for ownership. */
  creatorAddress: `0x${string}`;
  /** Human-readable display name stored in meta for UI rendering. */
  creatorDisplayName: string;
  /** DID of the creator; stored in meta for future protocol-layer use. */
  creatorDid?: string;
  title?: string;
  deleteRecordingAfterDays?: number;
}): Promise<LiveInput> {
  const isProd = clientEnv.appEnv === 'production';
  const autoDelete = opts.deleteRecordingAfterDays ?? (isProd ? undefined : 30);
  const nameSlug = opts.creatorDisplayName.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16) || 'aevia';

  const res = await fetch(streamUrl('live_inputs'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      meta: {
        name: opts.title ?? `aevia-${nameSlug}-${Date.now()}`,
        creator: opts.creatorDisplayName,
        // Cloudflare silently drops the top-level `defaultCreator` field for
        // most account tiers, leaving it `null` on GET and breaking ownership
        // filters. Mirror the creator address into user-controlled `meta`
        // where round-tripping is guaranteed. Always lowercase so filters
        // never need to normalise. Always store, never gate by chain-type.
        creatorAddress: opts.creatorAddress.toLowerCase(),
        ...(opts.creatorDid && { creatorDid: opts.creatorDid }),
      },
      recording: {
        mode: 'automatic',
        timeoutSeconds: 30,
        requireSignedURLs: false,
      },
      defaultCreator: opts.creatorAddress,
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
  // Cloudflare Stream's `/live_inputs` GET returns `result` as a bare array;
  // only the equivalent *create* response wraps it as `{liveInputs: [...]}`.
  // Keep the object-envelope branch as a defensive fallback in case the API
  // surface normalises over time.
  const result = await handle<LiveInputListItem[] | { liveInputs: LiveInputListItem[] }>(res);
  if (Array.isArray(result)) return result;
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
 * Create a Cloudflare Stream Direct Creator Upload (tus resumable).
 *
 * This is the preferred path for MediaRecorder blobs: the client uploads the
 * bytes directly to Cloudflare's upload URL, bypassing the ~100 MiB Worker
 * request-body limit and removing double-bandwidth through our edge.
 *
 * Cloudflare's API expects a tus `POST /stream?direct_user=true` with
 * `Tus-Resumable: 1.0.0`, `Upload-Length`, and `Upload-Metadata` headers.
 * The 201 response carries:
 *   - `Location`: the one-shot upload URL the client hands to tus-js-client
 *   - `stream-media-id`: the video UID we persist on the live input
 *
 * Docs: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#using-tus-recommended-for-videos-over-200mb
 */
export interface DirectUploadResult {
  uploadUrl: string;
  videoUid: string;
}

export interface DirectUploadOptions {
  /** Live input UID this recording belongs to. */
  liveInputId: string;
  /** Ethereum address of the creator (lowercase). */
  creatorAddress: string;
  /** Human-readable display name stored in meta for UI rendering. */
  creatorDisplayName: string;
  /** DID of the creator; stored in meta for future protocol-layer use. */
  creatorDid?: string;
  /** Expected byte length of the upload. Must be ≤ Cloudflare's Stream quota. */
  uploadLength: number;
}

/**
 * tus `Upload-Metadata` is a comma-separated list of `key base64(value)` pairs.
 * Use `btoa(unescape(encodeURIComponent(v)))` to survive UTF-8 display names.
 */
function encodeTusMetadata(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k} ${btoa(unescape(encodeURIComponent(v)))}`)
    .join(',');
}

export async function createDirectUpload(opts: DirectUploadOptions): Promise<DirectUploadResult> {
  const metaName = `aevia-${opts.liveInputId}`;
  const tusMeta = encodeTusMetadata({
    name: metaName,
    liveInputId: opts.liveInputId,
    creator: opts.creatorDisplayName,
    creatorAddress: opts.creatorAddress,
    ...(opts.creatorDid ? { creatorDid: opts.creatorDid } : {}),
    source: 'whip-client-recorder',
    requiresignedurls: 'false',
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getServerEnv().STREAM_API_TOKEN}`,
    'Tus-Resumable': '1.0.0',
    'Upload-Metadata': tusMeta,
    'Upload-Length': String(opts.uploadLength),
    // Attribute the upload to the creator — shows up in the CF Stream dash.
    'Upload-Creator': opts.creatorAddress,
  };

  const { CLOUDFLARE_ACCOUNT_ID } = getServerEnv();
  const url = `${API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
  });

  if (res.status !== 201) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Cloudflare Stream direct upload init failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }

  const uploadUrl = res.headers.get('Location');
  const videoUid = res.headers.get('stream-media-id');
  if (!uploadUrl || !videoUid) {
    throw new Error(
      'Cloudflare Stream direct upload response missing Location or stream-media-id headers',
    );
  }
  return { uploadUrl, videoUid };
}
