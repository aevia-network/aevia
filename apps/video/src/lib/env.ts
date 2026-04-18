import { z } from 'zod';

/**
 * Server-only env. Accessed in API routes, server components, middleware.
 * Parsed lazily so that `next build` static pages don't require live secrets.
 */
const serverSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID required'),
  STREAM_API_TOKEN: z.string().min(1, 'STREAM_API_TOKEN required'),
  STREAM_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, 'NEXT_PUBLIC_PRIVY_APP_ID required'),
  PRIVY_APP_SECRET: z.string().min(1, 'PRIVY_APP_SECRET required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment:\n${issues}\n\nSee SETUP.md`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Relayer env — separate schema because these vars are only required by the
 * `register-relayed` route, not by any server-rendered page. Pages that never
 * touch the relayer must continue to render when the key is absent.
 *
 * Contract: callers handle the `null` result and surface it as a 500
 * `relayer_not_configured` to the client rather than throwing. That keeps
 * every other route healthy when the relayer is temporarily de-provisioned
 * (e.g., funding drained and ops hasn't topped it up yet).
 */
const relayerSchema = z.object({
  RELAYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'RELAYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string'),
  BASE_SEPOLIA_RPC_URL: z.string().url().default('https://sepolia.base.org'),
});

export type RelayerEnv = z.infer<typeof relayerSchema>;

export function getRelayerEnv(): RelayerEnv | null {
  const parsed = relayerSchema.safeParse({
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
    BASE_SEPOLIA_RPC_URL: process.env.BASE_SEPOLIA_RPC_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.error('[relayer] env invalid or missing:', issues);
    return null;
  }
  return parsed.data;
}

/**
 * Client-side env. Only `NEXT_PUBLIC_*` vars are included — never put secrets here.
 */
export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV ?? 'development') as
    | 'development'
    | 'preview'
    | 'production',
  streamCustomerCode: process.env.NEXT_PUBLIC_STREAM_CUSTOMER_CODE,
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  /**
   * Dev-only bypass that skips Privy entirely. When true:
   *   - Providers.tsx renders children without AeviaPrivyProvider, so
   *     @walletconnect/* is never imported (fixes the Next dev SSR 500
   *     from walletconnect/types bundling).
   *   - Server-side readAeviaSession returns a stable mock session.
   *   - Sign-in UI on / is replaced with a banner + direct link to /feed.
   * MUST be falsy in prod — Cloudflare Pages deploys read
   * NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH from the project env.
   */
  devBypassAuth: process.env.NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH === 'true',
} as const;
