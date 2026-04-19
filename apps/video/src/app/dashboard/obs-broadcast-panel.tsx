'use client';

import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PublisherTokenResponse {
  token: string;
  jti: string;
  expiresAt: number;
  ingestUrl: string;
  liveId: string;
  liveName: string | null;
}

interface PanelState {
  loading: boolean;
  error: string | null;
  data: PublisherTokenResponse | null;
  /** When true, the token is shown in plaintext; default masks it. */
  revealed: boolean;
  /** Map of field-name → copied-recently flag for the inline checkmark. */
  copied: Record<string, boolean>;
}

const initial: PanelState = {
  loading: false,
  error: null,
  data: null,
  revealed: false,
  copied: {},
};

/**
 * Inline panel surfaced from a LiveRow when the creator opts to broadcast
 * via OBS Studio (or any external WHIP tool). Fetches a 30-min publisher
 * token on mount; the user copies `ingestUrl` + `token` into OBS:
 *
 *   Settings → Stream → Service: WHIP
 *   Server: <ingestUrl>
 *   Bearer Token: <token>
 *
 * Token rotation is currently "mint-fresh-on-click"; older tokens stay
 * valid until their TTL expires. Hard revocation lands in the follow-up
 * sprint slice (OPPORTUNITY §1.2).
 */
export function ObsBroadcastPanel({ liveUid }: { liveUid: string }) {
  const [state, setState] = useState<PanelState>(initial);

  async function mint() {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/lives/${liveUid}/publisher-token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as PublisherTokenResponse;
      setState({ loading: false, error: null, data, revealed: false, copied: {} });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'falha ao gerar token',
      }));
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mint reads
  // liveUid from closure but biome can't see through the helper. Re-running
  // on liveUid change is the intended behavior — token is per-live-scoped.
  useEffect(() => {
    void mint();
  }, [liveUid]);

  function copyField(name: string, value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setState((s) => ({ ...s, copied: { ...s.copied, [name]: true } }));
      setTimeout(() => {
        setState((s) => ({ ...s, copied: { ...s.copied, [name]: false } }));
      }, 1500);
    });
  }

  if (state.loading && !state.data) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-high px-3 py-2.5 text-on-surface/60 text-xs">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        gerando token de publisher…
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div className="mt-3 rounded-md bg-danger/10 px-3 py-2.5 text-danger text-xs">
        <p className="font-medium">não foi possível gerar token</p>
        <p className="mt-1 text-danger/80 text-[11px]">{state.error}</p>
        <button
          type="button"
          onClick={() => void mint()}
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] hover:bg-danger/10"
        >
          <RefreshCw className="size-3" aria-hidden />
          tentar de novo
        </button>
      </div>
    );
  }

  if (!state.data) return null;

  const expiresInMin = Math.max(0, Math.round((state.data.expiresAt * 1000 - Date.now()) / 60000));
  const tokenDisplay = state.revealed
    ? state.data.token
    : `${state.data.token.slice(0, 12)}…${state.data.token.slice(-8)}`;

  return (
    <div className="mt-3 space-y-3 rounded-md bg-surface-high p-3 text-xs">
      <p className="font-headline text-on-surface text-sm lowercase">configurar obs studio</p>

      <ol className="list-inside list-decimal space-y-1 text-on-surface/70 text-[11px]">
        <li>
          em obs: <span className="font-mono">configurações → transmissão → serviço: whip</span>
        </li>
        <li>cole o servidor e o token bearer abaixo</li>
        <li>
          recomendado: 1080p60 a 4500 kbps, intervalo de keyframe 2s, encoder x264 / nvenc /
          videotoolbox
        </li>
      </ol>

      <Field
        label="server (whip)"
        value={state.data.ingestUrl}
        copied={!!state.copied.url}
        onCopy={() => copyField('url', state.data!.ingestUrl)}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-on-surface/60 text-[10px] uppercase tracking-wider">
            bearer token
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, revealed: !s.revealed }))}
              aria-label={state.revealed ? 'ocultar token' : 'revelar token'}
              className="rounded-full p-1 text-on-surface/40 transition-colors hover:bg-surface hover:text-on-surface"
            >
              {state.revealed ? (
                <EyeOff className="size-3" aria-hidden />
              ) : (
                <Eye className="size-3" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => copyField('token', state.data!.token)}
              aria-label="copiar token"
              className="rounded-full p-1 text-on-surface/40 transition-colors hover:bg-surface hover:text-on-surface"
            >
              {state.copied.token ? (
                <Check className="size-3 text-primary" aria-hidden />
              ) : (
                <Copy className="size-3" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <p className="break-all rounded bg-surface px-2 py-1.5 font-mono text-[10px] text-on-surface/80">
          {tokenDisplay}
        </p>
      </div>

      <div className="flex items-center justify-between border-on-surface/5 border-t pt-2">
        <p className="text-on-surface/40 text-[10px]">
          token expira em ~{expiresInMin}min · uso individual recomendado
        </p>
        <button
          type="button"
          onClick={() => void mint()}
          disabled={state.loading}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-on-surface/60 text-[10px] transition-colors hover:bg-surface hover:text-on-surface disabled:opacity-50"
        >
          {state.loading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3" aria-hidden />
          )}
          gerar novo
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-on-surface/60 text-[10px] uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`copiar ${label}`}
          className="rounded-full p-1 text-on-surface/40 transition-colors hover:bg-surface hover:text-on-surface"
        >
          {copied ? (
            <Check className="size-3 text-primary" aria-hidden />
          ) : (
            <Copy className="size-3" aria-hidden />
          )}
        </button>
      </div>
      <p className="break-all rounded bg-surface px-2 py-1.5 font-mono text-[10px] text-on-surface/80">
        {value}
      </p>
    </div>
  );
}
