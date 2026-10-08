import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LayoutGrid, Plus } from "lucide-react";
import { ActionForm, Field } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createBoard } from "@/features/workspaces/actions";
import { requireWorkspace } from "@/services/workspaces";

export default async function BoardsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const { workspace, supabase } = await requireWorkspace(workspaceId);
  const { data: boards, error } = await supabase.from("boards").select("*").eq("workspace_id", workspaceId).order("position").order("id");
  if (error) throw new Error("Не удалось загрузить доски.");
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Link href={`/workspaces/${workspaceId}`} className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />{workspace.name}</Link><Badge variant="default">Рабочие потоки</Badge><h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Доски</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Организуйте работу команды по отдельным потокам.</p></div><a href="#new-board" className={buttonVariants({ className: "w-fit" })}><Plus size={16} />Новая доска</a></div>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Все доски</CardTitle><CardDescription className="mt-1">{boards.length ? "Выберите доску, чтобы открыть рабочий поток." : "Создайте первую доску для команды."}</CardDescription></div><span className="text-xs text-muted-foreground">{boards.length}</span></CardHeader><CardContent>
        {boards.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center"><LayoutGrid size={27} className="mb-3 text-muted-foreground" /><h2 className="font-medium">Пока нет досок</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Доска станет общей точкой входа для колонок и задач.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{boards.map((board) => <Link key={board.id} href={`/workspaces/${workspaceId}/boards/${board.id}`} className="group rounded-xl border border-border p-4 hover:border-primary/50 hover:bg-primary/[.03]"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><LayoutGrid size={17} /></span><ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary" /></div><h2 className="mt-5 truncate font-medium">{board.name}</h2><p className="mt-2 text-xs text-muted-foreground">Открыть рабочий поток</p></Link>)}</div>}
      </CardContent></Card>
      <Card id="new-board" className="scroll-mt-24"><CardHeader><CardTitle>Новая доска</CardTitle><CardDescription>Название можно изменить позже.</CardDescription></CardHeader><CardContent><ActionForm action={createBoard.bind(null, workspaceId)} submit="Создать доску"><Field label="Название" name="name" required maxLength={80} placeholder="Например, Product launch" /></ActionForm></CardContent></Card>
    </div>
  </div>;
}

