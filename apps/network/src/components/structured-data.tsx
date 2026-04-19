/**
 * JSON-LD structured data block for aevia.network.
 *
 * Emits Organization + WebSite schema.org entities so search engines
 * (Google, Bing, Brave) and LLM crawlers (Perplexity, ChatGPT search,
 * Claude with web access) can build a coherent entity card.
 *
 * Reference: https://schema.org / https://json-ld.org
 */
export function StructuredData({ baseUrl }: { baseUrl: string }) {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Aevia LLC',
    alternateName: 'aevia.network',
    url: baseUrl,
    logo: `${baseUrl}/icon.svg`,
    description:
      'Operator of the Aevia protocol — sovereign video distribution. Persistence does not imply distribution.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      name: 'Delaware, United States',
    },
    sameAs: ['https://github.com/aevia-network', 'https://aevia.video'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'general',
      email: 'contact@aevia.network',
      availableLanguage: ['en', 'pt-BR'],
    },
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'aevia.network',
    url: baseUrl,
    description:
      'Protocol home for Aevia. Whitepaper, RFC specification, AUP, roadmap, manifesto, FAQ.',
    inLanguage: ['en', 'pt-BR'],
    publisher: {
      '@type': 'Organization',
      name: 'Aevia LLC',
      url: baseUrl,
    },
  };

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Aevia Protocol',
    applicationCategory: 'CommunicationApplication',
    operatingSystem: 'Linux, macOS, Windows',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Open protocol for sovereign video distribution. Provider-node runs in Go over libp2p; on-chain settlement on Base L2 in non-custodial USDC.',
    url: baseUrl,
    softwareVersion: '0.1',
    author: {
      '@type': 'Organization',
      name: 'Aevia LLC',
    },
    license: 'https://github.com/aevia-network/aevia/blob/main/LICENSES.md',
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
    </>
  );
}
