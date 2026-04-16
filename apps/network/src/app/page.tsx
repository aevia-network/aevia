export default function NetworkLanding() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Aevia Network</h1>
        <p className="max-w-2xl text-lg text-muted md:text-xl">
          Protocol specification, developer portal, Provider Node operations, gateways, and
          governance.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">
          Persistence does not imply distribution
        </p>
      </div>
    </main>
  );
}
