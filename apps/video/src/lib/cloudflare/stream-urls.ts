import { clientEnv } from '@/lib/env';

/**
 * Cloudflare Stream customer-scoped CDN host derived from the env-provided
 * customer code (`NEXT_PUBLIC_STREAM_CUSTOMER_CODE`). All thumbnail / playback
 * URLs the app embeds in <img> tags or <video> elements must flow through this
 * helper so the host is configurable per environment (preview vs production)
 * and never hardcoded inline.
 *
 * Returns `null` when the env is missing — call sites must render a graceful
 * placeholder rather than emitting `https://undefined.cloudflarestream.com`.
 */
function streamCustomerHost(): string | null {
  const code = clientEnv.streamCustomerCode;
  if (!code) return null;
  return `https://${code}.cloudflarestream.com`;
}

/**
 * Thumbnail URL for a Cloudflare Stream video. Returns `null` when either the
 * recording UID or the customer code is unavailable. Default `height=360` is
 * sized for grid tiles; pass a smaller value for compact rows.
 *
 * Docs: https://developers.cloudflare.com/stream/viewing-videos/displaying-thumbnails/
 */
export function streamThumbnailUrl(
  recordingUid: string | undefined,
  options: { height?: number; time?: string } = {},
): string | null {
  if (!recordingUid) return null;
  const host = streamCustomerHost();
  if (!host) return null;
  const time = options.time ?? '1s';
  const height = options.height ?? 360;
  return `${host}/${recordingUid}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}&height=${height}`;
}

/**
 * HLS playback manifest URL for a Cloudflare Stream video. Returns `null` when
 * the customer code is unavailable. Used by hls.js wired into the viewer when
 * a live ends and its VOD becomes ready.
 */
export function streamHlsUrl(recordingUid: string | undefined): string | null {
  if (!recordingUid) return null;
  const host = streamCustomerHost();
  if (!host) return null;
  return `${host}/${recordingUid}/manifest/video.m3u8`;
}
