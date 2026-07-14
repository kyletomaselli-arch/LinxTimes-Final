export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/60 py-20 text-center">
        <div className="text-3xl">🏗️</div>
        <p className="mt-3 text-sm font-medium text-foreground/70">Coming up next</p>
        <p className="mt-1 max-w-sm text-xs text-foreground/45">{note}</p>
      </div>
    </div>
  );
}
