import { getServerEnv } from '../env';
import type { CloudflareStreamApiEnvelope, LiveInput, LiveInputListItem } from './types';

const API_BASE = 'https://api.cloudflare.com/client/v4';

function streamUrl(...segments: string[]): string {
  const { CLOUDFLARE_ACCOUNT_ID } = getServerEnv();
  return `${API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${segments.join('/')}`;
}

function headers(): HeadersInit {
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

export async function createLiveInput(opts: {
  creatorHandle: string;
  title?: string;
}): Promise<LiveInput> {
  const res = await fetch(streamUrl('live_inputs'), {
    method: 'POST',
    headers: headers(),
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
    }),
  });
  return handle<LiveInput>(res);
}

export async function getLiveInput(uid: string): Promise<LiveInput> {
  const res = await fetch(streamUrl('live_inputs', uid), {
    method: 'GET',
    headers: headers(),
  });
  return handle<LiveInput>(res);
}

export async function listLiveInputs(): Promise<LiveInputListItem[]> {
  const res = await fetch(streamUrl('live_inputs'), {
    method: 'GET',
    headers: headers(),
  });
  const result = await handle<{ liveInputs: LiveInputListItem[] }>(res);
  return result.liveInputs ?? [];
}

export async function deleteLiveInput(uid: string): Promise<void> {
  const res = await fetch(streamUrl('live_inputs', uid), {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete live input ${uid}: ${res.status}`);
  }
}
