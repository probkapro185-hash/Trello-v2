"use client";

import { ActionForm, Field } from "@/components/action-form";
import { createTask } from "./actions";
import type { BoardColumn } from "@/types/domain";
import { useEffect } from "react";

export function CreateTaskForm({ workspaceId, boardId, columns }: { workspaceId: string; boardId: string; columns: BoardColumn[] }) {
  const action = createTask.bind(null, workspaceId, boardId);
  useEffect(() => {
    if (window.location.hash === "#new-task") document.querySelector<HTMLInputElement>("[data-new-task]")?.focus();
  }, []);
  return <ActionForm action={action} submit="Добавить задачу" className="space-y-3">
    <Field data-new-task name="title" label="Название задачи" placeholder="Например, подготовить релиз" autoComplete="off" required maxLength={240} />
    <label className="block space-y-2 text-sm text-foreground/85">
      <span>Колонка</span>
      <select name="column_id" defaultValue={columns[0]?.id} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none" required>
        {columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}
      </select>
    </label>
  </ActionForm>;
}
