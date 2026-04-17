import { base, baseSepolia } from 'viem/chains';

/**
 * Viem chain metadata — separated from the pure constants in `chains.ts` so
 * that server-only code (route handlers, `readAeviaSession`) can import chain
 * ids without pulling viem's tree into the edge bundle. Only the client SDK
 * wrapper (`client.tsx`) touches these.
 */
export function defaultChain() {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  return env === 'production' ? base : baseSepolia;
}

export { base, baseSepolia };
