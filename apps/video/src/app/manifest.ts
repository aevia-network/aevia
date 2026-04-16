import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'aevia — vídeo sem intermediários',
    short_name: 'aevia',
    description:
      'live de baixa latência, vod automático, clips virais. seu conteúdo, sua audiência, seu protocolo.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0F1115',
    theme_color: '#0F1115',
    lang: 'pt-BR',
    orientation: 'any',
    categories: ['video', 'social', 'entertainment'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
