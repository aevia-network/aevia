'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientEnv } from '@/lib/env';
import { type WhipSession, publishWhip } from '@/lib/webrtc/whip';
import { CircleStop, Copy, Radio, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'idle' | 'requesting-devices' | 'ready' | 'connecting' | 'live' | 'error';

interface CreatedLive {
  uid: string;
  whipUrl: string;
  whepUrl: string;
  creator: string;
}

export function Producer({ handle }: { handle: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const whipSessionRef = useRef<WhipSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLive | null>(null);
  const [copied, setCopied] = useState(false);

  const startPreview = useCallback(async () => {
    setStatus('requesting-devices');
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to access camera/mic');
      setStatus('error');
    }
  }, []);

  const goLive = useCallback(async () => {
    if (!streamRef.current) return;
    setStatus('connecting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/lives', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to create live input (${res.status})`);
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
            setErrorMsg(`Connection ${s}`);
          }
        },
      });
      whipSessionRef.current = session;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start broadcast');
      setStatus('error');
    }
  }, []);

  const stopLive = useCallback(async () => {
    await whipSessionRef.current?.stop();
    whipSessionRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
    setCreated(null);
  }, []);

  useEffect(() => {
    return () => {
      void whipSessionRef.current?.stop();
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  const shareUrl = created ? `${clientEnv.appUrl.replace(/\/$/, '')}/live/${created.uid}` : null;

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
          <p className="text-muted text-xs uppercase tracking-[0.2em]">Broadcaster</p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">{handle}</h1>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-surface bg-surface">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 text-center">
            <VideoOff className="size-10 text-muted" />
            <p className="max-w-sm text-muted text-sm">
              Camera preview appears here. Click “Enable camera” to start.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {status === 'idle' && (
          <Button size="lg" onClick={startPreview}>
            Enable camera
          </Button>
        )}
        {status === 'requesting-devices' && (
          <Button size="lg" disabled>
            Requesting access…
          </Button>
        )}
        {status === 'ready' && (
          <Button size="lg" onClick={goLive}>
            <Radio className="size-4" /> Go live
          </Button>
        )}
        {status === 'connecting' && (
          <Button size="lg" disabled>
            Connecting…
          </Button>
        )}
        {(status === 'live' || status === 'error') && (
          <Button size="lg" variant="destructive" onClick={stopLive}>
            <CircleStop className="size-4" /> Stop
          </Button>
        )}
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {errorMsg && (
        <p className="mt-4 text-danger text-sm">
          <strong>Error:</strong> {errorMsg}
        </p>
      )}

      {shareUrl && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Share this live</CardTitle>
            <CardDescription>
              Anyone with this link can watch — no sign-in required.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="flex-1 break-all rounded bg-surface px-3 py-2 text-accent text-xs">
              {shareUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyShareUrl}>
              <Copy className="size-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'live') return <Badge variant="live">● LIVE</Badge>;
  if (status === 'connecting') return <Badge variant="secondary">Connecting</Badge>;
  if (status === 'ready') return <Badge variant="outline">Camera ready</Badge>;
  if (status === 'error') return <Badge variant="live">Error</Badge>;
  return <Badge variant="outline">Idle</Badge>;
}
