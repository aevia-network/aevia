import type { ptBR } from './pt-BR';

type Dictionary = typeof ptBR;

export const en: Dictionary = {
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
      contactHeading: 'contact · source',
      protocolHeading: 'protocol · jurisdiction',
      providerNodes: 'provider nodes',
      privacy: 'privacy',
      terms: 'terms',
      dmca: 'dmca',
      source: 'source (agpl-3.0)',
      agplNote:
        'agpl-3.0 §13: the source code for this network surface is publicly available at the repository above.',
      protocolVersion: (v: string) => `protocol ${v}`,
      network: 'Base Sepolia (testnet)',
      copyright: '© 2026 Aevia LLC · Delaware, USA',
    },
  },
  landing: {
    hero: {
      titleBefore: 'persistence does not imply distribution',
      subtitle:
        'sovereign video for everyone who creates — gamers, local journalists, educators, documentarians, ministries, makers, small communities. the aevia protocol anchors manifests on base l2 and pays persistence nodes in cUSDC to keep copies available when commercial cdns fail.',
    },
    personas: {
      heading: 'who this is for',
      lead: 'aevia is for anyone who creates and wants to persist. the aup excludes what healthy communities already exclude (csam, ncii, violence apologia). the rest of the creator world fits here.',
      items: [
        {
          tag: 'gamer',
          line: 'streams, playthroughs, tutorials, clips. your channel stays yours, not the algorithm’s.',
        },
        {
          tag: 'local journalist',
          line: 'city coverage, council, disaster. no dependence on a commercial cdn that rewrites the rules overnight.',
        },
        {
          tag: 'educator',
          line: 'lectures, talks, courses. your library persists even when the platform changes policy.',
        },
        {
          tag: 'documentarian',
          line: 'long-form, series, investigations. public editorial moderation, not opaque.',
        },
        {
          tag: 'maker / artisan',
          line: 'tutorials, workshops, products. audience portable by cid, not by handle.',
        },
        {
          tag: 'indie musician',
          line: 'your catalog, your rules. arbitrary demonetization doesn’t exist here.',
        },
        {
          tag: 'ministry / apologist',
          line: 'teaching, testimony, bible study. your work protected by the aup, not subject to moderation bias.',
        },
        {
          tag: 'local community',
          line: 'nonprofit, collective, cooperative. media tooling without depending on corporate cloud.',
        },
      ],
    },
    portals: [
      {
        index: '01',
        slug: 'whitepaper',
        href: '/whitepaper',
        blurb:
          '17 pages compiled from 6 RFCs. architecture, identity, persistence, AUP, governance, economics.',
      },
      {
        index: '02',
        slug: 'spec',
        href: '/spec',
        blurb:
          '6 normative RFCs in IETF style. manifest schema, content addressing, authentication, AUP, persistence pool.',
      },
      {
        index: '03',
        slug: 'manifesto',
        href: '/manifesto',
        blurb: 'why we built what we built, in the founder’s voice, in portuguese and english.',
      },
    ],
    roadmap: [
      {
        label: 'shipped',
        milestone: '2026-04 · hello live end-to-end',
        blurb: 'whip + whep validated, signed manifest, content registry on sepolia.',
      },
      {
        label: 'in flight',
        milestone: '2026-04 · content registry + manifests',
        blurb: 'cid canonicalization via webhook, client fetch with auto-verification.',
      },
      {
        label: 'next',
        milestone: '2026-Q2 · p2p media loader + risk score',
        blurb: 'libp2p in viewer, rfc-6 risk score published and anchored.',
      },
    ],
    closing: {
      headline: 'aevia does not distribute without persistence nodes. become one.',
      cta: 'become a provider node',
    },
  },
  manifesto: {
    meta: {
      title: 'manifesto · aevia.network',
      description: 'why we built what we built. a founder essay on why aevia exists.',
    },
    eyebrow: 'a founder essay · april 2026',
    title: 'manifesto',
    byline: 'by leandro barbosa',
    paragraphsBeforeQuote: [
      'i write this at a moment when commercial video platforms have learned that silencing a creator is cheaper than defending them. aevia exists because that arithmetic needs to be inverted.',
      'the protocol separates two things the internet has learned to conflate. persistence is the guarantee that your video continues to exist. distribution is the decision to push it to the public. aevia anchors the first on the blockchain and regulates the second under transparent governance. one must not imply the other.',
    ],
    quote: '“persistence does not imply distribution.”',
    paragraphsBetween: [
      'creators whose work is taken down by opaque decisions, voices that lose reach without warning, outlets and ministries that depend on cdns that can rewrite the rules overnight — all of them need a layer that does not depend on the capricious tolerance of a single provider. aevia is that layer. not out of idealism, but by architecture.',
      'and it is not only the persecuted creator who benefits. the gamer who does not want to lose three years of streaming to a policy change, the local journalist covering city council and needing reliable hosting, the educator who built a library of lessons over a decade, the documentarian with an investigation in progress, the ministry with a testimony archive — all operate under the same unstable infrastructure. aevia is for these whole communities, not only the dramatic cases.',
      'manifests signed on base l2. content addressed by cid. fee-for-service compensation in cusdc for the replication provider nodes perform. when a commercial cdn decides to pull you down, your copies remain where they always were, reachable by the same cid your audience already knows.',
    ],
    paragraphsAfterBreak: [
      'aevia is neutral at the infrastructure layer: any canonically signed content can persist on ipfs and be anchored on base l2. users are the publishers of their own manifests — aevia does not assume responsibility for the substance of that content. the editorial layer — ranking, feed, persistence pool subsidy — is what has a public criterion, stated in the aup.',
      'the difference between an opaque platform and a transparent protocol is this: a protocol publishes its normative rules in readable rfcs, exposes the weights of the risk score, and appoints a council with auditable votes. aevia moderates distribution, not content; what exists on raw ipfs is not our decision. what we subsidize, is.',
      'persistence, for us, is an act of care. we start small, with creators whose work does not fit inside the honest policies of commercial platforms. we will continue. slowly, auditably, without hype. if you read this far, you are already part of this.',
    ],
    signature: '— leandro barbosa. são paulo, brazil.',
  },
  roadmap: {
    meta: {
      title: 'roadmap · aevia.network',
      description:
        'where we are, what we are working on, where we are going. no date promises, just current state.',
    },
    eyebrow: 'protocol · roadmap',
    title: 'roadmap',
    subtitle:
      'where we are, what we are working on, where we are going. no date promises, just current state of the protocol.',
    stamp: 'updated 2026-04-17 · document version: v0.1',
    forwardLookingLabel: 'forward-looking statement',
    forwardLookingText:
      'this roadmap reflects planning at the date of publication. it is not a contractual commitment nor a delivery promise. schedules, scopes, and priorities may change without notice. shipped reflects state audited by integration tests; in flight and next reflect intent under current conditions. nothing here should be read as a yield promise, a security offer, or investment advice.',
    sections: [
      {
        label: '01 · shipped',
        title: 'what stands today',
        blurb:
          'three recent milestones that form the auditable base of the protocol. each one was validated with an integration test before landing.',
        milestones: [
          {
            date: '2026-04',
            headline: 'hello live end-to-end validated',
            descriptor:
              'whip capture, whep playback, manifest signed on base sepolia, content registry deployed.',
          },
          {
            date: '2026-04',
            headline: 'content registry on-chain + signed manifests',
            descriptor:
              'ContentRegistry contract on base sepolia. canonical json manifests with offline verification.',
          },
          {
            date: '2026-04',
            headline: 'rfc-4 (aup) and rfc-5 (persistence pool) published',
            descriptor: 'foundational normative policies of the protocol written in ietf style.',
          },
        ],
      },
      {
        label: '02 · in flight',
        title: 'what we are building now',
        blurb:
          'active work in the current sprint. each item has an integration test as its done criterion.',
        milestones: [
          {
            date: 'sprint 2',
            headline: 'cid canonicalization via cloudflare stream webhook',
            descriptor:
              'convert stream uid into canonical cid and sign the manifest automatically after encoding.',
          },
          {
            date: 'sprint 2',
            headline: 'client fetch with cid auto-verification',
            descriptor:
              'viewer fetches manifest and segments by cid, verifies the hash, rejects any mismatch.',
          },
          {
            date: 'sprint 2',
            headline: 'p2p: kademlia dht + circuit relay v2 in the provider node',
            descriptor:
              'transitive discovery across 3 nodes and relay route behind hostile nat. kill-switch test passing.',
          },
        ],
      },
      {
        label: '03 · next',
        title: 'where we go next',
        blurb:
          'the three next focuses after this sprint. none has a fixed date; each has an rfc or adr in draft.',
        milestones: [
          {
            date: 'sprint 3',
            headline: 'p2p media loader integrated into the viewer',
            descriptor:
              'libp2p stream in the web client, fallback to cdn when the mesh does not hold the piece in time.',
          },
          {
            date: 'sprint 3',
            headline: 'rfc-6 risk score — draft',
            descriptor:
              'formula R = 0.4·r_legal + 0.3·r_abuse + 0.3·r_values in draft; on-chain anchoring planned after external review.',
          },
          {
            date: 'sprint 4',
            headline: 'rfc-7 moderation and ecumenical jury — draft',
            descriptor:
              'proposal for 12 seats with 4-year terms and veto authority over parameters; composition and rules under discussion.',
          },
        ],
      },
    ],
  },
  providers: {
    meta: {
      title: 'provider nodes · aevia.network',
      description:
        'become an aevia provider node. provides hosting and replication as a service to the protocol; receives fee-for-service compensation in cusdc for the work performed.',
    },
    eyebrow: 'infra · provider nodes',
    title: 'provider nodes',
    subtitle:
      'the protocol does not distribute without persistence nodes. if you operate infrastructure — at home, in a regional data center, or on a trusted provider — you can render that service to the protocol.',
    lead: [
      'a provider node is a go process that replicates content addressed by cid and proves that replication on-chain at regular intervals. the node receives fee-for-service compensation in cusdc proportional to verified uptime, volume of replicated objects, and region weight.',
      'you do not need to be large. we expect most of the network to be composed of small operators — ministries, creator collectives, home operators with a proxmox and a decent connection. redundancy comes from number, not from size.',
    ],
    cards: [
      {
        n: '01 ·',
        title: 'replicate the content',
        body: 'you replicate content addressed by cid and limit by total size, region of origin, or creator/ministry. nothing is imposed — what you choose to replicate is your curation.',
      },
      {
        n: '02 ·',
        title: 'prove replication',
        body: 'the node regularly answers proof-of-replication challenges. the validity of the proof determines compensation for the period. no valid proof, no compensation — simple and auditable.',
      },
      {
        n: '03 ·',
        title: 'receive service compensation',
        body: 'the persistence pool contract on base pays cusdc per hour of audited replication. this is fee-for-service compensation for what you execute — not a yield on invested capital, not a profit share, not a securities offering.',
      },
    ],
    legalLabel: 'legal nature of the relationship',
    legalBody:
      'the relationship between provider node and aevia llc is an infrastructure service provision. you operate your own hardware, network, and operations; you define your own replication policies within the protocol rules; and you are compensated for the service effectively delivered. participation does not constitute an offer or acquisition of securities, collective investment vehicle, or investment contract under the howey test (sec v. w.j. howey co., 328 u.s. 293). operators are responsible for local tax and regulatory compliance (applicable money transmitter licenses, revenue declaration, etc.).',
    waitlistTitle: 'aevia does not distribute without provider nodes. render that service.',
    waitlistBody:
      'the waitlist is run by email. send me your hardware spec, bandwidth range, region, and operational jurisdiction. i reply in days — one-by-one, no newsletter.',
    waitlistCta: 'join the waitlist',
    waitlistRfc: 'read rfc-5 persistence pool',
    signature: '“redundancy comes from number, not from size.”',
  },
  aup: {
    meta: {
      title: 'aup · aevia.network',
      description:
        'aevia acceptable use policy. what the protocol does not amplify, why, and how we handle dmca, dsa, lgpd, ncmec takedowns, and sanctions.',
    },
    eyebrow: 'policy · aup',
    title: 'acceptable use policy',
    subtitle:
      'what aevia does not amplify, why that preserves section 230 immunity, and how we handle dmca, dsa, ncmec, lgpd takedowns, and sanctions.',
    stamp: 'version 0.1 · published 2026-04-17 · jurisdiction delaware, usa',
    leadParagraphs: [
      'aevia distinguishes persistence from distribution. persistence means your content continues to exist on the blockchain and on ipfs. distribution means we pay to host it on persistence nodes, surface it in the feed, or subsidize its reach. this policy governs the second, not the first.',
      'what you read below does not prohibit bits on raw ipfs. it only decrees which kinds of content do not receive a persistence pool check, do not enter the curated feed, and are not surfaced in ranking. the difference is architectural and intentional — and it is what preserves aevia’s intermediary immunity under section 230 (47 u.s.c. §230).',
      'the aup reflects values widely shared by healthy communities — parents want platforms without csam or ncii; educators want auditable moderation; serious journalists want public editorial criteria; families want feeds without contamination. classical christian values converge with this. the aup is an expression of these values, not the property of any single group.',
    ],
    exclusionsTitle: 'what aevia does not amplify',
    exclusionsLead:
      'the items below are excluded from persistence pool subsidy, from algorithmic ranking, and from curated feed. they are not a list of ‘forbidden content’ — they are a statement of how the protocol directs its economic and editorial resources.',
    exclusions: [
      { key: '[a]', text: 'pornography and sexually explicit content' },
      {
        key: '[b]',
        text: 'any sexualization of minors — absolute zero tolerance; reporting to ncmec cybertipline per 18 u.s.c. §2258a',
      },
      {
        key: '[c]',
        text: 'non-consensual intimate imagery (ncii), including sexualized deepfakes — per the shield act (15 u.s.c. §6851)',
      },
      {
        key: '[d]',
        text: 'celebratory apologia of violence, terrorism, or physical harm to persons',
      },
      { key: '[e]', text: 'celebratory apologia of abortion' },
      { key: '[f]', text: 'occultism, satanism, and witchcraft as practice' },
      { key: '[g]', text: 'apologia of recreational illicit drug use' },
      {
        key: '[h]',
        text: 'actionable hate speech against any group — including christians, jews, muslims, atheists, and any other',
      },
    ],
    ageTitle: 'minimum age',
    ageBody:
      'aevia is not directed to users under the age of 13, per coppa (15 u.s.c. §6501). for residents of the european economic area, the minimum age is 16, per art. 8 gdpr. for residents of brazil, the minimum age is 13 with parental authorization and 18 without, per art. 14 lgpd. if we discover personal data of a minor below the applicable minimum age, that data is deleted.',
    dmcaEyebrow: '§4 · dmca · 17 u.s.c. §512',
    dmcaTitle: 'copyright takedown procedure',
    dmcaBody1:
      'aevia llc operates as an intermediary under the digital millennium copyright act. upon completing formal registration of the designated agent with the u.s. copyright office, we will publish here the registration number and expiration date. until then, infringement notices must be sent to contact@aevia.network with subject dmca takedown and contain the elements required by 17 u.s.c. §512(c)(3): identification of the work, location on aevia, notifier contact, good-faith statement, statement under penalty of perjury, and signature.',
    dmcaBody2:
      'counter-notification respects the statutory 10–14 business-day window before content restoration. repeat-offender policy: first strike issues a warning, second strike triggers manual review with temporary suspension, third strike terminates the account and removes subsidy access. terminated accounts do not return via creation of a new account.',
    dmcaAgentLabel: 'designated agent',
    dmcaRegistryLabel: 'official registry',
    dsaEyebrow: '§5 · eu',
    dsaTitle: 'digital services act — notice & action',
    dsaBody:
      'for users in the european economic area, aevia operates a notice-and-action channel per art. 16 of regulation (eu) 2022/2065 (dsa). notifications of illegal content must be sent to contact@aevia.network with subject dsa notice and contain: asserted legal basis, content location, notifier identity (when required), and good-faith statement. we reply within seven business days with a reasoned justification when the decision is unfavorable, per art. 17. our annual transparency report will be published at /transparency starting from the first eligible window.',
    s230Eyebrow: '§6 · usa',
    s230Title: 'posture under section 230',
    s230Body1:
      'aevia moderates distribution — ranking, persistence pool subsidy, feed surfacing — with a public and explicit editorial criterion. aevia does not assume responsibility for the accuracy, legality, or character of user-generated content. users are the publishers of their own manifests.',
    s230Body2:
      'this posture invokes immunity under 47 u.s.c. §230(c)(1) and the good-samaritan protection under §230(c)(2)(a). nothing in this policy turns aevia into a publisher of third-party content; describing what we do not amplify is precisely the moderation that section 230(c)(2)(a) protects.',
    ncmecEyebrow: '§7 · ncmec cybertipline',
    ncmecBody:
      'apparent child sexual abuse material is reported to the ncmec cybertipline per 18 u.s.c. §2258a. we preserve the material for 90 days per §2258a(h), we do not review content beyond the minimum required to report (so as not to compromise the private-search understanding under the 4th amendment), and we do not allow appeal. there is no judgment call.',
    sanctionsEyebrow: '§8 · ofac',
    sanctionsTitle: 'sanctions and excluded jurisdictions',
    sanctionsBody:
      'aevia services are not available to residents, entities, or operators located in jurisdictions under comprehensive united states sanctions (office of foreign assets control — ofac), including but not limited to cuba, iran, north korea, syria, and occupied regions of ukraine. also excluded are persons and entities listed on the specially designated nationals and blocked persons list. use in violation of these restrictions may result in immediate blocking and reporting to the competent authorities.',
    privacyTitle: 'privacy and personal data',
    privacyBody1: 'the processing of personal data is governed by the',
    privacyBodyLink: 'privacy policy',
    privacyBody2:
      'of aevia, which covers ccpa/cpra (california), gdpr (eu), lgpd (brazil), and the associated data subject rights. aevia llc does not sell personal data under the ccpa definition.',
    arbitrationTitle: 'dispute resolution and class-action waiver',
    arbitrationBody:
      'any controversy, claim, or dispute arising from this policy or from the use of aevia services will be resolved by binding individual arbitration, conducted by the american arbitration association (aaa) under the commercial arbitration rules, seated in wilmington, delaware, in english. you and aevia expressly waive the right to jury trial and to participate in a class action or collective arbitration, whether as represented party or representative. this clause is governed by the federal arbitration act (9 u.s.c. §§1–16). opt-out available within 30 days after first use of the service by emailing contact@aevia.network with subject arbitration opt-out.',
    liabilityTitle: 'limitation of liability and warranty',
    liabilityBody:
      'aevia services are provided “as is” and “as available”, without express or implied warranty of fitness, availability, freedom from errors, or non-infringement. to the maximum extent permitted by law, aevia llc, its affiliates, directors, employees, and agents aggregate liability for any cause, contractual or non-contractual, shall not exceed the total amount effectively paid by the user to aevia in the twelve months prior to the event giving rise to the claim, or usd 100, whichever is greater. in no event will aevia be liable for indirect, incidental, special, consequential, punitive damages, or lost profits.',
    indemnityTitle: 'indemnification',
    indemnityBody:
      'the user agrees to indemnify and hold aevia llc harmless from any claim, demand, liability, damage, loss, or expense (including reasonable attorney fees) arising out of or related to: (i) content published by the user; (ii) breach of this policy or of the terms of service; (iii) breach of third-party rights; (iv) misuse of the services.',
    jurisdictionEyebrow: '§13 · jurisdiction',
    jurisdictionBody:
      'this policy is published by aevia llc, a delaware limited liability company, united states of america. governed by delaware law, excluding its conflict-of-laws rules. disputes not subject to the §10 arbitration clause (including intellectual property actions) are resolved in the state or federal courts located in delaware, and the parties consent to such jurisdiction. the united nations convention on contracts for the international sale of goods (cisg) does not apply. versions of this policy in other languages are for convenience; the english version prevails in case of conflict.',
  },
  privacy: {
    meta: {
      title: 'privacy · aevia.network',
      description:
        'aevia privacy policy. what we collect, why, how you exercise rights under ccpa, gdpr, and lgpd, and how we can be reached.',
    },
    eyebrow: 'policy · privacy',
    title: 'privacy policy',
    subtitle:
      'what we collect, why, how we retain it, and how you exercise rights under ccpa/cpra (california), gdpr (european union), and lgpd (brazil).',
    stamp: 'version 0.1 · published 2026-04-17 · controller: aevia llc · delaware, usa',
    controllerTitle: 'who controls your data',
    controllerBodyA:
      'the controller (data controller / operador) is aevia llc, a delaware limited liability company, united states of america. privacy contact:',
    controllerBodyB:
      '. for lgpd in brazil, this address also functions as the encarregado/dpo channel.',
    collectTitle: 'what we collect and why',
    collectLead:
      'the aevia design minimizes collection of personal data. what we collect, we collect with explicit purpose:',
    collectItems: [
      {
        tag: 'email',
        text: '— when you reach out, request provider-node waitlist, or file a dmca notice. purpose: respond to the specific request.',
      },
      {
        tag: 'wallet address',
        text: '— when you sign a manifest or operate a provider node. it is a public identifier on base l2; we do not treat it as a secret, but we record association with your operation.',
      },
      {
        tag: 'technical request logs',
        text: '— ip, user-agent, route, status code, timestamp. purpose: service operation, security, debugging. maximum retention: 30 days.',
      },
      {
        tag: 'aggregate metrics',
        text: '— request counts and aggregated geographic origin via cloudflare analytics. do not identify individuals.',
      },
    ],
    collectFooter:
      'aevia does not collect sensitive data (art. 11 lgpd, art. 9 gdpr) without explicit consent and specific purpose. aevia does not build commercial profiles, does not sell personal data under the ccpa definition, and does not share data with data brokers.',
    legalBasisEyebrow: '§3 · gdpr/lgpd',
    legalBasisTitle: 'legal basis for processing',
    legalBasisLead: 'the legal bases under gdpr art. 6 and lgpd art. 7 are:',
    legalBasisItems: [
      {
        tag: 'contract performance',
        text: '— to operate the service you requested (sign a manifest, operate a provider node).',
      },
      {
        tag: 'legitimate interest',
        text: '— for security, fraud prevention, debugging (technical logs).',
      },
      {
        tag: 'legal obligation',
        text: '— to respond to dmca takedowns, subpoenas, ncmec reports.',
      },
      {
        tag: 'consent',
        text: '— when explicitly requested (e.g., communication about protocol updates).',
      },
    ],
    rightsTitle: 'rights you have',
    rightsLead:
      'depending on your jurisdiction, you have rights over your personal data. aevia recognizes them universally to the maximum we can operate. send a request to contact@aevia.network with subject privacy request and specify which right. we reply within 30 days.',
    rightsItems: [
      {
        tag: 'access',
        text: '— obtain a copy of the personal data we hold (ccpa §1798.100, gdpr art. 15, lgpd art. 18 II).',
      },
      { tag: 'rectification', text: '— correct inaccurate data (gdpr art. 16, lgpd art. 18 III).' },
      {
        tag: 'deletion',
        text: '— delete data no longer necessary (ccpa §1798.105, gdpr art. 17, lgpd art. 18 VI). caveat: manifests anchored on base l2 are immutable by design; what we can delete are off-chain associations.',
      },
      {
        tag: 'portability',
        text: '— receive your data in a structured format (gdpr art. 20, lgpd art. 18 V).',
      },
      {
        tag: 'objection / sale opt-out',
        text: '— restrict legitimate-interest processing (gdpr art. 21). aevia does not sell data, but we respect such objection as general policy (ccpa §1798.120).',
      },
      {
        tag: 'human review',
        text: '— for automated decisions that significantly affect you (gdpr art. 22, lgpd art. 20). applicable to the risk score; you may request manual review.',
      },
    ],
    retentionTitle: 'retention and minimization',
    retentionBody:
      'technical logs: 30 days. contact records (emails): 2 years. dmca and counter-notification records: as required by law (17 u.s.c. §512). ncmec reports: 90 days per 18 u.s.c. §2258a(h). we delete data once it leaves all these windows.',
    transferTitle: 'international transfers',
    transferBody:
      'aevia is based in the united states. data of european economic area users transferred to the united states is protected by standard contractual clauses (gdpr art. 46(2)(c)). for brazilian data subjects, international transfers rely on specific clauses per lgpd art. 33. we will update this paragraph if we join the eu–us data privacy framework.',
    processorsTitle: 'third-party processors',
    processorsLead:
      'aevia uses the following processors to operate the service. each has a formal data processing agreement (dpa) and cannot use the data for its own purposes:',
    processorsItems: [
      {
        tag: 'cloudflare',
        text: '— hosting, cdn, aggregated analytics, email routing. standard dpa.',
      },
      {
        tag: 'privy',
        text: '— embedded wallet and creator authentication. data: wallet address, optional email.',
      },
      {
        tag: 'base (coinbase)',
        text: '— l2 blockchain network where manifests are anchored. all transactions are public by design.',
      },
    ],
    cookiesTitle: 'cookies',
    cookiesBody:
      'aevia.network uses only strictly necessary cookies (language toggle, privy session). there are no tracking, advertising, or third-party analytics cookies. if we add any in the future, a consent banner is required (gdpr ePrivacy, lgpd art. 8).',
    minorsTitle: 'minor privacy',
    minorsBodyA: 'per',
    minorsBodyLink: 'aup §3',
    minorsBodyB:
      ', aevia is not directed to users under 13 (coppa), 16 in the eea (gdpr art. 8), and requires parental authorization for ages 13–17 in brazil (lgpd art. 14). if we discover personal data of a minor below the applicable age, that data is deleted without the need for a formal request.',
    changesTitle: 'changes to this policy',
    changesBodyA:
      'when we materially amend this policy, we update the version at the top and publish a notice on the',
    changesBodyLink: 'roadmap',
    changesBodyB:
      '. changes that restrictively affect data-subject rights take effect 30 days after publication, giving time for prior exercise of current rights.',
    contactEyebrow: '§11 · privacy contact',
    contactBody1: 'aevia llc · delaware, usa ·',
    contactBody2:
      '. for complaints to a supervisory authority: usa — state ag of residence; eea — national data protection authority; brazil — autoridade nacional de proteção de dados (anpd).',
  },
  terms: {
    meta: {
      title: 'terms · aevia.network',
      description:
        'aevia terms of service. the agreement between you and aevia llc. read before using the network.',
    },
    eyebrow: 'policy · terms',
    title: 'terms of service',
    subtitle:
      'this is the agreement between you and aevia llc. by using aevia.network, aevia.video, or any aevia service, you agree to the terms below. read before using.',
    stamp: 'version 0.1 · published 2026-04-17 · jurisdiction delaware, usa',
    acceptTitle: 'acceptance',
    acceptBodyA:
      'by accessing or using the aevia services (including aevia.network, aevia.video, the underlying protocol, and any surface identified as operated by aevia llc), you accept these terms and the',
    acceptBodyAup: 'acceptable use policy',
    acceptBodyB: 'and the',
    acceptBodyPrivacy: 'privacy policy',
    acceptBodyC: ', which are incorporated by reference. if you do not agree, do not use.',
    eligibilityTitle: 'eligibility',
    eligibilityBody:
      'you represent that you meet the applicable minimum age per aup §3, that you are not located in a jurisdiction under comprehensive ofac sanctions (aup §8), that you are not listed on the specially designated nationals and blocked persons list, and that you have legal capacity to enter into this contract. if you use aevia on behalf of a legal entity, you represent that you have authority to bind that entity.',
    accountTitle: 'account and responsibility',
    accountBody:
      'the aevia account is anchored to a wallet operated via privy. you are responsible for protecting the credentials associated with your wallet and for every action executed from it. aevia cannot reverse on-chain transactions, recover lost keys, or undo cryptographic signatures. loss of wallet access means loss of the ability to sign future manifests — previously anchored content remains on ipfs and base l2.',
    licenseTitle: 'user content: ownership and license',
    licenseBody1:
      'you retain all rights in the content you publish on aevia. you grant us, for the service operation period, a non-exclusive, royalty-free, worldwide, sublicensable license limited to the following purposes: (i) to store and replicate the content via provider nodes to fulfill your manifest; (ii) to transmit the content to end users who request it; (iii) to display it on editorial surfaces (feed, ranking) when eligible per aup. the license terminates automatically if you delete the canonical reference — provided that on-chain content and ipfs content remain immutable by design.',
    licenseBody2:
      'you represent that you hold the necessary rights to grant this license and that the content does not infringe third-party rights.',
    prohibitedTitle: 'prohibited use and excluded content',
    prohibitedBodyA: 'use of the service is subject to the',
    prohibitedBodyLink: 'acceptable use policy',
    prohibitedBodyB:
      '. the aup governs what the protocol does not amplify and how we respond to abuse. violations may result in loss of subsidy, de-indexing, suspension, or termination per §7.',
    ipTitle: 'intellectual property and takedowns',
    ipBodyA:
      'dmca procedures (17 u.s.c. §512) and notice-and-action (dsa, (eu) 2022/2065) are described in',
    ipBodyAupLink: 'aup §4 and §5',
    ipBodyB:
      '. “aevia”, “aevia.network”, “aevia.video”, and the wordmark are trademarks of aevia llc. source-code licenses (apache-2.0 for contracts/protocol-spec, agpl-3.0 for clients, mit for the design system) are in',
    ipBodyLicensesLink: 'LICENSES.md',
    ipBodyC: '.',
    terminationTitle: 'termination',
    terminationBody:
      'you may stop using at any time; previously anchored manifests remain on ipfs and base l2 by design. aevia may suspend or terminate your access to subsidy, ranking, and feed for material aup breach, for dmca recidivism per the strikes policy (aup §4), for legal obligation, or at its own discretion upon reasonable prior notice (except in cases of criminal content requiring immediate action).',
    warrantyTitle: 'warranty disclaimer',
    warrantyBody:
      'the service is provided “as is” and “as available”. aevia disclaims, to the maximum extent permitted by applicable law, all express, implied, or statutory warranties, including warranties of merchantability, fitness for a particular purpose, title, and non-infringement. aevia does not guarantee that the service will be uninterrupted, error-free, or safe from data loss. blockchain, ipfs, and p2p are new technologies — you assume the technological risk.',
    liabilityTitle: 'limitation of liability',
    liabilityBody:
      'to the maximum extent permitted by law, the total liability of aevia llc, its affiliates, directors, employees, and agents for any aggregate cause shall not exceed the greater of (a) usd 100, or (b) the total effectively paid by you to aevia in the 12 months preceding the event. in no event will aevia be liable for indirect, incidental, special, consequential, punitive damages, or for lost profits, data loss, reputation loss, or any damage aevia could not reasonably foresee.',
    indemnityTitle: 'indemnification',
    indemnityBody:
      'you agree to indemnify and hold aevia llc harmless from any claim, liability, damage, loss, or expense (including reasonable attorney fees) arising out of: (i) content you published; (ii) breach of these terms or of the aup; (iii) breach of third-party rights; (iv) misuse of the service.',
    arbitrationTitle: 'dispute resolution and class-action waiver',
    arbitrationBodyA:
      'disputes arising from these terms are resolved by binding individual arbitration per',
    arbitrationBodyLink: 'aup §10',
    arbitrationBodyB:
      ', governed by the federal arbitration act (9 u.s.c. §§1–16) and administered by the aaa under the commercial arbitration rules, seated in wilmington, delaware. you waive jury trial and class actions. opt-out available within 30 days of first use by emailing contact@aevia.network with subject arbitration opt-out.',
    lawTitle: 'governing law and venue',
    lawBody:
      'these terms are governed by the law of the state of delaware, united states of america, excluding its conflict-of-laws rules. disputes not submitted to arbitration (e.g., intellectual property actions) are resolved in the state or federal courts located in delaware, and the parties consent to such jurisdiction. the united nations convention on contracts for the international sale of goods (cisg) does not apply.',
    modificationsTitle: 'modifications to these terms',
    modificationsBody:
      'we may modify these terms. material changes take effect 30 days after publication, giving you time to leave if you disagree. non-material changes (such as editorial corrections or address updates) take effect upon publication.',
    wholeTitle: 'entirety, severability, assignment',
    wholeBody:
      'these terms, together with the aup, the privacy policy, and any published addendum, constitute the entire agreement between you and aevia llc regarding the service, and supersede any prior agreement. if any provision is held invalid, the remaining provisions remain in effect. non-exercise of a right does not imply waiver. you may not assign your rights under this agreement without written consent from aevia; aevia may assign freely.',
    contactEyebrow: '§15 · contractual contact',
    contactBody1: 'aevia llc · delaware, usa ·',
    contactBody2:
      '. postal deliveries must be addressed to aevia llc’s registered agent in the state of delaware (details provided upon request).',
  },
  spec: {
    meta: {
      title: 'spec · aevia.network',
      description: 'index of the aevia protocol normative rfcs.',
    },
    eyebrow: 'protocol · spec',
    title: 'specification',
    subtitle:
      'six normative documents in ietf style. they govern manifest schema, content addressing, identity, aup, persistence pool, and risk score.',
    stamp:
      'version 0.1 · canonical source github.com/Leeaandrob/aevia/tree/main/docs/protocol-spec',
    coverA:
      'aevia rfcs follow the ietf style and use rfc 2119 for normative language — MUST and SHOULD carry weight. they are at once the source of truth for implementers and the public contract that investors and lawyers can read.',
    coverB:
      'each rfc is versioned in the repository and anchored on base l2 when published. the index below shows current state. individual rendering is at /spec/{slug}.',
    tableHeaders: {
      slug: 'slug',
      title: 'title',
      status: 'status',
      updated: 'last updated',
    },
    status: {
      published: 'published',
      draft: 'draft',
      planned: 'planned',
    },
    rows: [
      { slug: 'rfc-0', title: 'protocol overview', status: 'published', updated: '2026-04-14' },
      { slug: 'rfc-1', title: 'manifest schema', status: 'published', updated: '2026-04-15' },
      { slug: 'rfc-2', title: 'content addressing', status: 'published', updated: '2026-04-15' },
      {
        slug: 'rfc-3',
        title: 'authentication and signature',
        status: 'published',
        updated: '2026-04-16',
      },
      { slug: 'rfc-4', title: 'acceptable use policy', status: 'published', updated: '2026-04-16' },
      { slug: 'rfc-5', title: 'persistence pool', status: 'published', updated: '2026-04-16' },
      { slug: 'rfc-6', title: 'risk score', status: 'planned', updated: 'sprint 3' },
      { slug: 'rfc-7', title: 'moderation', status: 'planned', updated: 'sprint 4' },
    ],
    documentsLabel: 'documents',
    cards: [
      {
        n: 0,
        slug: 'rfc-0',
        title: 'overview',
        abstract:
          'how the layers fit together. what the thesis is. what is in scope and what is not.',
        sectionsLabel: '14 sections',
      },
      {
        n: 1,
        slug: 'rfc-1',
        title: 'manifest schema',
        abstract:
          'signed json structure describing each piece of content: cid, creator, segments, metadata, signature.',
        sectionsLabel: '14 sections',
      },
      {
        n: 2,
        slug: 'rfc-2',
        title: 'content addressing',
        abstract: 'cid, ipfs, gateways, and the immutability guarantee of content on base l2.',
        sectionsLabel: '14 sections',
      },
      {
        n: 3,
        slug: 'rfc-3',
        title: 'authentication and signature',
        abstract: 'privy embedded wallet on base, eip-712, offline verification without gas.',
        sectionsLabel: '14 sections',
      },
      {
        n: 4,
        slug: 'rfc-4',
        title: 'acceptable use policy',
        abstract: 'what aevia does not amplify, why that preserves section 230, dmca procedures.',
        sectionsLabel: '14 sections',
      },
      {
        n: 5,
        slug: 'rfc-5',
        title: 'persistence pool',
        abstract:
          'how cusdc flows to nodes that prove replication, payment formula, and monitoring.',
        sectionsLabel: '14 sections',
      },
    ],
    readDocument: 'read document',
    referencesLabel: 'references',
  },
  rfc: {
    meta: (eyebrow: string, title: string) => ({
      title: `${eyebrow} · aevia.network`,
      description: `normative rfc: ${title}.`,
    }),
    onPage: 'on this page',
    tocScope: '§1 · scope',
    tocTerminology: '§2 · terminology',
    tocExclusions: '§3 · exclusions',
    tocCompliance: '§4 · compliance',
    tocReferences: '§5 · references',
    backToIndex: '← back to index',
    versionLine: (date: string) => `version 0.1 · updated ${date} · status: published`,
    scopeTitle: 'scope',
    scopeP1:
      'this document defines [rfc scope, e.g., aevia’s acceptable use policy, or the canonical manifest schema]. it applies to all protocol clients and provider nodes.',
    scopeP2A: 'the keywords',
    scopeP2B: 'in this document are to be interpreted as described in rfc 2119.',
    terminologyTitle: 'terminology',
    terminologyLead: 'the terms below are used throughout the rfc with the meaning set out here.',
    termsList: [
      { term: 'manifest', def: 'signed json document describing a piece of content' },
      { term: 'cid', def: 'content identifier derived from the sha-256 hash of the content' },
      { term: 'provider node', def: 'agent that replicates and serves content for compensation' },
      { term: 'persistence pool', def: 'treasury that compensates provider nodes in cusdc' },
    ],
    exclusionsTitle: 'exclusions',
    exclusionsLead:
      'the protocol does not subsidize, amplify, or index the following content categories — they may exist on raw ipfs but do not receive a check, feed, or ranking.',
    exclusionsList: [
      'pornography and sexually explicit content',
      'any sexualization of minors (absolute zero tolerance; reporting to ncmec)',
      'celebratory apologia of violence',
      'material that sexualizes persons without consent',
      'apologia of occult practices or satanism',
    ],
    complianceTitle: 'compliance',
    complianceP1:
      'enforcement is multi-layer. the protocol makes the first cut via an off-chain risk score. the council has veto authority over parameters but not over bits existing on ipfs.',
    complianceP2:
      'dmca takedowns follow 17 u.s.c. §512. the designated agent receives notices at contact@aevia.network. the procedure respects the 10–14 business-day counter-notification window.',
    referencesTitle: 'references',
  },
  transparency: {
    meta: {
      title: 'transparency · aevia.network',
      description:
        'aevia transparency report. dmca takedown metrics, dsa notice-and-action, ncmec reports, council deliberations.',
    },
    eyebrow: 'policy · transparency',
    title: 'transparency report',
    subtitle:
      'what we publish, when, and why. aevia operates under art. 15 and 17 of the digital services act and under united states section 230. recurring transparency is a condition of our public editorial posture.',
    stamp: 'first eligible window: 2027-02-17 (12 months after the first eligible commercial use)',
    leadParagraphs: [
      'this is a public commitment, not a report. aevia has not yet reached the first eligible window for a dsa art. 15 report. until then, this page documents which metrics will be published, at what cadence, and where the historical record will live.',
      'aevia’s thesis — persistence does not imply distribution — is only credible if distribution decisions are auditable. this report is the instrument of that auditability: every feed, subsidy, or ranking change triggered by legal action becomes a public line here.',
    ],
    commitmentsTitle: 'normative commitments',
    commitments: [
      {
        tag: 'dsa art. 15',
        text: '— annual moderation report: removal requests received, addressed, contested; median response time; automated error rate; human resources allocated; suspension policy.',
      },
      {
        tag: 'dsa art. 17',
        text: '— individual justification for each distribution-restriction decision, whenever the user contests it. cited legal basis, alternatives considered, appeal channel.',
      },
      {
        tag: 'dmca §512',
        text: '— annual count of notices received, counter-notifications, strikes issued, accounts terminated for recidivism. published in the u.s. copyright office standard format.',
      },
      {
        tag: 'ncmec cybertipline',
        text: '— annual report count. content is never described — only the count and confirmation of escalation to ncmec per 18 u.s.c. §2258a.',
      },
      {
        tag: 'ecumenical council',
        text: '— text of parameter proposals, per-member votes, invoked vetoes, dissenting opinions. anchored on the trust ledger on base l2 at every deliberation.',
      },
      {
        tag: 'risk score',
        text: '— current formula, current weights, subsidy and feed thresholds, jury revisions. cryptographically signed changes.',
      },
    ],
    cadenceTitle: 'cadence and first reports',
    cadenceBody:
      'dsa reports: annual, published by 17 february, covering the previous calendar year. dmca reports: annual, published in january. council deliberations: published in near real-time on the trust ledger. individual strikes: direct notification to the affected user with textual justification in the user’s language.',
    statusTitle: 'current status (2026-04-17)',
    statusBody:
      'no report published yet — the platform has not reached the first eligible window. counters below reflect operation since bootstrap.',
    metricsHeaders: {
      metric: 'metric',
      count: 'count',
      window: 'window',
    },
    metrics: [
      { metric: 'dmca notices received', count: '0', window: 'since 2026-04' },
      { metric: 'dmca counter-notifications', count: '0', window: 'since 2026-04' },
      { metric: 'strikes issued', count: '0', window: 'since 2026-04' },
      { metric: 'accounts terminated for recidivism', count: '0', window: 'since 2026-04' },
      { metric: 'dsa notices received (eea)', count: '0', window: 'since 2026-04' },
      { metric: 'ncmec reports', count: '0', window: 'since 2026-04' },
      { metric: 'council deliberations', count: '0', window: 'council in bootstrap' },
      { metric: 'manual risk-score reviews', count: '0', window: 'since 2026-04' },
    ],
    archiveTitle: 'historical archive',
    archiveBody:
      'every published report will be linked here by year. the first report will be published on 2027-02-17. prior reports will be available as signed pdf and canonicalized html.',
    contactTitle: 'complaints, corrections, and requests',
    contactBody1: 'if you believe a metric in this report is incorrect, email',
    contactBody2:
      ' with subject transparency correction. we respond publicly — the correction and its reason appear in the next report.',
  },
  notFound: {
    label: '404 · page not found',
    headline: 'either you lost it, or it never existed.',
    body: 'the aevia protocol only indexes what has been canonically signed. if you followed an outside link to a route not in the spec, the route likely changed name before becoming official.',
    home: 'back to home',
    spec: 'go to spec',
    quote: '“persistence does not imply distribution.”',
  },
  whitepaper: {
    meta: {
      title: 'whitepaper · aevia.network',
      description:
        'Aevia — a protocol for sovereign video distribution. Technical specification v1.',
    },
    eyebrow: 'protocol · whitepaper',
    title: 'Aevia',
    subtitle: 'A protocol for sovereign video distribution.',
    author: 'Leandro Barbosa · Aevia LLC · version 1 · April 2026',
    version: 'v1 · April 2026',
    contents: 'contents',
    downloadPdf: 'save as pdf →',
    legalNoteLabel: 'legal note',
    legalNote:
      'This document describes a protocol architecture. It is not an offer of securities. The cUSDC flows described in §5 and §12 represent fee-for-service compensation for infrastructure provided to the protocol; they are not returns on invested capital. Forward-looking statements about future releases, RFCs, or features may change without notice. Nothing in this paper constitutes legal, financial, or investment advice.',
    referencesLabel: 'references',
    toc: [
      { id: 'abstract', label: 'Abstract' },
      { id: 's1-introduction', label: '1. Introduction' },
      { id: 's2-content-addressing', label: '2. Content Addressing' },
      { id: 's3-signed-manifests', label: '3. Signed Manifests' },
      { id: 's4-content-registry', label: '4. Content Registry' },
      { id: 's5-persistence-pool', label: '5. Persistence Pool' },
      { id: 's6-network-layer', label: '6. Network Layer' },
      { id: 's7-risk-score', label: '7. Risk Score' },
      { id: 's8-governance', label: '8. Governance' },
      { id: 's9-privacy-model', label: '9. Privacy Model' },
      { id: 's10-adversarial-analysis', label: '10. Adversarial Analysis' },
      { id: 's11-simplified-verification', label: '11. Simplified Verification' },
      { id: 's12-economic-model', label: '12. Economic Model' },
      { id: 's13-related-work', label: '13. Related Work' },
      { id: 's14-conclusion', label: '14. Conclusion' },
      { id: 'references', label: 'References' },
    ],
  },
};
