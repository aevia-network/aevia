import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { NetworkMap } from '@/components/network-map';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, '/network', getDictionary(locale).network.meta);
}

async function fetchProviders(req: { host: string; proto: string }) {
  const url = `${req.proto}://${req.host}/api/network/providers`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch {
    return {
      providers: [],
      summary: { total: 0, online: 0, offline: 0, totalActiveSessions: 0, probedAt: '' },
    };
  }
}

export default async function NetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const n = dict.network;
  const pathname = `/${locale}/network`;

  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'aevia.network';
  const proto = hdrs.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const initial = await fetchProviders({ host, proto });

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <section className="mx-auto max-w-[72ch] pt-[120px] md:pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{n.eyebrow}</span>
          <h1 className="mt-6 font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight">
            {n.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-lg md:text-xl text-on-surface-variant leading-[1.7]">
            {n.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{n.stamp}</p>
        </section>

        <section className="mt-16 md:mt-24">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-xs text-on-surface-variant">
              <span>
                {n.statsOnline}:{' '}
                <strong className="text-accent">{initial.summary.online}</strong> /{' '}
                {initial.summary.total}
              </span>
              <span>
                {n.statsActiveSessions}:{' '}
                <strong className="text-accent">{initial.summary.totalActiveSessions}</strong>
              </span>
              {initial.summary.probedAt ? (
                <span>
                  {n.statsProbedAt}:{' '}
                  <span className="text-accent">{initial.summary.probedAt.slice(11, 19)}Z</span>
                </span>
              ) : null}
            </div>
            <NetworkMap initial={initial} />
          </div>
        </section>

        <section className="mx-auto mt-16 md:mt-24 max-w-[92ch]">
          <h2 className="font-headline text-2xl md:text-3xl font-bold">{n.tableHeading}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs md:text-sm">
              <thead>
                <tr className="border-b border-primary-dim/40 text-left text-tertiary">
                  <th className="px-3 py-2 font-normal">{n.tableCols.name}</th>
                  <th className="px-3 py-2 font-normal">{n.tableCols.region}</th>
                  <th className="px-3 py-2 font-normal">{n.tableCols.hardware}</th>
                  <th className="px-3 py-2 font-normal">{n.tableCols.status}</th>
                  <th className="px-3 py-2 font-normal">{n.tableCols.sessions}</th>
                  <th className="px-3 py-2 font-normal">{n.tableCols.peerId}</th>
                </tr>
              </thead>
              <tbody>
                {initial.providers.map((p: { id: string; name: string; region: string; hardware: string; online: boolean; activeSessions: number; peerId: string }) => (
                  <tr key={p.id} className="border-b border-primary-dim/15">
                    <td className="px-3 py-3 text-accent">{p.name}</td>
                    <td className="px-3 py-3">{p.region}</td>
                    <td className="px-3 py-3 text-on-surface-variant">{p.hardware}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          p.online
                            ? 'rounded bg-primary/15 px-2 py-0.5 text-primary'
                            : 'rounded bg-error/15 px-2 py-0.5 text-error'
                        }
                      >
                        {p.online ? n.statusOnline : n.statusOffline}
                      </span>
                    </td>
                    <td className="px-3 py-3">{p.activeSessions}</td>
                    <td className="px-3 py-3 text-on-surface-variant">…{p.peerId.slice(-8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-on-surface-variant leading-[1.7]">{n.tableNote}</p>
        </section>

        <section className="mx-auto mt-16 mb-24 max-w-[72ch]">
          <p className="text-sm text-on-surface-variant leading-[1.7]">{n.legalNote}</p>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
