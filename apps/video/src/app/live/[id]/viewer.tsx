'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type WhepSession, playWhep } from '@/lib/webrtc/whep';
import { PermanenceStrip, VigilChip } from '@aevia/ui';
import Hls from 'hls.js';
import { Radio, Rewind } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type ViewerMode = 'live' | 'vod';
type LiveStatus = 'idle' | 'connecting' | 'playing' | 'ended' | 'error';
type VodStatus = 'idle' | 'loading' | 'playing' | 'error';

export function Viewer({
  uid,
  whepUrl,
  hlsUrl,
  vodProcessing = false,
  creator,
  state,
}: {
  uid: string;
  whepUrl: string;
  hlsUrl: string | null;
  vodProcessing?: boolean;
  creator: string;
  state: string;
}) {
  // Initial mode: live if broadcaster is currently connected; replay otherwise.
  const initialMode: ViewerMode = state === 'connected' ? 'live' : 'vod';
  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live (WHEP) state
  const whepSessionRef = useRef<WhepSession | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // VOD (HLS) state
  const [vodStatus, setVodStatus] = useState<VodStatus>('idle');
  const [vodError, setVodError] = useState<string | null>(null);

  const startLive = useCallback(async () => {
    setLiveStatus('connecting');
    setLiveError(null);
    try {
      const session = await playWhep({
        whepUrl,
        onConnectionStateChange: (s) => {
          if (s === 'connected') setLiveStatus('playing');
          if (s === 'failed' || s === 'closed') {
            setLiveStatus('error');
            setLiveError(`conexão ${s === 'failed' ? 'falhou' : 'encerrada'}`);
          }
          if (s === 'disconnected') setLiveStatus('ended');
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
      setLiveError(err instanceof Error ? err.message : 'falha ao conectar');
      setLiveStatus('error');
    }
  }, [whepUrl]);

  // Live mount: start WHEP; on unmount or mode change, tear down.
  useEffect(() => {
    if (mode !== 'live') return;
    void startLive();
    return () => {
      void whepSessionRef.current?.stop();
      whepSessionRef.current = null;
    };
  }, [mode, startLive]);

  // VOD mount: attach hls.js or rely on native HLS (Safari / iOS).
  useEffect(() => {
    if (mode !== 'vod' || !hlsUrl) return;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = null;
    setVodStatus('loading');
    setVodError(null);

    const onError = () => {
      setVodError('falha ao carregar replay');
      setVodStatus('error');
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      const onCanPlay = () => setVodStatus('playing');
      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', onError);
      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        video.src = '';
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setVodStatus('playing');
        video.play().catch(() => setAutoplayBlocked(true));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setVodError(`replay error: ${data.type}`);
          setVodStatus('error');
        }
      });
      return () => {
        hls.destroy();
      };
    }

    setVodError('reprodução hls não suportada neste navegador');
    setVodStatus('error');
  }, [mode, hlsUrl]);

  const unmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      void videoRef.current.play();
      setAutoplayBlocked(false);
    }
  };

  const switchToReplay = () => {
    void whepSessionRef.current?.stop();
    whepSessionRef.current = null;
    setMode('vod');
  };

  const isErrorBadge =
    (mode === 'live' && liveStatus === 'error') || (mode === 'vod' && vodStatus === 'error');

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
              @{creator}
            </p>
            {mode === 'live' && liveStatus === 'playing' && <VigilChip />}
          </div>
          <h1 className="mt-1 font-headline text-2xl font-semibold tracking-tight lowercase">
            {mode === 'live' ? 'transmissão ao vivo' : 'replay'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'live' && liveStatus === 'playing' && (
            <Badge variant="live" className="font-label tracking-wide">
              <Radio className="mr-1 size-3" /> ao vivo
            </Badge>
          )}
          {mode === 'live' && liveStatus === 'connecting' && (
            <Badge variant="secondary" className="font-label tracking-wide lowercase">
              conectando
            </Badge>
          )}
          {mode === 'live' && liveStatus === 'ended' && (
            <Badge variant="outline" className="font-label tracking-wide lowercase">
              encerrada
            </Badge>
          )}
          {mode === 'vod' && vodStatus === 'playing' && (
            <Badge variant="outline" className="font-label tracking-wide lowercase">
              <Rewind className="mr-1 size-3" /> replay
            </Badge>
          )}
          {mode === 'vod' && vodStatus === 'loading' && (
            <Badge variant="secondary" className="font-label tracking-wide lowercase">
              carregando
            </Badge>
          )}
          {isErrorBadge && (
            <Badge variant="live" className="font-label tracking-wide lowercase">
              erro
            </Badge>
          )}
          <code className="font-label text-on-surface-variant text-xs">{uid.slice(0, 8)}</code>
        </div>
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-primary-dim bg-surface-high">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={mode === 'vod'}
          className="h-full w-full object-contain"
        />
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
          layers={mode === 'live' && liveStatus === 'playing' ? ['providers', 'edge'] : ['edge']}
          width={160}
        />
        <p className="font-label text-[11px] text-on-surface-variant">
          persistência:{' '}
          {mode === 'live' && liveStatus === 'playing'
            ? 'edge + provider nodes'
            : 'edge gateway (hls)'}
        </p>
      </div>

      {mode === 'live' && liveStatus === 'ended' && hlsUrl && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-4 text-on-surface-variant text-sm lowercase">
          transmissão encerrada.
          <Button size="sm" variant="outline" onClick={switchToReplay} className="lowercase">
            <Rewind className="size-3.5" />
            assistir replay
          </Button>
        </div>
      )}

      {mode === 'live' && liveError && (
        <p className="mt-4 text-danger text-sm lowercase">
          <strong>erro:</strong> {liveError}
          <Button size="sm" variant="outline" className="ml-3 lowercase" onClick={startLive}>
            tentar novamente
          </Button>
        </p>
      )}

      {mode === 'vod' && vodError && (
        <p className="mt-4 text-danger text-sm lowercase">
          <strong>erro:</strong> {vodError}
        </p>
      )}

      {mode === 'vod' && !hlsUrl && vodProcessing && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-surface-container p-4 text-on-surface-variant text-sm lowercase">
          gravação ainda sendo processada pelo cloudflare. tente novamente em alguns minutos.
        </div>
      )}

      {mode === 'vod' && !hlsUrl && !vodProcessing && (
        <div className="mt-6 flex items-center gap-2 rounded-md bg-surface-container p-4 text-on-surface-variant text-sm lowercase">
          nenhuma gravação disponível para esta transmissão.
        </div>
      )}
    </main>
  );
}
