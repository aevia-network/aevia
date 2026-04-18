import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { MeshDot } from '@aevia/ui';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'manifesto · aevia.network',
  description:
    'por que construímos o que construímos. um ensaio do fundador sobre por que a aevia existe.',
};

const PARAGRAPHS_BEFORE_QUOTE = [
  'escrevo isto em um momento em que plataformas comerciais de vídeo aprenderam que silenciar um criador é mais barato que defendê-lo. aevia existe porque essa aritmética precisa ser invertida.',
  'o protocolo distingue duas coisas que a internet aprendeu a confundir. persistência é a garantia de que seu vídeo continua existindo. distribuição é a decisão de empurrá-lo ao público. aevia ancora a primeira na blockchain e regula a segunda com governança transparente. uma não deve implicar a outra.',
];

const PARAGRAPHS_BETWEEN = [
  'criadores cujo trabalho é derrubado por decisões opacas, vozes que perdem alcance sem aviso, meios e ministérios que dependem de cdns que podem mudar a regra da noite para o dia — todos precisam de uma camada que não dependa da tolerância caprichosa de um provedor único. aevia é essa camada. não por idealismo, mas por arquitetura.',
  'manifestos assinados em base l2. conteúdo endereçado por cid. compensação em cusdc pelos serviços de replicação que provider nodes prestam. quando um cdn comercial decide derrubar você, suas cópias continuam onde sempre estiveram, alcançáveis pelo mesmo cid que seu público já conhece.',
];

const PARAGRAPHS_AFTER_BREAK = [
  'a aevia é neutra na camada de infraestrutura: qualquer conteúdo canonicamente assinado pode persistir no ipfs e ser ancorado em base l2. usuários são os publishers dos próprios manifestos — a aevia não assume responsabilidade pelo teor desse conteúdo. a camada editorial — ranking, feed, subsidy do persistence pool — é que tem critério público, expresso na aup.',
  'a diferença entre plataforma opaca e protocolo transparente é esta: um protocolo publica suas regras normativas em rfcs legíveis, expõe os pesos do score de risco, e designa um conselho com votos auditáveis. a aevia modera distribuição, não conteúdo; o que existe no ipfs raw não é decisão nossa. o que subsidiamos, sim, é.',
  'persistência, para nós, é um ato de cuidado. começamos pequenos, com criadores cujo trabalho não cabe em políticas honestas de plataformas comerciais. vamos continuar. devagar, de forma auditável, sem hype. se você leu até aqui, você já faz parte disso.',
];

export default function Manifesto() {
  return (
    <>
      <Nav active="manifesto" locale="pt-BR" />

      <main className="mx-auto max-w-[1440px] px-12">
        <article className="mx-auto max-w-[72ch] pt-[200px] pb-[120px]">
          <header className="flex flex-col gap-6">
            <span className="font-label text-[13px] tracking-[0.04em] text-tertiary">
              um ensaio do fundador · abril de 2026
            </span>
            <h1 className="font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
              manifesto
            </h1>
            <p className="text-base text-on-surface-variant">por leandro barbosa</p>
          </header>

          <hr className="my-[120px] h-px border-0 bg-primary-dim/40" />

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {PARAGRAPHS_BEFORE_QUOTE.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <figure className="my-[96px] flex flex-col items-center gap-4">
            <MeshDot />
            <blockquote className="max-w-[56ch] text-center font-headline text-[56px] font-bold leading-[1.2] tracking-tight text-primary">
              “persistência não implica distribuição.”
            </blockquote>
          </figure>

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {PARAGRAPHS_BETWEEN.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div aria-hidden className="my-[96px] flex items-center justify-center gap-4">
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
          </div>

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {PARAGRAPHS_AFTER_BREAK.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <footer className="mt-[96px] flex items-center justify-end gap-2">
            <span className="font-body text-base italic text-on-surface-variant">
              — leandro barbosa. são paulo, brasil.
            </span>
            <MeshDot />
          </footer>
        </article>
      </main>

      <Footer />
    </>
  );
}
