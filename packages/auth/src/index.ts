/**
 * @aevia/auth — shared auth primitives for Aevia.
 *
 * Subpath exports keep client-only deps (Privy React SDK + viem chain
 * metadata) out of server bundles:
 *
 * - `@aevia/auth` (this file): DID helpers, chain-id constants, types.
 *   Zero transitive deps — safe on edge, server, and client.
 * - `@aevia/auth/client`: Privy React provider (`'use client'`). Pulls
 *   react-auth + viem; must only be imported from client components.
 * - `@aevia/auth/server`: session + token verification. Pulls jose only.
 */

export { addressToDid, didToAddress, didChainId, shortAddress } from './did';
export { AEVIA_CHAIN_ID_MAINNET, AEVIA_CHAIN_ID_SEPOLIA } from './chains';
export type { AeviaDid, AeviaSession, LoginMethod } from './types';
export {
  CONTENT_REGISTRY_ABI,
  CONTENT_REGISTRY_ADDRESS,
  CONTENT_REGISTRY_DOMAIN_NAME,
  CONTENT_REGISTRY_DOMAIN_VERSION,
  REGISTER_CONTENT_TYPES,
  buildRegisterContentTypedData,
  contentRegistryAddress,
  sprint2PlaceholderManifestCid,
} from './register-content';
export type {
  BuildRegisterContentTypedDataArgs,
  RegisterContentTypedData,
} from './register-content';
