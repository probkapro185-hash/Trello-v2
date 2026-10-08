import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div aria-busy="true" aria-label="Подготавливаем страницу" className="space-y-8"><div className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-2/3 max-w-sm" /><Skeleton className="h-4 w-1/2" /></div><div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-24" />)}</div><div className="rounded-xl border border-border bg-card"><ListSkeleton /></div></div>;
}
