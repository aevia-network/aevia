import { WalletScreen } from '@/components/wallet-screen';
import { defaultRpcUrl } from '@/lib/chain';
import { shortAddress } from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';
import { redirect } from 'next/navigation';

export const runtime = 'edge';
export const revalidate = 0;

/**
 * Sprint 2 wallet page. Real identity (DID, address, on-chain ETH balance
 * via viem); placeholder economy (credits + history) until the
 * PersistencePool + CreditToken contracts ship in Sprint 3.
 */
export default async function WalletPage() {
  const session = await readAeviaSession();
  if (!session) redirect('/');

  // Base Sepolia's public JSON-RPC — no key required, rate-limited but fine
  // for a single `eth_getBalance` on mount. For higher-throughput calls the
  // client would proxy through an edge route that reaches our keyed
  // Alchemy endpoint.
  return (
    <WalletScreen
      did={session.did}
      address={session.address}
      shortAddress={shortAddress(session.address)}
      rpcUrl={defaultRpcUrl()}
    />
  );
}
