"use client";
import { ListSkeleton } from "@/components/ui/skeleton";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLiveBoard } from "@/features/boards/live-scope";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/domain";
import { activityNames, activityFields, formatTimestamp } from "./collaboration-contracts";

type Entry = Activity & { profiles: { name: string } | null };
export function ActivityFeed({ taskId, workspaceId, refresh = 0 }: { taskId?: string; workspaceId?: string; refresh?: number }) {
  const { revision } = useLiveBoard();
  const [rows, setRows] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      const client = createClient();
      let query = client.from("activities").select("*, profiles(name)").order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 30, page * 30 + 30);
      if (taskId) query = query.eq("task_id", taskId);
      else if (workspaceId) query = query.eq("workspace_id", workspaceId);
      else return;
      const result = await query.abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      setLoaded(true);
      setError(result.error ? "Не удалось загрузить историю." : "");
      if (result.data) { setRows(result.data.slice(0, 30)); setMore(result.data.length > 30); }
    }
    void read();
    return () => controller.abort();
  }, [taskId, workspaceId, revision, refresh, page, retry]);
  return <section className="space-y-4" aria-label="История активности">
    {error && <div role="alert"><p>{error}</p><Button type="button" variant="ghost" onClick={() => setRetry((n) => n + 1)}>Повторить</Button></div>}
    {!loaded && <ListSkeleton />}
    {loaded && !rows.length && !error && <p className="text-sm text-muted-foreground">Здесь появятся действия команды.</p>}
    <ol className="space-y-4">{rows.map((entry) => {
      const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {};
      const details = [typeof metadata.task_title === "string" && !taskId ? metadata.task_title : null,
        typeof metadata.name === "string" ? metadata.name : null,
        entry.action === "task.moved" ? `${metadata.from ?? "Колонка"} → ${metadata.to ?? "Колонка"}` : null,
        Array.isArray(metadata.fields) && entry.action !== "task.moved" ? metadata.fields.map((field) => activityFields[String(field)] ?? String(field)).join(", ") : null].filter(Boolean).join(" · ");
      return <li key={entry.id} className="flex gap-3 text-sm"><UserAvatar name={entry.profiles?.name ?? "Система"} /><div className="min-w-0"><p><span className="font-medium">{entry.profiles?.name ?? "Система"}</span> <span className="text-muted-foreground">{activityNames[entry.action] ?? "изменил(а) задачу"}</span></p>{details && <p className="mt-1 break-words text-xs text-muted-foreground">{details}</p>}<time className="mt-1 block text-[11px] text-muted-foreground" dateTime={entry.created_at}>{formatTimestamp(entry.created_at)}</time></div></li>;
    })}</ol>
    {(page > 0 || more) && <div className="flex items-center justify-between"><Button type="button" variant="ghost" disabled={!page} onClick={() => setPage(page - 1)}>Новее</Button><span className="text-xs text-muted-foreground">Страница {page + 1}</span><Button type="button" variant="ghost" disabled={!more} onClick={() => setPage(page + 1)}>Ранее</Button></div>}
  </section>;
}
