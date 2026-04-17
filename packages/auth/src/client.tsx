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
 * - Login methods: email, Google, Apple, Passkey, external wallet.
 * - Embedded wallet created for users who log in without bringing one.
 * - Base L2 as the default chain (mainnet in production, sepolia otherwise).
 * - Dark theme with the Verdigris accent (#3f6b5c) per the design system.
 */
export function AeviaPrivyProvider({ appId, children }: AeviaPrivyProviderProps) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'apple', 'passkey', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#3f6b5c',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: defaultChain(),
        supportedChains: [base, baseSepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export { useLogin, useLogout, usePrivy, useUser } from '@privy-io/react-auth';
