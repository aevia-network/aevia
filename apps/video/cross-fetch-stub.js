/**
 * Edge-safe + browser-safe replacement for `cross-fetch` / `cross-fetch/polyfill`.
 *
 * `cross-fetch/dist/browser-ponyfill.js` imports `whatwg-fetch`, which
 * replaces `globalThis.fetch` with an `XMLHttpRequest`-backed polyfill as
 * an import-time side effect. Cloudflare Workers have `fetch` but no
 * `XMLHttpRequest`, so any downstream fetch call throws
 * `ReferenceError: XMLHttpRequest is not defined` once the Worker
 * isolate has warmed a page route that loaded the Privy React SDK.
 *
 * Webpack's `resolve.alias` in `next.config.ts` points cross-fetch,
 * cross-fetch/polyfill, and whatwg-fetch at this file. Both server (edge)
 * and browser have native `fetch`, so the stub just re-exports it — no
 * polyfill, no global patching, no side effects.
 *
 * Must be ESM because `apps/video/package.json` sets `"type": "module"`.
 */
const fetchFn = globalThis.fetch.bind(globalThis);

export default fetchFn;
export const fetch = fetchFn;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
