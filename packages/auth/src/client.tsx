'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { base, baseSepolia, defaultChain } from './chains-viem';

export interface AeviaPrivyProviderProps {
  appId: string;
  children: ReactNode;
}

/**
 * Wrap the app tree with Privy configured for Aevia.
 *
 * Embedded-wallet-only mode: external wallet login (`'wallet'`) is
 * intentionally excluded from `loginMethods`. Every user signs in via
 * email / Google / Apple / Passkey and Privy mints a Base L2 smart
 * wallet for them server-side (`createOnLogin: 'all-users'`).
 *
 * Why no external wallets:
 *
 * - Aevia D2 (Cloudflare-only stack, see CLAUDE.md) prescribes Privy
 *   embedded smart wallet on Base as the canonical identity primitive.
 *   External wallets are not part of the model.
 *
 * - When two browser wallet extensions race to inject `window.ethereum`
 *   (Coinbase + MetaMask, Phantom + MetaMask, etc.), the loser defines
 *   the property as a getter-only and the winner can't overwrite it.
 *   The loser then throws EIP-1193 code 4900 ("provider disconnected
 *   from all chains") in a loop, and any Privy hook that touches the
 *   injected provider stalls — observed 2026-04-19 with the EIP-712
 *   register flow stuck on "assinando manifesto…", reproducible with
 *   any user running >1 wallet extension. Sentry issues AEVIA-VIDEO-2
 *   and -3 captured the same root cause as background noise.
 *
 * - Forcing embedded-only collapses the wallet enumeration surface.
 *   `useWallets()` may still return external entries when the browser
 *   injects them, so callers MUST pick the embedded one explicitly:
 *   `wallets.find(w => w.walletClientType === 'privy')` instead of
 *   `wallets[0]`.
 *
 * Other config:
 * - Base L2 as the default chain (mainnet in production, sepolia otherwise).
 * - Dark theme with the Verdigris accent (#3f6b5c) per the design system.
 */
export function AeviaPrivyProvider({ appId, children }: AeviaPrivyProviderProps) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'apple', 'passkey'],
        appearance: {
          theme: 'dark',
          accentColor: '#3f6b5c',
          walletChainType: 'ethereum-only',
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
        defaultChain: defaultChain(),
        supportedChains: [base, baseSepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export {
  useLogin,
  useLogout,
  usePrivy,
  useSendTransaction,
  useSignTypedData,
  useUser,
  useWallets,
} from '@privy-io/react-auth';

export { AEVIA_CHAIN_ID_MAINNET, AEVIA_CHAIN_ID_SEPOLIA, appChainId } from './chains';
export { addressToDid, didChainId, didToAddress, shortAddress } from './did';
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
