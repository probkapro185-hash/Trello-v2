import { requireWorkspace } from "@/services/workspaces";
import { ActivityFeed } from "@/features/tasks/activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WorkspaceActivityPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const { workspace } = await requireWorkspace(workspaceId);
  return <div className="mx-auto max-w-3xl space-y-7"><div><p className="text-xs uppercase tracking-widest text-primary">{workspace.name}</p><h1 className="mt-3 text-3xl font-medium">Активность команды</h1><p className="mt-3 text-sm text-muted-foreground">Задачи, обсуждения и последние изменения workspace.</p></div><Card><CardHeader><CardTitle>История действий</CardTitle></CardHeader><CardContent><ActivityFeed workspaceId={workspaceId} /></CardContent></Card></div>;
}
