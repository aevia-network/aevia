import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { readSession } from '@/lib/session/cookie';
import { Radio, Trash2, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteLiveAction, signOutAction } from '../actions';

export const runtime = 'nodejs';
export const revalidate = 0;

interface LiveRow {
  uid: string;
  state: 'connected' | 'disconnected' | 'unknown';
  name: string;
  created: string;
}

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect('/');

  let myLives: LiveRow[] = [];
  try {
    const all = await listLiveInputs();
    myLives = all
      .filter((l) => l.defaultCreator === session.handle)
      .map((l) => ({
        uid: l.uid,
        state: (l.status?.current?.state as LiveRow['state']) ?? 'disconnected',
        name: l.meta?.name ?? '',
        created: l.created,
      }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
  } catch {
    // If Cloudflare API is transiently unreachable, render empty list gracefully.
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12 flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.2em]">Welcome back</p>
          <h1 className="mt-1 font-semibold text-3xl tracking-tight">{session.handle}</h1>
        </div>
        <Badge variant="outline">anonymous session</Badge>
      </header>

      <section className="mb-12 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-5 text-danger" />
              Go live
            </CardTitle>
            <CardDescription>
              Broadcast from your browser — low-latency, automatic VOD, shareable link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/live/new">Start broadcast</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-5 text-accent" />
              Discover
            </CardTitle>
            <CardDescription>
              See what&apos;s live on Aevia right now. Tap any card to watch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg">
              <Link href="/discover">Explore</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-xl">Your lives</h2>
          {myLives.length > 0 && (
            <p className="text-muted text-xs">
              {myLives.length} {myLives.length === 1 ? 'broadcast' : 'broadcasts'}
            </p>
          )}
        </div>

        {myLives.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted text-sm">
              No broadcasts yet. Your first live will appear here — you can watch it again and
              delete it.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {myLives.map((l) => (
              <Card key={l.uid}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {l.state === 'connected' ? (
                      <Badge variant="live">
                        <Radio className="mr-1 size-3" /> LIVE
                      </Badge>
                    ) : (
                      <Badge variant="outline">ended</Badge>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{l.name || 'Untitled'}</p>
                      <p className="text-muted text-xs">
                        {new Date(l.created).toLocaleString()} · {l.uid.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/live/${l.uid}`}>Watch</Link>
                    </Button>
                    <form action={deleteLiveAction}>
                      <input type="hidden" name="uid" value={l.uid} />
                      <Button type="submit" variant="destructive" size="sm">
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-16 text-muted text-xs">
        <form action={signOutAction}>
          <button type="submit" className="underline underline-offset-4">
            Sign out
          </button>
        </form>
      </footer>
    </main>
  );
}
