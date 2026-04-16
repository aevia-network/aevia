import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { readSession } from '@/lib/session/cookie';
import { Radio, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '../actions';

export const runtime = 'nodejs';

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect('/');

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
        <h2 className="mb-4 font-semibold text-xl">Your past lives</h2>
        <Card>
          <CardContent className="py-10 text-center text-muted text-sm">
            No recordings yet. Your first broadcast will automatically save as a VOD here.
          </CardContent>
        </Card>
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
