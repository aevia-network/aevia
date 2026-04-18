'use client';

import { BottomNav } from '@/components/bottom-nav';
import { cn } from '@/lib/utils';
import { PermanenceStrip, VigilChip } from '@aevia/ui';
import { ArrowLeft, Lock, Menu, Search, Share2, Shield, Terminal } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Mirrors Stitch screen `7a55f08eb83343158ba55e6394c3ef67` ("Aevia — Canal:
 * Portas Abertas"). Sprint 2 scope:
 *
 * - REAL: creator address + DID, per-live meta (thumbnail, on-chain
 *   manifest CID + register block, duration, live state), Basescan link.
 * - MOCK with honest framing: sovereignty receipts (peer count,
 *   mesh persistence %, credits received) — all require Sprint 3
 *   contracts + Provider Node telemetry.
 * - Placeholder: follow/support actions, bio, verification date.
 *
 * Accessible without auth (public channel). Bottom nav renders regardless;
 * the `/wallet` slot points to login on unauth paths by default.
 */
export interface CreatorLive {
  uid: string;
  name: string;
  state: 'connected' | 'disconnected' | 'unknown';
  createdISO: string;
  /** CF Stream thumbnail URL (or null if the live has no recording yet). */
  thumbnailUrl: string | null;
  /** VOD duration in seconds (null when still live or recording not processed). */
  durationSeconds: number | null;
  manifestCid?: string;
  registerBlock?: number;
  registerTxHash?: string;
}

export interface CreatorScreenProps {
  /** 0x-prefixed 20-byte address (lowercased). The slug in the URL. */
  address: `0x${string}`;
  /** `did:pkh:eip155:<chainId>:<address>`. */
  did: string;
  /** Short display like `0xabcd…9f4`. */
  shortAddress: string;
  /** Derived display name — `meta.creator` of the first live, or short address. */
  displayName: string;
  /** Most recent on-chain register block across all lives (for manifesto terminal). */
  lastRegisterBlock: number | null;
  /** Lives authored by this creator, newest first. */
  lives: CreatorLive[];
  /** Signed-in viewer's own address, if any — hides follow/support for self-visit. */
  viewerAddress: `0x${string}` | null;
}

export function CreatorScreen({
  address,
  did,
  shortAddress,
  displayName,
  lastRegisterBlock,
  lives,
  viewerAddress,
}: CreatorScreenProps) {
  const isSelf = viewerAddress?.toLowerCase() === address.toLowerCase();

  const liveLives = lives.filter((l) => l.state === 'connected');
  const anchoredCount = lives.filter((l) => l.manifestCid).length;

  // Sovereignty receipts — three cards. Sprint 2 fills them with counts
  // derived from Cloudflare Stream meta; Sprint 3 replaces the mocks with
  // Provider Node telemetry + on-chain credit flows.
  const receipts = {
    livesPublished: lives.length,
    onChainAnchored: anchoredCount,
    // Placeholder — would be `creditsReceivedLast30d` from PersistencePool.
    creditsLast30d: 0,
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/creator/${address}`;
    const shareData = { title: `${displayName} · aevia`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled — fall back to clipboard
      }
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <div className="min-h-screen pb-28">
      {/* TopAppBar — glass backdrop */}
      <header className="fixed top-0 right-0 left-0 z-50 flex h-14 items-center justify-between bg-[#1C2027]/65 px-4 backdrop-blur-[20px]">
        <div className="flex items-center gap-4">
          <button type="button" aria-label="menu" className="text-on-surface hover:opacity-80">
            <Menu className="size-6" aria-hidden />
          </button>
          <Link href="/" className="font-headline font-semibold text-[16px] text-primary lowercase">
            aevia
          </Link>
        </div>
        <button type="button" aria-label="buscar" className="text-on-surface hover:opacity-80">
          <Search className="size-6" aria-hidden />
        </button>
      </header>

      <main className="mx-auto max-w-2xl">
        {/* Banner */}
        <section className="relative h-[220px] w-full overflow-hidden">
          <Image
            src="/hero/creator-default.jpg"
            alt="estante editorial — banner padrão do canal"
            fill
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover grayscale-[0.2]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20" />

          {/* Back + Share overlays */}
          <div className="absolute top-16 right-4 left-4 z-10 flex justify-between">
            <Link
              href="/dashboard"
              aria-label="voltar"
              className="rounded-lg bg-surface/60 p-2 text-on-surface backdrop-blur-md transition-transform active:scale-95"
            >
              <ArrowLeft className="size-6" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={handleShare}
              aria-label="compartilhar canal"
              className="rounded-lg bg-surface/60 p-2 text-on-surface backdrop-blur-md transition-transform active:scale-95"
            >
              <Share2 className="size-6" aria-hidden />
            </button>
          </div>

          {/* Overlapping avatar */}
          <div className="-bottom-6 absolute left-6 flex items-end">
            <div className="relative">
              <Avatar name={displayName} />
              <div className="absolute right-1 bottom-1 rounded-full border-2 border-surface bg-surface-container p-1">
                <VigilChip />
              </div>
            </div>
          </div>
        </section>

        {/* Identity block */}
        <section className="-mt-6 relative z-10 rounded-t-xl bg-surface-container px-6 pt-10 pb-6">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="font-headline font-semibold text-on-surface text-xl lowercase">
              {displayName}
            </h2>
            <VigilChip />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3 font-body text-on-surface-variant text-sm">
            <span className="font-mono text-primary-dim">{shortAddress}</span>
            <span className="flex items-center gap-1 opacity-60">
              <Lock className="size-3.5" aria-hidden />
              criador verificado via privy · did:pkh
            </span>
          </div>
          <p className="max-w-prose font-body text-on-surface/80 text-sm leading-relaxed">
            canal on-chain em aevia.video. cada transmissão assina um manifesto em base sepolia —
            ninguém pode apagar, ninguém pode renomear.
          </p>
        </section>

        {/* Manifesto terminal */}
        <section className="bg-surface-lowest px-6 py-4">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-lg border border-white/5 bg-black/40 p-3">
            <Terminal className="size-3.5 text-primary-dim" aria-hidden />
            <span className="font-mono text-[10px] text-on-surface/40 uppercase tracking-widest">
              {did}
            </span>
            <span className="text-on-surface/20">•</span>
            <span className="font-mono text-[10px] text-on-surface/40 uppercase tracking-widest">
              {lastRegisterBlock !== null
                ? `último manifesto em bloco ${lastRegisterBlock}`
                : 'nenhum manifesto on-chain ainda'}
            </span>
            <span className="text-on-surface/20">•</span>
            <a
              href={`https://sepolia.basescan.org/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-primary hover:underline"
            >
              verificar →
            </a>
          </div>
        </section>

        {/* Sovereignty receipts */}
        <section className="grid grid-cols-3 gap-3 px-6 py-6">
          <ReceiptCard
            value={String(receipts.livesPublished)}
            label="transmissões publicadas"
            tone="tertiary"
          />
          <ReceiptCard
            value={String(receipts.onChainAnchored)}
            label="ancoradas on-chain"
            tone="primary"
          />
          <ReceiptCard
            value={String(receipts.creditsLast30d)}
            label="créditos recebidos 30d · em breve"
            tone="secondary"
          />
        </section>

        {/* Action row */}
        <section className="flex items-center gap-3 px-6 pb-6">
          <button
            type="button"
            disabled={isSelf}
            className="flex-1 rounded-lg bg-primary py-3 text-center font-label font-medium text-on-primary transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSelf ? 'este é o seu canal' : 'seguir'}
          </button>
          <button
            type="button"
            disabled
            className="flex-1 rounded-lg border border-secondary py-3 text-center font-label font-medium text-secondary opacity-50"
          >
            apoiar
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="compartilhar"
            className="p-3 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Share2 className="size-6" aria-hidden />
          </button>
        </section>

        {/* Tab strip */}
        <nav className="no-scrollbar sticky top-14 z-40 flex overflow-x-auto border-surface-container-high border-b bg-surface px-6">
          <span className="mr-8 flex items-center gap-2 whitespace-nowrap border-primary border-b-2 py-4 font-label text-primary text-sm">
            todas as transmissões
          </span>
          <span className="mr-8 flex items-center gap-2 whitespace-nowrap py-4 font-label text-on-surface/50 text-sm">
            ao vivo agora
            {liveLives.length > 0 && (
              <span className="flex size-2 animate-pulse rounded-full bg-primary-dim" />
            )}
          </span>
          <span className="mr-8 whitespace-nowrap py-4 font-label text-on-surface/50 text-sm">
            clips
          </span>
          <span className="whitespace-nowrap py-4 font-label text-on-surface/50 text-sm">
            sobre
          </span>
        </nav>

        {/* Video grid */}
        {lives.length === 0 ? (
          <section className="px-6 py-20 text-center">
            <p className="font-label text-on-surface/40 text-sm lowercase">
              este canal ainda não publicou nenhuma transmissão.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-4 p-6">
            {lives.map((live) => (
              <VideoCard key={live.uid} live={live} />
            ))}
          </section>
        )}

        {/* Editorial footer */}
        <footer className="mb-12 flex flex-col items-center gap-6 border-surface-container border-t px-6 py-12">
          <div className="flex flex-col items-center gap-2">
            <a
              href={`https://sepolia.basescan.org/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-label text-primary text-xs hover:underline"
            >
              <Shield className="size-3.5" aria-hidden />
              link de verificação on-chain
            </a>
            <a
              href="mailto:contact@aevia.network?subject=Violação%20de%20conduta"
              className="font-label text-danger text-xs hover:underline"
            >
              denunciar violação de conduta
            </a>
          </div>
          <div className="flex items-center gap-2 opacity-20">
            <span className="font-mono text-[10px] lowercase">aevia sovereignty protocol v0.1</span>
          </div>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components

function Avatar({ name }: { name: string }) {
  // Derive initials from display name or short address. Two letters max.
  const initials = name
    .replace(/^0x/, '')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <div className="flex size-[96px] items-center justify-center rounded-full border-4 border-surface bg-gradient-to-br from-primary-container via-primary to-primary-dim font-headline font-semibold text-on-primary text-2xl">
      {initials || '··'}
    </div>
  );
}

function ReceiptCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'primary' | 'secondary' | 'tertiary';
}) {
  const toneClass = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
  }[tone];
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-container-high p-4">
      <span className={cn('font-headline font-semibold text-lg tracking-tight', toneClass)}>
        {value}
      </span>
      <span className="font-label text-[10px] text-on-surface/50 leading-tight">{label}</span>
    </div>
  );
}

function VideoCard({ live }: { live: CreatorLive }) {
  const isLive = live.state === 'connected';
  const durationLabel = formatDuration(live.durationSeconds);

  return (
    <Link
      href={`/live/${live.uid}`}
      className="group flex flex-col gap-3"
      aria-label={`abrir transmissão ${live.name}`}
    >
      <div
        className={cn(
          'relative aspect-video overflow-hidden rounded-lg bg-surface-container',
          isLive && 'border-2 border-primary-dim/30',
        )}
      >
        {live.thumbnailUrl ? (
          <img
            src={live.thumbnailUrl}
            alt={live.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-container-high">
            <span className="font-label text-on-surface/30 text-xs lowercase">sem thumbnail</span>
          </div>
        )}

        {isLive && (
          <span className="absolute top-2 left-2 rounded-full bg-primary-container px-2 py-0.5 font-label font-bold text-[8px] text-on-primary-container uppercase tracking-wider">
            ao vivo
          </span>
        )}

        {durationLabel && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {durationLabel}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PermanenceStrip
          layers={['edge']}
          width={60}
          aria-label="persistência atual: cloudflare stream · mesh e provider nodes em breve"
        />
        <h3 className="line-clamp-2 font-headline text-on-surface text-sm leading-tight lowercase">
          {live.name}
        </h3>
        <div className="flex flex-col gap-0.5 font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">
          {live.manifestCid ? (
            <span>ancorado em bloco {live.registerBlock}</span>
          ) : (
            <span>aguardando âncora on-chain</span>
          )}
          <span>
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(live.createdISO))}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}
