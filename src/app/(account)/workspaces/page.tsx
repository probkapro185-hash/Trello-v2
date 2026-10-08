import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Layers, LayoutGrid, Plus, Users } from "lucide-react";
import { requireProfile } from "@/services/session";
import { ActionForm, Field } from "@/components/action-form";
import { createWorkspace } from "@/features/workspaces/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { z } from "zod";

const recentBoardsSchema = z.array(z.object({ id: z.uuid(), name: z.string(), position: z.number() }));

export default async function WorkspacesPage() {
  const { supabase, profile } = await requireProfile();
  const { data: workspaces, error } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Не удалось загрузить workspace.");
  const { data: stats, error: statsError } = await supabase.rpc("workspace_summaries");
  if (statsError) throw new Error("Не удалось загрузить обзор workspace.");
  const byId = new Map(stats.map((row) => [row.workspace_id, row]));
  const summaries = workspaces.flatMap((workspace) => {
    const row = byId.get(workspace.id);
    return row ? [{ workspace, boards: recentBoardsSchema.parse(row.recent_boards), boardCount: row.board_count, memberCount: row.member_count, taskCount: row.task_count }] : [];
  });
  const recentBoards = summaries.flatMap(({ workspace, boards }) => boards.slice(0, 4).map((board) => ({ board, workspace })));
  const boardCount = summaries.reduce((total, summary) => total + summary.boardCount, 0);
  const taskCount = summaries.reduce((total, summary) => total + summary.taskCount, 0);
  const memberCount = summaries.reduce((total, summary) => total + summary.memberCount, 0);
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><Badge variant="default">Обзор</Badge><h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">С возвращением, {profile.name.split(" ")[0]}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Все команды и доски в одном спокойном рабочем пространстве.</p></div>
      <Link href="#new-workspace" className={buttonVariants({ className: "w-fit" })}><Plus size={16} />Новый workspace</Link>
    </section>
    <section aria-label="Сводка" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Workspace", value: workspaces.length, icon: Layers, note: "доступных пространств" }, { label: "Доски", value: boardCount, icon: LayoutGrid, note: "в вашей команде" }, { label: "Задачи", value: taskCount, icon: CheckCircle2, note: "всего на досках" }, { label: "Участники", value: memberCount, icon: Users, note: "во всех workspace" }].map(({ label, value, icon: Icon, note }) => <Card key={label} className="shadow-none"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-medium tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon size={17} strokeWidth={1.8} /></span></CardContent></Card>)}
    </section>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Ваши workspace</CardTitle><CardDescription className="mt-1">Выберите пространство, чтобы продолжить.</CardDescription></div><span className="text-xs text-muted-foreground">{workspaces.length}</span></CardHeader><CardContent>
        {summaries.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center"><Layers size={25} className="mb-3 text-muted-foreground" /><h3 className="font-medium">Создайте первый workspace</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Дайте ему название, затем пригласите коллег по ссылке.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{summaries.map(({ workspace, boardCount: workspaceBoardCount, memberCount: members }) => <Link key={workspace.id} href={`/workspaces/${workspace.id}`} className="group rounded-xl border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/[.03]"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{workspace.name.slice(0, 1).toUpperCase()}</span><ArrowUpRight size={16} className="text-muted-foreground transition-colors group-hover:text-primary" /></div><h3 className="mt-4 truncate font-medium">{workspace.name}</h3><div className="mt-3 flex gap-3 text-xs text-muted-foreground"><span>{workspaceBoardCount} {workspaceBoardCount === 1 ? "доска" : "досок"}</span><span>{members} участн.</span></div></Link>)}</div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Недавние доски</CardTitle><CardDescription>Быстрый доступ к рабочим потокам.</CardDescription></CardHeader><CardContent>{recentBoards.length === 0 ? <div className="rounded-xl bg-secondary/70 p-5"><LayoutGrid size={22} className="mb-3 text-muted-foreground" /><p className="text-sm font-medium">Досок пока нет</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Откройте workspace и создайте первую доску.</p></div> : <div className="space-y-2">{recentBoards.map(({ board, workspace }) => <Link key={board.id} href={`/workspaces/${workspace.id}/boards/${board.id}`} className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary"><LayoutGrid size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{board.name}</span><span className="block truncate text-xs text-muted-foreground">{workspace.name}</span></span><ArrowUpRight size={15} className="text-muted-foreground group-hover:text-primary" /></Link>)}</div>}</CardContent></Card>
    </div>
    <Card id="new-workspace" className="scroll-mt-24"><CardHeader><CardTitle>Новое пространство</CardTitle><CardDescription>Вы станете владельцем и сможете приглашать участников.</CardDescription></CardHeader><CardContent className="max-w-xl"><ActionForm action={createWorkspace} submit="Создать workspace"><Field label="Название" name="name" required maxLength={80} placeholder="Например, Product team" /></ActionForm></CardContent></Card>
  </div>;
}
