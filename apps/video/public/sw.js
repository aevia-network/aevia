/**
 * Minimal service worker — satisfies Chrome desktop install prompt criteria.
 * No caching logic here. P2P cache lands in Sprint 3 with js-libp2p in a
 * Web Worker + custom HLS.js fragment loader.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through. Browser handles the request normally.
});
