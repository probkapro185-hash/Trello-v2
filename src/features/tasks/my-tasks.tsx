"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { deadlineGroup, localToday, taskHref } from "./task-groups";
import { priorityNames } from "./contracts";
import type { Database } from "@/types/database";

type Row = Database["public"]["Functions"]["my_tasks"]["Returns"][number];
export function MyTasks() {
  const [completed, setCompleted] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ rows: Row[]; today: string; more: boolean; error?: string } | null>(null);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRevision((v) => v + 1); };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); clearInterval(timer); };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void createClient().rpc("my_tasks", { show_completed: completed, page_number: page }).abortSignal(abort.signal).then(({ data, error }) => {
      if (!abort.signal.aborted) setResult({ rows: data?.slice(0, 100) ?? [], more: (data?.length ?? 0) > 100, today: localToday(), error: error ? "Не удалось загрузить задачи. Попробуйте ещё раз." : undefined });
    });
    return () => abort.abort();
  }, [completed, page, revision]);
  const groups = completed ? ["Завершены"] : ["Просрочены", "Сегодня", "Предстоящие", "Без срока"];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-2"><Button variant={!completed ? "default" : "outline"} aria-pressed={!completed} onClick={() => { setCompleted(false); setPage(0); setResult(null); }}>В работе</Button><Button variant={completed ? "default" : "outline"} aria-pressed={completed} onClick={() => { setCompleted(true); setPage(0); setResult(null); }}>Завершены</Button><Button variant="ghost" onClick={() => { setResult(null); setRevision((v) => v + 1); }}>Обновить</Button></div>
    {!result ? <ListSkeleton /> : result.error ? <div role="alert" className="rounded-xl border border-destructive/30 p-6"><p>{result.error}</p><Button className="mt-4" onClick={() => setRevision((v) => v + 1)}>Повторить</Button></div> : <>
      {result.rows.length === 0 ? <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center"><ListTodo className="mx-auto mb-4 text-primary" /><h2 className="font-medium">{completed ? "Завершённых задач пока нет" : "Пока нет назначенных задач"}</h2><p className="mt-2 text-sm text-muted-foreground">Откройте задачу на доске и выберите себя в поле «Исполнитель».</p><Link href="/workspaces" className="mt-5 inline-block text-sm text-primary">Перейти к workspace →</Link></div> : groups.map((group) => {
        const rows = result.rows.filter((task) => completed || deadlineGroup(task.due_date, result.today) === group);
        return <section key={group} className="overflow-hidden rounded-xl border border-border bg-card"><h2 className="flex items-center gap-3 border-b border-border px-5 py-4 text-sm font-medium">{group}<span className="text-xs text-muted-foreground">{rows.length}</span></h2>{rows.length ? rows.map((task) => <Link key={task.id} href={taskHref(task)} className="flex min-w-0 items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0 hover:bg-muted"><span className={completed ? "text-emerald-300" : "text-muted-foreground"}>{completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{task.workspace_name} / {task.board_name} · {priorityNames[task.priority]}</span></span>{task.due_date && <time dateTime={task.due_date} className={`shrink-0 text-xs ${!completed && task.due_date < result.today ? "text-destructive" : "text-muted-foreground"}`}>{task.due_date.split("-").reverse().join(".")}</time>}</Link>) : <p className="px-5 py-5 text-sm text-muted-foreground">Задач нет — можно сосредоточиться на другом.</p>}</section>;
      })}
      {(page > 0 || result.more) && <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => { setPage(page - 1); setResult(null); }}>Назад</Button><span className="text-xs text-muted-foreground">Страница {page + 1} · до 100 задач</span><Button variant="outline" disabled={!result.more} onClick={() => { setPage(page + 1); setResult(null); }}>Далее</Button></div>}
    </>}
  </div>;
}
