import { requireProfile } from "@/services/session";
import { MyTasks } from "@/features/tasks/my-tasks";

export default async function MyTasksPage() {
  await requireProfile("/my-tasks");
  return <div className="space-y-8"><div><p className="text-xs uppercase tracking-widest text-primary">Личный фокус</p><h1 className="mt-3 text-3xl font-medium tracking-tight">Мои задачи</h1><p className="mt-3 text-sm text-muted-foreground">Всё, что назначено вам, во всех workspace.</p></div><MyTasks /></div>;
}
