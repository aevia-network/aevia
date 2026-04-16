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
} as const;
