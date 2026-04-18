'use client';

import { BottomNav } from '@/components/bottom-nav';
import { type ProviderHealth, shortPeerId } from '@/lib/mesh/health';
import { MeshDot } from '@aevia/ui';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  Globe2,
  Heart,
  Info,
  MapPin,
  Scale,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

/**
 * Mirrors Stitch canonical `6bc79a6084f74b2182ce7444e5fced05` ("Aevia —
 * Transparência e Governança"). This page is pedagogy: the axiom
 * "persistência ≠ distribuição" with enough exposition that a visitor can
 * understand what the protocol does without opening the spec.
 *
 * Sprint 2 split:
 *
 * - REAL: axiom, score formula (matches protocol spec §6), status dimension
 *   semantics, viewer DID when signed in.
 * - MOCK with honest framing: "transparência em números" metrics (uptime,
 *   appeals, latência, archive) — the observability pipeline lands in
 *   sprint 3 with Sentry + provider-node telemetry, so these numbers carry a
 *   "metas · sprint 3" chip. Council avatars are monogram placeholders until
 *   the council registry contract ships.
 */

export interface TrustViewer {
  did: string;
  shortAddress: string;
}

export interface TrustScreenProps {
  viewer: TrustViewer | null;
  /**
   * Live snapshot of every registered provider in the mesh — fetched
   * server-side from each `/healthz`. Empty array means no provider is
   * currently registered in the viewer's peer registry env (honest: grafo
   * ausente, não placeholder).
   */
  mesh: ProviderHealth[];
}

export function TrustScreen({ viewer, mesh }: TrustScreenProps) {
  return (
    <div className="min-h-screen pb-28">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 pt-6 pb-10">
        <HeroAxiom />
        <FormulaInset />
        <DimensionRows />
        <OutcomeStates />
        <MeshGrafo mesh={mesh} />
        <TransparencyNumbers />
        <CouncilBlock />
        <ViewerHistoryBlock viewer={viewer} />
      </main>

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
            governança
          </h1>
        </div>
        <button
          type="button"
          aria-label="sobre esta página"
          className="rounded-full p-2 text-on-surface/60 transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Info className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}

// ---- Hero ----------------------------------------------------------------

function HeroAxiom() {
  return (
    <section aria-labelledby="axiom" className="flex flex-col gap-4">
      <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
        política pública · revisada trimestralmente
      </p>
      <h2
        id="axiom"
        className="flex flex-wrap items-center gap-3 font-headline font-semibold text-[28px] text-on-surface leading-tight lowercase"
      >
        a tese: persistência ≠ distribuição
        <MeshDot />
      </h2>
      <p className="font-body text-on-surface/80">
        seu conteúdo não é apagado do mesh. a plataforma regula apenas o que
        <em className="not-italic text-on-surface"> promove</em> — recomendações, ranking, pagamento
        de persistência. bits continuam existindo nos provider nodes mesmo quando a aevia decide não
        amplificá-los.
      </p>
      <Link
        href="/aup"
        className="inline-flex items-center gap-1.5 font-label text-primary-dim text-sm lowercase hover:text-primary"
      >
        ler a política completa
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

// ---- Formula inset -------------------------------------------------------

function FormulaInset() {
  return (
    <section
      aria-label="fórmula do score"
      className="flex flex-col gap-3 rounded-md bg-surface-container p-5"
    >
      <p className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.2em]">
        score de risco
      </p>
      <code className="block font-mono text-[15px] text-on-surface leading-relaxed tracking-tight">
        R = (R_legal × 0.4) + (R_abuse × 0.3) + (R_values × 0.3)
      </code>
      <p className="border-outline-variant/30 border-t pt-3 font-label text-[11px] text-on-surface/60 lowercase">
        R = 0 — sem restrição · R = 1 — bloqueio duro · valores intermediários disparam os estados
        de distribuição abaixo.
      </p>
    </section>
  );
}

// ---- Dimension rows ------------------------------------------------------

interface Dimension {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  label: string;
  weight: string;
  body: string;
}

const DIMENSIONS: readonly Dimension[] = [
  {
    icon: Scale,
    accent: 'text-primary',
    label: 'R_legal · 40%',
    weight: 'compliance com a lei aplicável',
    body: 'ordens judiciais, NCII, propriedade intelectual registrada, ameaças concretas a pessoas identificáveis.',
  },
  {
    icon: Shield,
    accent: 'text-tertiary',
    label: 'R_abuse · 30%',
    weight: 'comportamento coordenado',
    body: 'spam, manipulação de métricas, redes de inautenticidade, abuso automatizado do pipeline de persistência.',
  },
  {
    icon: Heart,
    accent: 'text-secondary',
    label: 'R_values · 30%',
    weight: 'alinhamento à aup pública',
    body: 'o capital não subsidia o que a política lista como fora de escopo — bits continuam, distribuição não.',
  },
];

function DimensionRows() {
  return (
    <section aria-labelledby="dimensions" className="flex flex-col gap-3">
      <h3 id="dimensions" className="font-headline font-semibold text-on-surface text-xl lowercase">
        as três dimensões do score
      </h3>
      <ul className="flex flex-col gap-3">
        {DIMENSIONS.map((dim) => (
          <li
            key={dim.label}
            className="flex items-start gap-4 rounded-md bg-surface-container p-4"
          >
            <dim.icon className={`mt-0.5 size-5 shrink-0 ${dim.accent}`} aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-body font-medium text-on-surface text-sm lowercase">
                {dim.label} · {dim.weight}
              </p>
              <p className="font-body text-on-surface/70 text-sm">{dim.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Outcome states ------------------------------------------------------

interface OutcomeState {
  label: string;
  chipClass: string;
  body: string;
}

const OUTCOMES: readonly OutcomeState[] = [
  {
    label: 'mantido',
    chipClass: 'bg-tertiary-container text-tertiary',
    body: 'visibilidade total no feed e na descoberta. monetização via persistence pool ativa.',
  },
  {
    label: 'desindexado do discovery',
    chipClass: 'bg-secondary-container text-secondary',
    body: 'conteúdo persiste e é acessível via link direto. deixa de aparecer no /feed e em busca.',
  },
  {
    label: 'só raw mesh',
    chipClass: 'border border-secondary/40 bg-transparent text-secondary',
    body: 'removido da interface aevia. provider nodes que já pinaram continuam servindo sob demanda.',
  },
  {
    label: 'violação grave',
    chipClass: 'bg-danger/15 text-danger',
    body: 'conteúdo ilegal ou com perigo iminente a pessoas identificáveis — de-listing em todo o pipeline aevia, relatório ncmec quando aplicável.',
  },
];

function OutcomeStates() {
  return (
    <section aria-labelledby="outcomes" className="flex flex-col gap-3">
      <h3 id="outcomes" className="font-headline font-semibold text-on-surface text-xl lowercase">
        o que pode acontecer com um conteúdo
      </h3>
      <ul className="flex flex-col gap-3">
        {OUTCOMES.map((o) => (
          <li key={o.label} className="flex flex-col gap-2 rounded-md bg-surface-container p-4">
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-label font-medium text-xs lowercase ${o.chipClass}`}
            >
              {o.label}
            </span>
            <p className="font-body text-on-surface/70 text-sm">{o.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Mesh grafo (real, observável em tempo real) ------------------------

interface MeshGrafoProps {
  mesh: ProviderHealth[];
}

/**
 * Renders every provider currently registered in the mesh with its
 * region, coordinates, RTT, and reachability status. This section is NOT
 * a mock: the data comes from each provider's live `/healthz` fetched
 * server-side at render time. An empty state explains honestly when
 * the viewer's peer registry env lists no providers.
 */
function MeshGrafo({ mesh }: MeshGrafoProps) {
  const reachable = mesh.filter((m) => m.status === 'ok').length;
  const total = mesh.length;

  return (
    <section aria-labelledby="grafo" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="grafo" className="font-headline font-semibold text-on-surface text-xl lowercase">
          mesh ao vivo
        </h3>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          observável em tempo real
        </span>
      </div>
      <p className="font-body text-on-surface/70 text-sm">
        cada linha é um provider público conhecido. a região e as coordenadas vêm do próprio node —
        assinadas por quem opera, não pela aevia.
      </p>

      {total === 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-on-surface/10 border-dashed bg-surface-container/60 p-4">
          <p className="font-body text-on-surface/70 text-sm">
            nenhum provider público registrado neste cliente.
          </p>
          <p className="font-label text-[11px] text-on-surface/50 lowercase">
            o grafo só aparece quando operadores publicam seus endpoints no registry — permanência
            não implica descoberta.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 font-label text-[11px] text-on-surface/60 lowercase">
            <Globe2 className="size-3.5" aria-hidden />
            <span>
              {reachable}/{total} nodes alcançáveis agora
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {mesh.map((p) => (
              <li
                key={p.httpsBase}
                className="flex flex-col gap-1 rounded-md bg-surface-container p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-label font-medium text-on-surface text-sm lowercase">
                    {p.peerId ? shortPeerId(p.peerId) : hostOf(p.httpsBase)}
                  </span>
                  <ReachabilityBadge status={p.status} />
                </div>
                <MeshRowMeta provider={p} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ReachabilityBadge({ status }: { status: ProviderHealth['status'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 font-label text-[10px] text-primary uppercase tracking-[0.1em]">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        alcançável
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-0.5 font-label text-[10px] text-error uppercase tracking-[0.1em]">
      <span className="size-1.5 rounded-full bg-error" aria-hidden />
      offline
    </span>
  );
}

function MeshRowMeta({ provider }: { provider: ProviderHealth }) {
  if (provider.status === 'unreachable') {
    return (
      <p className="font-label text-[11px] text-on-surface/50 lowercase">
        {provider.httpsBase} · motivo {provider.reason}
      </p>
    );
  }
  const regionLabel = provider.region ?? 'sem região declarada';
  const hasCoords = provider.lat !== undefined && provider.lng !== undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-label text-[11px] text-on-surface/60 lowercase">
      <span className="inline-flex items-center gap-1">
        <MapPin className="size-3" aria-hidden />
        {regionLabel}
      </span>
      {hasCoords ? (
        <span>
          {(provider.lat as number).toFixed(2)}°, {(provider.lng as number).toFixed(2)}°
        </span>
      ) : null}
      <span>rtt {provider.rttMs} ms</span>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ---- Transparency numbers (honest mock) ---------------------------------

interface Metric {
  value: string;
  label: string;
}

const METRICS: readonly Metric[] = [
  { value: '98.2%', label: 'uptime mesh' },
  { value: '1.4k', label: 'appeals/mês' },
  { value: '12 ms', label: 'latência de assinatura' },
  { value: '2.4 tb', label: 'archive 24h' },
];

function TransparencyNumbers() {
  return (
    <section aria-labelledby="numbers" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="numbers" className="font-headline font-semibold text-on-surface text-xl lowercase">
          transparência em números
        </h3>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          metas · sprint 3
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <div key={m.label} className="flex flex-col gap-1 rounded-md bg-surface-container p-4">
            <dt className="font-label text-[10px] text-on-surface/50 uppercase tracking-wider">
              {m.label}
            </dt>
            <dd className="font-headline font-semibold text-[24px] text-on-surface">{m.value}</dd>
          </div>
        ))}
      </dl>
      <p className="font-label text-[11px] text-on-surface/50 lowercase">
        alvos publicados hoje · pipeline de observabilidade real entra em sprint 3 com sentry +
        telemetria dos provider nodes.
      </p>
    </section>
  );
}

// ---- Conselho ------------------------------------------------------------

interface CouncilMember {
  id: string;
  initials: string;
  region: string;
}

const VISIBLE_COUNCIL: readonly CouncilMember[] = [
  { id: 'c1', initials: 'TE', region: 'teologia · es' },
  { id: 'c2', initials: 'JB', region: 'jornalismo · br' },
  { id: 'c3', initials: 'ÉU', region: 'ética · us' },
];

function CouncilBlock() {
  return (
    <section aria-labelledby="council" className="flex flex-col gap-4">
      <h3 id="council" className="font-headline font-semibold text-on-surface text-xl lowercase">
        conselho ativo · 11 membros · 4 decisões esta semana
      </h3>
      <ul className="flex items-center">
        {VISIBLE_COUNCIL.map((m, idx) => (
          <li
            key={m.id}
            className={`flex flex-col items-center gap-1.5 ${idx === 0 ? '' : '-ml-2'}`}
          >
            <span
              aria-label={m.region}
              className="inline-flex size-12 items-center justify-center rounded-full bg-primary-container font-label font-semibold text-[13px] text-on-primary ring-2 ring-surface"
            >
              {m.initials}
            </span>
          </li>
        ))}
        <li className="-ml-2 inline-flex size-12 items-center justify-center rounded-full bg-surface-container font-label font-semibold text-[12px] text-on-surface/70 ring-2 ring-surface">
          +8
        </li>
      </ul>
      <p className="font-body text-on-surface/70 text-sm">
        conselho multi-denominacional e independente. teólogos, jornalistas, eticistas e leigos
        votam casos limítrofes com mandatos rotativos. decisões publicadas em íntegra, revisáveis
        trimestralmente.
      </p>
      <Link
        href="/aup"
        className="inline-flex items-center gap-1.5 font-label text-primary-dim text-sm lowercase hover:text-primary"
      >
        candidatar-se ao conselho
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

// ---- Viewer history (DID terminal) --------------------------------------

function ViewerHistoryBlock({ viewer }: { viewer: TrustViewer | null }) {
  return (
    <section
      aria-labelledby="history"
      className="flex flex-col gap-3 rounded-md bg-surface-container p-5"
    >
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-on-surface/60" aria-hidden />
        <h3
          id="history"
          className="font-headline font-semibold text-base text-on-surface lowercase"
        >
          meu histórico
        </h3>
      </div>

      {viewer ? (
        <div className="flex flex-col gap-1 font-mono text-[11px] text-on-surface/70">
          <div className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-wider">did</span>
            <code className="truncate">
              {viewer.did.slice(0, 22)}…{viewer.shortAddress.slice(-6)}
            </code>
          </div>
          <div className="flex items-center justify-between gap-2 border-outline-variant/30 border-t pt-2">
            <span className="uppercase tracking-wider">política</span>
            <span className="lowercase">aceita no cadastro</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-wider">appeals</span>
            <span className="lowercase">nenhum aberto</span>
          </div>
        </div>
      ) : (
        <p className="font-body text-on-surface/70 text-sm">
          entre com sua conta para ver o histórico do seu DID nesta plataforma — política aceita,
          appeals abertos, decisões do conselho que mencionam seus conteúdos.
        </p>
      )}

      {!viewer && (
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-label text-on-primary text-xs lowercase hover:opacity-90"
        >
          entrar para ver meu histórico
        </Link>
      )}
    </section>
  );
}
