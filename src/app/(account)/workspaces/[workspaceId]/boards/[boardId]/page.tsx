import Link from "next/link";
import { ArrowLeft, CheckCircle2, Columns3, LayoutGrid, ListTodo } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { idSchema } from "@/lib/validation";
import { avatarUrl, requireWorkspace } from "@/services/workspaces";
import type { BoardColumn, TaskCard } from "@/types/domain";
import { readBoardTasks } from "@/services/board-tasks";
import { createColumn } from "@/features/boards/actions";
import { CreateTaskForm } from "@/features/boards/create-task-form";
import { BoardClient } from "@/features/boards/board-client";
import type { CardDetails } from "@/features/tasks/contracts";

export default async function BoardOverviewPage({ params }: { params: Promise<{ workspaceId: string; boardId: string }> }) {
  const { workspaceId, boardId } = await params;
  if (!idSchema.safeParse(boardId).success) notFound();
  const { workspace, supabase } = await requireWorkspace(workspaceId);
  const [boardResult, columnsResult, tasksResult] = await Promise.all([
    supabase.from("boards").select("*").eq("id", boardId).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("columns").select("*").eq("board_id", boardId).eq("workspace_id", workspaceId).order("position").order("id"),
    readBoardTasks(supabase, workspaceId, boardId),
  ]);
  if (boardResult.error || columnsResult.error || tasksResult.error) throw new Error("Не удалось загрузить доску.");
  if (!boardResult.data) notFound();
  const columns = (columnsResult.data ?? []) as BoardColumn[];
  const tasks: TaskCard[] = tasksResult.data.map(({ id, workspace_id, board_id, column_id, title, priority, due_date, position, version }) => ({ id, workspace_id, board_id, column_id, title, priority, due_date, position, version }));
  const avatarPaths = [...new Set((tasksResult.data ?? []).flatMap((task) => task.task_assignees.flatMap((entry) => entry.workspace_members?.profiles?.avatar_path ? [entry.workspace_members.profiles.avatar_path] : [])))];
  const avatars = new Map(await Promise.all(avatarPaths.map(async (path) => [path, await avatarUrl(path)] as const)));
  const details: Record<string, CardDetails> = Object.fromEntries((tasksResult.data ?? []).map((task) => [task.id, {
    labels: task.task_labels.flatMap((entry) => entry.labels ? [entry.labels] : []),
    assignee: task.task_assignees[0]?.workspace_members?.profiles?.name ?? null,
    avatarUrl: avatars.get(task.task_assignees[0]?.workspace_members?.profiles?.avatar_path ?? "") ?? null,
    completed: task.checklists.flatMap((list) => list.checklist_items).filter((item) => item.is_completed).length,
    total: task.checklists.flatMap((list) => list.checklist_items).length,
  }]));
  const columnAction = createColumn.bind(null, workspaceId, boardId);
  return <div className="space-y-8">
    <div>
      <Link href={`/workspaces/${workspaceId}/boards`} className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />Все доски</Link>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><Badge variant="default">Kanban</Badge><h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{boardResult.data.name}</h1><p className="mt-3 text-sm text-muted-foreground">{workspace.name} · рабочий поток команды.</p></div>
        <Link href={`/workspaces/${workspaceId}/boards`} className={buttonVariants({ variant: "outline", className: "w-fit" })}><LayoutGrid size={16} />Все доски</Link>
      </div>
    </div>
    <section aria-label="Сводка доски" className="grid gap-3 sm:grid-cols-3">
      <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Columns3 size={17} /></span><div><p className="text-xs text-muted-foreground">Колонки</p><p className="mt-1 text-xl font-medium">{columns.length}</p></div></CardContent></Card>
      <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><ListTodo size={17} /></span><div><p className="text-xs text-muted-foreground">Задачи</p><p className="mt-1 text-xl font-medium">{tasks.length}</p></div></CardContent></Card>
      <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300"><CheckCircle2 size={17} /></span><div><p className="text-xs text-muted-foreground">Статус</p><p className="mt-1 text-sm font-medium">Готова к работе</p></div></CardContent></Card>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="min-w-0"><CardHeader><CardTitle>Доска задач</CardTitle><CardDescription>Нажмите на карточку, чтобы открыть детали. Используйте ручку справа для перемещения.</CardDescription></CardHeader><CardContent><BoardClient workspaceId={workspaceId} boardId={boardId} columns={columns} tasks={tasks} details={details} /></CardContent></Card>
      <aside className="space-y-4" aria-label="Управление доской">
        <Card id="new-task" className="scroll-mt-24"><CardHeader><CardTitle className="text-base">Новая задача</CardTitle><CardDescription>Добавьте карточку в выбранную колонку. Быстрый доступ — N.</CardDescription></CardHeader><CardContent><CreateTaskForm workspaceId={workspaceId} boardId={boardId} columns={columns} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Новая колонка</CardTitle><CardDescription>Колонка появится в конце доски.</CardDescription></CardHeader><CardContent><ActionForm action={columnAction} submit="Добавить колонку" refreshOnSuccess><Field name="name" label="Название" placeholder="Например, На проверке" autoComplete="off" /></ActionForm></CardContent></Card>
      </aside>
    </div>
    <p className="text-center text-xs text-muted-foreground">Workspace: {workspace.name}</p>
  </div>;
}
