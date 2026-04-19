'use client';

import type { Locale } from '@/i18n/config';
import { localePath } from '@/i18n/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NavSlug } from './nav';

export function MobileMenu({
  active,
  locale,
  items,
  externalVideoLabel,
  ptPath,
  enPath,
  closeLabel,
  openLabel,
}: {
  active?: NavSlug;
  locale: Locale;
  items: { slug: NavSlug; label: string }[];
  externalVideoLabel: string;
  ptPath: string;
  enPath: string;
  closeLabel: string;
  openLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Defer portal mount until after hydration so SSR markup matches.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while drawer open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const drawer = open ? (
    <div
      className="fixed inset-0 z-[100] lg:hidden"
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: '#0F1115' }}
    >
      {/* Backdrop — invisible but click-to-close */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => setOpen(false)}
        className="absolute inset-0"
        tabIndex={-1}
      />

      {/* Drawer content */}
      <div
        className="relative flex h-full flex-col"
        style={{ backgroundColor: '#0F1115' }}
      >
        <div className="flex h-[72px] items-center justify-between px-6">
          <span className="font-headline text-base tracking-tight">aevia.network</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:text-accent"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1 px-6 pt-8"
          aria-label="primary mobile navigation"
        >
          {items.map((item) => {
            const isActive = item.slug === active;
            return (
              <Link
                key={item.slug}
                href={localePath(locale, `/${item.slug}`)}
                onClick={() => setOpen(false)}
                className={
                  isActive
                    ? 'border-l-2 border-primary bg-surface-container-low/40 py-4 pl-5 font-headline text-2xl text-accent'
                    : 'border-l-2 border-transparent py-4 pl-5 font-headline text-2xl text-on-surface-variant transition-colors hover:text-accent'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-6 border-t border-outline-variant/40 px-6 py-8 font-label text-sm">
          <a
            href="https://aevia.video"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-accent"
          >
            {externalVideoLabel}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>

          <div className="flex items-center gap-3">
            <Link
              href={enPath}
              onClick={() => setOpen(false)}
              className={
                locale === 'en'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant transition-colors hover:text-accent'
              }
            >
              en
            </Link>
            <span className="text-outline-variant">/</span>
            <Link
              href={ptPath}
              onClick={() => setOpen(false)}
              className={
                locale === 'pt-BR'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant transition-colors hover:text-accent'
              }
            >
              pt-br
            </Link>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:text-accent lg:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
