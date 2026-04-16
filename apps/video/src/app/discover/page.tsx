import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { Radio } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';
export const revalidate = 15;

export default async function DiscoverPage() {
  let lives: Array<{ uid: string; creator: string; name: string }> = [];
  try {
    const all = await listLiveInputs();
    lives = all
      .filter((l) => l.status?.current?.state === 'connected')
      .map((l) => ({
        uid: l.uid,
        creator: l.defaultCreator ?? l.meta?.creator ?? 'anonymous',
        name: l.meta?.name ?? '',
      }));
  } catch {
    // If Stream API unreachable at render time, show empty state gracefully.
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-8">
        <p className="text-muted text-xs uppercase tracking-[0.2em]">Discover</p>
        <h1 className="mt-1 font-semibold text-3xl tracking-tight">Live now</h1>
      </header>

      {lives.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted text-sm">
            Nothing live right now. Be the first —{' '}
            <Link href="/live/new" className="underline">
              go live
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lives.map((l) => (
            <Link key={l.uid} href={`/live/${l.uid}`}>
              <Card className="transition-colors hover:bg-surface/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="live">
                      <Radio className="mr-1 size-3" /> LIVE
                    </Badge>
                    <span className="truncate">@{l.creator}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="truncate text-muted text-xs">{l.name}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
