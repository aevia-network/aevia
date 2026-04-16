'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type WhepSession, playWhep } from '@/lib/webrtc/whep';
import { AlertCircle, Radio } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type ViewerStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';

export function Viewer({
  uid,
  whepUrl,
  creator,
  state,
}: {
  uid: string;
  whepUrl: string;
  creator: string;
  state: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const whepSessionRef = useRef<WhepSession | null>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const start = useCallback(async () => {
    setStatus('connecting');
    setErrorMsg(null);
    try {
      const session = await playWhep({
        whepUrl,
        onConnectionStateChange: (s) => {
          if (s === 'connected') setStatus('playing');
          if (s === 'failed' || s === 'closed') {
            setStatus('error');
            setErrorMsg(`Connection ${s}`);
          }
          if (s === 'disconnected') setStatus('ended');
        },
      });
      whepSessionRef.current = session;
      if (videoRef.current) {
        videoRef.current.srcObject = session.stream;
        try {
          await videoRef.current.play();
        } catch {
          // iOS Safari often blocks autoplay until user gesture.
          setAutoplayBlocked(true);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('error');
    }
  }, [whepUrl]);

  useEffect(() => {
    void start();
    return () => {
      void whepSessionRef.current?.stop();
    };
  }, [start]);

  const unmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      void videoRef.current.play();
      setAutoplayBlocked(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.2em]">@{creator}</p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">Live broadcast</h1>
        </div>
        <div className="flex items-center gap-3">
          {status === 'playing' && (
            <Badge variant="live">
              <Radio className="mr-1 size-3" /> LIVE
            </Badge>
          )}
          {status === 'connecting' && <Badge variant="secondary">Connecting</Badge>}
          {status === 'ended' && <Badge variant="outline">Ended</Badge>}
          {status === 'error' && <Badge variant="live">Error</Badge>}
          <code className="text-muted text-xs">{uid.slice(0, 8)}</code>
        </div>
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-surface bg-surface">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {autoplayBlocked && (
          <button
            type="button"
            onClick={unmute}
            className="absolute inset-0 flex items-center justify-center bg-background/80 font-medium text-accent text-lg"
          >
            Tap to unmute
          </button>
        )}
      </div>

      {state === 'disconnected' && status !== 'playing' && (
        <div className="mt-6 flex items-center gap-2 rounded-md border border-surface bg-surface/50 p-4 text-muted text-sm">
          <AlertCircle className="size-4" />
          Broadcaster is not currently streaming. Waiting for them to come online…
          <Button size="sm" variant="ghost" onClick={start}>
            Retry
          </Button>
        </div>
      )}

      {errorMsg && (
        <p className="mt-4 text-danger text-sm">
          <strong>Error:</strong> {errorMsg}
          <Button size="sm" variant="outline" className="ml-3" onClick={start}>
            Retry
          </Button>
        </p>
      )}
    </main>
  );
}
