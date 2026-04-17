'use client';

import { Check, CircleAlert, Loader2, UploadCloud, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type UploadState, useUploads } from './upload-context';

/**
 * UploadBanner — sticky status strip rendered once at the root so in-flight
 * uploads persist visually across navigations.
 *
 * The banner is intentionally passive: it reads `useUploads()` and renders one
 * row per active upload. The only mutation it performs is `dismissUpload`,
 * either via the explicit `X` button on terminal rows or via the 10-second
 * auto-dismiss on `done`. Mid-upload rows cannot be dismissed here — the
 * banner guards against accidental aborts; if the user really needs to cancel,
 * that belongs in a more prominent "abort" flow (out of scope for Sprint 2).
 *
 * Progress bar math: the underlying tus upload uses a 5 MiB chunk size
 * (`upload-context.tsx`). A 93 MB blob therefore yields ~19 chunks, so the bar
 * advances in visible 5%-ish increments — enough motion to reassure the user
 * without flickering every millisecond.
 */
export function UploadBanner() {
  const { uploads } = useUploads();

  if (uploads.length === 0) return null;

  // `<output>` is the semantic element HTML specifies for "live result of a
  // calculation", which is functionally what an upload progress region is.
  // It carries an implicit `role="status"` + `aria-live="polite"`, so screen
  // readers announce new rows and state changes without extra ARIA noise.
  return (
    <output className="sticky top-0 z-40 block w-full bg-surface/95 supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur">
      <ul className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-2">
        {uploads.map((upload) => (
          <UploadRow key={upload.liveInputId} upload={upload} />
        ))}
      </ul>
    </output>
  );
}

function UploadRow({ upload }: { upload: UploadState }) {
  const { dismissUpload } = useUploads();
  const router = useRouter();
  const shortUid = upload.videoUid.slice(0, 8);
  const isTerminal = upload.status === 'done' || upload.status === 'failed';

  // Auto-dismiss successful uploads after 10s. `failed` rows are intentionally
  // sticky — the user has to acknowledge the error by clicking `X` or the
  // retry affordance, so we don't silently drop the failure from the UI.
  useEffect(() => {
    if (upload.status !== 'done') return;
    const timer = setTimeout(() => {
      dismissUpload(upload.liveInputId);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [upload.status, upload.liveInputId, dismissUpload]);

  const handleRetry = () => {
    // TODO(sprint-3 §11.2.1): implement in-place retry. Real retry requires the
    // original Blob, which is no longer in memory after a navigation. MVP
    // affordance: clear the stale row and bounce the user to the Live page
    // where they can re-trigger stop-and-upload.
    dismissUpload(upload.liveInputId);
    router.push(`/live/${upload.liveInputId}`);
  };

  return (
    <li className="flex items-center gap-3 rounded-md bg-surface-container px-3 py-2">
      <StatusIcon status={upload.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="font-label text-xs text-on-surface">
            <StatusLabel upload={upload} shortUid={shortUid} />
          </p>
          {upload.status === 'done' && (
            <Link
              href={`/live/${upload.liveInputId}`}
              className="font-label text-xs text-primary-dim underline underline-offset-2 hover:text-on-primary-container"
            >
              rever
            </Link>
          )}
          {upload.status === 'failed' && (
            <button
              type="button"
              onClick={handleRetry}
              className="font-label text-xs text-primary-dim underline underline-offset-2 hover:text-on-primary-container"
            >
              tentar novamente
            </button>
          )}
        </div>
        {upload.status === 'failed' && upload.error && (
          <p className="mt-0.5 truncate font-label text-[10px] text-on-surface-variant">
            {upload.error}
          </p>
        )}
        {upload.status === 'uploading' && (
          // `tabIndex={-1}` satisfies the a11y rule for interactive roles while
          // keeping the bar out of the tab order — sighted users track visible
          // progress, assistive tech reads `aria-valuenow` without needing a stop.
          <div
            role="progressbar"
            aria-valuenow={upload.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="progresso do upload"
            tabIndex={-1}
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-surface-high"
          >
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="dispensar"
        onClick={() => dismissUpload(upload.liveInputId)}
        disabled={!isTerminal}
        className="shrink-0 rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

function StatusIcon({ status }: { status: UploadState['status'] }) {
  switch (status) {
    case 'queued':
    case 'uploading':
      return <UploadCloud className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />;
    case 'linking':
      return (
        <Loader2
          className="size-4 shrink-0 animate-spin text-on-surface-variant"
          aria-hidden="true"
        />
      );
    case 'done':
      return <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />;
    case 'failed':
      return <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />;
  }
}

function StatusLabel({ upload, shortUid }: { upload: UploadState; shortUid: string }) {
  switch (upload.status) {
    case 'queued':
      return <>na fila — aevia-{shortUid}</>;
    case 'uploading':
      return (
        <>
          enviando gravação — {shortUid} · {upload.progress}%
        </>
      );
    case 'linking':
      return <>finalizando com cloudflare — {shortUid}</>;
    case 'done':
      return <>gravação salva — {shortUid}</>;
    case 'failed':
      return <>falha ao enviar — {shortUid}</>;
  }
}
