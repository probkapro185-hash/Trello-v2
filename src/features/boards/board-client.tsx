"use client";

import { useSearchParams, usePathname } from "next/navigation";
import type { BoardColumn, TaskCard as Task } from "@/types/domain";
import type { CardDetails } from "@/features/tasks/contracts";
import { TaskDrawer } from "@/features/tasks/task-drawer";
import { KanbanBoard } from "./kanban-board";
import { LiveStatus } from "./live-scope";

export function BoardClient(props: { workspaceId: string; boardId: string; columns: BoardColumn[]; tasks: Task[]; details: Record<string, CardDetails> }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const selected = params.get("task");
  function setSelected(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("task", id); else next.delete("task");
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
  }
  function closeTask() {
    const id = selected;
    setSelected(null);
    if (id) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-task-open="${CSS.escape(id)}"]`)?.focus());
  }
  const selectedTask = props.tasks.find((task) => task.id === selected);
  return <><LiveStatus />{selected && !selectedTask && <div role="alert" className="mb-4 rounded-xl border border-border p-4 text-sm"><p>Задача удалена или больше недоступна.</p><button onClick={closeTask} className="mt-2 text-primary">Вернуться к доске</button></div>}<KanbanBoard {...props} onOpen={setSelected} />{selectedTask && <TaskDrawer key={selectedTask.id} taskId={selectedTask.id} liveVersion={selectedTask.version} onClose={closeTask} />}</>;
}
