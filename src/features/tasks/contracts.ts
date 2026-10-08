import { z } from "zod";
import { idSchema, taskTitleSchema } from "@/lib/validation";
import type { Label, Task } from "@/types/domain";

export const priorityNames = { low: "Низкий", medium: "Обычный", high: "Высокий", urgent: "Срочный" };
export const taskEditSchema = z.object({
  title: taskTitleSchema,
  description: z.string().max(50000, "Описание — до 50 000 символов"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.union([z.literal(""), z.iso.date()]),
  assignee: z.union([z.literal(""), idSchema]),
  labels: z.array(idSchema).max(100),
  checklists: z.array(z.object({
    id: idSchema,
    title: z.string().trim().min(1, "Назовите чеклист").max(120),
    items: z.array(z.object({ id: idSchema, text: z.string().trim().min(1, "Заполните пункт чеклиста").max(500), is_completed: z.boolean() })).max(200),
  })).max(20),
});
export type TaskEdit = z.infer<typeof taskEditSchema>;
export type TaskDetails = {
  task: Task;
  edit: TaskEdit;
  labels: Label[];
  members: { id: string; name: string }[];
};
export type CardDetails = { labels: Pick<Label, "id" | "name" | "color">[]; assignee: string | null; avatarUrl: string | null; completed: number; total: number };
