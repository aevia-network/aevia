'use client';

import { useEffect } from 'react';

/**
 * Registers the minimal service worker (public/sw.js) on mount.
 * Required for Chrome desktop's PWA install prompt. iOS "Add to Home Screen"
 * works from the manifest alone, but registering here is harmless there.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Silent — SW failure must not break the app.
    });
  }, []);

  return null;
}
