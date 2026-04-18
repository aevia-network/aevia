import type { ReactNode } from 'react';

export function WhitepaperBody(): ReactNode {
  return (
    <>
      <section id="abstract" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">resumo</span>
        <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
          Resumo
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Descrevemos Aevia, um protocolo que separa a persistência do conteúdo de vídeo de sua
            distribuição. Criadores assinam manifestos tipados que enumeram o conteúdo por
            identificadores imutáveis (CIDs) e ancoram esses manifestos em uma Layer 2 pública do
            Ethereum. Provider nodes operados independentemente replicam os bytes referenciados e
            recebem compensação fee-for-service em uma stablecoin atrelada ao dólar, auditada por um
            protocolo periódico de proof-of-replication baseado em challenge-response. Distribuição
            — ranking, subsídio e surface no feed — é governada por um risk score público e por um
            conselho ecumênico de doze assentos com poder de veto sobre parâmetros do protocolo. A
            arquitetura resultante dá ao trabalho de um criador uma propriedade que plataformas de
            vídeo existentes não oferecem: sua existência continuada não é condicional ao favor
            continuado de um único custodiante.
          </p>
        </div>
      </section>

      <section id="s1-introduction" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§1</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Introdução
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Plataformas comerciais de vídeo operam um contrato implícito e compartilhado com seus
            criadores: o criador fornece conteúdo, e a plataforma fornece distribuição em troca de
            uma parte da publicidade ou da assinatura. O contrato é frágil. Incentivos jurídicos,
            comerciais ou políticos de uma plataforma podem mudar — e quando mudam, criadores são
            desplataformados, monetização é revogada, conteúdo é removido. A audiência anterior se
            torna inacessível não porque os bytes foram destruídos, mas porque o único caminho que
            conectava os bytes à audiência foi cortado.
          </p>
          <p>
            A falha simétrica é igualmente corrosiva. Algumas plataformas escolhem amplificar
            material que a sociedade ao redor já decidiu que não merece amplificação. O resultado é
            uma discussão pública interminável em que cada lado está convencido de que algum outro
            lado capturou o aparato de moderação.
          </p>
          <p>
            Ambas as falhas compartilham uma premissa estrutural: que <em>hospedar</em> e{' '}
            <em>recomendar</em> são o mesmo ato. Uma plataforma detém os bytes <em>e</em> decide
            quem os vê. Se separarmos essas duas decisões — se tratarmos persistência (os bytes
            continuam existindo) e distribuição (os bytes são exibidos para pessoas) como camadas
            arquiteturais independentes — podemos ser honestos sobre moderação: qualquer plataforma
            que recomenda algo está curando, e fingir o contrário é desonesto ou ingênuo. Mas os
            bytes em si não precisam desaparecer para serem descurados.
          </p>
          <p>
            Este paper descreve Aevia, um protocolo e um conjunto de clientes de referência que
            separam persistência de distribuição. O protocolo é content-addressed e ancorado em uma
            blockchain pública. A replicação é executada por provider nodes operados
            independentemente, compensados pelo serviço em stablecoin. Distribuição — ranking,
            surface de feed, subsídio — é governada por um risk score publicado e por um júri
            rotativo. A arquitetura resultante tem uma propriedade que plataformas de vídeo
            existentes não têm: a existência continuada do trabalho de um criador não está
            condicionada ao favor continuado de um único custodiante.
          </p>
          <p>
            Chamamos essa propriedade de <em>soberania</em>. O axioma central do paper —{' '}
            <em>persistência não implica distribuição</em> — é ao mesmo tempo princípio de design e
            constraint. É o que torna a arquitetura honesta: não pretendemos ser neutros sobre o que
            recomendamos, e não pretendemos controlar o que apenas existe.
          </p>
          <p>
            O restante deste paper está organizado como segue. §2–§4 descrevem a camada de
            persistência: content addressing, manifestos assinados e o registry on-chain. §5–§6
            descrevem as camadas de replicação e de rede. §7–§8 descrevem a camada de distribuição e
            sua governança. §9 analisa o modelo de privacidade. §10 examina adversários. §11 e §12
            cobrem verificação por light-client e o estado estacionário econômico. §13 situa Aevia
            entre sistemas relacionados. §14 conclui.
          </p>
        </div>
      </section>

      <section id="s2-content-addressing" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§2</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Endereçamento de Conteúdo
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            A menor unidade de armazenamento em Aevia é um <em>objeto</em>: uma sequência arbitrária
            de bytes, tipicamente um segmento de vídeo, uma imagem ou um manifesto. Todo objeto é
            identificado pelo seu Content Identifier (CID), derivado deterministicamente do conteúdo
            do objeto por uma função hash criptográfica.
          </p>
          <p>
            Adotamos CIDv1 conforme especificado pelo projeto Multiformats [3]. Um CID codifica o
            algoritmo de hash, o digest e o codec do conteúdo. Aevia fixa o algoritmo em SHA-256 e a
            codificação textual em multibase base32 para garantir uma representação canônica e
            URL-safe. Para qualquer objeto <span className="font-mono">O</span>, seu CID é:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            CID(O) = &quot;b&quot; || base32(codec || 0x12 || 0x20 || SHA-256(O))
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            onde <span className="font-mono">codec</span> é o prefixo multicodec identificando o
            tipo de conteúdo (<span className="font-mono">raw</span> = 0x55 para bytes opacos,{' '}
            <span className="font-mono">json</span> = 0x0200 para manifestos estruturados),{' '}
            <span className="font-mono">0x12</span> é o identificador multihash para SHA-256 e{' '}
            <span className="font-mono">0x20</span> é o comprimento do digest em bytes (32).
          </p>
          <p>
            Duas propriedades desse esquema são load-bearing para o resto do protocolo. Primeira,{' '}
            <em>imutabilidade</em>: o CID é função dos bytes; qualquer modificação de um bit altera
            o hash e, portanto, o CID. Duas partes referindo-se ao mesmo CID detêm conteúdo
            byte-idêntico. Segunda, <em>independência de localização</em>: o CID não embute host,
            URL ou operador. Um CID pode ser satisfeito por qualquer nó que detenha os bytes; o
            protocolo não privilegia nenhuma fonte específica.
          </p>
          <p>
            Manifestos Aevia referenciam segmentos de vídeo por CID, não por URL. Essa é a condição
            mínima suficiente para persistência: o conteúdo de um criador pode ser servido por{' '}
            <em>qualquer</em> operador disposto, porque o pedido é &ldquo;me dê o objeto cujo
            SHA-256 é X&rdquo;, não &ldquo;me dê o que quer que esteja hospedado na URL Y&rdquo;.
          </p>
        </div>
      </section>

      <section id="s3-signed-manifests" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§3</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Manifestos Assinados
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Um <em>manifesto</em> é um documento JSON estruturado que descreve um item de conteúdo.
            O manifesto enumera segmentos por CID, carrega metadados (criador, timestamp, duração) e
            é assinado criptograficamente pelo criador. O schema do manifesto, em forma abreviada,
            é:
          </p>
        </div>
        <pre className="mt-8 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant">
          <code>{`{
  "version": 1,
  "cid": "<CID do corpo do manifesto em si>",
  "creator": "<endereço Ethereum EIP-55>",
  "created_at": "<timestamp RFC 3339>",
  "content_type": "video/hls" | "video/vod" | "image" | "document",
  "duration_seconds": <number | null>,
  "hls": {
    "master_playlist_cid": "<CID>",
    "segments": ["<CID>", "<CID>", ...]
  } | null,
  "signature": "<assinatura secp256k1 de 65 bytes com prefixo 0x>"
}`}</code>
        </pre>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            A assinatura é computada sobre a codificação JSON canônica [2] do manifesto com o campo{' '}
            <span className="font-mono">signature</span> excluído. A chave de assinatura é a chave
            privada Ethereum do criador, e a assinatura segue o formato typed-data EIP-712 [6] com
            um domain separator fixado ao protocolo Aevia e seu chain ID.
          </p>
          <p>
            Verificação é determinística e offline. Dado um manifesto{' '}
            <span className="font-mono">M</span>, um verificador:
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Extrai <span className="font-mono">M.signature</span> e o remove de{' '}
              <span className="font-mono">M</span> para obter{' '}
              <span className="font-mono">M&apos;</span>.
            </li>
            <li>
              Computa a codificação JSON canônica de <span className="font-mono">M&apos;</span>.
            </li>
            <li>
              Computa o digest EIP-712 sobre os bytes canônicos e o domain separator da Aevia.
            </li>
            <li>
              Recupera o endereço do signer a partir de{' '}
              <span className="font-mono">M.signature</span> e do digest.
            </li>
            <li>
              Verifica que o endereço recuperado é igual a{' '}
              <span className="font-mono">M.creator</span>.
            </li>
          </ol>
          <p>
            Qualquer mismatch em qualquer passo invalida o manifesto. Nenhum round-trip de rede é
            necessário; o verificador precisa apenas dos bytes do manifesto e do domain separator.
            Essa propriedade torna prática a verificação offline leve (§11).
          </p>
        </div>
      </section>

      <section id="s4-content-registry" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§4</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Content Registry
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Assinaturas provam autoria. Elas não provam tempo — uma assinatura diz ao verificador{' '}
            <em>quem</em> assinou, não <em>quando</em>. Para um protocolo público, a prova de
            timestamp importa: ela estabelece precedência, resolve disputas e habilita raciocínio
            com janelas de tempo, como janelas de takedown e rotação de júri.
          </p>
          <p>
            Aevia usa um Content Registry on-chain para ancoragem de timestamp. O registry é um
            contrato Solidity deployado em Base, um rollup Ethereum Layer 2. O contrato expõe uma
            única operação mutante:
          </p>
        </div>
        <pre className="mt-8 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant">
          <code>{`function register(bytes32 manifestHash, address creator)
    external
    returns (uint64 registeredAt);`}</code>
        </pre>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            O contrato armazena{' '}
            <span className="font-mono">(manifestHash → (creator, registeredAt))</span> e emite um
            evento a cada registro. O timestamp de bloco on-chain fornece um lower bound
            autoritativo da idade do manifesto.
          </p>
          <p>
            Escolhemos Base por três razões. Primeiro, Base herda a segurança do Ethereum via fraud
            proofs de optimistic rollup; nenhuma premissa de trust separada é necessária além da do
            Ethereum. Segundo, as fees em Base são aproximadamente 0,1–1% das fees do Ethereum Layer
            1, tornando o registro econômico para criadores individuais. Terceiro, a infraestrutura
            de account abstraction de Base permite que Aevia patrocine gas para criadores via
            relayer, de modo que um criador de primeira viagem assina um manifesto sem segurar ETH
            nativo.
          </p>
          <p>
            Registro com gas patrocinado é importante para onboarding, mas não deve criar um gargalo
            de confiança. O relayer é permissionless no sentido de que qualquer sponsor pode
            submeter qualquer manifesto assinado; a assinatura é verificada on-chain, e o sponsor
            recebe uma taxa fixa por registro. Sponsors não podem forjar manifestos nem modificar os
            dados registrados.
          </p>
          <p>
            O registry é append-only: manifestos registrados não podem ser removidos, apenas
            superados por registros subsequentes. Um criador que deseja publicar uma revisão
            registra um novo manifesto apontando para novos CIDs; o manifesto antigo permanece no
            registry com seu timestamp original. Consumidores selecionam a versão mais recente
            consultando o registry. Isso é deliberado: o Registry serve como registro histórico do
            que foi publicado, independente de uma versão permanecer corrente ou não.
          </p>
        </div>
      </section>

      <section id="s5-persistence-pool" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§5</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Persistence Pool
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            O Content Registry prova que o conteúdo <em>existiu</em> em um momento específico; não
            garante que o conteúdo permanece <em>acessível</em>. Acessibilidade requer que os bytes
            brutos — os próprios segmentos de vídeo — continuem vivendo em infraestrutura física
            operada por custodiantes dispostos.
          </p>
          <p>
            A camada de persistência de Aevia é um mercado econômico. Provider nodes replicam
            conteúdo e são compensados, em uma stablecoin atrelada ao dólar (cUSDC em Base), pelo
            tempo gasto hospedando e respondendo a pedidos de retrieval. O contrato de compensação —
            o Persistence Pool — mantém saldo corrente em cUSDC e desembolsa para provider nodes com
            base em métricas auditáveis.
          </p>
          <p>
            A compensação de um provider node ao longo de uma epoch de pagamento{' '}
            <span className="font-mono">t</span> é:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            P_i(t) = R_i(t) · B_i(t) · W_region(i) · ρ(t)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>onde:</p>
          <ul className="ml-4 list-disc space-y-2 pl-4">
            <li>
              <span className="font-mono">R_i(t)</span> é a fração de challenges de replicação
              respondidos com sucesso pelo nó <span className="font-mono">i</span> durante a epoch{' '}
              <span className="font-mono">t</span>, em [0, 1].
            </li>
            <li>
              <span className="font-mono">B_i(t)</span> é o total de byte-horas de conteúdo
              replicado pelo nó <span className="font-mono">i</span> durante a epoch{' '}
              <span className="font-mono">t</span>.
            </li>
            <li>
              <span className="font-mono">W_region(i)</span> ∈ {'{'}0.5, 1.0, 1.5{'}'} é o peso
              regional codificando redundância geográfica (escassez baixa, média, alta).
            </li>
            <li>
              <span className="font-mono">ρ(t)</span> é a taxa unitária do pool para a epoch{' '}
              <span className="font-mono">t</span>, computada como{' '}
              <span className="font-mono">(pool_balance · ε) / Σ_i (R_i · B_i · W_region)</span>,
              onde <span className="font-mono">ε</span> é a fração de desembolso por epoch.
            </li>
          </ul>
          <p>
            O protocolo de challenge-response é o núcleo da prova de replicação. Em intervalos
            aleatórios, o contrato do pool emite um challenge <span className="font-mono">c_k</span>{' '}
            consistindo de (i) um CID-alvo <span className="font-mono">x</span>, (ii) uma faixa
            aleatória de bytes <span className="font-mono">[a, b]</span> dentro do objeto
            identificado por <span className="font-mono">x</span> e (iii) um número de bloco{' '}
            <span className="font-mono">n</span> no qual o challenge expira.
          </p>
          <p>
            Cada provider node alegando deter <span className="font-mono">x</span> deve responder
            antes do bloco <span className="font-mono">n</span> com os bytes brutos{' '}
            <span className="font-mono">x[a..b]</span> e um commitment de prova on-chain. O contrato
            verifica os bytes contra o CID conhecido; para objetos grandes, uma árvore Merkle de
            chunks de conteúdo permite verificação O(log n) sem armazenar o objeto completo
            on-chain. Uma resposta correta e em tempo incrementa{' '}
            <span className="font-mono">R_i</span>; uma resposta ausente ou incorreta a decrementa.
          </p>
          <p>
            O protocolo resiste a dois ataques. Um nó que alega deter conteúdo que não tem não
            consegue responder a um challenge de faixa aleatória sem armazenar o conteúdo; buscar de
            um peer no momento do challenge é derrotado por janelas de resposta apertadas (latência
            típica de fetch inter-peer excede a janela). Um nó que armazenou o conteúdo mas está
            offline no momento do challenge é indistinguível de um que perdeu os dados; o protocolo
            trata ambos como falhas, o que é o incentivo correto — o contrato paga por{' '}
            <em>disponibilidade</em>, não por <em>custódia alegada</em>.
          </p>
          <p>
            Challenges são distribuídos por Poisson com taxa esperada{' '}
            <span className="font-mono">λ</span> por nó por epoch. Setar{' '}
            <span className="font-mono">λ</span> de modo que o número esperado de challenges por
            epoch seja grande (ex: 100 ou mais) reduz a variância de{' '}
            <span className="font-mono">R_i</span> e torna a compensação previsível para operadores
            honestos.
          </p>
        </div>
      </section>

      <section id="s6-network-layer" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§6</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Camada de Rede
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Conteúdo deve fluir de provider nodes para viewers. Aevia usa libp2p como substrato de
            transporte e a distributed hash table (DHT) Kademlia [9] para descoberta de conteúdo.
          </p>
          <p>
            Todo provider node opera um host libp2p identificado por um par de chaves ed25519
            auto-gerado. O host participa de uma DHT Kademlia delimitada pelo namespace do protocolo{' '}
            <span className="font-mono">/aevia/kad/1.0.0</span>. A DHT armazena mapeamentos{' '}
            <span className="font-mono">(cid → [provider_peer_id, ...])</span>, permitindo que
            qualquer nó descubra quais peers alegam deter um CID dado. A DHT é eventually consistent
            sob premissas de maioria honesta; providers que replicam um CID pela primeira vez chamam{' '}
            <span className="font-mono">Provide(cid)</span> para anunciar disponibilidade, e viewers
            chamam <span className="font-mono">FindProviders(cid)</span> para obter o conjunto atual
            de peers candidatos.
          </p>
          <p>
            Peers atrás de NAT ou firewalls restritivos não podem ser alcançados por dial direto.
            Tratamos isso com Circuit Relay v2: peers NATted registram-se em nós relay públicos e
            anunciam sua identidade alcançável{' '}
            <span className="font-mono">/p2p/&lt;relay&gt;/p2p-circuit/p2p/&lt;peer&gt;</span> na
            DHT. Viewers discam a identidade de relay; o relay encaminha o stream criptografado.
          </p>
          <p>
            Para viewers em browser, Aevia usa WebTransport e WebRTC. O cliente estabelece uma
            conexão WebTransport com um provider node — diretamente quando possível, via um gateway
            WebTransport libp2p caso contrário — e solicita segmentos HLS por CID. O provider serve
            os bytes após verificar que o requester está dentro dos rate limits aplicáveis.
          </p>
          <p>
            Retrieval de conteúdo é oportunístico e paralelo. Um cliente pode requisitar o mesmo CID
            de múltiplos providers concorrentemente, aceitando a primeira resposta válida. Uma
            resposta válida é aquela cujos bytes produzem o CID esperado; respostas inválidas são
            descartadas sem retry para aquele peer. Esse design oferece defesa natural contra
            providers maliciosos servindo conteúdo corrompido: o cliente descobre a corrupção
            imediatamente e seleciona um peer honesto dentre os candidatos restantes.
          </p>
        </div>
      </section>

      <section id="s7-risk-score" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§7</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Risk Score
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            As decisões de distribuição do protocolo — qual conteúdo recebe subsídio do persistence
            pool, qual conteúdo aparece no feed curado, qual conteúdo o algoritmo de ranking eleva —
            são governadas por um Risk Score. O Risk Score é uma computação off-chain com fórmula
            publicada:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            R(c) = α · R_legal(c) + β · R_abuse(c) + γ · R_values(c)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            com pesos default α = 0.4, β = 0.3, γ = 0.3. Cada componente é normalizado para o
            intervalo [0, 1]:
          </p>
          <ul className="ml-4 list-disc space-y-3 pl-4">
            <li>
              <span className="font-mono">R_legal(c)</span> reflete o sinal de risco legal do
              conteúdo. Entradas incluem pedidos de takedown DMCA dirigidos ao CID [11],
              notice-and-action DSA [12] e subpoenas. Um CID sem sinais legais tem{' '}
              <span className="font-mono">R_legal = 0</span>; um CID com takedown ativo não
              contestado tem <span className="font-mono">R_legal ≈ 1</span>.
            </li>
            <li>
              <span className="font-mono">R_abuse(c)</span> reflete sinais de reporte de usuários e
              júri. Entradas incluem contagem de flags (ponderada pela reputação do reporter),
              resultados de revisão por júri e sinais de conteúdo prévio do mesmo criador. Um CID
              novo de um criador novo começa com <span className="font-mono">R_abuse = 0</span>
              {'; '}
              decisões acumuladas do júri elevam ou reduzem o score.
            </li>
            <li>
              <span className="font-mono">R_values(c)</span> reflete alinhamento com a Acceptable
              Use Policy (AUP). Entradas incluem saída de classificador (treinado em um dataset
              público de conteúdo AUP-conforme e AUP-excluído) e resultados de revisão manual.{' '}
              <span className="font-mono">R_values</span> é mais alto para conteúdo que o
              classificador ou revisores identificam como dentro das categorias excluídas pela AUP.
            </li>
          </ul>
          <p>Dois thresholds governam o comportamento do protocolo:</p>
          <ul className="ml-4 list-disc space-y-2 pl-4">
            <li>
              <span className="font-mono">R(c) ≥ θ_subsidy</span> exclui{' '}
              <span className="font-mono">c</span> do subsídio do persistence pool. Provider nodes
              que replicam <span className="font-mono">c</span> não recebem compensação ponderada
              por <span className="font-mono">W_region</span>; podem ainda deter e servir{' '}
              <span className="font-mono">c</span> por conta própria.
            </li>
            <li>
              <span className="font-mono">R(c) ≥ θ_feed</span> exclui{' '}
              <span className="font-mono">c</span> do feed curado e das superfícies de ranking
              operadas por clientes Aevia. O conteúdo permanece recuperável por CID; simplesmente
              não é promovido.
            </li>
          </ul>
          <p>
            Thresholds default são <span className="font-mono">θ_subsidy = 0.5</span> e{' '}
            <span className="font-mono">θ_feed = 0.3</span>. Ambos são parâmetros do protocolo,
            sujeitos a governança (§8). Os números absolutos importam menos que a propriedade de
            design: a decisão de subsidiar ou surface é pública, auditável e contestável.
          </p>
          <p>
            Os scores componentes <span className="font-mono">R_legal</span>,{' '}
            <span className="font-mono">R_abuse</span>, <span className="font-mono">R_values</span>{' '}
            são recomputados periodicamente e publicados em um Trust Ledger público, onde toda
            mudança de score carrega uma assinatura criptográfica do serviço de ranking do pool. Um
            criador que acredita que um score está incorreto pode solicitar revisão por júri (§8).
          </p>
        </div>
      </section>

      <section id="s8-governance" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§8</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Governança
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Mudanças de parâmetro — os pesos α, β, γ; os thresholds{' '}
            <span className="font-mono">θ_subsidy</span>, <span className="font-mono">θ_feed</span>
            {'; '}a taxa de challenge <span className="font-mono">λ</span>
            {'; '}o desembolso por epoch <span className="font-mono">ε</span> — não ficam a critério
            da Aevia LLC. São decididas por um Conselho Ecumênico: doze assentos independentes,
            mandatos de quatro anos, com poder de veto sobre propostas de parâmetro.
          </p>
          <p>
            A composição do Conselho é deliberadamente plural. Os assentos são ocupados por
            indivíduos (não organizações) com perspectiva teológica, filosófica ou profissional
            publicamente declarada: clérigos em exercício, acadêmicos de direito seculares,
            ativistas de direitos humanos, criptógrafos técnicos, entre outros. Nenhuma tradição ou
            interesse único detém maioria. Uma proposta de parâmetro requer maioria simples (≥7/12)
            para passar, mas qualquer conselheiro pode exercer um veto único por mandato para
            bloquear uma proposta que considere incompatível com os valores declarados do protocolo.
          </p>
          <p>
            Deliberações do Conselho são registradas no Trust Ledger público. Cada deliberação
            publica: o texto da proposta, votos por conselheiro, invocações de veto e opiniões
            divergentes. O Ledger é em si um log Merkle-anchored em Base, tornando-o auditável e
            append-only.
          </p>
          <p>
            Eleições do Conselho ocorrem a cada quatro anos. O eleitorado é o conjunto de operadores
            estabelecidos — criadores e provider nodes ativos há pelo menos doze meses e que
            mantiveram conformidade com a AUP. A mecânica das eleições é governada pelo próprio
            Conselho (metagovernança); o Conselho inicial de bootstrap é nomeado pela Aevia LLC com
            justificativa pública para cada assento.
          </p>
          <p>
            Essa estrutura equilibra duas tensões. Primeira, governança centralizada colapsa nas
            preferências da Aevia LLC; o Conselho existe para prevenir isso. Segunda, governança
            puramente descentralizada sofre ou de plutocracia (one token, one vote) ou de risco
            Sybil (one person, one vote, onde &ldquo;person&rdquo; é inverificável). Os doze
            assentos fixos, mandatos longos e composição plural são uma simplificação deliberada que
            troca alguma legitimidade por decisões previsíveis e não-capturáveis.
          </p>
        </div>
      </section>

      <section id="s9-privacy-model" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§9</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Modelo de Privacidade
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            As garantias de privacidade de Aevia seguem de sua arquitetura e não de opacidade
            operacional. Três modelos de ameaça delimitam a análise.
          </p>
          <p>
            <em>Observador passivo.</em> Uma entidade que observa a blockchain pública e o tráfego
            de gateways IPFS públicos observa todo manifesto registrado (endereço do criador,
            timestamp, CID), todo peer ID público de provider node e todo anúncio na DHT. Não
            consegue observar qual viewer assistiu qual conteúdo (a menos que o viewer busque via
            gateway público), endereços de e-mail ou IPs de criadores assinando via relayer.
          </p>
          <p>
            <em>Adversário ativo.</em> Uma entidade que opera um ou mais provider nodes maliciosos,
            entra na DHT e observa pedidos de retrieval vê quais CIDs são requisitados de seus nós e
            de quais peer IDs. Não consegue observar a identidade real do peer que requisita (peer
            IDs são efêmeros e regenerados com frequência) nem a audiência agregada de qualquer CID
            (cada adversário vê apenas requisições roteadas a ele).
          </p>
          <p>
            <em>Coerção legal.</em> Um governo ou parte que obtenha ordem judicial compelindo Aevia
            LLC a divulgar dados tem acesso a qualquer dado que Aevia LLC detenha: endereços de
            e-mail de criadores (se fornecidos), logs do relayer (retidos trinta dias), registros de
            pagamento e deliberações do Conselho. Não tem acesso a dados que Aevia LLC não detém, o
            que inclui os manifestos on-chain (já públicos), os bytes de conteúdo armazenados por
            provider nodes independentes fora do controle da Aevia LLC e as identidades reais de
            viewers (não coletadas).
          </p>
          <p>
            As propriedades de privacidade do protocolo são assimétricas por design. Autoria é
            pública (criadores assinam manifestos com wallets on-chain); audiência é privada (sem
            tracking de identidade na camada de retrieval); metadados administrativos são legalmente
            descobríveis mas deliberadamente minimizados.
          </p>
          <p>
            Criadores que requerem anonimato têm dois caminhos. Podem assinar com uma wallet não
            conectada à sua identidade real, aceitando o ônus operacional de gestão de chaves. Ou
            podem assinar via relayer pseudônimo — um serviço que re-assina manifestos em nome de
            criadores após um KYC, retendo apenas a ligação com o pseudônimo. Aevia não opera tal
            relayer em v1; o protocolo admite sua construção por terceiros.
          </p>
        </div>
      </section>

      <section id="s10-adversarial-analysis" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§10</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Análise Adversarial
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>Analisamos cinco classes de ataque.</p>
          <p>
            <strong>(a) Provider desonesto.</strong> Um adversário opera um provider node que alega
            deter conteúdo que não tem, coletando subsídio fraudulentamente. O protocolo de
            challenge-response (§5) exige que o provider produza faixas arbitrárias de bytes do
            conteúdo alegado dentro de um deadline apertado. Buscar de um peer no momento do
            challenge é bloqueado pelo deadline. A probabilidade de um provider desonesto sobreviver
            à epoch <span className="font-mono">t</span> sem ser detectado, dados{' '}
            <span className="font-mono">λ</span> challenges por epoch e probabilidade de detecção
            por challenge <span className="font-mono">p</span>, é{' '}
            <span className="font-mono">(1 − p)^λ</span>. Com{' '}
            <span className="font-mono">λ = 100</span> e <span className="font-mono">p = 0.9</span>,
            a probabilidade de sobrevivência é <span className="font-mono">10^−100</span>. Na
            prática, o adversário é detectado já na primeira epoch.
          </p>
          <p>
            <strong>(b) Provider Sybil.</strong> Um adversário opera muitas identidades de provider
            node para inflar sua participação na compensação. A compensação é proporcional a
            byte-horas replicadas e auditadas, não à contagem de nós. Um adversário rodando cem nós
            Sybil cada um detendo 1% do conteúdo recebe a mesma compensação total que um único nó
            detendo 100% — a soma é a mesma. O adversário não consegue inflar{' '}
            <span className="font-mono">B_i</span> sem de fato deter os bytes. O peso{' '}
            <span className="font-mono">W_region</span> introduz um incentivo menor para diversidade
            geográfica, o que favorece ligeiramente operadores multi-site reais, mas Sybil não é o
            vetor de ameaça crítico aqui.
          </p>
          <p>
            <strong>(c) Censura via coerção legal.</strong> Um adversário pressiona a Aevia LLC a
            remover um manifesto específico do Content Registry. O Registry é append-only e
            on-chain; Aevia LLC não pode deletar unilateralmente um manifesto registrado. Aevia LLC
            pode ser ordenada a parar de indexar um CID em suas superfícies de cliente, mas indexar
            é decisão editorial, não decisão de protocolo. O manifesto permanece em Base,
            descobrível via block explorer; provider nodes fora da jurisdição da Aevia LLC continuam
            a servir o conteúdo; clientes alternativos podem renderizá-lo. Essa é a expressão
            arquitetural de persistência ≠ distribuição.
          </p>
          <p>
            <strong>(d) Ataque de eclipse na DHT.</strong> Um adversário preenche a tabela de
            roteamento DHT de um peer-alvo com identidades controladas pelo adversário, isolando o
            alvo de peers honestos. A estrutura de <span className="font-mono">k</span>-buckets do
            Kademlia exige que o adversário controle maioria adversarial dos peers nos buckets de
            roteamento do alvo, que têm largura <span className="font-mono">k</span> e cobrem a
            vizinhança do alvo no keyspace. Para uma rede de 10.000 peers e{' '}
            <span className="font-mono">k = 20</span>, o ataque exige algo como ~160 peer IDs
            adversariais estrategicamente posicionados. A DHT de Aevia usa adicionalmente refresh de
            bucket com probing aleatório, o que previne eclipse permanente; um bucket refrescado
            incluirá novos peers honestos à medida que entrarem. O ataque é caro e transitório.
          </p>
          <p>
            <strong>(e) Ataque econômico ao Persistence Pool.</strong> Um adversário que controla
            grande fração dos fluxos de compensação do pool pode rebaixar a taxa por epoch de
            operadores honestos. Não alegamos defesa provavelmente segura. A defesa empírica do
            protocolo é pluralismo: o contrato do pool é público, o comportamento adversarial é
            auditável, e um ataque persistente dispara revisão do Conselho (§8). Se um adversário
            captura o pool, o Conselho pode propor um fork do contrato de compensação que exclua o
            adversário; a estrutura de veto do Conselho torna essa uma ação possível mas
            deliberadamente não trivial.
          </p>
        </div>
      </section>

      <section id="s11-simplified-verification" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§11</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Verificação Simplificada
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Um light client — um viewer que não mantém um índice completo do Content Registry — pode
            verificar a validade e a vigência de um manifesto com um pequeno número de requisições
            de rede.
          </p>
          <p>
            Dado um manifesto <span className="font-mono">M</span> alegadamente corrente para o
            criador de endereço <span className="font-mono">c</span> no tempo{' '}
            <span className="font-mono">t</span>:
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Computar o hash canônico{' '}
              <span className="font-mono">h = H(canonical(M \ signature))</span>.
            </li>
            <li>
              Consultar o Content Registry:{' '}
              <span className="font-mono">
                registeredAt, registeredCreator = Registry.lookup(h)
              </span>
              .
            </li>
            <li>
              Verificar <span className="font-mono">registeredCreator == c</span>.
            </li>
            <li>
              Verificar <span className="font-mono">registeredAt ≤ t</span>.
            </li>
            <li>
              Verificar assinatura EIP-712:{' '}
              <span className="font-mono">recover(M.signature, h) == c</span>.
            </li>
            <li>
              Verificar cada CID referenciado: buscar o conteúdo, computar seu CID e comparar ao
              alegado pelo manifesto.
            </li>
          </ol>
          <p>
            Uma verificação completa exige uma chamada de contrato (passo 2), uma recuperação de
            assinatura (passo 5) e um hash-check por CID referenciado (passo 6). Para um manifesto
            de vídeo típico com 342 segmentos HLS, isso são 342 hashes de conteúdo, um hash de
            manifesto e uma recuperação de assinatura — aproximadamente 50 ms em hardware de
            consumidor.
          </p>
          <p>
            O light client não precisa confiar em nenhum servidor ou gateway. Um gateway malicioso
            só consegue fazer a verificação falhar (servindo conteúdo errado); não consegue fazer
            com que um manifesto errado seja aceito.
          </p>
        </div>
      </section>

      <section id="s12-economic-model" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§12</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Modelo Econômico
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            O Persistence Pool opera sob princípio de conservação: em qualquer epoch, a compensação
            total paga é igual ao desembolso total do saldo do pool. O pool é reabastecido por uma
            fração dos fluxos de crédito direcionados pelo criador (o <em>credit pulse</em>) e,
            durante o bootstrap, diretamente pela Aevia LLC.
          </p>
          <p>
            Seja <span className="font-mono">S(t)</span> o saldo do pool na epoch{' '}
            <span className="font-mono">t</span>, <span className="font-mono">I(t)</span> a fração
            de credit pulse entrante e <span className="font-mono">O(t)</span> o desembolso. O saldo
            evolui como:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            S(t+1) = (1 − ε) · S(t) + I(t)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Para um equilíbrio estacionário <span className="font-mono">S*</span>, exigimos{' '}
            <span className="font-mono">O(t) = I(t)</span>, dando{' '}
            <span className="font-mono">S* = I / ε</span>.
          </p>
          <p>
            Isso tem uma consequência útil. A taxa por epoch <span className="font-mono">ρ(t)</span>{' '}
            é <span className="font-mono">ε · S(t) / Σ_i (R_i · B_i · W_region)</span>. No
            equilíbrio,
          </p>
        </div>
        <div className="mt-6 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            ρ* = I / Σ_i (R_i · B_i · W_region)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            A taxa escala linearmente com o fluxo de crédito de criadores e inversamente com volume
            replicado. À medida que mais criadores enviam crédito pelo pulse, as taxas sobem; à
            medida que mais provider nodes entram, as taxas caem. O mercado se auto-equilibra.
          </p>
          <p>
            Break-even para um provider node depende do custo operacional por byte-hora e de{' '}
            <span className="font-mono">R · B · W</span> esperado. Considere um nó em região de alto
            peso (<span className="font-mono">W = 1.5</span>) com 99% de uptime (
            <span className="font-mono">R = 0.99</span>), detendo 10 TB por um mês (
            <span className="font-mono">B ≈ 7.2 · 10^15</span> byte-horas). O nó ganha{' '}
            <span className="font-mono">0.99 · 7.2·10^15 · 1.5 · ρ</span> cUSDC. Com{' '}
            <span className="font-mono">ρ</span> ajustado de modo que a taxa de estado estacionário
            produza aproximadamente $5 por TB-mês para regiões de alto peso, o nó ganha
            aproximadamente $75/mês pelos 10 TB. Custo operacional para os mesmos 10 TB em
            infraestrutura de consumidor — eletricidade, banda, amortização de hardware — é
            tipicamente $15–30/mês. A margem é real mas modesta.
          </p>
          <p>
            O modelo não depende de valorização especulativa. A compensação é denominada em uma
            stablecoin atrelada ao dólar; o retorno de um provider é determinado pelo desempenho de
            replicação, não por movimento de preço de token. Isso é um contraste intencional com
            designs que dependem da valorização de token nativo para fechar o loop econômico.
          </p>
        </div>
      </section>

      <section id="s13-related-work" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§13</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Trabalhos Relacionados
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Aevia bebe de vários sistemas anteriores, cada um resolvendo um subconjunto do problema.
          </p>
          <p>
            <strong>IPFS</strong> [3] introduziu armazenamento content-addressed e a DHT Kademlia
            para retrieval descentralizado. IPFS não especifica incentivo econômico para
            persistência; o conteúdo desaparece quando o último nó pinning o larga.
          </p>
          <p>
            <strong>Filecoin</strong> [4] construiu uma camada econômica sobre IPFS, usando
            proof-of-spacetime e proof-of-replication para compensar mineradores de storage. O
            design do Filecoin mira em arquivamento frio: deals são tipicamente de 6–12 meses com
            setores grandes e alta latência de retrieval. A camada de persistência de Aevia é de
            horizonte mais curto e retrieval-first, e opera em Base, não em uma chain dedicada.
          </p>
          <p>
            <strong>Arweave</strong> [5] usa modelo diferente: um pagamento único perpétuo em um
            endowment que capitaliza e financia replicação indefinida. Arweave é otimizado para
            arquivamento permanente, aceita custo up-front maior e não separa persistência de
            distribuição.
          </p>
          <p>
            <strong>Livepeer</strong> [10] trata de um problema diferente — transcoding em escala —
            usando estrutura similar de provider node e pagamento, mas focado em processamento de
            vídeo, não em storage.
          </p>
          <p>
            <strong>LBRY/Odysee</strong>, <strong>PeerTube</strong> e <strong>Rumble</strong> tratam
            de distribuição de vídeo sem garantia em nível de protocolo de persistência: seu
            conteúdo pode ser desplataformado pelo operador da instância federada ou do serviço
            centralizado. A camada de persistência de Aevia pretende sobreviver a qualquer cliente
            individual.
          </p>
          <p>
            <strong>BitTorrent</strong> demonstrou que replicação distribuída é viável em escala
            quando alinhada com incentivo de usuário. Aevia generaliza o padrão tornando o incentivo
            explícito (compensação em cUSDC) em vez de implícito (tit-for-tat choking).
          </p>
          <p>
            O que Aevia contribui sobre esses é o <em>princípio da separação</em>: persistência e
            distribuição como camadas econômicas e de governança distintas. O Content Registry
            ancora persistência; o Risk Score e o Conselho governam distribuição. Sistemas
            existentes ou colapsam as duas (plataformas de vídeo mainstream) ou tratam apenas de uma
            (protocolos puros de storage).
          </p>
        </div>
      </section>

      <section id="s14-conclusion" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§14</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Conclusão
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Descrevemos um protocolo em que o conteúdo de um criador persiste em uma rede de
            replicadores economicamente compensados, indexado por um registry on-chain público e
            assinado com uma identidade criptográfica verificável. Distribuição — ranking, surface
            de feed, subsídio — é governada por um risk score público e contestável e por um
            Conselho Ecumênico de doze assentos.
          </p>
          <p>
            A arquitetura assume uma posição: persistência é infraestrutura e deve ser neutra;
            distribuição é editorial e deve ser honesta. Não alegamos neutralidade sobre o que
            recomendamos. Alegamos que a existência continuada do trabalho de um criador não é, e
            não deve ser, condicional à nossa recomendação.
          </p>
          <p>
            O protocolo é open-source: Apache-2.0 para os contratos e a especificação; AGPL-3.0 para
            clientes de referência; MIT para o design system compartilhado. O endereço do Content
            Registry em Base é público. As deliberações do Conselho estão no Trust Ledger público.
            Cada afirmação neste paper é verificável no código.
          </p>
        </div>
      </section>

      <div id="references" className="border-t border-primary-dim/30 pt-12">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">referências</span>
        <ol className="mt-6 list-decimal space-y-3 pl-6 font-mono text-sm text-on-surface-variant leading-[1.6]">
          <li>
            IETF RFC 2119 — Bradner, S., &ldquo;Key words for use in RFCs to Indicate Requirement
            Levels&rdquo;, março 1997.
          </li>
          <li>
            IETF RFC 8785 — Rundgren, A. et al., &ldquo;JSON Canonicalization Scheme (JCS)&rdquo;,
            junho 2020.
          </li>
          <li>
            Benet, J., &ldquo;IPFS — Content Addressed, Versioned, P2P File System&rdquo;, 2014.
          </li>
          <li>Protocol Labs, &ldquo;Filecoin: A Decentralized Storage Network&rdquo;, 2017.</li>
          <li>
            Williams, S., &ldquo;Arweave: A Protocol for Economically Sustainable Information
            Permanence&rdquo;, 2018.
          </li>
          <li>
            Ethereum Foundation, &ldquo;EIP-712: Typed structured data hashing and signing&rdquo;,
            2018.
          </li>
          <li>
            Ethereum Foundation, &ldquo;EIP-55: Mixed-case checksum address encoding&rdquo;, 2016.
          </li>
          <li>Nakamoto, S., &ldquo;Bitcoin: A Peer-to-Peer Electronic Cash System&rdquo;, 2008.</li>
          <li>
            Maymounkov, P., Mazières, D., &ldquo;Kademlia: A Peer-to-peer Information System Based
            on the XOR Metric&rdquo;, 2002.
          </li>
          <li>Livepeer Inc., &ldquo;Livepeer Whitepaper&rdquo;, 2017.</li>
          <li>17 U.S.C. §512 — Limitations on liability relating to material online (DMCA).</li>
          <li>Regulation (EU) 2022/2065 — Digital Services Act.</li>
          <li>
            47 U.S.C. §230 — Protection for private blocking and screening of offensive material.
          </li>
          <li>18 U.S.C. §2258A — Reporting requirements of providers.</li>
          <li>SEC v. W.J. Howey Co., 328 U.S. 293 (1946).</li>
        </ol>
      </div>
    </>
  );
}
