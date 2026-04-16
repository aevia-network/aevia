/**
 * Minimal service worker — satisfies Chrome desktop install-prompt criteria
 * (an SW must exist for a PWA to be installable).
 *
 * No fetch handler: an empty `fetch` listener marks the SW as
 * fetch-intercepting to the browser even though it does nothing. Some
 * browsers (and some Cloudflare CDN paths) treat a client with a
 * fetch-intercepting SW differently and were occasionally emitting
 * `ERR_CONNECTION_CLOSED` on the manifest request. Removing the listener
 * keeps the SW present for the install-prompt check but leaves network
 * handling entirely to the browser.
 *
 * P2P cache lands in Sprint 3 via js-libp2p in a Web Worker with a
 * custom HLS.js fragment loader; the service worker stays simple here.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
