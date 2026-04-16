import { base, baseSepolia } from 'viem/chains';

export const AEVIA_CHAIN_ID_MAINNET = 8453;
export const AEVIA_CHAIN_ID_SEPOLIA = 84532;

export function defaultChain() {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  return env === 'production' ? base : baseSepolia;
}

export { base, baseSepolia };
