export const ptBR = {
  common: {
    nav: {
      whitepaper: 'whitepaper',
      spec: 'spec',
      aup: 'aup',
      roadmap: 'roadmap',
      manifesto: 'manifesto',
      externalVideo: 'aevia.video',
    },
    footer: {
      siteHeading: 'site',
      legalHeading: 'legal',
      contactHeading: 'contato · código-fonte',
      protocolHeading: 'protocolo · jurisdição',
      providerNodes: 'provider nodes',
      privacy: 'privacy',
      terms: 'terms',
      dmca: 'dmca',
      source: 'fonte (agpl-3.0)',
      agplNote:
        'agpl-3.0 §13: o código-fonte desta superfície de rede está disponível publicamente no repositório acima.',
      protocolVersion: (v: string) => `protocolo ${v}`,
      network: 'Base Sepolia (testnet)',
      copyright: '© 2026 Aevia LLC · Delaware, USA',
    },
  },
  landing: {
    hero: {
      titleBefore: 'persistência não implica distribuição',
      subtitle:
        'vídeo soberano pra todo mundo que cria — gamers, jornalistas locais, educadores, documentaristas, ministérios, makers, pequenas comunidades. o protocolo aevia ancora manifestos em base l2 e paga nós de persistência em cUSDC pra manter cópias disponíveis quando cdns comerciais falham.',
    },
    personas: {
      heading: 'pra quem é isso',
      lead: 'aevia é pra quem cria e quer persistir. a aup exclui o que comunidades saudáveis já excluem (csam, ncii, apologia de violência). o resto do mundo criador cabe aqui.',
      items: [
        {
          tag: 'gamer',
          line: 'streams, playthroughs, tutoriais, clipes. seu canal continua seu, não do algoritmo.',
        },
        {
          tag: 'jornalista local',
          line: 'cobertura de cidade, conselho municipal, desastre climático. sem dependência de cdn comercial que muda regra da noite pro dia.',
        },
        {
          tag: 'educador',
          line: 'aulas, palestras, cursos. sua biblioteca persiste mesmo quando a plataforma muda política.',
        },
        {
          tag: 'documentarista',
          line: 'longa duração, séries, investigações. moderação editorial pública, não opaca.',
        },
        {
          tag: 'maker / artesão',
          line: 'tutoriais, workshops, produtos. audiência portável por cid, não por handle.',
        },
        {
          tag: 'músico indie',
          line: 'seu catálogo, suas regras. demonetização arbitrária não existe aqui.',
        },
        {
          tag: 'ministério / apologista',
          line: 'ensino, testemunho, estudo bíblico. seu trabalho protegido pela aup, não sujeito a viés de moderação.',
        },
        {
          tag: 'comunidade local',
          line: 'ong, coletivo, cooperativa. ferramenta de mídia sem depender de corporate cloud.',
        },
      ],
    },
    portals: [
      {
        index: '01',
        slug: 'whitepaper',
        href: '/whitepaper',
        blurb:
          '17 páginas compiladas de 6 RFCs. arquitetura, identidade, persistência, AUP, governança, economia.',
      },
      {
        index: '02',
        slug: 'spec',
        href: '/spec',
        blurb:
          '6 RFCs normativos no estilo IETF. manifesto schema, content addressing, autenticação, AUP, persistence pool.',
      },
      {
        index: '03',
        slug: 'manifesto',
        href: '/manifesto',
        blurb: 'por que construímos o que construímos, na voz do fundador, em português e inglês.',
      },
    ],
    roadmap: [
      {
        label: 'shipped',
        milestone: '2026-04 · hello live end-to-end',
        blurb: 'whip + whep validados, manifesto assinado, content registry em sepolia.',
      },
      {
        label: 'in flight',
        milestone: '2026-04 · content registry + manifestos',
        blurb: 'cid canonicalization via webhook, fetch com auto-verificação no client.',
      },
      {
        label: 'next',
        milestone: '2026-Q2 · p2p media loader + risk score',
        blurb: 'integração libp2p no viewer, rfc-6 risk score publicado e ancorado.',
      },
    ],
    closing: {
      headline: 'aevia não distribui sem os nós de persistência. seja um.',
      cta: 'tornar-se um provider node',
    },
  },
  manifesto: {
    meta: {
      title: 'manifesto · aevia.network',
      description:
        'por que construímos o que construímos. um ensaio do fundador sobre por que a aevia existe.',
    },
    eyebrow: 'um ensaio do fundador · abril de 2026',
    title: 'manifesto',
    byline: 'por leandro barbosa',
    paragraphsBeforeQuote: [
      'escrevo isto em um momento em que plataformas comerciais de vídeo aprenderam que silenciar um criador é mais barato que defendê-lo. aevia existe porque essa aritmética precisa ser invertida.',
      'o protocolo distingue duas coisas que a internet aprendeu a confundir. persistência é a garantia de que seu vídeo continua existindo. distribuição é a decisão de empurrá-lo ao público. aevia ancora a primeira na blockchain e regula a segunda com governança transparente. uma não deve implicar a outra.',
    ],
    quote: '“persistência não implica distribuição.”',
    paragraphsBetween: [
      'criadores cujo trabalho é derrubado por decisões opacas, vozes que perdem alcance sem aviso, meios e ministérios que dependem de cdns que podem mudar a regra da noite para o dia — todos precisam de uma camada que não dependa da tolerância caprichosa de um provedor único. aevia é essa camada. não por idealismo, mas por arquitetura.',
      'e não é apenas o criador perseguido que ganha com isso. o gamer que não quer perder três anos de streaming por uma policy change, o jornalista local que cobre conselho municipal e precisa de hosting confiável, a educadora que construiu biblioteca de aulas por uma década, o documentarista com investigação em andamento, o ministério com arquivo de testemunho — todos operam sob a mesma infraestrutura instável. aevia é pra essas comunidades inteiras, não só pros casos dramáticos.',
      'manifestos assinados em base l2. conteúdo endereçado por cid. compensação em cusdc pelos serviços de replicação que provider nodes prestam. quando um cdn comercial decide derrubar você, suas cópias continuam onde sempre estiveram, alcançáveis pelo mesmo cid que seu público já conhece.',
    ],
    paragraphsAfterBreak: [
      'a aevia é neutra na camada de infraestrutura: qualquer conteúdo canonicamente assinado pode persistir no ipfs e ser ancorado em base l2. usuários são os publishers dos próprios manifestos — a aevia não assume responsabilidade pelo teor desse conteúdo. a camada editorial — ranking, feed, subsidy do persistence pool — é que tem critério público, expresso na aup.',
      'a diferença entre plataforma opaca e protocolo transparente é esta: um protocolo publica suas regras normativas em rfcs legíveis, expõe os pesos do score de risco, e designa um conselho com votos auditáveis. a aevia modera distribuição, não conteúdo; o que existe no ipfs raw não é decisão nossa. o que subsidiamos, sim, é.',
      'persistência, para nós, é um ato de cuidado. começamos pequenos, com criadores cujo trabalho não cabe em políticas honestas de plataformas comerciais. vamos continuar. devagar, de forma auditável, sem hype. se você leu até aqui, você já faz parte disso.',
    ],
    signature: '— leandro barbosa. são paulo, brasil.',
  },
  roadmap: {
    meta: {
      title: 'roadmap · aevia.network',
      description:
        'onde estamos, em que trabalhamos, para onde vamos. sem promessas de data, só estado atual.',
    },
    eyebrow: 'protocolo · roadmap',
    title: 'roadmap',
    subtitle:
      'onde estamos, em que trabalhamos, para onde vamos. sem promessas de data, só estado atual do protocolo.',
    stamp: 'atualizado em 2026-04-17 · versão do documento: v0.1',
    forwardLookingLabel: 'forward-looking statement',
    forwardLookingText:
      'este roadmap reflete planejamento à data de publicação. não constitui compromisso contratual nem promessa de entrega. cronogramas, escopos e priorizações podem mudar sem aviso. shipped reflete estado auditado por testes integrados; in flight e next refletem intenção sob as condições atuais. nada aqui deve ser interpretado como promessa de rendimento, oferta de valor mobiliário, ou aconselhamento de investimento.',
    sections: [
      {
        label: '01 · shipped',
        title: 'o que já está de pé',
        blurb:
          'três milestones recentes que formam a base auditável do protocolo. cada um foi validado com teste integrado antes de subir.',
        milestones: [
          {
            date: '2026-04',
            headline: 'hello live end-to-end validado',
            descriptor:
              'whip de captura, whep de consumo, manifesto assinado em base sepolia, content registry deployado.',
          },
          {
            date: '2026-04',
            headline: 'content registry on-chain + manifestos assinados',
            descriptor:
              'contrato ContentRegistry em base sepolia. manifestos canônicos json com verificação offline.',
          },
          {
            date: '2026-04',
            headline: 'rfc-4 (aup) e rfc-5 (persistence pool) publicados',
            descriptor: 'políticas normativas fundacionais do protocolo escritas em estilo ietf.',
          },
        ],
      },
      {
        label: '02 · in flight',
        title: 'o que estamos construindo agora',
        blurb:
          'trabalho ativo da sprint corrente. cada item tem teste integrado como critério de pronto.',
        milestones: [
          {
            date: 'sprint 2',
            headline: 'cid canonicalization via webhook cloudflare stream',
            descriptor:
              'converter uid do stream em cid canônico e assinar o manifesto automaticamente após o encoding.',
          },
          {
            date: 'sprint 2',
            headline: 'client fetch com auto-verificação por cid',
            descriptor:
              'viewer busca manifesto e segmentos pelo cid, verifica hash, rejeita qualquer mismatch.',
          },
          {
            date: 'sprint 2',
            headline: 'p2p: dht kademlia + circuit relay v2 no provider node',
            descriptor:
              'discovery transitivo em 3 nós e rota relay atrás de nat hostil. teste kill-switch passando.',
          },
        ],
      },
      {
        label: '03 · next',
        title: 'onde vamos em seguida',
        blurb:
          'os três próximos focos depois desta sprint. nenhum tem data fechada; todos têm rfc ou adr em rascunho.',
        milestones: [
          {
            date: 'sprint 3',
            headline: 'p2p media loader integrado ao viewer',
            descriptor:
              'libp2p stream no client web, fallback para cdn quando o mesh não tem a peça em tempo.',
          },
          {
            date: 'sprint 3',
            headline: 'rfc-6 risk score — rascunho',
            descriptor:
              'fórmula R = 0.4·r_legal + 0.3·r_abuse + 0.3·r_values em rascunho; ancoragem on-chain prevista após revisão externa.',
          },
          {
            date: 'sprint 4',
            headline: 'rfc-7 moderação e jury ecumênica — rascunho',
            descriptor:
              'proposta de 12 assentos com mandato de 4 anos e direito de veto em parâmetros; composição e regras em discussão.',
          },
        ],
      },
    ],
  },
  providers: {
    meta: {
      title: 'provider nodes · aevia.network',
      description:
        'torne-se um provider node da aevia. presta serviço de hospedagem e replicação ao protocolo; recebe compensação fee-for-service em cusdc pelo serviço prestado.',
    },
    eyebrow: 'infra · provider nodes',
    title: 'provider nodes',
    subtitle:
      'o protocolo não distribui sem nós de persistência. se você opera infraestrutura — em casa, em datacenter regional, ou num provedor de confiança — pode prestar esse serviço ao protocolo.',
    lead: [
      'um provider node é um processo go que replica conteúdo endereçado por cid e prova essa replicação on-chain em intervalos regulares. o nó recebe compensação fee-for-service em cusdc proporcional ao uptime verificado, ao volume de objetos replicados e ao peso da região.',
      'você não precisa ser grande. esperamos que a maior parte da rede seja composta por operadores pequenos — ministérios, coletivos de creators, operadores caseiros com um proxmox e uma conexão decente. a redundância vem do número, não do tamanho.',
    ],
    cards: [
      {
        n: '01 ·',
        title: 'replica o conteúdo',
        body: 'você replica conteúdo endereçado por cid e limita por tamanho total, região de origem ou criador/ministério. nenhum conteúdo é imposto — a curadoria do que replicar é sua.',
      },
      {
        n: '02 ·',
        title: 'prova replicação',
        body: 'o nó responde a desafios de proof-of-replication regularmente. a validade da prova determina a compensação do período. sem prova válida, sem compensação — simples e auditável.',
      },
      {
        n: '03 ·',
        title: 'recebe compensação de serviço',
        body: 'o contrato persistence pool em base paga cusdc por hora de replicação auditada. é compensação fee-for-service pelo que você executa — não rendimento sobre capital investido, não participação em lucros, não oferta de valores mobiliários.',
      },
    ],
    legalLabel: 'natureza jurídica da relação',
    legalBody:
      'a relação entre provider node e aevia llc é de prestação de serviço de infraestrutura. você opera seu próprio hardware, rede e operação; define políticas próprias de replicação dentro das regras do protocolo; e é compensado pelo serviço efetivamente entregue. a participação não constitui oferta ou aquisição de valores mobiliários, instrumento coletivo de investimento, ou contrato de investimento conforme howey test (sec v. w.j. howey co., 328 u.s. 293). operadores são responsáveis por compliance fiscal e regulatório local (licenças de money transmitter aplicáveis, declaração de receita, etc.).',
    waitlistTitle: 'aevia não distribui sem provider nodes. preste esse serviço.',
    waitlistBody:
      'a lista de espera é operada por e-mail. me mande especificação de hardware, faixa de banda, região e jurisdição operacional. respondo em dias — um a um, sem newsletter.',
    waitlistCta: 'entrar na waitlist',
    waitlistRfc: 'leia rfc-5 persistence pool',
    signature: '“a redundância vem do número, não do tamanho.”',
  },
  aup: {
    meta: {
      title: 'aup · aevia.network',
      description:
        'acceptable use policy da aevia. o que o protocolo não amplifica, por quê, e como lidamos com takedowns dmca, dsa, lgpd, ncmec e sanções.',
    },
    eyebrow: 'política · aup',
    title: 'acceptable use policy',
    subtitle:
      'o que a aevia não amplifica, por que isso preserva imunidade sob section 230, e como lidamos com takedowns dmca, dsa, ncmec, lgpd e sanções.',
    stamp: 'versão 0.1 · publicado 2026-04-17 · jurisdição delaware, usa',
    leadParagraphs: [
      'a aevia distingue persistência e distribuição. persistência significa que seu conteúdo continua existindo na blockchain e no ipfs. distribuição significa que nós pagamos para hospedá-lo em nós de persistência, mostramos ele no feed, ou subsidiamos seu alcance. esta política rege a segunda, não a primeira.',
      'o que você ler abaixo não proíbe bits no ipfs raw. decreta apenas que tipos de conteúdo não recebem cheque do persistence pool, não entram no feed curado e não são surfaceados em ranking. a diferença é arquitetural e intencional — e é o que preserva a imunidade da aevia como intermediário sob section 230 (47 u.s.c. §230).',
      'a aup reflete valores amplamente compartilhados por comunidades saudáveis — pais querem plataforma sem csam ou ncii; educadores querem moderação auditável; jornalistas sérios querem critério editorial público; famílias querem feed sem contaminação. valores cristãos clássicos convergem com isso. a aup é expressão desses valores, não propriedade de um grupo.',
    ],
    exclusionsTitle: 'o que a aevia não amplifica',
    exclusionsLead:
      'os itens a seguir são excluídos de subsidy do persistence pool, de ranking algorítmico e de feed curado. não são uma lista de ‘conteúdo proibido’ — são uma declaração de como o protocolo dirige seus recursos econômicos e editoriais.',
    exclusions: [
      { key: '[a]', text: 'pornografia e conteúdo sexualmente explícito' },
      {
        key: '[b]',
        text: 'qualquer sexualização de menores — tolerância zero absoluta; reporte à ncmec cybertipline conforme 18 u.s.c. §2258a',
      },
      {
        key: '[c]',
        text: 'conteúdo íntimo não consentido (ncii), incluindo deepfakes sexualizados — conforme shield act (15 u.s.c. §6851)',
      },
      {
        key: '[d]',
        text: 'apologia celebratória de violência, terrorismo ou dano físico a pessoas',
      },
      { key: '[e]', text: 'apologia celebratória de aborto' },
      { key: '[f]', text: 'ocultismo, satanismo e feitiçaria como prática' },
      { key: '[g]', text: 'apologia de uso recreativo de drogas ilícitas' },
      {
        key: '[h]',
        text: 'discurso de ódio acionável contra qualquer grupo — incluindo cristãos, judeus, muçulmanos, ateus e quaisquer outros',
      },
    ],
    ageTitle: 'idade mínima',
    ageBody:
      'a aevia não é direcionada a menores de 13 anos, conforme coppa (15 u.s.c. §6501). para residentes no espaço econômico europeu, a idade mínima é 16 anos, conforme art. 8 gdpr. para residentes no brasil, a idade mínima é 13 anos com autorização parental e 18 anos sem, conforme art. 14 lgpd. se descobrirmos dados pessoais de menor abaixo da idade mínima aplicável, esses dados são deletados.',
    dmcaEyebrow: '§4 · dmca · 17 u.s.c. §512',
    dmcaTitle: 'procedimento de takedown por copyright',
    dmcaBody1:
      'a aevia llc opera como intermediário sob os termos do digital millennium copyright act. ao concluir o registro formal de agente designado junto ao u.s. copyright office, publicaremos aqui o número de registro e a data de validade. até lá, notificações de infração devem ser enviadas a contact@aevia.network com assunto dmca takedown e conter os elementos exigidos por 17 u.s.c. §512(c)(3): identificação do trabalho, localização na aevia, contato do notificante, declaração de boa-fé, declaração sob perjúrio, e assinatura.',
    dmcaBody2:
      'a contra-notificação respeita o prazo legal de 10 a 14 dias úteis antes de restauração do conteúdo. política de reincidência: primeiro strike gera aviso, segundo strike revisão manual com suspensão temporária, terceiro strike termina a conta e remove o acesso a subsidy. contas terminadas não retornam via criação de nova conta.',
    dmcaAgentLabel: 'agente designado',
    dmcaRegistryLabel: 'registro oficial',
    dsaEyebrow: '§5 · ue',
    dsaTitle: 'digital services act — notice & action',
    dsaBody:
      'para usuários no espaço econômico europeu, a aevia opera um canal de notice-and-action conforme art. 16 do regulamento (ue) 2022/2065 (dsa). notificações de conteúdo ilegal devem ser enviadas para contact@aevia.network com assunto dsa notice e conter: razão legal alegada, localização do conteúdo, identidade do notificante (quando exigível) e declaração de boa-fé. respondemos em até sete dias úteis com justificativa fundamentada quando a decisão não for favorável, conforme art. 17. nosso relatório anual de transparência será publicado em /transparency a partir da primeira janela elegível.',
    s230Eyebrow: '§6 · usa',
    s230Title: 'postura sob section 230',
    s230Body1:
      'a aevia modera distribuição — ranking, subsidy do persistence pool, feed surfacing — com critério editorial público e explícito. a aevia não assume responsabilidade pela acurácia, legalidade ou caráter do conteúdo gerado por usuários. usuários são os publishers dos próprios manifestos.',
    s230Body2:
      'essa postura invoca imunidade sob 47 u.s.c. §230(c)(1) e proteção good samaritan sob §230(c)(2)(a). nada nesta política transforma a aevia em publisher do conteúdo alheio; descrever o que não amplificamos é exatamente o exercício da moderação que a seção 230(c)(2)(a) protege.',
    ncmecEyebrow: '§7 · ncmec cybertipline',
    ncmecBody:
      'material de abuso sexual infantil aparente é reportado à ncmec cybertipline conforme 18 u.s.c. §2258a. preservamos o material por 90 dias conforme §2258a(h), não revisamos o conteúdo além do mínimo para reporte (para não comprometer o entendimento de private-search sob 4ª emenda), e não permitimos apelação. não há chamada de julgamento.',
    sanctionsEyebrow: '§8 · ofac',
    sanctionsTitle: 'sanções e jurisdições excluídas',
    sanctionsBody:
      'os serviços da aevia não estão disponíveis para residentes, entidades ou operadores localizados em jurisdições sob sanções compreensivas dos estados unidos (office of foreign assets control — ofac), incluindo mas não limitadas a cuba, irã, coreia do norte, síria e regiões ocupadas da ucrânia. também excluídos pessoas e entidades listadas na specially designated nationals and blocked persons list. uso em violação destas restrições pode resultar em bloqueio imediato e reporte às autoridades competentes.',
    privacyTitle: 'privacidade e dados pessoais',
    privacyBody1: 'o tratamento de dados pessoais é regido pela',
    privacyBodyLink: 'política de privacidade',
    privacyBody2:
      'da aevia, que cobre ccpa/cpra (california), gdpr (ue), lgpd (brasil) e direitos de sujeito de dados associados. a aevia llc não vende dados pessoais na definição ccpa.',
    arbitrationTitle: 'resolução de disputas e renúncia a ação coletiva',
    arbitrationBody:
      'qualquer controvérsia, reclamação ou disputa decorrente desta política ou do uso dos serviços da aevia será resolvida por arbitragem individual vinculante, conduzida pela american arbitration association (aaa) sob as regras de arbitragem comercial, sediada em wilmington, delaware, em idioma inglês. você e a aevia renunciam expressamente ao direito a julgamento por júri e a participar de ação coletiva ou arbitragem coletiva como representado ou representante. esta cláusula é regida pelo federal arbitration act (9 u.s.c. §§1–16). opt-out dentro de 30 dias após primeiro uso do serviço, enviando e-mail para contact@aevia.network com assunto arbitration opt-out.',
    liabilityTitle: 'limitação de responsabilidade e garantia',
    liabilityBody:
      'os serviços da aevia são fornecidos “como estão” e “conforme disponíveis”, sem garantia expressa ou implícita de adequação, disponibilidade, ausência de erros ou não violação. na máxima extensão permitida por lei, a responsabilidade da aevia llc, suas afiliadas, diretores, funcionários e agentes por qualquer causa agregada, contratual ou extracontratual, não excederá o valor total efetivamente pago pelo usuário à aevia nos doze meses anteriores ao evento que deu origem à reclamação, ou usd 100, o que for maior. em nenhuma hipótese a aevia será responsável por danos indiretos, incidentais, especiais, consequenciais, punitivos ou lucros cessantes.',
    indemnityTitle: 'indenização',
    indemnityBody:
      'o usuário concorda em indenizar e manter a aevia llc isenta de qualquer reclamação, demanda, responsabilidade, dano, perda ou despesa (incluindo honorários advocatícios razoáveis) decorrentes de ou relacionadas a: (i) conteúdo publicado pelo usuário; (ii) violação desta política ou dos termos de serviço; (iii) violação de direitos de terceiros; (iv) uso indevido dos serviços.',
    jurisdictionEyebrow: '§13 · jurisdição',
    jurisdictionBody:
      'esta política é publicada pela aevia llc, uma limited liability company de delaware, estados unidos da américa. regida pela legislação de delaware, com exclusão de suas normas de conflito de leis. disputas não sujeitas à cláusula §10 de arbitragem (incluindo ações de propriedade intelectual) são resolvidas em cortes estaduais ou federais localizadas em delaware, e as partes consentem em tal jurisdição. a convenção de viena sobre contratos de compra e venda internacional de mercadorias (cisg) não se aplica. versões desta política em outros idiomas são de conveniência; a versão em inglês prevalece em caso de conflito.',
  },
  privacy: {
    meta: {
      title: 'privacy · aevia.network',
      description:
        'política de privacidade da aevia. o que coletamos, por que, como você exerce direitos sob ccpa, gdpr e lgpd, e como entramos em contato.',
    },
    eyebrow: 'política · privacy',
    title: 'política de privacidade',
    subtitle:
      'o que coletamos, por quê, como guardamos, e como você exerce direitos sob ccpa/cpra (california), gdpr (união europeia) e lgpd (brasil).',
    stamp: 'versão 0.1 · publicado 2026-04-17 · controlador: aevia llc · delaware, usa',
    controllerTitle: 'quem controla seus dados',
    controllerBodyA:
      'o controlador (data controller / operador) é aevia llc, uma limited liability company de delaware, estados unidos da américa. contato de privacidade:',
    controllerBodyB:
      '. para lgpd no brasil, este endereço também funciona como canal do encarregado/dpo.',
    collectTitle: 'o que coletamos e por quê',
    collectLead:
      'o design da aevia minimiza coleta de dados pessoais. o que coletamos, coletamos com finalidade explícita:',
    collectItems: [
      {
        tag: 'e-mail',
        text: '— quando você entra em contato, solicita waitlist de provider node, ou envia notificação dmca. finalidade: responder à solicitação específica.',
      },
      {
        tag: 'endereço de wallet',
        text: '— quando você assina manifesto ou opera provider node. é um identificador público em base l2; não o tratamos como secret, mas registramos associação com sua operação.',
      },
      {
        tag: 'logs técnicos de requisição',
        text: '— ip, user-agent, rota, status code, timestamp. finalidade: operação do serviço, segurança, debug. retenção máxima: 30 dias.',
      },
      {
        tag: 'métricas agregadas',
        text: '— contagem de requisições e origem geográfica agregada via cloudflare analytics. não identificam indivíduos.',
      },
    ],
    collectFooter:
      'a aevia não coleta dados sensíveis (art. 11 lgpd, art. 9 gdpr) sem consentimento explícito e finalidade específica. a aevia não constrói perfis comerciais, não vende dados pessoais conforme definição ccpa, e não compartilha dados com data brokers.',
    legalBasisEyebrow: '§3 · gdpr/lgpd',
    legalBasisTitle: 'base legal para o tratamento',
    legalBasisLead: 'as bases legais sob art. 6 gdpr e art. 7 lgpd são:',
    legalBasisItems: [
      {
        tag: 'execução de contrato',
        text: '— para operar o serviço que você solicitou (assinar manifesto, operar provider node).',
      },
      {
        tag: 'legítimo interesse',
        text: '— para segurança, prevenção de fraude, debug (logs técnicos).',
      },
      {
        tag: 'obrigação legal',
        text: '— para responder a takedowns dmca, subpoenas, reportes ncmec.',
      },
      {
        tag: 'consentimento',
        text: '— quando explicitamente solicitado (ex: comunicação sobre novidades do protocolo).',
      },
    ],
    rightsTitle: 'direitos que você tem',
    rightsLead:
      'dependendo da sua jurisdição, você tem direitos sobre seus dados pessoais. a aevia os reconhece universalmente ao máximo operacional que possamos. envie solicitação para contact@aevia.network com assunto privacy request e especifique qual direito. respondemos em até 30 dias.',
    rightsItems: [
      {
        tag: 'acesso',
        text: '— obter cópia dos dados pessoais que mantemos (ccpa §1798.100, gdpr art. 15, lgpd art. 18 II).',
      },
      { tag: 'retificação', text: '— corrigir dados inexatos (gdpr art. 16, lgpd art. 18 III).' },
      {
        tag: 'deleção',
        text: '— apagar dados que não são mais necessários (ccpa §1798.105, gdpr art. 17, lgpd art. 18 VI). ressalva: manifestos ancorados em base l2 são imutáveis por design; o que podemos deletar são associações do lado off-chain.',
      },
      {
        tag: 'portabilidade',
        text: '— receber seus dados em formato estruturado (gdpr art. 20, lgpd art. 18 V).',
      },
      {
        tag: 'objeção / opt-out de venda',
        text: '— restringir tratamento por legítimo interesse (gdpr art. 21). a aevia não vende dados, mas respeitamos essa objeção como política geral (ccpa §1798.120).',
      },
      {
        tag: 'revisão humana',
        text: '— para decisões automatizadas que afetem você significativamente (gdpr art. 22, lgpd art. 20). aplicável ao score de risco; você pode solicitar revisão manual.',
      },
    ],
    retentionTitle: 'retenção e minimização',
    retentionBody:
      'logs técnicos: 30 dias. registros de contato (e-mails): 2 anos. registros de dmca e contra-notificação: conforme exigência legal (17 u.s.c. §512). ncmec reports: 90 dias conforme 18 u.s.c. §2258a(h). deletamos dados que saíram de todas essas janelas.',
    transferTitle: 'transferências internacionais',
    transferBody:
      'a aevia é sediada nos estados unidos. dados de usuários do espaço econômico europeu transferidos para os estados unidos são protegidos por standard contractual clauses (gdpr art. 46(2)(c)). para titulares brasileiros, transferências internacionais dependem de cláusulas específicas conforme art. 33 lgpd. atualizaremos este parágrafo se aderirmos ao eu–us data privacy framework.',
    processorsTitle: 'processadores terceirizados',
    processorsLead:
      'a aevia utiliza os seguintes processadores na operação do serviço. cada um tem acordo formal de processamento (dpa) e não pode usar os dados para finalidades próprias:',
    processorsItems: [
      {
        tag: 'cloudflare',
        text: '— hospedagem, cdn, analytics agregado, email routing. dpa padrão.',
      },
      {
        tag: 'privy',
        text: '— embedded wallet e autenticação de criadores. dados: endereço de wallet, e-mail opcional.',
      },
      {
        tag: 'base (coinbase)',
        text: '— rede blockchain l2 onde manifestos são ancorados. todas as transações são públicas por design.',
      },
    ],
    cookiesTitle: 'cookies',
    cookiesBody:
      'aevia.network usa apenas cookies estritamente necessários (toggle de idioma, sessão privy). não há cookies de tracking, publicidade, ou analytics de terceiros. se futuramente adicionarmos, o banner de consentimento é exigido (gdpr ePrivacy, lgpd art. 8).',
    minorsTitle: 'privacidade de menores',
    minorsBodyA: 'conforme a',
    minorsBodyLink: 'aup §3',
    minorsBodyB:
      ', a aevia não é direcionada a menores de 13 anos (coppa), 16 anos no eee (gdpr art. 8), e exige autorização parental para 13–17 no brasil (lgpd art. 14). se descobrirmos dados pessoais de menor abaixo da idade aplicável, esses dados são deletados sem necessidade de pedido formal.',
    changesTitle: 'alterações nesta política',
    changesBodyA:
      'quando alteramos materialmente esta política, atualizamos a versão no topo e publicamos um aviso no',
    changesBodyLink: 'roadmap',
    changesBodyB:
      '. mudanças que afetem direitos do titular de forma restritiva entram em vigor 30 dias após publicação, dando tempo para exercício prévio dos direitos atuais.',
    contactEyebrow: '§11 · contato de privacidade',
    contactBody1: 'aevia llc · delaware, usa ·',
    contactBody2:
      '. para reclamações à autoridade de controle: eua — ag do estado de residência; eee — autoridade nacional de proteção de dados; brasil — autoridade nacional de proteção de dados (anpd).',
  },
  terms: {
    meta: {
      title: 'terms · aevia.network',
      description:
        'termos de serviço da aevia. o acordo entre você e a aevia llc. leia antes de usar a rede.',
    },
    eyebrow: 'política · terms',
    title: 'termos de serviço',
    subtitle:
      'este é o acordo entre você e a aevia llc. ao usar aevia.network, aevia.video ou qualquer serviço da aevia, você concorda com os termos abaixo. leia antes de usar.',
    stamp: 'versão 0.1 · publicado 2026-04-17 · jurisdição delaware, usa',
    acceptTitle: 'aceitação',
    acceptBodyA:
      'ao acessar ou usar os serviços da aevia (inclui aevia.network, aevia.video, o protocolo subjacente e qualquer superfície identificada como operada pela aevia llc), você aceita estes termos e a',
    acceptBodyAup: 'acceptable use policy',
    acceptBodyB: 'e a',
    acceptBodyPrivacy: 'política de privacidade',
    acceptBodyC: ', que são incorporadas por referência. se não concorda, não use.',
    eligibilityTitle: 'elegibilidade',
    eligibilityBody:
      'você declara ter idade mínima aplicável conforme aup §3, não estar localizado em jurisdição sob sanções compreensivas ofac (aup §8), não estar listado na specially designated nationals and blocked persons list, e ter capacidade legal para celebrar este contrato. se você usa a aevia em nome de pessoa jurídica, declara ter autoridade para vincular a entidade.',
    accountTitle: 'conta e responsabilidade',
    accountBody:
      'a conta aevia é ancorada em uma wallet operada via privy. você é responsável por proteger as credenciais associadas à sua wallet e por todas as ações executadas a partir dela. a aevia não pode reverter transações on-chain, recuperar chaves perdidas ou desfazer assinaturas criptográficas. perda de acesso à wallet significa perda de capacidade de assinar futuros manifestos — conteúdo previamente ancorado permanece no ipfs e na base l2.',
    licenseTitle: 'conteúdo do usuário: propriedade e licença',
    licenseBody1:
      'você retém todos os direitos sobre o conteúdo que publica na aevia. você nos concede, pelo tempo de operação do serviço, licença não-exclusiva, gratuita, mundial e sublicenciável, limitada às seguintes finalidades: (i) armazenar e replicar o conteúdo via provider nodes para cumprir seu manifesto; (ii) transmitir o conteúdo a usuários finais que o solicitem; (iii) exibi-lo em superfícies editoriais (feed, ranking) quando elegível conforme aup. a licença termina automaticamente se você excluir a referência canônica — ressalvado que o conteúdo on-chain e no ipfs permanece imutável por design.',
    licenseBody2:
      'você declara que possui os direitos necessários para conceder esta licença e que o conteúdo não infringe direitos de terceiros.',
    prohibitedTitle: 'uso proibido e conteúdo excluído',
    prohibitedBodyA: 'o uso do serviço está sujeito à',
    prohibitedBodyLink: 'acceptable use policy',
    prohibitedBodyB:
      '. ao aup rege o que o protocolo não amplifica e como respondemos a abusos. violações podem resultar em perda de subsidy, desindexação, suspensão ou terminação conforme §7.',
    ipTitle: 'propriedade intelectual e takedowns',
    ipBodyA:
      'procedimentos dmca (17 u.s.c. §512) e notice-and-action (dsa, (ue) 2022/2065) estão descritos na',
    ipBodyAupLink: 'aup §4 e §5',
    ipBodyB:
      '. “aevia”, “aevia.network”, “aevia.video” e o wordmark são marcas da aevia llc. licenças de código-fonte (apache-2.0 para contracts/protocol-spec, agpl-3.0 para clients, mit para design system) estão em',
    ipBodyLicensesLink: 'LICENSES.md',
    ipBodyC: '.',
    terminationTitle: 'terminação',
    terminationBody:
      'você pode parar de usar a qualquer momento; manifestos previamente ancorados permanecem no ipfs e na base l2 por design. a aevia pode suspender ou terminar seu acesso a subsidy, ranking e feed por violação material de aup, por reincidência dmca conforme política de strikes (aup §4), por obrigação legal, ou a critério próprio após aviso prévio razoável (exceto em casos de conteúdo criminal que exija ação imediata).',
    warrantyTitle: 'disclaimer de garantia',
    warrantyBody:
      'o serviço é fornecido “como está” e “conforme disponível”. a aevia rejeita, na máxima extensão permitida por lei aplicável, todas as garantias expressas, implícitas ou estatutárias, incluindo garantias de comerciabilidade, adequação a propósito específico, título e não-infração. a aevia não garante que o serviço será ininterrupto, livre de erros, ou seguro contra perda de dados. blockchain, ipfs e p2p são tecnologias novas — você assume o risco tecnológico.',
    liabilityTitle: 'limitação de responsabilidade',
    liabilityBody:
      'na máxima extensão permitida por lei, a responsabilidade total da aevia llc, suas afiliadas, diretores, funcionários e agentes por qualquer causa agregada não excederá o maior valor entre (a) usd 100, ou (b) o total efetivamente pago por você à aevia nos 12 meses anteriores ao evento. em nenhuma hipótese a aevia será responsável por danos indiretos, incidentais, especiais, consequenciais, punitivos, ou por lucros cessantes, perda de dados, perda de reputação ou qualquer dano que a aevia não poderia razoavelmente prever.',
    indemnityTitle: 'indenização',
    indemnityBody:
      'você concorda em indenizar e manter a aevia llc isenta de qualquer reclamação, responsabilidade, dano, perda ou despesa (incluindo honorários advocatícios razoáveis) decorrentes de: (i) conteúdo que você publicou; (ii) violação destes termos ou da aup; (iii) violação de direitos de terceiros; (iv) uso indevido do serviço.',
    arbitrationTitle: 'resolução de disputas e renúncia a ação coletiva',
    arbitrationBodyA:
      'disputas decorrentes destes termos são resolvidas por arbitragem individual vinculante conforme',
    arbitrationBodyLink: 'aup §10',
    arbitrationBodyB:
      ', regida pelo federal arbitration act (9 u.s.c. §§1–16) e administrada pela aaa sob regras de arbitragem comercial, sediada em wilmington, delaware. você renuncia a julgamento por júri e a ações coletivas. opt-out disponível dentro de 30 dias após primeiro uso, enviando e-mail a contact@aevia.network com assunto arbitration opt-out.',
    lawTitle: 'lei aplicável e foro',
    lawBody:
      'estes termos são regidos pela legislação do estado de delaware, estados unidos da américa, com exclusão de suas normas de conflito de leis. disputas não submetidas a arbitragem (ex: ações de propriedade intelectual) são resolvidas nas cortes estaduais ou federais localizadas em delaware, e as partes consentem em tal jurisdição. a convenção de viena sobre contratos de compra e venda internacional de mercadorias (cisg) não se aplica.',
    modificationsTitle: 'modificações destes termos',
    modificationsBody:
      'podemos modificar estes termos. mudanças materiais entram em vigor 30 dias após publicação, dando tempo para você sair se não concordar. mudanças não-materiais (como correção de redação ou atualização de endereços) entram em vigor na publicação.',
    wholeTitle: 'integralidade, severabilidade, cessão',
    wholeBody:
      'estes termos, juntos com a aup, a política de privacidade e qualquer adendo publicado, constituem o acordo integral entre você e a aevia llc sobre o serviço, e substituem qualquer acordo anterior. se qualquer disposição for considerada inválida, as demais permanecem em vigor. não-exercício de direito não implica renúncia. você não pode ceder seus direitos sob este acordo sem consentimento escrito da aevia; a aevia pode ceder livremente.',
    contactEyebrow: '§15 · contato contratual',
    contactBody1: 'aevia llc · delaware, usa ·',
    contactBody2:
      '. entregas por correio postal devem ser endereçadas ao registered agent da aevia llc no estado de delaware (detalhes fornecidos mediante solicitação).',
  },
  spec: {
    meta: {
      title: 'spec · aevia.network',
      description: 'índice dos rfcs normativos do protocolo aevia.',
    },
    eyebrow: 'protocolo · spec',
    title: 'specification',
    subtitle:
      'seis documentos normativos no estilo ietf. regem manifesto schema, content addressing, identidade, aup, persistence pool e risk score.',
    stamp:
      'versão 0.1 · fonte canônica github.com/aevia-network/aevia/tree/main/docs/protocol-spec',
    coverA:
      'rfcs da aevia seguem o estilo ietf e usam rfc 2119 para linguagem normativa — MUST e SHOULD têm peso. são ao mesmo tempo a fonte da verdade para implementadores e o contrato público que investidores e juristas podem ler.',
    coverB:
      'cada rfc é versionado no repositório e ancorado em base l2 quando publicado. o índice abaixo mostra o estado atual. a renderização individual está em /spec/{slug}.',
    tableHeaders: {
      slug: 'slug',
      title: 'título',
      status: 'status',
      updated: 'última atualização',
    },
    status: {
      published: 'publicado',
      draft: 'rascunho',
      planned: 'planejado',
    },
    rows: [
      {
        slug: 'rfc-0',
        title: 'visão geral do protocolo',
        status: 'published',
        updated: '2026-04-14',
      },
      { slug: 'rfc-1', title: 'manifest schema', status: 'published', updated: '2026-04-15' },
      { slug: 'rfc-2', title: 'content addressing', status: 'published', updated: '2026-04-15' },
      {
        slug: 'rfc-3',
        title: 'autenticação e assinatura',
        status: 'published',
        updated: '2026-04-16',
      },
      { slug: 'rfc-4', title: 'acceptable use policy', status: 'published', updated: '2026-04-16' },
      { slug: 'rfc-5', title: 'persistence pool', status: 'published', updated: '2026-04-16' },
      { slug: 'rfc-6', title: 'risk score', status: 'planned', updated: 'sprint 3' },
      { slug: 'rfc-7', title: 'moderação', status: 'planned', updated: 'sprint 4' },
    ],
    documentsLabel: 'documentos',
    cards: [
      {
        n: 0,
        slug: 'rfc-0',
        title: 'visão geral',
        abstract:
          'como as camadas se encaixam. qual a tese. o que está em escopo e o que não está.',
        sectionsLabel: '14 seções',
      },
      {
        n: 1,
        slug: 'rfc-1',
        title: 'manifest schema',
        abstract:
          'estrutura json assinada que descreve cada conteúdo: cid, criador, segmentos, metadados, assinatura.',
        sectionsLabel: '14 seções',
      },
      {
        n: 2,
        slug: 'rfc-2',
        title: 'content addressing',
        abstract: 'cid, ipfs, gateways e a garantia de imutabilidade do conteúdo na base l2.',
        sectionsLabel: '14 seções',
      },
      {
        n: 3,
        slug: 'rfc-3',
        title: 'autenticação e assinatura',
        abstract: 'privy embedded wallet em base, eip-712, verificação offline sem gas.',
        sectionsLabel: '14 seções',
      },
      {
        n: 4,
        slug: 'rfc-4',
        title: 'acceptable use policy',
        abstract:
          'o que a aevia não amplifica, por que isso preserva section 230, procedimentos dmca.',
        sectionsLabel: '14 seções',
      },
      {
        n: 5,
        slug: 'rfc-5',
        title: 'persistence pool',
        abstract:
          'como cusdc flui para os nós que provam replicação, fórmula de pagamento e monitoramento.',
        sectionsLabel: '14 seções',
      },
    ],
    readDocument: 'ler documento',
    referencesLabel: 'referências',
  },
  rfc: {
    meta: (eyebrow: string, title: string) => ({
      title: `${eyebrow} · aevia.network`,
      description: `rfc normativo: ${title}.`,
    }),
    onPage: 'na página',
    tocScope: '§1 · escopo',
    tocTerminology: '§2 · terminologia',
    tocExclusions: '§3 · exclusões',
    tocCompliance: '§4 · cumprimento',
    tocReferences: '§5 · referências',
    backToIndex: '← voltar ao índice',
    versionLine: (date: string) => `versão 0.1 · atualizado ${date} · status: publicado`,
    scopeTitle: 'escopo',
    scopeP1:
      'este documento define [escopo do rfc, ex: a política de uso aceitável da aevia, ou o schema canônico de manifesto]. aplica-se a todos os clientes e provider nodes do protocolo.',
    scopeP2A: 'as palavras-chave',
    scopeP2B: 'neste documento são interpretadas conforme rfc 2119.',
    terminologyTitle: 'terminologia',
    terminologyLead:
      'os termos abaixo são usados ao longo do rfc com o significado aqui estabelecido.',
    termsList: [
      { term: 'manifest', def: 'documento json assinado que descreve um conteúdo' },
      { term: 'cid', def: 'content identifier derivado do hash sha-256 do conteúdo' },
      { term: 'provider node', def: 'agente que replica e serve conteúdo mediante pagamento' },
      { term: 'persistence pool', def: 'tesouraria que remunera provider nodes em cusdc' },
    ],
    exclusionsTitle: 'exclusões',
    exclusionsLead:
      'o protocolo não subsidia, não amplifica e não indexa os seguintes tipos de conteúdo — eles podem existir no ipfs raw mas não recebem cheque, feed ou ranking.',
    exclusionsList: [
      'pornografia e conteúdo sexualmente explícito',
      'qualquer sexualização de menores (tolerância zero absoluta; reporte a ncmec)',
      'apologia celebratória de violência',
      'material que sexualiza pessoas sem consentimento',
      'apologia de práticas ocultistas ou satanismo',
    ],
    complianceTitle: 'cumprimento',
    complianceP1:
      'o cumprimento é multi-camada. o protocolo faz o primeiro corte via score de risco calculado off-chain. o conselho tem direito de veto sobre parâmetros, mas não sobre bits existentes no ipfs.',
    complianceP2:
      'takedowns dmca seguem 17 u.s.c. §512. o agente designado recebe notificações em contact@aevia.network. o procedimento respeita a janela de contra-notificação de 10–14 dias úteis.',
    referencesTitle: 'referências',
  },
  transparency: {
    meta: {
      title: 'transparency · aevia.network',
      description:
        'relatório de transparência da aevia. métricas de takedown dmca, notice-and-action dsa, reportes ncmec, deliberações do conselho.',
    },
    eyebrow: 'política · transparência',
    title: 'relatório de transparência',
    subtitle:
      'o que publicamos, quando, e por quê. a aevia opera sob art. 15 e 17 do digital services act e sob section 230 dos estados unidos. transparência recorrente é condição da nossa postura editorial pública.',
    stamp: 'primeira janela elegível: 2027-02-17 (12 meses após o primeiro uso comercial elegível)',
    leadParagraphs: [
      'este é um commitment público, não um relatório em si. a aevia ainda não atingiu a primeira janela elegível para um relatório dsa art. 15. até lá, esta página documenta quais métricas serão publicadas, com qual cadência, e onde o registro histórico viverá.',
      'a tese da aevia — persistência não implica distribuição — só é crível se as decisões de distribuição forem auditáveis. este relatório é o instrumento dessa auditabilidade: cada mudança de feed, subsidy ou ranking disparada por ação legal vira linha pública aqui.',
    ],
    commitmentsTitle: 'compromissos normativos',
    commitments: [
      {
        tag: 'dsa art. 15',
        text: '— relatório anual de moderação: pedidos de remoção recebidos, atendidos, contestados; tempo médio de resposta; taxa de erro automático; recursos humanos alocados; política de suspensão.',
      },
      {
        tag: 'dsa art. 17',
        text: '— justificativa individual por decisão de restrição de distribuição, quando o usuário contestar. fundamentação legal citada, alternativas consideradas, canal de apelação.',
      },
      {
        tag: 'dmca §512',
        text: '— contagem anual de notices recebidos, contra-notificações, strikes emitidos, contas terminadas por reincidência. publicado no formato padrão da u.s. copyright office.',
      },
      {
        tag: 'ncmec cybertipline',
        text: '— contagem anual de reportes. conteúdo não é jamais descrito — apenas a contagem e confirmação de escalonamento à ncmec conforme 18 u.s.c. §2258a.',
      },
      {
        tag: 'conselho ecumênico',
        text: '— texto das propostas de parâmetro, votos por conselheiro, vetos invocados, opiniões divergentes. ancorado no trust ledger em base l2 a cada deliberação.',
      },
      {
        tag: 'risk score',
        text: '— fórmula vigente, pesos atuais, thresholds de subsidy e feed, revisões feitas por júri. mudanças assinadas criptograficamente.',
      },
    ],
    cadenceTitle: 'cadência e primeiros relatórios',
    cadenceBody:
      'relatórios dsa: anuais, publicados até 17 de fevereiro, cobrindo o ano civil anterior. relatórios dmca: anuais, publicados em janeiro. deliberações do conselho: publicadas em tempo quase real no trust ledger. strikes individuais: notificação direta ao usuário afetado, com justificativa textual no idioma do usuário.',
    statusTitle: 'status atual (2026-04-17)',
    statusBody:
      'nenhum relatório publicado ainda — a plataforma não atingiu a primeira janela. contadores abaixo refletem a operação desde o bootstrap.',
    metricsHeaders: {
      metric: 'métrica',
      count: 'contagem',
      window: 'janela',
    },
    metrics: [
      { metric: 'notices dmca recebidos', count: '0', window: 'desde 2026-04' },
      { metric: 'contra-notificações dmca', count: '0', window: 'desde 2026-04' },
      { metric: 'strikes emitidos', count: '0', window: 'desde 2026-04' },
      { metric: 'contas terminadas por reincidência', count: '0', window: 'desde 2026-04' },
      { metric: 'notices dsa recebidos (eea)', count: '0', window: 'desde 2026-04' },
      { metric: 'reportes ncmec', count: '0', window: 'desde 2026-04' },
      { metric: 'deliberações do conselho', count: '0', window: 'conselho ainda em bootstrap' },
      { metric: 'revisões manuais de risk score', count: '0', window: 'desde 2026-04' },
    ],
    archiveTitle: 'arquivo histórico',
    archiveBody:
      'todos os relatórios publicados ficarão linkados aqui por ano. o primeiro relatório será publicado em 2027-02-17. relatórios anteriores estarão disponíveis em pdf assinado e em html canonicalizado.',
    contactTitle: 'reclamações, correções e solicitações',
    contactBody1:
      'se você acredita que uma métrica neste relatório está incorreta, envie um email para',
    contactBody2:
      ' com assunto transparency correction. respondemos publicamente — a correção e a razão da correção aparecem no próximo relatório.',
  },
  notFound: {
    label: '404 · página não encontrada',
    headline: 'ou você a perdeu, ou ela nunca existiu.',
    body: 'o protocolo aevia indexa apenas o que foi canonicamente assinado. se você seguiu um link de fora para uma rota que não está na spec, é provável que a rota tenha mudado de nome antes de ser oficial.',
    home: 'voltar para o início',
    spec: 'ir para a spec',
    quote: '“persistência não implica distribuição.”',
  },
  whitepaper: {
    meta: {
      title: 'whitepaper · aevia.network',
      description:
        'Aevia — um protocolo para distribuição soberana de vídeo. especificação técnica v1.',
    },
    eyebrow: 'protocolo · whitepaper',
    title: 'Aevia',
    subtitle: 'Um protocolo para distribuição soberana de vídeo.',
    author: 'Leandro Barbosa · Aevia LLC · versão 1 · abril de 2026',
    version: 'v1 · abril de 2026',
    contents: 'sumário',
    downloadPdf: 'salvar como pdf →',
    legalNoteLabel: 'nota jurídica',
    legalNote:
      'Este documento descreve uma arquitetura de protocolo. Não é uma oferta de valores mobiliários. Os fluxos de cUSDC descritos em §5 e §12 representam compensação fee-for-service pela infraestrutura prestada ao protocolo; não são retornos sobre capital investido. Declarações prospectivas sobre releases, RFCs ou funcionalidades futuras podem mudar sem aviso. Nada neste documento constitui aconselhamento jurídico, financeiro ou de investimento.',
    referencesLabel: 'referências',
    toc: [
      { id: 'abstract', label: 'Resumo' },
      { id: 's1-introduction', label: '1. Introdução' },
      { id: 's2-content-addressing', label: '2. Endereçamento de Conteúdo' },
      { id: 's3-signed-manifests', label: '3. Manifestos Assinados' },
      { id: 's4-content-registry', label: '4. Content Registry' },
      { id: 's5-persistence-pool', label: '5. Persistence Pool' },
      { id: 's6-network-layer', label: '6. Camada de Rede' },
      { id: 's7-risk-score', label: '7. Risk Score' },
      { id: 's8-governance', label: '8. Governança' },
      { id: 's9-privacy-model', label: '9. Modelo de Privacidade' },
      { id: 's10-adversarial-analysis', label: '10. Análise Adversarial' },
      { id: 's11-simplified-verification', label: '11. Verificação Simplificada' },
      { id: 's12-economic-model', label: '12. Modelo Econômico' },
      { id: 's13-related-work', label: '13. Trabalhos Relacionados' },
      { id: 's14-conclusion', label: '14. Conclusão' },
      { id: 'references', label: 'Referências' },
    ],
  },
};
