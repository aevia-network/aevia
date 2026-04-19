import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1115',
        gap: 12,
        borderRadius: 32,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 88,
          height: 88,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 88,
            height: 88,
            borderRadius: '50%',
            border: '4px solid rgba(63,107,92,0.18)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '5px solid rgba(63,107,92,0.45)',
          }}
        />
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#3F6B5C',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: 'sans-serif',
          fontSize: 22,
          fontWeight: 700,
          color: '#F3EEE4',
          letterSpacing: -0.4,
        }}
      >
        aevia
      </div>
    </div>,
    { ...size },
  );
}
