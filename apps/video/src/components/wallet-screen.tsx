'use client';

import { cn } from '@/lib/utils';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Compass,
  CreditCard,
  Database,
  History,
  Home,
  Plus,
  Radio,
  Send,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Mirrors Stitch screen `41894518677145719b70b7c1350f9ff7` ("Aevia — Carteira
 * & Créditos"). Real data where available (DID, address, on-chain ETH
 * balance, Basescan link); labelled placeholders everywhere the Persistence
 * Pool contracts have not yet shipped (credits balance, history). Every
 * "em breve" affordance matches the Stitch convention.
 *
 * Bottom nav is rendered inline here for Sprint 2 and will be factored into
 * a shared `AppShell` component during the Home Feed pass.
 */
export interface WalletScreenProps {
  /** Full `did:pkh:eip155:<chainId>:<address>` string from `readAeviaSession`. */
  did: string;
  /** Lowercased 0x address. */
  address: `0x${string}`;
  /** Short-form address e.g. `0xabcd…9f4`. */
  shortAddress: string;
  /** Base Sepolia RPC URL exposed to the client via `clientEnv.baseSepoliaRpc`. */
  rpcUrl?: string;
}

export function WalletScreen({ did, address, shortAddress, rpcUrl }: WalletScreenProps) {
  // --- On-chain ETH balance (real) -----------------------------------------
  // Uses the same public RPC the relayer + registration flow talks to.
  // Falls back to `null` if the RPC is unavailable; the UI shows a dash.
  const [ethBalance, setEthBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!rpcUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }),
        });
        if (!res.ok) return;
        const { result } = (await res.json()) as { result?: string };
        if (!result || cancelled) return;
        const wei = BigInt(result);
        // Render with 4 decimal places — typical for sub-ETH balances on testnet.
        const eth = Number(wei) / 1e18;
        setEthBalance(eth.toFixed(4));
      } catch {
        // Network hiccup — leave `null`, render "—".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, rpcUrl]);

  // --- Mocked credits + history (Persistence Pool = Sprint 3) --------------
  // The welcome bonus of 20 credits is promised in `TODO.md §5` but the
  // CreditToken contract ships in Sprint 3. Until then we render the
  // onboarding mint visually so the demo carries the economic message
  // without over-promising.
  const creditsBalance = 20;
  const creditsReceived = 20;
  const creditsSent = 0;

  type TransactionKind = 'onboarding' | 'received' | 'sent' | 'purchase';
  interface Transaction {
    kind: TransactionKind;
    counterpart?: string;
    label: string;
    timestamp: string;
    delta: number;
  }

  const transactions: Transaction[] = [
    {
      kind: 'onboarding',
      label: 'bônus de boas-vindas',
      counterpart: 'aevia',
      timestamp: 'ao criar carteira',
      delta: 20,
    },
  ];

  return (
    <div className="min-h-screen pb-28">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-surface-container-low px-4">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="voltar"
            className="rounded-full p-2 text-tertiary transition-colors hover:bg-surface-container active:scale-95"
          >
            <ArrowLeft className="size-6" aria-hidden />
          </Link>
          <h1 className="font-headline font-semibold text-base text-on-surface lowercase">
            sua carteira
          </h1>
          <button
            type="button"
            aria-label="histórico"
            className="rounded-full p-2 text-tertiary transition-colors hover:bg-surface-container active:scale-95"
          >
            <History className="size-6" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 pt-6">
        {/* Balance Hero Block */}
        <section className="flex flex-col items-center rounded-lg bg-surface-container p-8 text-center">
          <span className="mb-2 font-label text-[12px] text-tertiary lowercase">
            saldo disponível
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-semibold text-[56px] text-secondary leading-none">
              {creditsBalance}
            </span>
            <span className="font-label font-medium text-secondary/60 text-sm">créditos</span>
          </div>
          <p className="mt-1 text-on-surface/40 text-sm">
            persistence pool em breve · créditos hoje são simbólicos
          </p>
          <div className="mt-8 w-full space-y-2">
            <div className="flex justify-between font-label text-[10px] text-on-surface/50 lowercase">
              <span>+{creditsReceived} recebidos</span>
              <span>−{creditsSent} enviados</span>
            </div>
            <div className="flex h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full bg-tertiary"
                style={{
                  width: `${
                    creditsReceived + creditsSent > 0
                      ? (creditsReceived / (creditsReceived + creditsSent)) * 100
                      : 100
                  }%`,
                }}
              />
              <div
                className="h-full bg-secondary"
                style={{
                  width: `${
                    creditsReceived + creditsSent > 0
                      ? (creditsSent / (creditsReceived + creditsSent)) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-center font-label text-[10px] text-on-surface/30 lowercase">
              últimos 30 dias
            </div>
          </div>
        </section>

        {/* Primary Actions */}
        <div className="grid grid-cols-[1fr_1fr_48px] gap-3">
          <ActionButton kind="primary" icon={<Plus className="size-5" aria-hidden />} disabled>
            comprar créditos
          </ActionButton>
          <ActionButton kind="outline" icon={<Send className="size-5" aria-hidden />} disabled>
            enviar
          </ActionButton>
          <button
            type="button"
            disabled
            aria-label="receber — em breve"
            className="relative flex size-12 items-center justify-center rounded-lg bg-surface-container-high transition-transform active:scale-95 disabled:cursor-not-allowed"
          >
            <ArrowDownToLine className="size-6 text-tertiary" aria-hidden />
            <span className="-top-2 -right-1 absolute whitespace-nowrap rounded-full border border-secondary/20 bg-surface-lowest px-1.5 py-0.5 font-label text-[8px] text-secondary">
              em breve
            </span>
          </button>
        </div>

        {/* Recent Summary */}
        <div className="flex items-center justify-between rounded-lg bg-surface-container-high p-4">
          <div className="flex flex-col">
            <span className="font-label text-[10px] text-on-surface/40 lowercase">
              nas últimas 24h
            </span>
            <span className="font-label text-on-surface text-sm lowercase">
              movimentação recente
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-tertiary" />
              <span className="font-mono text-xs">+0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-secondary" />
              <span className="font-mono text-xs">−0</span>
            </div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="no-scrollbar flex gap-6 overflow-x-auto border-surface-container-high border-b pb-px">
          <Tab label="histórico" active />
          <Tab label="apoiadores" />
          <Tab label="criadores apoiados" />
          <Tab label="métodos" />
        </div>

        {/* History List */}
        <div className="space-y-3">
          {transactions.map((tx, i) => (
            <TransactionRow key={`${tx.kind}-${i}`} tx={tx} />
          ))}
          <p className="px-2 py-6 text-center font-label text-[11px] text-on-surface/30 lowercase">
            suas próximas transações aparecem aqui quando você apoiar ou for apoiado.
          </p>
        </div>

        {/* DID Inset Terminal */}
        <footer className="space-y-4 rounded-lg border border-surface-container-high/30 bg-surface-lowest p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-tertiary" aria-hidden />
              <span className="font-label text-[10px] text-tertiary uppercase tracking-widest">
                identity terminal
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 animate-pulse rounded-full bg-primary" />
              <span className="font-mono text-[9px] text-primary">online</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-mono text-[9px] text-on-surface/30 lowercase">did</span>
            <p className="break-all font-mono text-[11px] text-on-surface/70 leading-relaxed">
              {did}
            </p>
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[9px] text-on-surface/30 lowercase">
                saldo on-chain (base sepolia)
              </span>
              <p className="font-mono text-on-surface text-xs">
                {ethBalance !== null ? `${ethBalance} eth` : '—'}
              </p>
            </div>
            <a
              href={`https://sepolia.basescan.org/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-label text-[10px] text-primary transition-colors hover:text-primary-dim"
            >
              verificar em basescan
              <ArrowUpRight className="size-3" aria-hidden />
            </a>
          </div>

          <div className="flex items-center justify-between border-surface-container-high/30 border-t pt-3">
            <span className="font-mono text-[9px] text-on-surface/30 lowercase">address</span>
            <span className="font-mono text-[10px] text-on-surface/60">{shortAddress}</span>
          </div>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components

function ActionButton({
  kind,
  icon,
  children,
  disabled,
}: {
  kind: 'primary' | 'outline';
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const base =
    'flex h-12 items-center justify-center gap-2 rounded-lg font-label font-medium text-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        base,
        kind === 'primary' && 'bg-primary text-on-primary',
        kind === 'outline' && 'border border-primary text-primary',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Tab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={cn(
          'whitespace-nowrap px-1 font-label font-medium text-sm lowercase',
          active ? 'text-on-surface' : 'text-on-surface/40',
        )}
      >
        {label}
      </span>
      {active && <div className="h-0.5 w-full rounded-full bg-primary" />}
    </div>
  );
}

function TransactionRow({
  tx,
}: {
  tx: {
    kind: 'onboarding' | 'received' | 'sent' | 'purchase';
    counterpart?: string;
    label: string;
    timestamp: string;
    delta: number;
  };
}) {
  const inbound = tx.delta > 0;
  const deltaColor = inbound ? 'text-tertiary' : 'text-secondary';

  let iconNode: React.ReactNode;
  if (tx.kind === 'onboarding') {
    iconNode = (
      <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container-high">
        <Sparkles className="size-5 text-secondary" aria-hidden />
      </div>
    );
  } else if (tx.kind === 'purchase') {
    iconNode = (
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary-container/20">
        <CreditCard className="size-5 text-primary" aria-hidden />
      </div>
    );
  } else {
    iconNode = <div className="size-10 rounded-full bg-surface-container-high" />;
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-container p-4">
      <div className="flex items-center gap-3">
        {iconNode}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-label text-on-surface text-xs lowercase">{tx.label}</span>
            {tx.counterpart && (
              <span className="font-label text-[10px] text-on-surface/40">@{tx.counterpart}</span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-on-surface/30">{tx.timestamp}</p>
        </div>
      </div>
      <span className={cn('font-headline font-semibold text-sm', deltaColor)}>
        {inbound ? '+' : '−'}
        {Math.abs(tx.delta)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav — inlined for Sprint 2; factor into shared AppShell in the Home
// Feed pass. Active state follows the current pathname.

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 z-40 flex h-[72px] w-full items-center justify-around bg-surface-container-low px-4">
      <NavButton label="início" href="/dashboard" active={pathname === '/dashboard'}>
        <Home className="size-6" aria-hidden />
      </NavButton>
      <NavButton label="descobrir" href="/discover" active={pathname === '/discover'}>
        <Compass className="size-6" aria-hidden />
      </NavButton>
      {/* Elevated center: go live */}
      <div className="-top-4 relative">
        <Link
          href="/live/new"
          aria-label="ao vivo"
          className="flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform active:scale-90"
        >
          <Radio className="size-7" aria-hidden />
        </Link>
        <span className="-bottom-6 -translate-x-1/2 absolute left-1/2 whitespace-nowrap font-label font-medium text-[10px] text-on-surface/60 lowercase">
          ao vivo
        </span>
      </div>
      <NavButton label="criadores" href="/discover" active={false}>
        <Users className="size-6" aria-hidden />
      </NavButton>
      <NavButton label="perfil" href="/wallet" active={pathname === '/wallet'}>
        <User className="size-6" aria-hidden />
      </NavButton>
    </nav>
  );
}

function NavButton({
  label,
  href,
  active,
  children,
}: {
  label: string;
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center p-2 transition-opacity hover:opacity-80 active:scale-90',
        active ? 'text-on-surface' : 'text-on-surface/60',
      )}
    >
      <span className={active ? 'text-primary' : ''}>{children}</span>
      <span className="font-label font-medium text-[10px] lowercase">{label}</span>
    </Link>
  );
}
