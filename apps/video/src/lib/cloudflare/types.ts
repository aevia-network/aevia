/**
 * Cloudflare Stream — Live Input API types.
 * Docs: https://developers.cloudflare.com/stream/stream-live/
 */

export interface CloudflareStreamApiEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}

export interface LiveInputRecording {
  mode: 'off' | 'automatic';
  timeoutSeconds?: number;
  requireSignedURLs?: boolean;
  allowedOrigins?: string[];
}

export interface LiveInput {
  uid: string;
  rtmps: { url: string; streamKey: string };
  rtmpsPlayback: { url: string; streamKey: string };
  srt: { url: string; streamId: string; passphrase: string };
  srtPlayback: { url: string; streamId: string; passphrase: string };
  webRTC: { url: string };
  webRTCPlayback: { url: string };
  created: string;
  modified: string;
  meta: Record<string, string>;
  defaultCreator?: string;
  recording: LiveInputRecording;
  status: null | {
    current: { state: 'connected' | 'disconnected' | 'unknown' };
    statusLastSeen?: string;
  };
}

export type LiveInputListItem = Omit<LiveInput, 'rtmps' | 'rtmpsPlayback' | 'srt' | 'srtPlayback'>;

/**
 * Cloudflare Stream — Video (recording) derived from a Live Input.
 * Docs: https://developers.cloudflare.com/stream/viewing-videos/
 */
export interface StreamVideo {
  uid: string;
  duration: number;
  status: {
    state: 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    step?: string;
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  created: string;
  modified: string;
  readyToStream: boolean;
  readyToStreamAt?: string;
  thumbnail?: string;
  preview?: string;
  playback: {
    hls: string;
    dash: string;
  };
  liveInput?: string;
  meta?: Record<string, string>;
}
