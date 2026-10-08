"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/services/session";
import { idSchema } from "@/lib/validation";
import { taskEditSchema, type TaskDetails } from "./contracts";

export async function deleteTask(taskId: string, version: number): Promise<{ error?: string }> {
  if (!idSchema.safeParse(taskId).success || !Number.isInteger(version) || version < 1) return { error: "Некорректная задача." };
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).eq("version", version).select("workspace_id,board_id").maybeSingle();
  if (error || !data) return { error: "Задача изменилась или доступ отозван. Обновите её перед удалением." };
  revalidatePath(`/workspaces/${data.workspace_id}/boards/${data.board_id}`);
  revalidatePath("/my-tasks");
  return {};
}

export async function loadTaskDetails(taskId: string): Promise<{ data?: TaskDetails; error?: string }> {
  if (!idSchema.safeParse(taskId).success) return { error: "Задача не найдена." };
  const { supabase } = await requireProfile();
  const result = await supabase.from("tasks").select("*, task_assignees(user_id), task_labels(label_id), checklists(*, checklist_items(*))").eq("id", taskId).maybeSingle();
  if (result.error || !result.data) return { error: "Не удалось открыть задачу. Проверьте доступ и попробуйте снова." };
  const { task_assignees, task_labels, checklists, ...task } = result.data;
  const [labels, members] = await Promise.all([
    supabase.from("labels").select("*").eq("workspace_id", task.workspace_id).order("name"),
    supabase.from("workspace_members").select("profiles(id, name)").eq("workspace_id", task.workspace_id),
  ]);
  if (labels.error || members.error) return { error: "Не удалось загрузить участников или метки." };
  const order = (a: { position: number; id: string }, b: { position: number; id: string }) => a.position - b.position || a.id.localeCompare(b.id);
  return { data: { task, labels: labels.data, members: members.data.flatMap((member) => member.profiles ? [member.profiles] : []), edit: {
    title: task.title, description: task.description, priority: task.priority, due_date: task.due_date ?? "",
    assignee: task_assignees[0]?.user_id ?? "", labels: task_labels.map((label) => label.label_id),
    checklists: checklists.sort(order).map((list) => ({ id: list.id, title: list.title, items: list.checklist_items.sort(order).map(({ id, text, is_completed }) => ({ id, text, is_completed })) })),
  } } };
}

export async function saveTaskDetails(taskId: string, version: number, input: unknown): Promise<{ version?: number; error?: string }> {
  const parsed = taskEditSchema.safeParse(input);
  if (!idSchema.safeParse(taskId).success || !Number.isInteger(version) || version < 1) return { error: "Некорректная задача." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  const { supabase } = await requireProfile();
  const task = await supabase.from("tasks").select("workspace_id, board_id").eq("id", taskId).maybeSingle();
  if (task.error || !task.data) return { error: "Задача недоступна." };
  const result = await supabase.rpc("save_task_details", { target_task: taskId, expected_version: version, details: parsed.data });
  if (result.error) return { error: "Не удалось сохранить задачу. Попробуйте ещё раз." };
  const payload = z.object({ version: z.number().int().positive() }).safeParse(result.data);
  if (!payload.success) {
    const failure = z.object({ error: z.string() }).safeParse(result.data);
    return { error: failure.success && failure.data.error === "stale_task" ? "Задача уже изменена. Закройте и откройте панель, чтобы загрузить актуальную версию. Ваши правки пока не сохранены." : "Изменения не сохранены. Проверьте доступность исполнителя, меток и чеклистов." };
  }
  revalidatePath(`/workspaces/${task.data.workspace_id}/boards/${task.data.board_id}`);
  return payload.data;
}

export async function createTaskLabel(taskId: string, name: string, color: string) {
  const parsed = z.object({ taskId: idSchema, name: z.string().trim().min(1, "Введите название метки").max(32), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).safeParse({ taskId, name, color });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте метку." };
  const { supabase } = await requireProfile();
  const task = await supabase.from("tasks").select("workspace_id").eq("id", taskId).maybeSingle();
  if (task.error || !task.data) return { error: "Задача недоступна." };
  const result = await supabase.from("labels").insert({ workspace_id: task.data.workspace_id, name: parsed.data.name, color: parsed.data.color }).select("*").single();
  if (result.error) return { error: result.error.code === "23505" ? "Метка с таким названием уже существует." : "Не удалось создать метку." };
  return { data: result.data };
}
