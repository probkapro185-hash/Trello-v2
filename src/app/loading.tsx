export default function Loading() {
  return <main aria-busy="true" aria-label="Подготавливаем страницу" className="mx-auto max-w-3xl space-y-6 px-6 py-20">
    <div className="h-4 w-24 animate-pulse rounded bg-muted" /><div className="h-8 w-64 animate-pulse rounded bg-muted" />
    <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
  </main>;
}
