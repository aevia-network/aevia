import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'aevia.network — sovereign video protocol';

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return new ImageResponse(<div />, size);
  }
  const dict = getDictionary(locale);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: '#0F1115',
        color: '#F3EEE4',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '999px',
            background: '#3F6B5C',
            border: '2px solid rgba(63, 107, 92, 0.4)',
            boxShadow: '0 0 0 4px rgba(63, 107, 92, 0.15)',
          }}
        />
        <span
          style={{
            fontSize: '28px',
            letterSpacing: '-0.01em',
            color: '#F3EEE4',
          }}
        >
          aevia.network
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <h1
          style={{
            fontSize: '80px',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
            color: '#F3EEE4',
            maxWidth: '1000px',
          }}
        >
          {dict.landing.hero.titleBefore}.
        </h1>
        <p
          style={{
            fontSize: '28px',
            lineHeight: 1.4,
            color: 'rgba(243, 238, 228, 0.7)',
            margin: 0,
            maxWidth: '900px',
          }}
        >
          {dict.landing.hero.subtitle}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '20px',
          color: 'rgba(243, 238, 228, 0.55)',
          fontFamily: 'monospace',
        }}
      >
        <span>Base Sepolia · {locale}</span>
        <span>persistence does not imply distribution</span>
      </div>
    </div>,
    size,
  );
}
