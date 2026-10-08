"use server";

import { revalidatePath } from "next/cache";
import { idSchema, columnNameSchema, taskTitleSchema, field } from "@/lib/validation";
import { requireWorkspace } from "@/services/workspaces";
import type { ActionState } from "@/types/actions";

const positionStep = 1024;

async function boardExists(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], workspaceId: string, boardId: string) {
  const result = await supabase.from("boards").select("id").eq("id", boardId).eq("workspace_id", workspaceId).maybeSingle();
  if (result.error) throw new Error("Не удалось проверить доску.");
  return Boolean(result.data);
}

async function nextPosition(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], table: "columns" | "tasks", boardId: string, workspaceId: string) {
  const result = await supabase.from(table).select("position").eq("board_id", boardId).eq("workspace_id", workspaceId).order("position", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("Не удалось определить позицию.");
  return (result.data?.position ?? 0) + positionStep;
}

export async function createColumn(workspaceId: string, boardId: string, _: ActionState, form: FormData): Promise<ActionState> {
  if (!idSchema.safeParse(boardId).success) return { error: "Доска не найдена." };
  const { supabase } = await requireWorkspace(workspaceId);
  if (!await boardExists(supabase, workspaceId, boardId)) return { error: "Доска не найдена." };
  const name = columnNameSchema.safeParse(field(form, "name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const position = await nextPosition(supabase, "columns", boardId, workspaceId);
  const { error } = await supabase.from("columns").insert({ workspace_id: workspaceId, board_id: boardId, name: name.data, position });
  if (error) return { error: "Не удалось создать колонку." };
  revalidatePath(`/workspaces/${workspaceId}/boards/${boardId}`);
  return { success: "Колонка добавлена." };
}

export async function createTask(workspaceId: string, boardId: string, _: ActionState, form: FormData): Promise<ActionState> {
  if (!idSchema.safeParse(boardId).success) return { error: "Доска не найдена." };
  const { supabase } = await requireWorkspace(workspaceId);
  if (!await boardExists(supabase, workspaceId, boardId)) return { error: "Доска не найдена." };
  const title = taskTitleSchema.safeParse(field(form, "title"));
  const columnId = idSchema.safeParse(field(form, "column_id"));
  if (!title.success) return { error: title.error.issues[0]?.message };
  if (!columnId.success) return { error: "Выберите колонку." };
  const column = await supabase.from("columns").select("id").eq("id", columnId.data).eq("board_id", boardId).eq("workspace_id", workspaceId).maybeSingle();
  if (column.error || !column.data) return { error: "Колонка не найдена." };
  const position = await nextPosition(supabase, "tasks", boardId, workspaceId);
  const { error } = await supabase.from("tasks").insert({ workspace_id: workspaceId, board_id: boardId, column_id: columnId.data, title: title.data, position });
  if (error) return { error: "Не удалось создать задачу." };
  revalidatePath(`/workspaces/${workspaceId}/boards/${boardId}`);
  return { success: "Задача добавлена." };
}

export type MoveTaskInput = {
  workspaceId: string;
  boardId: string;
  taskId: string;
  targetColumnId: string;
  expectedVersion: number;
  previousTask: string | null;
  nextTask: string | null;
};

export type MoveTaskResult = {
  task_id: string;
  column_id: string;
  position: number;
  version: number;
};

export async function moveTask(input: MoveTaskInput): Promise<{ data?: MoveTaskResult; error?: string }> {
  const ids = [input.workspaceId, input.boardId, input.taskId, input.targetColumnId];
  if ([...ids, ...[input.previousTask, input.nextTask].filter((id) => id !== null)].some((value) => !idSchema.safeParse(value).success) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) return { error: "Параметры перемещения некорректны." };
  const { supabase } = await requireWorkspace(input.workspaceId);
  if (!await boardExists(supabase, input.workspaceId, input.boardId)) return { error: "Доска не найдена." };
  const { data, error } = await supabase.rpc("reorder_task", {
    target_task: input.taskId,
    target_column: input.targetColumnId,
    expected_version: input.expectedVersion,
    previous_task: input.previousTask!,
    next_task: input.nextTask!,
  });
  if (error) return { error: "Не удалось переместить задачу." };
  const result = data as Record<string, unknown> | null;
  if (!result || typeof result.error === "string") {
    return { error: result?.error === "stale_task" || result?.error === "stale_order" ? "Порядок или задача изменились в другой сессии. Доска обновлена; повторите перемещение." : "Не удалось переместить задачу." };
  }
  if (typeof result.task_id !== "string" || typeof result.column_id !== "string" || typeof result.position !== "number" || typeof result.version !== "number") return { error: "Ответ сервера некорректен." };
  revalidatePath(`/workspaces/${input.workspaceId}/boards/${input.boardId}`);
  return { data: result as MoveTaskResult };
}
