'use client';

import { appChain } from '@/lib/chain';
import { streamThumbnailUrl } from '@/lib/cloudflare/stream-urls';
import { formatDateTimePtBR } from '@/lib/format';
import {
  CONTENT_REGISTRY_ABI,
  appChainId,
  buildRegisterContentTypedData,
  contentRegistryAddress,
  shortAddress,
  sprint2PlaceholderManifestCid,
  useSendTransaction,
  useSignTypedData,
  useWallets,
} from '@aevia/auth/client';
import { PermanenceStrip } from '@aevia/ui';
import { Anchor, Check, Loader2, Pencil, Play, Radio, Trash2, Tv2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { http, createPublicClient, encodeFunctionData, keccak256 as viemKeccak256 } from 'viem';
import { deleteLiveAction, renameLiveAction } from '../actions';
import { ObsBroadcastPanel } from './obs-broadcast-panel';

export interface LiveRowData {
  uid: string;
  state: 'connected' | 'disconnected' | 'unknown';
  name: string;
  created: string;
  /** Cloudflare Stream video UID once the live recording has been uploaded. */
  recordingVideoUid?: string;
  /** 0x-prefixed 32-byte manifest identifier once registered on-chain. */
  manifestCid?: string;
  /** Transaction hash of the successful `registerContent` call. */
  registerTxHash?: string;
  /** Block number of the successful `registerContent` call. */
  registerBlock?: number;
}

type RegisterState =
  | { kind: 'idle' }
  | { kind: 'running'; step: 'nonce' | 'sign' | 'send' | 'confirm' | 'persist' }
  | { kind: 'success'; block: number; txHash: string }
  | { kind: 'error'; message: string };

type SponsorshipState = { kind: 'available' } | { kind: 'exhausted'; limit: number; used: number };

export function LiveRow({ live }: { live: LiveRowData }) {
  const [editing, setEditing] = useState(false);
  const [obsPanelOpen, setObsPanelOpen] = useState(false);
  const [draft, setDraft] = useState(live.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const createdLabel = formatDateTimePtBR(live.created);

  const router = useRouter();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTypedData } = useSignTypedData();
  const { sendTransaction } = useSendTransaction();
  const [registerState, setRegisterState] = useState<RegisterState>(() => {
    if (live.manifestCid && live.registerTxHash && typeof live.registerBlock === 'number') {
      return { kind: 'success', block: live.registerBlock, txHash: live.registerTxHash };
    }
    return { kind: 'idle' };
  });
  const [sponsorship, setSponsorship] = useState<SponsorshipState>({ kind: 'available' });

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const confirmAndDelete = (event: React.FormEvent<HTMLFormElement>) => {
    const ok = window.confirm(
      'apagar esta transmissão? o vídeo gravado também será removido. esta ação não pode ser desfeita.',
    );
    if (!ok) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const canRegister =
    Boolean(live.recordingVideoUid) &&
    !live.manifestCid &&
    registerState.kind !== 'running' &&
    registerState.kind !== 'success';

  const handleRegister = async () => {
    if (!walletsReady) return;
    const wallet = wallets[0];
    if (!wallet) {
      setRegisterState({ kind: 'error', message: 'carteira indisponível' });
      return;
    }

    const chainId = appChainId();
    const chain = appChain();
    const registry = contentRegistryAddress(chainId);
    const owner = wallet.address.toLowerCase() as `0x${string}`;
    const videoUid = live.recordingVideoUid;
    if (!videoUid) {
      setRegisterState({ kind: 'error', message: 'gravação ausente' });
      return;
    }

    try {
      setRegisterState({ kind: 'running', step: 'nonce' });

      // Read the nonce via our own viem client (bound to Base Sepolia RPC),
      // not via the wallet. This works regardless of which chain the wallet
      // is currently connected to, so we can defer the costly `switchChain`
      // round-trip until right before the tx send — Privy's switchChain has
      // been observed to time out with "Request expired" on some MetaMask
      // installs, and we want the flow to reach the signing prompt first.
      const publicClient = createPublicClient({ chain, transport: http() });

      const nonce = (await publicClient.readContract({
        address: registry,
        abi: CONTENT_REGISTRY_ABI,
        functionName: 'nonces',
        args: [owner],
      })) as bigint;

      const manifestCid = sprint2PlaceholderManifestCid({
        videoUid,
        owner,
        createdAtSeconds: Math.floor(Date.now() / 1000),
        keccak256: viemKeccak256,
      });

      const typedData = buildRegisterContentTypedData({
        owner,
        manifestCid,
        parentCid: `0x${'0'.repeat(64)}`,
        policyFlags: 0,
        chainId,
        nonce,
        verifyingContract: registry,
      });

      setRegisterState({ kind: 'running', step: 'sign' });
      // Privy's `useSignTypedData` routes to the correct signer:
      //   - embedded wallet: signs with the Privy-managed key (modal UI);
      //   - external wallet: proxies `eth_signTypedData_v4` to the injected
      //     provider (MetaMask / Coinbase / etc.).
      // For smart wallets (ERC-1271), the on-chain `SignatureChecker` handles
      // the variable-length signature produced here.
      const { signature } = await signTypedData(
        // SignTypedDataParams expects `message: Record<string, unknown>`, which
        // admits bigint values for uint256 fields (viem serializes them via the
        // underlying EIP-712 transport). Cast is safe: our struct literal is a
        // strict super-shape of the interface.
        typedData as unknown as Parameters<typeof signTypedData>[0],
        { address: owner },
      );

      const data = encodeFunctionData({
        abi: CONTENT_REGISTRY_ABI,
        functionName: 'registerContent',
        args: [
          owner,
          manifestCid,
          `0x${'0'.repeat(64)}` as `0x${string}`,
          0,
          signature as `0x${string}`,
        ],
      });

      setRegisterState({ kind: 'running', step: 'send' });
      // Only switch chain now, right before the tx: signing doesn't require
      // it (typed data commits the chainId explicitly), and deferring keeps
      // the user from hitting MetaMask's switch prompt on every retry.
      // Wrap in try/catch so "Request expired" from Privy doesn't kill the
      // flow — `sendTransaction` will throw a clearer error if the wallet is
      // truly on the wrong chain.
      if (wallet.chainId !== `eip155:${chainId}`) {
        try {
          await wallet.switchChain(chainId);
        } catch (err) {
          console.error('[register] switchChain failed, continuing:', err);
        }
      }
      const { hash: txHash } = await sendTransaction(
        {
          to: registry,
          data,
          chainId,
        },
        { address: owner },
      );

      setRegisterState({ kind: 'running', step: 'confirm' });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        throw new Error(`transaction reverted at block ${receipt.blockNumber}`);
      }
      const block = Number(receipt.blockNumber);

      setRegisterState({ kind: 'running', step: 'persist' });
      const res = await fetch(`/api/lives/${live.uid}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestCid,
          registerTxHash: txHash,
          registerBlock: block,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `persist failed with ${res.status}`);
      }

      setRegisterState({ kind: 'success', block, txHash });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      setRegisterState({ kind: 'error', message });
    }
  };

  /**
   * Sponsored (gas-free) path.
   *
   * Client still signs the EIP-712 typed data; the edge route submits the
   * on-chain tx with a platform-funded relayer key. End-to-end the user
   * never sees a wallet "Confirm transaction" prompt — only the "Sign
   * message" prompt they already see today.
   */
  const handleRegisterSponsored = async () => {
    if (!walletsReady) return;
    const wallet = wallets[0];
    if (!wallet) {
      setRegisterState({ kind: 'error', message: 'carteira indisponível' });
      return;
    }

    const chainId = appChainId();
    const chain = appChain();
    const registry = contentRegistryAddress(chainId);
    const owner = wallet.address.toLowerCase() as `0x${string}`;
    const videoUid = live.recordingVideoUid;
    if (!videoUid) {
      setRegisterState({ kind: 'error', message: 'gravação ausente' });
      return;
    }

    try {
      setRegisterState({ kind: 'running', step: 'nonce' });
      const publicClient = createPublicClient({ chain, transport: http() });

      const nonce = (await publicClient.readContract({
        address: registry,
        abi: CONTENT_REGISTRY_ABI,
        functionName: 'nonces',
        args: [owner],
      })) as bigint;

      const manifestCid = sprint2PlaceholderManifestCid({
        videoUid,
        owner,
        createdAtSeconds: Math.floor(Date.now() / 1000),
        keccak256: viemKeccak256,
      });

      const parentCid = `0x${'0'.repeat(64)}` as `0x${string}`;
      const policyFlags = 0;

      const typedData = buildRegisterContentTypedData({
        owner,
        manifestCid,
        parentCid,
        policyFlags,
        chainId,
        nonce,
        verifyingContract: registry,
      });

      setRegisterState({ kind: 'running', step: 'sign' });
      const { signature } = await signTypedData(
        typedData as unknown as Parameters<typeof signTypedData>[0],
        { address: owner },
      );

      setRegisterState({ kind: 'running', step: 'send' });
      const res = await fetch(`/api/lives/${live.uid}/register-relayed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          manifestCid,
          parentCid,
          policyFlags,
          signature,
        }),
      });

      if (res.status === 402) {
        const body = (await res.json().catch(() => ({}))) as { limit?: number; used?: number };
        setSponsorship({
          kind: 'exhausted',
          limit: body.limit ?? 10,
          used: body.used ?? 10,
        });
        setRegisterState({
          kind: 'error',
          message: 'patrocínio esgotado — registros grátis consumidos (10/10).',
        });
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
          txHash?: string;
        };
        throw new Error(body.reason ?? body.error ?? `relayer failed with ${res.status}`);
      }

      const body = (await res.json()) as {
        ok: boolean;
        manifestCid: string;
        txHash: string;
        block: number;
      };

      setRegisterState({ kind: 'success', block: body.block, txHash: body.txHash });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      setRegisterState({ kind: 'error', message });
    }
  };

  const thumb = streamThumbnailUrl(live.recordingVideoUid, { height: 240 });
  const isLive = live.state === 'connected';

  return (
    <article className="flex flex-col gap-3 rounded-md bg-surface-container p-4">
      {/* Top row: thumbnail · title block · primary actions */}
      <div className="flex items-start gap-3">
        {/* Thumbnail (or placeholder when no recording yet) */}
        <Link
          href={`/live/${live.uid}`}
          aria-label="assistir"
          className="group relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-high"
        >
          {thumb ? (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-opacity group-hover:opacity-80"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-on-surface/30">
              <Radio className="size-5" aria-hidden />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-surface-lowest/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-5 text-on-surface" aria-hidden />
          </span>
          {isLive && (
            <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-label text-[8px] text-on-primary lowercase">
              <span className="size-1 animate-pulse rounded-full bg-on-primary" />
              live
            </span>
          )}
        </Link>

        {/* Title block */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {editing ? (
            <form
              action={(formData) => {
                formData.set('uid', live.uid);
                formData.set('name', draft);
                void renameLiveAction(formData);
                setEditing(false);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                name="name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={120}
                className="min-w-0 flex-1 rounded-md bg-surface-high px-2.5 py-1.5 font-body text-on-surface text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              />
              <button
                type="submit"
                aria-label="salvar"
                className="rounded-full p-1.5 text-primary-dim transition-colors hover:bg-surface-high hover:text-primary"
              >
                <Check className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="cancelar"
                onClick={() => {
                  setDraft(live.name);
                  setEditing(false);
                }}
                className="rounded-full p-1.5 text-on-surface/50 transition-colors hover:bg-surface-high hover:text-on-surface"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate font-headline font-medium text-on-surface text-sm lowercase">
                {live.name || 'sem título'}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="renomear"
                className="text-on-surface/40 transition-colors hover:text-on-surface"
              >
                <Pencil className="size-3" aria-hidden />
              </button>
            </div>
          )}

          {/* Permanence strip + meta */}
          <div className="flex flex-wrap items-center gap-2">
            <PermanenceStrip layers={isLive ? ['providers', 'edge'] : ['edge']} width={64} />
            <p className="font-mono text-[10px] text-on-surface/40">
              {createdLabel} · {live.uid.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Right-aligned secondary actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setObsPanelOpen((v) => !v)}
            className={`rounded-full p-2 transition-colors hover:bg-surface-high ${
              obsPanelOpen ? 'text-primary' : 'text-on-surface/60 hover:text-on-surface'
            }`}
            aria-label="transmitir via obs"
            aria-expanded={obsPanelOpen}
            title="transmitir via obs / ferramenta externa"
          >
            <Tv2 className="size-4" aria-hidden />
          </button>
          <Link
            href={`/live/${live.uid}`}
            className="rounded-full p-2 text-on-surface/60 transition-colors hover:bg-surface-high hover:text-on-surface"
            aria-label="assistir"
            title="assistir"
          >
            <Play className="size-4" aria-hidden />
          </Link>
          <form action={deleteLiveAction} onSubmit={confirmAndDelete}>
            <input type="hidden" name="uid" value={live.uid} />
            <button
              type="submit"
              aria-label="apagar"
              title="apagar"
              className="rounded-full p-2 text-on-surface/40 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>

      {obsPanelOpen ? <ObsBroadcastPanel liveUid={live.uid} /> : null}

      {/* On-chain row: terminal-style anchor chip OR register CTAs */}
      {registerState.kind === 'success' && (
        <div className="flex items-center gap-2 rounded-md bg-surface-lowest px-3 py-2 font-mono text-[10px] text-on-surface/60">
          <Anchor className="size-3 shrink-0 text-primary-dim" aria-hidden />
          <span className="lowercase">ancorado · bloco</span>
          <span className="text-on-surface">{registerState.block}</span>
          <span className="text-on-surface/30">·</span>
          <span className="truncate">{shortAddress(registerState.txHash, 6, 4)}</span>
        </div>
      )}

      {registerState.kind === 'running' && (
        <div className="flex items-center gap-2 rounded-md bg-surface-lowest px-3 py-2 font-mono text-[10px] text-on-surface/60">
          <Loader2 className="size-3 shrink-0 animate-spin text-primary-dim" aria-hidden />
          <span className="lowercase">
            {registerState.step === 'nonce' && 'lendo nonce on-chain…'}
            {registerState.step === 'sign' && 'assinando manifesto eip-712…'}
            {registerState.step === 'send' && 'enviando transação…'}
            {registerState.step === 'confirm' && 'aguardando confirmação…'}
            {registerState.step === 'persist' && 'gravando meta…'}
          </span>
        </div>
      )}

      {registerState.kind === 'error' && (
        <div
          className="flex items-center gap-2 rounded-md bg-surface-lowest px-3 py-2 font-mono text-[10px] text-danger"
          title={registerState.message}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-danger" />
          <span className="lowercase">falha ao registrar — toque pra tentar de novo</span>
        </div>
      )}

      {canRegister && (
        <div className="flex flex-wrap items-center gap-2">
          {sponsorship.kind === 'available' && (
            <button
              type="button"
              onClick={handleRegisterSponsored}
              disabled={!walletsReady}
              title="aevia paga o gás desta vez"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 font-label font-medium text-on-primary text-xs lowercase transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Anchor className="size-3.5" aria-hidden />
              registrar on-chain · grátis
            </button>
          )}
          <button
            type="button"
            onClick={handleRegister}
            disabled={!walletsReady}
            title={
              sponsorship.kind === 'exhausted'
                ? 'patrocínio esgotado — registre pagando o próprio gás'
                : 'registre pagando o próprio gás'
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-high px-3 py-2 font-label font-medium text-on-surface/80 text-xs lowercase transition-colors hover:bg-surface-highest hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Anchor className="size-3.5" aria-hidden />
            pagar eu mesmo
          </button>
        </div>
      )}
    </article>
  );
}
