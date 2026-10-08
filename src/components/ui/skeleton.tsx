import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-foreground/[.06]", className)} />;
}

export function ListSkeleton() {
  return <div role="status" aria-label="Загрузка" className="space-y-4 p-4"><span className="sr-only">Загрузка</span>{[0, 1, 2].map((key) => <div key={key} className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>)}</div>;
}
