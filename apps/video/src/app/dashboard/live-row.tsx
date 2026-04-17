'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AEVIA_CHAIN_ID_MAINNET,
  AEVIA_CHAIN_ID_SEPOLIA,
  CONTENT_REGISTRY_ABI,
  buildRegisterContentTypedData,
  contentRegistryAddress,
  shortAddress,
  sprint2PlaceholderManifestCid,
  useSendTransaction,
  useSignTypedData,
  useWallets,
} from '@aevia/auth/client';
import { PermanenceStrip } from '@aevia/ui';
import { Anchor, Check, Loader2, Pencil, Radio, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { http, createPublicClient, encodeFunctionData, keccak256 as viemKeccak256 } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { deleteLiveAction, renameLiveAction } from '../actions';

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

function appChain() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : baseSepolia;
}

function appChainId(): number {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production'
    ? AEVIA_CHAIN_ID_MAINNET
    : AEVIA_CHAIN_ID_SEPOLIA;
}

export function LiveRow({ live }: { live: LiveRowData }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(live.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const createdLabel = new Date(live.created).toLocaleString('pt-BR');

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

      // Ensure the wallet is on the right chain before signing / sending.
      // `switchChain` is idempotent — safe to call when already on-target.
      if (wallet.chainId !== `eip155:${chainId}`) {
        await wallet.switchChain(chainId);
      }

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

  const registerChip = (() => {
    if (registerState.kind === 'success') {
      return (
        <Badge variant="outline" className="font-label text-[10px] lowercase tracking-wide">
          <Anchor className="mr-1 size-3" />
          bloco {registerState.block} · {shortAddress(registerState.txHash, 6, 4)}
        </Badge>
      );
    }
    if (registerState.kind === 'error') {
      return (
        <Badge
          variant="outline"
          className="font-label text-[10px] lowercase tracking-wide text-danger"
          title={registerState.message}
        >
          falha ao registrar
        </Badge>
      );
    }
    return null;
  })();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {live.state === 'connected' ? (
            <Badge variant="live" className="font-label tracking-wide">
              <Radio className="mr-1 size-3" /> ao vivo
            </Badge>
          ) : (
            <Badge variant="outline" className="font-label tracking-wide">
              encerrada
            </Badge>
          )}
          <div className="min-w-0 flex-1">
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
                  className="min-w-0 flex-1 rounded bg-surface-high px-2 py-1 font-label text-sm text-on-surface focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  aria-label="salvar"
                  className="px-2"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="cancelar"
                  className="px-2"
                  onClick={() => {
                    setDraft(live.name);
                    setEditing(false);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-sm">{live.name || 'sem título'}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="renomear"
                  className="text-on-surface-variant transition-colors hover:text-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PermanenceStrip
                layers={live.state === 'connected' ? ['providers', 'edge'] : ['edge']}
                width={80}
              />
              <p className="font-label text-[10px] text-on-surface-variant">
                {createdLabel} · {live.uid.slice(0, 8)}
              </p>
              {registerChip}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canRegister && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="lowercase"
              onClick={handleRegister}
              disabled={!walletsReady}
            >
              <Anchor className="size-3.5" />
              registrar on-chain
            </Button>
          )}
          {registerState.kind === 'running' && (
            <Badge variant="outline" className="font-label text-[10px] lowercase tracking-wide">
              <Loader2 className="mr-1 size-3 animate-spin" />
              {registerState.step === 'nonce' && 'lendo nonce'}
              {registerState.step === 'sign' && 'assinando'}
              {registerState.step === 'send' && 'enviando'}
              {registerState.step === 'confirm' && 'confirmando'}
              {registerState.step === 'persist' && 'gravando meta'}
            </Badge>
          )}
          <Button asChild variant="outline" size="sm" className="lowercase">
            <Link href={`/live/${live.uid}`}>assistir</Link>
          </Button>
          <form action={deleteLiveAction} onSubmit={confirmAndDelete}>
            <input type="hidden" name="uid" value={live.uid} />
            <Button type="submit" variant="destructive" size="sm" className="lowercase">
              <Trash2 className="size-3.5" />
              apagar
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
