import { BottomNav } from '@/components/bottom-nav';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { shortAddress } from '@aevia/auth';
import { MeshDot } from '@aevia/ui';
import { ArrowLeft, ArrowRight, Search, Users } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';
export const revalidate = 0;

interface CreatorCard {
  address: `0x${string}`;
  displayName: string;
  livesCount: number;
  hasLiveNow: boolean;
  /** ISO timestamp of the most recent live for this creator (any state). */
  lastLiveAtISO: string | null;
  /** Number of lives anchored on-chain via ContentRegistry. */
  anchoredCount: number;
}

/**
 * /creators — dedicated creators index. Replaces the anchor-hack the bottom
 * nav previously used (`/discover#creators`) with a real destination, so the
 * "criadores" slot has a coherent surface distinct from "descobrir" (which
 * focuses on lives now).
 *
 * Sprint 2 split:
 * - REAL: creators derived by grouping `listLiveInputs()` by `meta.creatorAddress`.
 *   Anchored count derived from `meta.manifestCid` presence.
 * - HONEST GAP: follower counts, "verified provider node" chips, handle
 *   registry — all wait on Sprint 3+.
 */
export default async function CreatorsPage() {
  const all = await listLiveInputs().catch(() => []);

  const byAddress = new Map<
    `0x${string}`,
    {
      displayName: string;
      livesCount: number;
      hasLiveNow: boolean;
      lastLiveAtISO: string | null;
      anchoredCount: number;
    }
  >();

  for (const l of all) {
    const raw = (l.meta?.creatorAddress ?? l.defaultCreator ?? '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(raw)) continue;
    const address = raw as `0x${string}`;
    const displayName = l.meta?.creator ?? shortAddress(address);
    const isLive = l.status?.current?.state === 'connected';
    const isAnchored = Boolean(l.meta?.manifestCid);

    const existing = byAddress.get(address);
    if (existing) {
      existing.livesCount += 1;
      existing.hasLiveNow = existing.hasLiveNow || isLive;
      existing.anchoredCount += isAnchored ? 1 : 0;
      if (!existing.lastLiveAtISO || l.created > existing.lastLiveAtISO) {
        existing.lastLiveAtISO = l.created;
      }
    } else {
      byAddress.set(address, {
        displayName,
        livesCount: 1,
        hasLiveNow: isLive,
        lastLiveAtISO: l.created,
        anchoredCount: isAnchored ? 1 : 0,
      });
    }
  }

  const creators: CreatorCard[] = [...byAddress.entries()]
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => {
      // 1) Live now creators first.
      if (a.hasLiveNow !== b.hasLiveNow) return a.hasLiveNow ? -1 : 1;
      // 2) Then by lives count desc (most prolific surfaces first).
      if (a.livesCount !== b.livesCount) return b.livesCount - a.livesCount;
      // 3) Tiebreaker: most recently active. ISO timestamps sort
      //    lexicographically so a string compare suffices; nulls sink last.
      const aTs = a.lastLiveAtISO ?? '';
      const bTs = b.lastLiveAtISO ?? '';
      return bTs.localeCompare(aTs);
    });

  const liveNowCount = creators.filter((c) => c.hasLiveNow).length;
  const anchoredTotal = creators.reduce((sum, c) => sum + c.anchoredCount, 0);

  return (
    <div className="min-h-screen pb-28">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-6 pb-10">
        <Hero
          totalCreators={creators.length}
          liveNowCount={liveNowCount}
          anchoredTotal={anchoredTotal}
        />

        <CreatorsList creators={creators} />
      </main>

      <BottomNav />
    </div>
  );
}

// ---- Top chrome (harmonized) ---------------------------------------------

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
            criadores
          </h1>
        </div>
        <button
          type="button"
          aria-label="buscar criador"
          className="rounded-full p-2 text-on-surface/60 transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Search className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}

// ---- Hero ----------------------------------------------------------------

function Hero({
  totalCreators,
  liveNowCount,
  anchoredTotal,
}: {
  totalCreators: number;
  liveNowCount: number;
  anchoredTotal: number;
}) {
  return (
    <section aria-labelledby="creators-hero" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
          índice de pessoas
        </p>
        <MeshDot />
      </div>
      <h2
        id="creators-hero"
        className="font-headline font-semibold text-[28px] text-on-surface leading-[1.1] lowercase"
      >
        quem permanece — sem algoritmo intermediando
      </h2>
      <p className="font-body text-on-surface/60 text-sm">
        cronológico, agrupado por carteira. ranking começa quando o conselho editorial e o score de
        risco entrarem (sprint 3+).
      </p>

      <dl className="mt-2 grid grid-cols-3 gap-3">
        <KpiBox label="ao vivo" value={String(liveNowCount)} accent="primary" />
        <KpiBox label="criadores" value={String(totalCreators)} />
        <KpiBox label="ancoradas" value={String(anchoredTotal)} accent="secondary" />
      </dl>
    </section>
  );
}

function KpiBox({
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
    <div className="flex flex-col gap-1.5 rounded-md bg-surface-container p-4">
      <dt className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
        {label}
      </dt>
      <dd
        className={`font-headline font-semibold text-[24px] leading-none lowercase ${valueClass}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ---- List ----------------------------------------------------------------

function CreatorsList({ creators }: { creators: CreatorCard[] }) {
  if (creators.length === 0) {
    return (
      <section className="rounded-md bg-surface-container px-5 py-12 text-center">
        <p className="font-body text-on-surface/70 text-sm lowercase">
          ainda não há criadores indexados. quem transmitir aparece aqui — sem algoritmo,
          cronologicamente.
        </p>
        <Link
          href="/live/new"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-label font-medium text-on-primary text-xs lowercase transition-opacity hover:opacity-90"
        >
          começar transmissão
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="creators-list" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3
          id="creators-list"
          className="font-headline font-semibold text-lg text-on-surface lowercase"
        >
          todos os criadores
        </h3>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
          {creators.length} {creators.length === 1 ? 'pessoa' : 'pessoas'}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {creators.map((c) => (
          <li key={c.address}>
            <CreatorRow creator={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreatorRow({ creator }: { creator: CreatorCard }) {
  const initial = creator.displayName.trim().charAt(0).toLowerCase() || '·';
  const livesLabel =
    creator.livesCount === 1 ? '1 transmissão' : `${creator.livesCount} transmissões`;
  const anchoredLabel = creator.anchoredCount > 0 ? `· ${creator.anchoredCount} on-chain` : '';

  return (
    <Link
      href={`/creator/${creator.address}`}
      className="group flex items-center gap-3 rounded-md bg-surface-container p-3 transition-colors hover:bg-surface-high"
    >
      <span
        aria-hidden
        className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-high font-headline font-semibold text-on-surface text-sm lowercase"
      >
        {initial}
        {creator.hasLiveNow && (
          <span className="-bottom-0.5 -right-0.5 absolute inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-label text-[7px] text-on-primary lowercase">
            <span className="size-1 animate-pulse rounded-full bg-on-primary" />
            live
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-headline font-medium text-on-surface text-sm lowercase">
          {creator.displayName}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-on-surface/50">
          <Users className="size-3" aria-hidden />
          {livesLabel} {anchoredLabel}
        </span>
        <span className="font-mono text-[9px] text-on-surface/30">
          {shortAddress(creator.address)}
        </span>
      </div>

      <ArrowRight
        className="size-4 shrink-0 text-on-surface/30 transition-colors group-hover:text-on-surface/70"
        aria-hidden
      />
    </Link>
  );
}
