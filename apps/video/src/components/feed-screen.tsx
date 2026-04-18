'use client';

import { BottomNav } from '@/components/bottom-nav';
import {
  LiveTile,
  MeshDot,
  PermanenceStrip,
  PersonasStrip,
  PresenceRow,
  RankingSwitcher,
  type RankingTemplate,
  ReactionStrip,
  VigilChip,
} from '@aevia/ui';
import { ArrowRight, Bell, ChevronRight, CreditCard, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Mirrors Stitch screen `659db837da83412298c0e1a9f2c1f1b6` ("Aevia — Home Feed
 * (Harmonized)"). Sprint 2 split:
 *
 * - REAL: "ao vivo agora" carousel, viewer chrome (when signed in).
 * - MOCK with honest framing: curator editorial card, feed posts with
 *   reactions/presence, creators grid. Mocks are explicitly labelled
 *   "pré-curadoria" so nothing passes for production content.
 *
 * Renders as a client component because the ranking switcher holds local state
 * and the reaction strip will wire into PostHog/contracts in Sprint 3.
 */

export interface LiveCard {
  uid: string;
  title: string;
  creatorDisplayName: string;
  /** Lowercased 0x address, null if the live has no creator on meta (legacy). */
  creatorAddress: string | null;
  /** CF Stream thumbnail URL, null if the live has no recording yet. */
  thumbnailUrl: string | null;
}

export interface FeedViewer {
  address: `0x${string}`;
  shortAddress: string;
  displayName: string;
}

export interface FeedScreenProps {
  viewer: FeedViewer | null;
  lives: LiveCard[];
}

export function FeedScreen({ viewer, lives }: FeedScreenProps) {
  const [template, setTemplate] = useState<RankingTemplate>('padrao');

  return (
    <div className="min-h-screen pb-28">
      <TopChrome viewer={viewer} />

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 pt-6 pb-10">
        <RankingSection template={template} onTemplateChange={setTemplate} />
        <LiveNowStrip lives={lives} />
        {/* PersonasStrip mirrors the 8 canonical personas declared in
            `aevia.network`'s `landing.personas`. Placed after the live rail so
            the viewer first sees what's on air, then immediately gets the
            "this is for me" answer regardless of niche. */}
        <PersonasStrip />
        <CuratorialCard />
        <FeedPostsPreview />
        <CreatorsGrid />
      </main>

      <BottomNav />
    </div>
  );
}

// ---- Top chrome ----------------------------------------------------------

function TopChrome({ viewer }: { viewer: FeedViewer | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-surface-container-low/90 px-4 backdrop-blur-[12px]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <Link href="/feed" className="flex items-center gap-2">
          <span className="font-headline font-semibold text-[18px] text-on-surface lowercase">
            aevia
          </span>
          <MeshDot />
          <span className="font-label text-[10px] text-on-surface/60 lowercase">
            21 peers · em breve
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {viewer ? (
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-label text-xs text-on-surface lowercase transition-colors hover:bg-surface-high"
            >
              <CreditCard className="size-4 text-secondary" aria-hidden />
              20 créditos · em breve
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-label text-xs text-on-primary lowercase"
            >
              entrar
            </Link>
          )}
          <button
            type="button"
            aria-label="notificações"
            className="rounded-full p-2 text-on-surface/60 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Bell className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

// ---- Ranking section -----------------------------------------------------

function RankingSection({
  template,
  onTemplateChange,
}: {
  template: RankingTemplate;
  onTemplateChange: (t: RankingTemplate) => void;
}) {
  return (
    <section aria-labelledby="ranking-heading" className="flex flex-col gap-3">
      <h1
        id="ranking-heading"
        className="font-headline font-semibold text-2xl text-on-surface lowercase tracking-tight"
      >
        o que assistir
      </h1>
      <RankingSwitcher value={template} onChange={onTemplateChange} />
      <p className="font-label text-xs text-on-surface/60 lowercase">
        curadoria editorial · troque o template quando quiser
      </p>
    </section>
  );
}

// ---- Live Now strip ------------------------------------------------------

function LiveNowStrip({ lives }: { lives: LiveCard[] }) {
  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="live-heading"
          className="font-headline font-semibold text-xl text-on-surface lowercase"
        >
          ao vivo agora
        </h2>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 font-label text-xs text-primary-dim lowercase hover:text-primary"
        >
          ver tudo
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {lives.length === 0 ? (
        <div className="rounded-md bg-surface-container px-4 py-8 text-center">
          <p className="font-body text-on-surface/70 text-sm lowercase">
            ninguém no ar agora. volte em breve, ou inicie sua transmissão.
          </p>
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {lives.map((live) => (
            <div key={live.uid} className="w-[260px] shrink-0 snap-start">
              <Link href={`/live/${live.uid}`}>
                <LiveTile
                  thumbnailUrl={live.thumbnailUrl ?? undefined}
                  thumbnailAlt={live.title}
                  live
                  aria-label={live.title}
                >
                  <p className="line-clamp-2 font-body font-medium text-on-surface text-sm">
                    {live.title}
                  </p>
                  <p className="font-label text-[11px] text-on-surface/60 lowercase">
                    {live.creatorDisplayName}
                  </p>
                </LiveTile>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Curatorial editorial card -------------------------------------------

function CuratorialCard() {
  return (
    <section aria-labelledby="editorial-heading" className="rounded-md bg-surface-container p-5">
      <p className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
        assinado pelo conselho editorial
      </p>
      <h2
        id="editorial-heading"
        className="mt-2 font-headline font-semibold text-[22px] text-on-surface leading-tight lowercase"
      >
        criadores que permaneceram no ar em 2025
      </h2>
      <p className="mt-2 font-body text-on-surface/70 text-sm">
        uma seleção editorial que o algoritmo não substitui. sete canais escolhidos pela
        persistência editorial e pela dignidade da voz.
      </p>
      <Link
        href="/discover"
        className="mt-4 inline-flex items-center gap-1.5 font-label text-primary-dim text-sm lowercase hover:text-primary"
      >
        explorar todos os criadores
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

// ---- Feed posts preview (mock with honest framing) -----------------------

interface FeedPost {
  id: string;
  creatorName: string;
  creatorHref: string;
  avatarInitials: string;
  timestamp: string;
  title: string;
  excerpt: string;
  durationOrState: string;
  viewsLabel: string;
  peersLabel: string;
  reactionCounts: {
    amem?: number;
    orar?: number;
    boost?: number;
  };
}

const MOCK_POSTS: FeedPost[] = [
  {
    id: 'mock-1',
    creatorName: 'agência paulista',
    creatorHref: '/discover',
    avatarInitials: 'AP',
    timestamp: 'há 14 min',
    title: 'câmara de são paulo · sessão extraordinária sobre orçamento 2026',
    excerpt:
      'cobertura ao vivo do plenário. transmissão ancorada em base l2; replay disponível mesmo se a câmara remover o stream oficial.',
    durationOrState: 'ao vivo · 18 min',
    viewsLabel: '2.341 visualizações',
    peersLabel: '47 peers compartilhando',
    reactionCounts: { amem: 142, orar: 88, boost: 34 },
  },
  {
    id: 'mock-2',
    creatorName: 'biblioteca aberta',
    creatorHref: '/discover',
    avatarInitials: 'BA',
    timestamp: 'há 2 h',
    title: 'matemática 9º ano · sistemas de equações em 12 minutos',
    excerpt:
      'aula direta da biblioteca pública de campinas. parte de uma série; persistente independente de mudanças de plataforma na escola.',
    durationOrState: '12 min · vod',
    viewsLabel: '18 mil visualizações',
    peersLabel: '112 peers',
    reactionCounts: { amem: 420, boost: 52 },
  },
];

const MOCK_POST_VIEWERS = [
  { id: 'v1', name: 'Lucas Andrade' },
  { id: 'v2', name: 'Marina Pires' },
  { id: 'v3', name: 'Elias Ramos' },
  { id: 'v4', name: 'Ana Teixeira' },
];

function FeedPostsPreview() {
  return (
    <section aria-labelledby="posts-heading" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="posts-heading"
          className="font-headline font-semibold text-xl text-on-surface lowercase"
        >
          pré-curadoria
        </h2>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          amostra · sprint 3
        </span>
      </div>
      <div className="flex flex-col gap-6">
        {MOCK_POSTS.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <article className="flex flex-col gap-3 rounded-md bg-surface-container p-4">
      <header className="flex items-center justify-between gap-3">
        <Link href={post.creatorHref} className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary-container font-label font-semibold text-[11px] text-on-primary">
            {post.avatarInitials}
          </span>
          <span className="flex flex-col">
            <span className="font-body font-medium text-on-surface text-sm lowercase">
              {post.creatorName}
            </span>
            <span className="font-label text-[11px] text-on-surface/50 lowercase">
              {post.timestamp}
            </span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="mais opções"
          className="rounded-full p-1.5 text-on-surface/60 hover:bg-surface-high hover:text-on-surface"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-surface-container-high">
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-label text-[11px] text-on-surface/30 lowercase">
            conteúdo pré-curadoria
          </span>
        </div>
        <span className="absolute right-2 bottom-2 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white lowercase">
          {post.durationOrState}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-body font-medium text-base text-on-surface lowercase">{post.title}</h3>
        <p className="font-body text-on-surface/70 text-sm">{post.excerpt}</p>
      </div>

      <div className="flex items-center gap-2">
        <PermanenceStrip
          layers={['edge', 'providers']}
          width={48}
          aria-label="permanência: edge + providers"
        />
        <VigilChip />
        <span className="font-label text-[11px] text-on-surface/50 lowercase">
          {post.viewsLabel} · {post.peersLabel}
        </span>
      </div>

      <PresenceRow viewers={MOCK_POST_VIEWERS} total={24} />

      <ReactionStrip counts={post.reactionCounts} className="flex-wrap" />
    </article>
  );
}

// ---- Creators grid (mock, honest) ----------------------------------------

const MOCK_CREATORS = [
  { id: 'c1', name: 'antônia mendes', region: 'jornalismo · campinas' },
  { id: 'c2', name: 'marcelo rocha', region: 'aulas · 9º ano' },
  { id: 'c3', name: 'iara veloso', region: 'documentário · rural' },
];

function CreatorsGrid() {
  return (
    <section aria-labelledby="creators-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="creators-heading"
          className="font-headline font-semibold text-xl text-on-surface lowercase"
        >
          criadores em destaque
        </h2>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          amostra · sprint 3
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {MOCK_CREATORS.map((c) => (
          <li key={c.id}>
            <div className="flex flex-col items-center gap-2 rounded-md bg-surface-container px-2 py-4 text-center">
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary-container font-headline font-semibold text-[16px] text-on-primary">
                {c.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <p className="font-body font-medium text-on-surface text-xs lowercase">{c.name}</p>
              <p className="font-label text-[10px] text-on-surface/50 lowercase">{c.region}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
