import { BottomNav } from '@/components/bottom-nav';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { streamThumbnailUrl } from '@/lib/cloudflare/stream-urls';
import { shortAddress } from '@aevia/auth';
import { LiveTile, MeshDot } from '@aevia/ui';
import { ArrowLeft, ArrowRight, Bell, Users } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';
export const revalidate = 0;

interface LiveCard {
  uid: string;
  title: string;
  creatorDisplayName: string;
  creatorAddress: `0x${string}` | null;
  thumbnailUrl: string | null;
}

interface CreatorCard {
  address: `0x${string}`;
  displayName: string;
  livesCount: number;
  hasLiveNow: boolean;
}

/**
 * /discover — Sprint 2 surface for browsing what's on air now and the creators
 * publishing on Aevia. No Stitch canonical was sealed for this page; it
 * applies the harmonized DS established by `/feed`, `/wallet`, `/creator`,
 * `/trust` (tonal layering, Sora editorial titles, lowercase pt-BR, signature
 * components from `@aevia/ui` where they compose).
 *
 * Sprint 2 split:
 * - REAL: lives sourced from `listLiveInputs()` filtered to `connected`.
 *   Creators derived by grouping live inputs by `meta.creatorAddress`.
 * - HONEST GAP: peer counts, creator follower counts, "verified provider node"
 *   chips — all wait on Sprint 3 (Provider Node telemetry + handle registry).
 */
export default async function DiscoverPage() {
  const all = await listLiveInputs().catch(() => []);

  // ---- Lives now (connected only, newest first) --------------------------
  const lives: LiveCard[] = all
    .filter((l) => l.status?.current?.state === 'connected')
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .map((l) => {
      const recordingUid = l.meta?.recordingVideoUid;
      const thumbnailUrl = streamThumbnailUrl(recordingUid, { height: 360 });
      const creatorAddressRaw = (l.meta?.creatorAddress ?? l.defaultCreator ?? '').toLowerCase();
      const creatorAddress = /^0x[0-9a-f]{40}$/.test(creatorAddressRaw)
        ? (creatorAddressRaw as `0x${string}`)
        : null;
      return {
        uid: l.uid,
        title: l.meta?.name ?? 'sem título',
        creatorDisplayName:
          l.meta?.creator ?? (creatorAddress ? shortAddress(creatorAddress) : 'aevia'),
        creatorAddress,
        thumbnailUrl,
      };
    });

  // ---- Creators (grouped by address, sorted by lives count desc) ---------
  // Until the handle registry ships (Sprint 3+), the address is the canonical
  // identifier and `meta.creator` (typically the email used at sign-up) is the
  // display string. We dedupe by address and prefer the most recent display.
  const byAddress = new Map<
    `0x${string}`,
    { displayName: string; livesCount: number; hasLiveNow: boolean }
  >();
  for (const l of all) {
    const raw = (l.meta?.creatorAddress ?? l.defaultCreator ?? '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(raw)) continue;
    const address = raw as `0x${string}`;
    const displayName = l.meta?.creator ?? shortAddress(address);
    const isLive = l.status?.current?.state === 'connected';
    const existing = byAddress.get(address);
    if (existing) {
      existing.livesCount += 1;
      existing.hasLiveNow = existing.hasLiveNow || isLive;
    } else {
      byAddress.set(address, { displayName, livesCount: 1, hasLiveNow: isLive });
    }
  }
  const creators: CreatorCard[] = [...byAddress.entries()]
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => {
      // Live now first, then by total lives published.
      if (a.hasLiveNow !== b.hasLiveNow) return a.hasLiveNow ? -1 : 1;
      return b.livesCount - a.livesCount;
    });

  return (
    <div className="min-h-screen pb-28">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 pt-6 pb-10">
        <Hero liveNowCount={lives.length} creatorsCount={creators.length} />

        <LivesSection lives={lives} />

        <CreatorsSection creators={creators} />
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
            descobrir
          </h1>
        </div>
        <button
          type="button"
          aria-label="notificações"
          className="rounded-full p-2 text-on-surface/60 transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Bell className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}

// ---- Hero (editorial intro + meshdot + counts) ---------------------------

function Hero({ liveNowCount, creatorsCount }: { liveNowCount: number; creatorsCount: number }) {
  return (
    <section aria-labelledby="discover-hero" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
          índice editorial
        </p>
        <MeshDot />
      </div>
      <h2
        id="discover-hero"
        className="font-headline font-semibold text-[28px] text-on-surface leading-[1.1] lowercase"
      >
        quem está no ar e quem permanece
      </h2>
      <p className="font-body text-on-surface/60 text-sm">
        {liveNowCount} ao vivo agora · {creatorsCount}{' '}
        {creatorsCount === 1 ? 'criador' : 'criadores'} mapeados na rede.
      </p>
    </section>
  );
}

// ---- Lives section (2-col grid mobile, 3-col on lg) ----------------------

function LivesSection({ lives }: { lives: LiveCard[] }) {
  return (
    <section aria-labelledby="lives" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h3 id="lives" className="font-headline font-semibold text-xl text-on-surface lowercase">
          ao vivo agora
        </h3>
        {lives.length > 0 && (
          <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
            {lives.length} {lives.length === 1 ? 'transmissão' : 'transmissões'}
          </span>
        )}
      </div>

      {lives.length === 0 ? (
        <div className="rounded-md bg-surface-container px-5 py-12 text-center">
          <p className="font-body text-on-surface/70 text-sm lowercase">
            ninguém no ar agora. seja o primeiro a transmitir — sua presença chama a próxima.
          </p>
          <Link
            href="/live/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-label font-medium text-on-primary text-xs lowercase transition-opacity hover:opacity-90"
          >
            começar transmissão
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {lives.map((live) => (
            <Link key={live.uid} href={`/live/${live.uid}`}>
              <LiveTile
                thumbnailUrl={live.thumbnailUrl ?? undefined}
                thumbnailAlt={live.title}
                live
                aria-label={live.title}
              >
                <p className="line-clamp-2 font-body font-medium text-on-surface text-sm lowercase">
                  {live.title}
                </p>
                <p className="font-label text-[11px] text-on-surface/60 lowercase">
                  {live.creatorDisplayName}
                </p>
              </LiveTile>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Creators section (list of cards) ------------------------------------

const CREATORS_PREVIEW_LIMIT = 5;

function CreatorsSection({ creators }: { creators: CreatorCard[] }) {
  const preview = creators.slice(0, CREATORS_PREVIEW_LIMIT);
  const hasMore = creators.length > CREATORS_PREVIEW_LIMIT;

  return (
    <section aria-labelledby="creators" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h3 id="creators" className="font-headline font-semibold text-xl text-on-surface lowercase">
          criadores
        </h3>
        {creators.length > 0 && (
          <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
            {creators.length} {creators.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
        )}
      </div>

      {creators.length === 0 ? (
        <div className="rounded-md bg-surface-container px-5 py-10 text-center">
          <p className="font-body text-on-surface/70 text-sm lowercase">
            ainda não há criadores indexados. quem transmitir aparece aqui — sem algoritmo,
            cronologicamente.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {preview.map((c) => (
              <li key={c.address}>
                <CreatorRow creator={c} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <Link
              href="/creators"
              className="inline-flex items-center gap-1 self-start font-label text-primary-dim text-sm lowercase hover:text-primary"
            >
              ver todos os criadores
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function CreatorRow({ creator }: { creator: CreatorCard }) {
  const initial = creator.displayName.trim().charAt(0).toLowerCase() || '·';
  const livesLabel =
    creator.livesCount === 1 ? '1 transmissão' : `${creator.livesCount} transmissões`;

  return (
    <Link
      href={`/creator/${creator.address}`}
      className="group flex items-center gap-3 rounded-md bg-surface-container p-3 transition-colors hover:bg-surface-high"
    >
      <span
        aria-hidden
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-high font-headline font-semibold text-on-surface text-sm lowercase"
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
          {livesLabel}
          <span className="text-on-surface/30">·</span>
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
