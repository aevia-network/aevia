'use client';

import { cn } from '@/lib/utils';
import { Compass, Home, Radio, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent bottom navigation. Five slots mirroring the Stitch canonical:
 * início, descobrir, ao vivo (elevated center), criadores, perfil.
 *
 * Rendered per-page in Sprint 2; will fold into a shared `AppShell` when
 * the Home Feed pass introduces a typed top-chrome variants layer.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 z-40 flex h-[72px] w-full items-center justify-around bg-surface-container-low px-4">
      <NavButton label="início" href="/feed" active={pathname === '/feed'}>
        <Home className="size-6" aria-hidden />
      </NavButton>
      <NavButton label="descobrir" href="/discover" active={pathname === '/discover'}>
        <Compass className="size-6" aria-hidden />
      </NavButton>
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
      <NavButton label="criadores" href="/discover" active={pathname.startsWith('/creator/')}>
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
