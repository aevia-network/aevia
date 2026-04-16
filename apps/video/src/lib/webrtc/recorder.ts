/**
 * MediaRecorder wrapper — captures a MediaStream to a Blob while WHIP is
 * publishing the same stream. Runs in parallel; live broadcast is not affected.
 *
 * Used as the client-side recording path because Cloudflare Stream's WebRTC
 * (WHIP) beta does not yet produce server-side recordings. After the broadcast
 * ends we upload the resulting Blob to Cloudflare Stream's basic upload
 * endpoint, which transcodes it into HLS/DASH for VOD playback.
 *
 * Browser support: Chrome, Firefox, Edge, Safari 14.1+ (codec availability
 * varies; pickSupportedMimeType degrades gracefully).
 */

export interface RecorderSession {
  /** Stop recording and resolve with the final Blob. */
  stop: () => Promise<Blob>;
  /** Discard any buffered chunks without producing a Blob. */
  cancel: () => void;
  /** Current underlying MediaRecorder state. */
  state: () => RecordingState;
  /** MIME type actually used (some browsers coerce). */
  mimeType: string;
}

const CANDIDATES: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  for (const c of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

export function startRecorder(
  stream: MediaStream,
  options?: { mimeType?: string; videoBitsPerSecond?: number },
): RecorderSession {
  const mimeType = options?.mimeType ?? pickSupportedMimeType();
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: options?.videoBitsPerSecond ?? 2_500_000,
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  // 1-second chunks — resilient against late user decisions without inflating
  // overhead. Final Blob concatenates them in order.
  recorder.start(1000);

  const stop = () =>
    new Promise<Blob>((resolve) => {
      if (recorder.state === 'inactive') {
        resolve(new Blob(chunks, { type: mimeType }));
        return;
      }
      recorder.addEventListener(
        'stop',
        () => {
          resolve(new Blob(chunks, { type: mimeType }));
        },
        { once: true },
      );
      recorder.stop();
    });

  return {
    stop,
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Already inactive
      }
      chunks.length = 0;
    },
    state: () => recorder.state,
    mimeType,
  };
}
