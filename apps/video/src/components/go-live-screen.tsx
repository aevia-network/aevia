'use client';

import { BottomNav } from '@/components/bottom-nav';
import { useUploads } from '@/components/upload-context';
import { type RecorderSession, startRecorder } from '@/lib/webrtc/recorder';
import { type WhipSession, publishWhip } from '@/lib/webrtc/whip';
import { PermanenceStrip } from '@aevia/ui';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleStop,
  Copy,
  Mic,
  Radio,
  Settings2,
  VideoOff,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Mirrors Stitch screen `d632b8b7ea1242969c8242e6d9dfac43` ("Aevia — Nova
 * Transmissão (Harmonized)"). Preserves the pre-Stitch producer flow
 * byte-for-byte — getUserMedia → POST /api/lives → WHIP publish → client-side
 * MediaRecorder → tus Direct Upload via UploadContext.
 *
 * Sprint 2 split:
 *
 * - REAL: camera/mic preview, title field persisted via POST body.title →
 *   createLiveInput meta.name, DID signed-as line, WHIP publish, client
 *   recorder, direct-upload handoff, share URL.
 * - ACTIVE: AUP acknowledgment checkbox — required before the "ir ao vivo"
 *   CTA is enabled. Copy matches the Stitch commitment.
 * - MOCK with honest framing: description (deferred to sprint 3 backend
 *   storage), ranking template (visual preference only until the feed gate
 *   lands), category, network status (peers/cost/balance), schedule-for-
 *   later, save-draft. All mocks carry "sprint 3" labels.
 */

type ConnectionStatus = 'idle' | 'requesting-devices' | 'ready' | 'connecting' | 'live' | 'error';
type RankingTemplate = 'familia' | 'padrao' | 'ministerio';

interface CreatedLive {
  uid: string;
  whipUrl: string;
  whepUrl: string | null;
  creator: string;
  backend?: 'cloudflare-stream' | 'aevia-mesh';
}

interface CreateLiveResponse {
  backend: 'cloudflare-stream' | 'aevia-mesh';
  uid: string | null;
  whipUrl: string;
  whepUrl: string | null;
  hlsBaseUrl: string | null;
  creator: string;
  creatorAddress: string;
  creatorDid: string;
  title: string | null;
}

interface DirectUploadResponse {
  uploadUrl: string;
  videoUid: string;
}

export interface GoLiveScreenProps {
  displayName: string;
  address: `0x${string}`;
  did: string;
}

export function GoLiveScreen({ displayName, address, did }: GoLiveScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const whipSessionRef = useRef<WhipSession | null>(null);
  const recorderRef = useRef<RecorderSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLive | null>(null);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<RankingTemplate>('padrao');
  const [aupAccepted, setAupAccepted] = useState(false);

  const { startUpload } = useUploads();

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
    if (!aupAccepted) {
      setErrorMsg('aceite a responsabilidade aup antes de transmitir.');
      return;
    }
    setStatus('connecting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/lives', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `falha ao criar transmissão (${res.status})`);
      }
      const apiLive = (await res.json()) as CreateLiveResponse;

      const session = await publishWhip({
        whipUrl: apiLive.whipUrl,
        stream: streamRef.current,
        did: apiLive.creatorDid,
        onConnectionStateChange: (s) => {
          if (s === 'connected') setStatus('live');
          if (s === 'failed' || s === 'disconnected' || s === 'closed') {
            setStatus('error');
            setErrorMsg(`conexão ${s}`);
          }
        },
      });
      whipSessionRef.current = session;

      // On the aevia-mesh path the uid is minted by the provider-node at WHIP
      // time and arrives via the X-Aevia-Session-ID response header. On the
      // Cloudflare path the uid already came from POST /api/lives.
      const uid = apiLive.uid ?? session.sessionId;
      if (!uid) {
        throw new Error('resposta da rede não trouxe id da transmissão');
      }
      setCreated({
        uid,
        whipUrl: apiLive.whipUrl,
        whepUrl: apiLive.whepUrl,
        creator: apiLive.creator,
        backend: apiLive.backend,
      });

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
  }, [aupAccepted, title]);

  const stopLive = useCallback(async () => {
    const liveUid = created?.uid;
    const backend = created?.backend ?? 'cloudflare-stream';
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

    // Client-side recording → Cloudflare tus direct upload. Aevia-mesh
    // path pins each live segment on the provider-node itself, so the
    // replay is reconstructed by announcing the final manifest CID via
    // DHT — no VOD upload needed. That wire-up lands in M8.5.
    if (backend !== 'cloudflare-stream') {
      recorder?.cancel();
      return;
    }

    if (recorder && liveUid) {
      try {
        const blob = await recorder.stop();
        if (blob.size === 0) return;

        const res = await fetch(`/api/lives/${liveUid}/direct-upload-url`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadLength: blob.size }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `falha ao obter url de upload (${res.status})`);
        }
        const { uploadUrl, videoUid } = (await res.json()) as DirectUploadResponse;
        startUpload({ liveInputId: liveUid, blob, uploadUrl, videoUid });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'falha ao finalizar gravação');
      }
    }
  }, [created?.uid, created?.backend, startUpload]);

  useEffect(() => {
    return () => {
      void whipSessionRef.current?.stop();
      recorderRef.current?.cancel();
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  const shareUrl = created ? `${window.location.origin}/live/${created.uid}` : null;

  const copyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const isLive = status === 'live';
  const isConnecting = status === 'connecting' || status === 'requesting-devices';
  const isReady = status === 'ready';
  const canGoLive = isReady && aupAccepted && !isConnecting;

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <CameraPreview
          videoRef={videoRef}
          status={status}
          onStart={startPreview}
          displayName={displayName}
        />

        <div className="flex flex-col gap-6 px-4">
          <DetailsSection
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            disabled={isLive}
          />

          <CurationSection template={template} onTemplateChange={setTemplate} disabled={isLive} />

          <SignatureSection did={did} address={address} isLive={isLive} />

          <NetworkStatusMock />

          <AupAcknowledgment checked={aupAccepted} onChange={setAupAccepted} disabled={isLive} />

          {errorMsg && (
            <p
              role="alert"
              className="rounded-md bg-surface-container p-3 font-body text-danger text-sm lowercase"
            >
              erro: {errorMsg}
            </p>
          )}

          {shareUrl && <ShareBlock shareUrl={shareUrl} copied={copied} onCopy={copyShareUrl} />}
        </div>
      </main>

      <StickyCta
        status={status}
        canGoLive={canGoLive}
        onStart={startPreview}
        onGoLive={goLive}
        onStop={stopLive}
      />

      <BottomNav />
    </div>
  );
}

// ---- Top chrome ----------------------------------------------------------

function TopChrome() {
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-surface-container-low/95 px-4 backdrop-blur-[12px]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            aria-label="voltar"
            className="rounded-full p-1.5 text-on-surface transition-colors hover:bg-surface-container"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="font-headline font-semibold text-base text-on-surface lowercase">
            nova transmissão
          </h1>
        </div>
        <button
          type="button"
          disabled
          aria-label="salvar rascunho (em breve)"
          className="cursor-not-allowed rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface/40 text-xs lowercase"
        >
          salvar rascunho · sprint 3
        </button>
      </div>
    </header>
  );
}

// ---- Camera preview ------------------------------------------------------

function CameraPreview({
  videoRef,
  status,
  onStart,
  displayName,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: ConnectionStatus;
  onStart: () => void;
  displayName: string;
}) {
  const specLabel =
    status === 'live' || status === 'connecting' || status === 'ready'
      ? 'câmera frontal · 720p · 30fps · aac + opus'
      : 'preview inativo · toque para habilitar';

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden bg-surface-high">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {status === 'live' && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-sm bg-black/80 px-2 py-1 font-label text-[10px] text-white uppercase tracking-wider">
            <span aria-hidden className="aevia-live-pulse size-1.5 rounded-full" />
            ao vivo
          </span>
        )}

        {status === 'idle' && (
          <button
            type="button"
            onClick={onStart}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-center"
          >
            <VideoOff className="size-10 text-on-surface/40" aria-hidden />
            <p className="max-w-xs font-body text-on-surface/70 text-sm lowercase">
              o preview aparece aqui. toque para habilitar câmera e mic.
            </p>
          </button>
        )}

        {status === 'requesting-devices' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="font-body text-on-surface/70 text-sm lowercase">solicitando acesso…</p>
          </div>
        )}
      </div>

      <div
        id="preview-heading"
        className="flex items-center justify-between gap-2 px-4 font-label text-[11px] text-on-surface/60 lowercase"
      >
        <span>{specLabel}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="alternar mic"
            disabled
            className="rounded-full p-1.5 text-on-surface/40"
          >
            <Mic className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="trocar câmera"
            disabled
            className="rounded-full p-1.5 text-on-surface/40"
          >
            <Camera className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="configurações"
            disabled
            className="rounded-full p-1.5 text-on-surface/40"
          >
            <Settings2 className="size-4" aria-hidden />
          </button>
          <span className="font-label text-[10px] text-on-surface/40 lowercase">
            @{displayName}
          </span>
        </span>
      </div>
    </section>
  );
}

// ---- Details (title + description) --------------------------------------

function DetailsSection({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  disabled,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  disabled: boolean;
}) {
  const titleId = useId();
  const descId = useId();

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-4">
      <h2
        id="details-heading"
        className="font-headline font-semibold text-lg text-on-surface lowercase"
      >
        detalhes
      </h2>

      <label htmlFor={titleId} className="flex flex-col gap-1.5">
        <span className="font-label text-[11px] text-on-surface/60 uppercase tracking-wider">
          título *
        </span>
        <input
          id={titleId}
          type="text"
          required
          disabled={disabled}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="o que você vai transmitir?"
          className="rounded-md bg-surface-container px-3 py-2.5 font-body text-on-surface text-sm placeholder:text-on-surface/30 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
      </label>

      <label htmlFor={descId} className="flex flex-col gap-1.5">
        <span className="font-label text-[11px] text-on-surface/60 uppercase tracking-wider">
          descrição · opcional
        </span>
        <textarea
          id={descId}
          rows={3}
          disabled={disabled}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="conte um pouco do que esperar desta transmissão"
          className="resize-none rounded-md bg-surface-container px-3 py-2.5 font-body text-on-surface text-sm placeholder:text-on-surface/30 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <span className="font-label text-[10px] text-on-surface/40 lowercase">
          descrição ainda não persistida · sprint 3
        </span>
      </label>
    </section>
  );
}

// ---- Curation (ranking + category) --------------------------------------

const TEMPLATE_OPTIONS: readonly { kind: RankingTemplate; label: string }[] = [
  { kind: 'familia', label: 'família' },
  { kind: 'padrao', label: 'padrão' },
  { kind: 'ministerio', label: 'ministério' },
];

function CurationSection({
  template,
  onTemplateChange,
  disabled,
}: {
  template: RankingTemplate;
  onTemplateChange: (t: RankingTemplate) => void;
  disabled: boolean;
}) {
  return (
    <section aria-labelledby="curation-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="curation-heading"
          className="font-headline font-semibold text-lg text-on-surface lowercase"
        >
          curadoria
        </h2>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          preferência · sprint 3
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-label text-[11px] text-on-surface/60 uppercase tracking-wider">
          template de ranking
        </span>
        <div
          role="radiogroup"
          aria-label="template de ranking"
          className={`inline-flex w-full gap-1 rounded-full bg-surface-container p-1 ${
            disabled ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          {TEMPLATE_OPTIONS.map((opt) => {
            const isActive = template === opt.kind;
            return (
              <button
                key={opt.kind}
                type="button"
                // biome-ignore lint/a11y/useSemanticElements: ARIA-APG Radio Group pattern — native inputs can't style as pills.
                role="radio"
                aria-checked={isActive}
                onClick={() => onTemplateChange(opt.kind)}
                className={`h-9 flex-1 rounded-full font-label font-medium text-sm lowercase transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface/60 hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="font-label text-[11px] text-on-surface/50 lowercase">
        define como seu conteúdo aparece no feed — a escolha não bloqueia publicação.
      </p>
    </section>
  );
}

// ---- Signature (DID + permanence preview) -------------------------------

function SignatureSection({
  did,
  address,
  isLive,
}: {
  did: string;
  address: `0x${string}`;
  isLive: boolean;
}) {
  const shortDid = `${did.slice(0, 24)}…${address.slice(-4)}`;
  return (
    <section
      aria-labelledby="signature-heading"
      className="flex flex-col gap-3 rounded-md bg-surface-container p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="signature-heading"
          className="font-headline font-semibold text-base text-on-surface lowercase"
        >
          assinatura
        </h2>
        {isLive && (
          <span className="inline-flex items-center gap-1 font-label text-[10px] text-primary-dim lowercase">
            <CheckCircle2 className="size-3" aria-hidden />
            registrando
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <PermanenceStrip
          layers={isLive ? ['providers', 'edge'] : ['edge']}
          width={96}
          aria-label="persistência prevista"
        />
        <p className="font-label text-[11px] text-on-surface/70 lowercase">
          {isLive ? 'edge + provider nodes' : 'edge gateway (preview)'}
        </p>
      </div>

      <div className="flex flex-col gap-1 border-outline-variant/30 border-t pt-3 font-mono text-[10px] text-on-surface/60">
        <div className="flex items-center justify-between gap-2">
          <span className="uppercase tracking-wider">assinado como</span>
          <code className="truncate">{shortDid}</code>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="uppercase tracking-wider">gravação automática</span>
          <span className="text-on-surface/80 lowercase">vod persistente · ligado</span>
        </div>
      </div>

      <p className="font-label text-[11px] text-on-surface/50 lowercase">
        o manifesto assinado ancora a transmissão on-chain quando o registro fechar — persiste mesmo
        se a aevia sair do ar.
      </p>
    </section>
  );
}

// ---- Network status (mock, honest) --------------------------------------

function NetworkStatusMock() {
  return (
    <section aria-labelledby="network-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="network-heading"
          className="font-headline font-semibold text-lg text-on-surface lowercase"
        >
          rede e custo
        </h2>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          amostra · sprint 3
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="peers próximos" value="48" />
        <Stat label="provider nodes" value="12" />
        <Stat label="estimativa · 2 h" value="36 créditos" />
        <Stat label="seu saldo" value="20 créditos" />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md bg-surface-container p-3">
      <dt className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-0.5 font-body font-medium text-on-surface text-sm lowercase">{value}</dd>
    </div>
  );
}

// ---- AUP acknowledgment --------------------------------------------------

function AupAcknowledgment({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <section aria-labelledby="aup-heading" className="rounded-md bg-surface-container p-4">
      <label className="flex cursor-pointer gap-3" htmlFor="aup-checkbox">
        <input
          id="aup-checkbox"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <span id="aup-heading" className="font-body text-on-surface/80 text-sm">
          compreendo que o uso da aevia implica na responsabilidade direta pelo conteúdo
          transmitido. comprometo-me a não veicular discurso de ódio, conteúdo sexual explícito ou
          violento.
        </span>
      </label>
      <Link
        href="/aup"
        className="mt-2 inline-block font-label text-primary-dim text-xs lowercase hover:text-primary"
      >
        ler política completa →
      </Link>
    </section>
  );
}

// ---- Share block ---------------------------------------------------------

function ShareBlock({
  shareUrl,
  copied,
  onCopy,
}: {
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section
      aria-label="link de compartilhamento"
      className="flex flex-col gap-2 rounded-md bg-surface-container p-4"
    >
      <h3 className="font-headline font-semibold text-base text-on-surface lowercase">
        compartilhe esta transmissão
      </h3>
      <p className="font-body text-on-surface/70 text-sm lowercase">
        qualquer pessoa com este link pode assistir — sem login.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 break-all rounded bg-surface-high px-3 py-2 font-mono text-[11px] text-on-surface">
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-high px-3 py-1.5 font-label text-on-surface text-xs lowercase hover:bg-surface-highest"
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? 'copiado' : 'copiar'}
        </button>
      </div>
    </section>
  );
}

// ---- Sticky bottom CTA ---------------------------------------------------

function StickyCta({
  status,
  canGoLive,
  onStart,
  onGoLive,
  onStop,
}: {
  status: ConnectionStatus;
  canGoLive: boolean;
  onStart: () => void;
  onGoLive: () => void;
  onStop: () => void;
}) {
  let label = 'habilitar câmera';
  let onClick: () => void = onStart;
  let variant: 'primary' | 'destructive' | 'muted' = 'primary';
  let disabled = false;

  if (status === 'requesting-devices') {
    label = 'solicitando acesso…';
    disabled = true;
    variant = 'muted';
  } else if (status === 'ready') {
    label = canGoLive ? 'ir ao vivo' : 'aceite a aup para transmitir';
    onClick = onGoLive;
    disabled = !canGoLive;
  } else if (status === 'connecting') {
    label = 'conectando…';
    disabled = true;
    variant = 'muted';
  } else if (status === 'live') {
    label = 'parar transmissão';
    onClick = onStop;
    variant = 'destructive';
  } else if (status === 'error') {
    label = 'tentar novamente';
    onClick = onStart;
  }

  const colorClasses =
    variant === 'destructive'
      ? 'bg-danger text-on-error'
      : variant === 'muted'
        ? 'bg-surface-high text-on-surface/60'
        : 'bg-primary text-on-primary';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[72px] z-30 px-4 pb-3">
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-full font-label font-medium text-sm lowercase transition-opacity ${colorClasses} ${
            disabled ? 'opacity-60' : 'hover:opacity-90'
          }`}
        >
          {status === 'ready' && canGoLive && <Radio className="size-4" aria-hidden />}
          {status === 'live' && <CircleStop className="size-4" aria-hidden />}
          {label}
        </button>
      </div>
    </div>
  );
}
