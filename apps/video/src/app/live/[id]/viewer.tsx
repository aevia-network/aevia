'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type WhepSession, playWhep } from '@/lib/webrtc/whep';
import { PermanenceStrip, VigilChip } from '@aevia/ui';
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
            setErrorMsg(`conexão ${s === 'failed' ? 'falhou' : 'encerrada'}`);
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
      setErrorMsg(err instanceof Error ? err.message : 'falha ao conectar');
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
          <div className="flex items-center gap-2">
            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
              @{creator}
            </p>
            {status === 'playing' && <VigilChip />}
          </div>
          <h1 className="mt-1 font-headline text-2xl font-semibold tracking-tight lowercase">
            transmissão ao vivo
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {status === 'playing' && (
            <Badge variant="live" className="font-label tracking-wide">
              <Radio className="mr-1 size-3" /> ao vivo
            </Badge>
          )}
          {status === 'connecting' && (
            <Badge variant="secondary" className="font-label tracking-wide lowercase">
              conectando
            </Badge>
          )}
          {status === 'ended' && (
            <Badge variant="outline" className="font-label tracking-wide lowercase">
              encerrada
            </Badge>
          )}
          {status === 'error' && (
            <Badge variant="live" className="font-label tracking-wide lowercase">
              erro
            </Badge>
          )}
          <code className="font-label text-on-surface-variant text-xs">{uid.slice(0, 8)}</code>
        </div>
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-primary-dim bg-surface-high">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {autoplayBlocked && (
          <button
            type="button"
            onClick={unmute}
            className="absolute inset-0 flex items-center justify-center bg-background/80 font-headline font-medium text-accent text-lg lowercase"
          >
            toque para ativar o som
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <PermanenceStrip
          layers={status === 'playing' ? ['providers', 'edge'] : ['edge']}
          width={160}
        />
        <p className="font-label text-[11px] text-on-surface-variant">
          persistência: {status === 'playing' ? 'edge + provider nodes' : 'edge gateway'}
        </p>
      </div>

      {state === 'disconnected' && status !== 'playing' && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-surface-container p-4 text-on-surface-variant text-sm lowercase">
          <AlertCircle className="size-4" />
          transmissor não está no ar. aguardando retorno…
          <Button size="sm" variant="ghost" onClick={start} className="lowercase">
            tentar novamente
          </Button>
        </div>
      )}

      {errorMsg && (
        <p className="mt-4 text-danger text-sm lowercase">
          <strong>erro:</strong> {errorMsg}
          <Button size="sm" variant="outline" className="ml-3 lowercase" onClick={start}>
            tentar novamente
          </Button>
        </p>
      )}
    </main>
  );
}
