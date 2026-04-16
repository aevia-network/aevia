export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Aevia</h1>
        <p className="max-w-2xl text-lg text-muted md:text-xl">
          Go live without the gatekeepers. Automatic VOD. Viral clips. Your content, your audience,
          your protocol.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">
          Sprint 0 scaffold — Hello Live arriving in Sprint 1
        </p>
      </div>
    </main>
  );
}
