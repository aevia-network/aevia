import { AEVIA_CHAIN_ID_MAINNET, appChainId } from '@aevia/auth';
import type { Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';

/**
 * Resolve the active viem `Chain` object from `NEXT_PUBLIC_APP_ENV`. Mirrors
 * `appChainId()` from `@aevia/auth` so the two helpers stay in lockstep — when
 * the chain id is mainnet, the viem chain is `base`; otherwise `baseSepolia`.
 *
 * Lives in the app rather than `@aevia/auth/chains.ts` to keep the auth
 * package free of viem's chain-metadata dep tree.
 */
export function appChain(): Chain {
  return appChainId() === AEVIA_CHAIN_ID_MAINNET ? base : baseSepolia;
}

/**
 * Default JSON-RPC URL for the active chain. Reads `viem`'s built-in chain
 * metadata so a single mainnet flip rewires every consumer (no copy of the
 * URL in env or component code). The final `??` guards against viem ever
 * shipping a chain definition without a default RPC tuple — strictly defensive
 * since both `base` and `baseSepolia` always carry one today.
 */
export function defaultRpcUrl(): string {
  return appChain().rpcUrls.default.http[0] ?? 'https://sepolia.base.org';
}

/**
 * Block-explorer base URL for the active chain (Basescan on mainnet,
 * Sepolia Basescan on testnet). Uses `viem`'s chain metadata.
 */
export function explorerUrl(): string {
  return appChain().blockExplorers?.default?.url ?? 'https://basescan.org';
}

/** Convenience: explorer URL for an account address. */
export function explorerAddressUrl(address: string): string {
  return `${explorerUrl()}/address/${address}`;
}

/** Convenience: explorer URL for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  return `${explorerUrl()}/tx/${hash}`;
}
