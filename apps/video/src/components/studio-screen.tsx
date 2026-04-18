'use client';

import type { LiveRowData } from '@/app/dashboard/live-row';
import { LiveRow } from '@/app/dashboard/live-row';
import { BottomNav } from '@/components/bottom-nav';
import { LogoutButton } from '@/components/logout-button';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Database,
  Radio,
  ScrollText,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

/**
 * Creator studio at /dashboard. No Stitch canonical exists for this surface;
 * applies the harmonized DS sealed across `/feed`, `/wallet`, `/creator`,
 * `/trust`: tonal layering (no borders — the DID terminal footer is the only
 * exception, matching the wallet pattern), Sora editorial titles, lowercase
 * pt-BR, signature components where they compose, and honest mock framing for
 * non-shipped receipts (PersistencePool + uptime aggregator land Sprint 3).
 *
 * Sprint 2 split:
 * - REAL: name, DID, address, transmissions list (LiveRow keeps the EIP-712
 *   sponsored-relayer register flow, rename + delete actions).
 * - MOCK with honest framing: persistence pool 30d, hours on air. Folded into
 *   a single "economia · em breve" card so mocks never share visual weight
 *   with the real KPIs above them.
 */

export interface StudioViewer {
  displayName: string;
  shortAddress: string;
  did: string;
  /** e.g. "privy", "google", "email" — already lowercase from session. */
  loginMethod: string;
}

export interface StudioScreenProps {
  viewer: StudioViewer;
  lives: LiveRowData[];
}

export function StudioScreen({ viewer, lives }: StudioScreenProps) {
  const publishedCount = lives.length;
  const anchoredCount = lives.filter((l) => l.manifestCid).length;
  const liveNowCount = lives.filter((l) => l.state === 'connected').length;

  return (
    <div className="min-h-screen pb-28">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-6 pb-10">
        <IdentityHero viewer={viewer} />
        <WalletPreviewCard viewer={viewer} />
        <PrimaryCta />
        <KpiRow published={publishedCount} anchored={anchoredCount} liveNow={liveNowCount} />
        <TransmissionsSection lives={lives} />
        <EconomyMockNote />
        <SecondaryLinks />
        <DidTerminal viewer={viewer} />
      </main>

      <BottomNav />
    </div>
  );
}

// ---- Top chrome (harmonized 56px, glass over surface_container_low) ------

function TopChrome() {
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-surface-container-low/90 px-4 backdrop-blur-[12px]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            aria-label="voltar ao feed"
            className="rounded-full p-2 text-on-surface/70 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="font-headline font-semibold text-base text-on-surface lowercase">
            estúdio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <WalletChip />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

// Mirror the credits chip in `/feed` chrome — same href, same icon, same
// honest "em breve" suffix until CreditToken contract ships in sprint 3.
function WalletChip() {
  return (
    <Link
      href="/wallet"
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface text-xs lowercase transition-colors hover:bg-surface-high"
    >
      <Wallet className="size-4 text-secondary" aria-hidden />
      20 créditos · em breve
    </Link>
  );
}

// ---- Identity hero (editorial, no inline chips) --------------------------

function IdentityHero({ viewer }: { viewer: StudioViewer }) {
  return (
    <section aria-labelledby="identity" className="flex flex-col gap-2">
      <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
        seu espaço editorial
      </p>
      <h2
        id="identity"
        className="font-headline font-semibold text-[28px] text-on-surface leading-[1.1] lowercase break-words sm:text-[32px]"
      >
        olá, {viewer.displayName}
      </h2>
      <p className="font-body text-on-surface/60 text-sm">
        cada transmissão fica registrada na rede aevia. você decide quando ancorar on-chain.
      </p>
    </section>
  );
}

// ---- Wallet preview card (prominent sub-route of perfil) ----------------

// Replaces the previous tiny "carteira" chip in `<QuickLinks>` with a
// full-width card that gives the wallet visible weight on the studio.
// Aligns with the Stitch wallet canonical contract — wallet is the
// economic surface of perfil, not a peer of pedagogical links.
function WalletPreviewCard({ viewer }: { viewer: StudioViewer }) {
  return (
    <Link
      href="/wallet"
      aria-label="abrir carteira"
      className="group flex items-center gap-4 rounded-md bg-surface-container p-4 transition-colors hover:bg-surface-high"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary/15">
        <Wallet className="size-6 text-secondary" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-headline font-semibold text-base text-on-surface lowercase">
            carteira
          </span>
          <span className="font-label text-[10px] text-on-surface/40 uppercase tracking-wider">
            em breve
          </span>
        </div>
        <span className="font-headline font-semibold text-[22px] text-secondary leading-none lowercase">
          20 créditos
        </span>
        <span className="truncate font-mono text-[10px] text-on-surface/40">
          {viewer.shortAddress} · sepolia
        </span>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-on-surface/30 transition-colors group-hover:text-on-surface/70"
        aria-hidden
      />
    </Link>
  );
}

// ---- Secondary links (pedagogy footer) ----------------------------------

function SecondaryLinks() {
  return (
    <nav aria-label="links de pedagogia" className="flex flex-wrap gap-2">
      <Link
        href="/trust"
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface/70 text-xs lowercase transition-colors hover:bg-surface-high hover:text-on-surface"
      >
        <ScrollText className="size-3.5 text-tertiary" aria-hidden />
        transparência
      </Link>
      <Link
        href="/aup"
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-on-surface/70 text-xs lowercase transition-colors hover:bg-surface-high hover:text-on-surface"
      >
        política de uso
      </Link>
    </nav>
  );
}

// ---- Primary CTA (single Verdigris filled, not the double-bg gimmick) ----

function PrimaryCta() {
  return (
    <Link
      href="/live/new"
      className="group inline-flex items-center justify-between gap-4 rounded-md bg-primary p-5 transition-opacity hover:opacity-95 active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-dim">
          <Radio className="size-5 text-on-primary" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="font-headline font-semibold text-base text-on-primary lowercase">
            começar transmissão
          </span>
          <span className="font-label text-[11px] text-on-primary/70 lowercase">
            baixa latência · vod automático · link compartilhável
          </span>
        </div>
      </div>
      <ArrowRight
        className="size-5 text-on-primary/80 transition-colors group-hover:text-on-primary"
        aria-hidden
      />
    </Link>
  );
}

// ---- KPI row (3 real numbers, no mock dots) ------------------------------

function KpiRow({
  published,
  anchored,
  liveNow,
}: {
  published: number;
  anchored: number;
  liveNow: number;
}) {
  return (
    <section aria-labelledby="kpis" className="flex flex-col gap-3">
      <h3 id="kpis" className="font-headline font-semibold text-lg text-on-surface lowercase">
        seus números
      </h3>
      <dl className="grid grid-cols-3 gap-3">
        <Kpi label="ao vivo" value={String(liveNow)} accent="primary" />
        <Kpi label="transmissões" value={String(published)} />
        <Kpi label="ancoradas" value={String(anchored)} accent="secondary" />
      </dl>
    </section>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'primary' | 'secondary';
}) {
  const valueClass =
    accent === 'primary'
      ? 'text-primary-dim'
      : accent === 'secondary'
        ? 'text-secondary'
        : 'text-on-surface';
  return (
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-md bg-surface-container p-4">
      <dt className="truncate font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
        {label}
      </dt>
      <dd
        className={`font-headline font-semibold text-[28px] leading-none lowercase ${valueClass}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ---- Transmissions section -----------------------------------------------

function TransmissionsSection({ lives }: { lives: LiveRowData[] }) {
  return (
    <section aria-labelledby="transmissions" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3
          id="transmissions"
          className="font-headline font-semibold text-lg text-on-surface lowercase"
        >
          suas transmissões
        </h3>
        {lives.length > 0 && (
          <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
            {lives.length} {lives.length === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>

      {lives.length === 0 ? (
        <div className="rounded-md bg-surface-container px-5 py-12 text-center">
          <p className="font-body text-on-surface/70 text-sm lowercase">
            nenhuma transmissão ainda. a primeira aparecerá aqui — você poderá revê-la, renomeá-la,
            ancorá-la on-chain ou apagá-la.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lives.map((l) => (
            <LiveRow key={l.uid} live={l} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Economy mock note (honest framing) ----------------------------------

function EconomyMockNote() {
  return (
    <section aria-label="economia" className="flex flex-col gap-3 rounded-md bg-surface-dim p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          economia · em breve
        </span>
        <span className="font-label text-[10px] text-secondary lowercase">sprint 3</span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[10px] text-on-surface/40 uppercase tracking-wider">
            persistence pool · 30d
          </dt>
          <dd className="font-headline font-semibold text-[22px] text-on-surface/40 leading-none lowercase">
            0 créditos
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[10px] text-on-surface/40 uppercase tracking-wider">
            horas ao ar · 30d
          </dt>
          <dd className="font-headline font-semibold text-[22px] text-on-surface/40 leading-none">
            —
          </dd>
        </div>
      </dl>
      <p className="font-body text-[11px] text-on-surface/40 leading-relaxed">
        os contratos persistencepool + credittoken sobem no sprint 3. até lá, esses números são
        placeholders honestos.
      </p>
    </section>
  );
}

// ---- DID terminal footer (matches wallet exactly) ------------------------

function DidTerminal({ viewer }: { viewer: StudioViewer }) {
  return (
    <footer className="space-y-4 rounded-lg border border-surface-container-high/30 bg-surface-lowest p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-tertiary" aria-hidden />
          <span className="font-label text-[10px] text-tertiary uppercase tracking-widest">
            identity terminal
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-1.5 animate-pulse rounded-full bg-primary" />
          <span className="font-mono text-[9px] text-primary">online</span>
        </div>
      </div>

      <div className="space-y-1">
        <span className="font-mono text-[9px] text-on-surface/30 lowercase">did</span>
        <p className="break-all font-mono text-[11px] text-on-surface/70 leading-relaxed">
          {viewer.did}
        </p>
      </div>

      <div className="flex items-center justify-between border-surface-container-high/30 border-t pt-3">
        <span className="font-mono text-[9px] text-on-surface/30 lowercase">conta</span>
        <span className="font-mono text-[10px] text-on-surface/60 lowercase">
          {viewer.loginMethod}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-on-surface/30 lowercase">address</span>
        <span className="font-mono text-[10px] text-on-surface/60">{viewer.shortAddress}</span>
      </div>
    </footer>
  );
}
