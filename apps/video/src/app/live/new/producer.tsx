'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type RecorderSession, startRecorder } from '@/lib/webrtc/recorder';
import { type WhipSession, publishWhip } from '@/lib/webrtc/whip';
import { CircleStop, Copy, Radio, Rewind, UploadCloud, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'idle' | 'requesting-devices' | 'ready' | 'connecting' | 'live' | 'error';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface CreatedLive {
  uid: string;
  whipUrl: string;
  whepUrl: string;
  creator: string;
}

export function Producer({
  displayName,
  address: _address,
  did: _did,
}: {
  displayName: string;
  /** Reserved for Sprint 2 manifest signing. */
  address: `0x${string}`;
  /** Reserved for Sprint 2 manifest signing. */
  did: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const whipSessionRef = useRef<WhipSession | null>(null);
  const recorderRef = useRef<RecorderSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLive | null>(null);
  const [copied, setCopied] = useState(false);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedVideoUid, setUploadedVideoUid] = useState<string | null>(null);

  const startPreview = useCallback(async () => {
    setStatus('requesting-devices');
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'falha ao acessar câmera/mic');
      setStatus('error');
    }
  }, []);

  const goLive = useCallback(async () => {
    if (!streamRef.current) return;
    setStatus('connecting');
    setErrorMsg(null);
    setUploadStatus('idle');
    setUploadError(null);
    setUploadedVideoUid(null);

    try {
      const res = await fetch('/api/lives', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `falha ao criar transmissão (${res.status})`);
      }
      const live = (await res.json()) as CreatedLive;
      setCreated(live);

      const session = await publishWhip({
        whipUrl: live.whipUrl,
        stream: streamRef.current,
        onConnectionStateChange: (s) => {
          if (s === 'connected') setStatus('live');
          if (s === 'failed' || s === 'disconnected' || s === 'closed') {
            setStatus('error');
            setErrorMsg(`conexão ${s}`);
          }
        },
      });
      whipSessionRef.current = session;

      // Start client-side recording in parallel — Cloudflare WHIP beta does not
      // produce server-side recordings yet, so we capture locally and upload
      // when the broadcaster stops.
      try {
        recorderRef.current = startRecorder(streamRef.current);
      } catch (err) {
        // If MediaRecorder is unsupported, the live itself still works.
        console.warn('[recorder] failed to start, continuing without VOD', err);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'falha ao iniciar transmissão');
      setStatus('error');
    }
  }, []);

  const uploadRecording = useCallback(async (liveUid: string, blob: Blob) => {
    setUploadStatus('uploading');
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', blob, `aevia-${liveUid}.webm`);
      const res = await fetch(`/api/lives/${liveUid}/recording`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `falha no upload (${res.status})`);
      }
      const data = (await res.json()) as { videoUid: string };
      setUploadedVideoUid(data.videoUid);
      setUploadStatus('success');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'falha no upload');
      setUploadStatus('error');
    }
  }, []);

  const stopLive = useCallback(async () => {
    const liveUid = created?.uid;
    const recorder = recorderRef.current;
    recorderRef.current = null;

    await whipSessionRef.current?.stop();
    whipSessionRef.current = null;

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');

    if (recorder && liveUid) {
      try {
        const blob = await recorder.stop();
        if (blob.size > 0) {
          await uploadRecording(liveUid, blob);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'falha ao finalizar gravação');
        setUploadStatus('error');
      }
    }
  }, [created?.uid, uploadRecording]);

  useEffect(() => {
    return () => {
      void whipSessionRef.current?.stop();
      recorderRef.current?.cancel();
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  // Derive from the current origin rather than `clientEnv.appUrl` — the
  // latter falls back to `localhost:3000` whenever `NEXT_PUBLIC_APP_URL`
  // isn't set at build time, leaking localhost links into production
  // shares. The Producer is always rendered client-side after hydration,
  // so `window.location.origin` is always available.
  const shareUrl = created ? `${window.location.origin}/live/${created.uid}` : null;

  const copyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
            transmissor
          </p>
          <h1 className="mt-1 font-headline text-2xl font-semibold tracking-tight lowercase">
            {displayName}
          </h1>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-surface bg-surface">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 text-center">
            <VideoOff className="size-10 text-muted" />
            <p className="max-w-sm text-muted text-sm lowercase">
              o preview da câmera aparece aqui. clique em “habilitar câmera” para começar.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {status === 'idle' && (
          <Button size="lg" onClick={startPreview} className="lowercase">
            habilitar câmera
          </Button>
        )}
        {status === 'requesting-devices' && (
          <Button size="lg" disabled className="lowercase">
            solicitando acesso…
          </Button>
        )}
        {status === 'ready' && (
          <Button size="lg" onClick={goLive} className="lowercase">
            <Radio className="size-4" /> ir ao vivo
          </Button>
        )}
        {status === 'connecting' && (
          <Button size="lg" disabled className="lowercase">
            conectando…
          </Button>
        )}
        {(status === 'live' || status === 'error') && (
          <Button size="lg" variant="destructive" onClick={stopLive} className="lowercase">
            <CircleStop className="size-4" /> parar
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="lowercase">
          <Link href="/dashboard">voltar ao painel</Link>
        </Button>
      </div>

      {errorMsg && (
        <p className="mt-4 text-danger text-sm lowercase">
          <strong>erro:</strong> {errorMsg}
        </p>
      )}

      {shareUrl && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="font-headline lowercase">compartilhe esta transmissão</CardTitle>
            <CardDescription className="lowercase">
              qualquer pessoa com este link pode assistir — sem login.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="flex-1 break-all rounded bg-surface px-3 py-2 font-label text-accent text-xs">
              {shareUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyShareUrl} className="lowercase">
              <Copy className="size-3.5" />
              {copied ? 'copiado' : 'copiar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {uploadStatus !== 'idle' && created && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            {uploadStatus === 'uploading' && (
              <>
                <UploadCloud className="size-4 animate-pulse text-primary" />
                <p className="text-on-surface-variant text-sm lowercase">
                  enviando gravação para o cloudflare stream…
                </p>
              </>
            )}
            {uploadStatus === 'success' && uploadedVideoUid && (
              <>
                <Rewind className="size-4 text-primary" />
                <p className="text-on-surface-variant text-sm lowercase">
                  gravação salva. replay disponível em{' '}
                  <Link href={`/live/${created.uid}`} className="underline">
                    /live/{created.uid.slice(0, 8)}
                  </Link>{' '}
                  assim que o cloudflare terminar de processar.
                </p>
              </>
            )}
            {uploadStatus === 'error' && (
              <p className="text-danger text-sm lowercase">
                <strong>falha no upload:</strong> {uploadError ?? 'erro desconhecido'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'live')
    return (
      <Badge variant="live" className="font-label tracking-wide">
        <Radio className="mr-1 size-3" /> ao vivo
      </Badge>
    );
  if (status === 'connecting')
    return (
      <Badge variant="secondary" className="font-label tracking-wide lowercase">
        conectando
      </Badge>
    );
  if (status === 'ready')
    return (
      <Badge variant="outline" className="font-label tracking-wide lowercase">
        câmera pronta
      </Badge>
    );
  if (status === 'error')
    return (
      <Badge variant="live" className="font-label tracking-wide lowercase">
        erro
      </Badge>
    );
  return (
    <Badge variant="outline" className="font-label tracking-wide lowercase">
      aguardando
    </Badge>
  );
}
