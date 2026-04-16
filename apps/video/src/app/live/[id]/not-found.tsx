import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LiveNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <h1 className="font-semibold text-3xl tracking-tight">Live not found</h1>
      <p className="max-w-md text-center text-muted">
        This broadcast doesn&apos;t exist or has been deleted.
      </p>
      <Button asChild>
        <Link href="/discover">Back to discover</Link>
      </Button>
    </main>
  );
}
