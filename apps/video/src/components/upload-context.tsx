'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type * as TusModule from 'tus-js-client';

export type UploadStatus = 'queued' | 'uploading' | 'linking' | 'done' | 'failed';

export interface UploadState {
  liveInputId: string;
  videoUid: string;
  /** `uploading`/`linking`/`done`/`failed` — status of the upload. */
  status: UploadStatus;
  /** 0–100, integer. Only meaningful while `status === 'uploading'`. */
  progress: number;
  /** Human-readable error message. Only set when `status === 'failed'`. */
  error?: string;
  /** Number of tus-level retries consumed so far. */
  attempts: number;
  /** Wall-clock ms when the upload entered the queue. Used for sort order. */
  startedAt: number;
}

export interface StartUploadInput {
  liveInputId: string;
  blob: Blob;
  /** Signed upload URL returned by `POST /api/lives/:id/direct-upload-url`. */
  uploadUrl: string;
  /** Video UID Cloudflare assigned to this upload. */
  videoUid: string;
}

interface UploadContextValue {
  uploads: UploadState[];
  startUpload: (input: StartUploadInput) => void;
  dismissUpload: (liveInputId: string) => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

/**
 * Active statuses = the upload still needs the browser tab to stay open. Used
 * to gate the `beforeunload` handler and to decide when to hide the banner.
 */
const ACTIVE_STATUSES: readonly UploadStatus[] = ['queued', 'uploading', 'linking'];

function isActive(status: UploadStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Global Upload Context.
 *
 * Holds a map of in-flight uploads keyed by `liveInputId`, exposes
 * `startUpload`/`dismissUpload`, and registers a `beforeunload` listener
 * while any upload is active. Mounted once under `<Providers>` so the
 * Producer can dispatch a blob and then unmount freely — navigation and
 * tab idle do not abort the upload.
 *
 * Resumability: tus-js-client retries failed chunks (not the whole blob)
 * with the `retryDelays` below; once tus gives up we surface the error in
 * the banner.
 */
export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  // Track the live tus.Upload instances so dismiss can abort them and an
  // unmount cleanly aborts everything.
  const instancesRef = useRef<Map<string, TusModule.Upload>>(new Map());
  // Lazily-loaded reference to `tus-js-client` so SSR and the initial
  // client bundle do not pull in the tus source chain. The import resolves
  // when `startUpload` fires — by then we are deep in an interaction, so the
  // 22 KB gzipped hit is paid exactly once and only when needed.
  const tusModuleRef = useRef<typeof TusModule | null>(null);

  const upsert = useCallback((liveInputId: string, patch: Partial<UploadState>) => {
    setUploads((prev) => {
      const existing = prev.find((u) => u.liveInputId === liveInputId);
      if (!existing) return prev;
      return prev.map((u) => (u.liveInputId === liveInputId ? { ...existing, ...patch } : u));
    });
  }, []);

  const loadTus = useCallback(async (): Promise<typeof TusModule> => {
    if (tusModuleRef.current) return tusModuleRef.current;
    const mod = await import('tus-js-client');
    tusModuleRef.current = mod;
    return mod;
  }, []);

  const linkRecording = useCallback(
    async (liveInputId: string, videoUid: string): Promise<void> => {
      const res = await fetch(`/api/lives/${liveInputId}/link-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUid }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `falha ao vincular gravação (${res.status})`);
      }
    },
    [],
  );

  const startUpload = useCallback(
    (input: StartUploadInput) => {
      const { liveInputId, blob, uploadUrl, videoUid } = input;

      setUploads((prev) => {
        // Replace any existing entry for the same liveInputId — re-trying a
        // failed upload should not double-stack rows in the banner.
        const withoutExisting = prev.filter((u) => u.liveInputId !== liveInputId);
        return [
          ...withoutExisting,
          {
            liveInputId,
            videoUid,
            status: 'queued',
            progress: 0,
            attempts: 0,
            startedAt: Date.now(),
          },
        ];
      });

      void (async () => {
        let tus: typeof TusModule;
        try {
          tus = await loadTus();
        } catch (err) {
          upsert(liveInputId, {
            status: 'failed',
            error: err instanceof Error ? err.message : 'falha ao carregar cliente de upload',
          });
          return;
        }

        const upload = new tus.Upload(blob, {
          uploadUrl,
          // tus-js-client retries individual chunks, not the whole blob.
          // Exponential-ish schedule: 0, 1s, 3s, 10s, 20s (~34 s total).
          retryDelays: [0, 1000, 3000, 10_000, 20_000],
          chunkSize: 5 * 1024 * 1024,
          metadata: { filetype: blob.type || 'video/webm' },
          removeFingerprintOnSuccess: true,
          onError: (err: Error) => {
            upsert(liveInputId, {
              status: 'failed',
              error: err.message || 'falha no upload',
            });
            instancesRef.current.delete(liveInputId);
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct =
              bytesTotal > 0 ? Math.min(99, Math.floor((bytesUploaded / bytesTotal) * 100)) : 0;
            upsert(liveInputId, { status: 'uploading', progress: pct });
          },
          onSuccess: () => {
            upsert(liveInputId, { status: 'linking', progress: 99 });
            void linkRecording(liveInputId, videoUid)
              .then(() => {
                upsert(liveInputId, { status: 'done', progress: 100 });
              })
              .catch((err: unknown) => {
                upsert(liveInputId, {
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'falha ao vincular gravação',
                });
              })
              .finally(() => {
                instancesRef.current.delete(liveInputId);
              });
          },
        });

        instancesRef.current.set(liveInputId, upload);
        upload.start();
      })();
    },
    [loadTus, linkRecording, upsert],
  );

  const dismissUpload = useCallback((liveInputId: string) => {
    const instance = instancesRef.current.get(liveInputId);
    if (instance) {
      // Abort any in-flight tus PATCH — ignore errors; we drop the row either way.
      instance.abort(true).catch(() => {
        // Intentionally swallowed.
      });
      instancesRef.current.delete(liveInputId);
    }
    setUploads((prev) => prev.filter((u) => u.liveInputId !== liveInputId));
  }, []);

  // beforeunload — warn the user only when at least one upload is active
  // (queued/uploading/linking). Register/unregister dynamically so browsers
  // don't show the prompt unnecessarily after the queue drains.
  useEffect(() => {
    const hasActive = uploads.some((u) => isActive(u.status));
    if (!hasActive) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the custom string; they show a generic prompt.
      // The text is kept as a documented fallback for older engines.
      e.returnValue = 'gravação em andamento; fechar agora perde o replay. confirmar saída?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploads]);

  // Unmount safety — if the provider itself unmounts (shouldn't happen in the
  // root tree but we stay defensive), tell tus to stop any pending PATCHes.
  useEffect(() => {
    const instances = instancesRef.current;
    return () => {
      for (const instance of instances.values()) {
        instance.abort(true).catch(() => {
          // Intentionally swallowed.
        });
      }
      instances.clear();
    };
  }, []);

  const value = useMemo<UploadContextValue>(
    () => ({ uploads, startUpload, dismissUpload }),
    [uploads, startUpload, dismissUpload],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUploads must be used inside <UploadProvider>');
  }
  return ctx;
}
