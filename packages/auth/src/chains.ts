export const AEVIA_CHAIN_ID_MAINNET = 8453;
export const AEVIA_CHAIN_ID_SEPOLIA = 84532;

/**
 * Resolve the active Aevia chain ID from `NEXT_PUBLIC_APP_ENV`.
 *
 * - `'production'` → Base Mainnet (8453)
 * - anything else (`'preview'`, `'development'`, `undefined`) → Base Sepolia (84532)
 *
 * Reads `process.env.NEXT_PUBLIC_APP_ENV` directly so the helper works in both
 * server and client bundles — Next.js inlines `NEXT_PUBLIC_*` at build time,
 * so there's no runtime drift between the two contexts. Use this everywhere
 * the chain selection matters (DID derivation, EIP-712 typed data, viem
 * client construction, contract address lookup) so the mainnet flip is a
 * single env change rather than a code sweep.
 */
export function appChainId(): number {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production'
    ? AEVIA_CHAIN_ID_MAINNET
    : AEVIA_CHAIN_ID_SEPOLIA;
}
