import { z } from "zod";

export const emailSchema = z.email("Введите корректный email").max(254);
export const passwordSchema = z.string().min(10, "Пароль должен содержать минимум 10 символов").max(128, "Пароль слишком длинный");
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(80, "Имя — до 80 символов"),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, "Username: 3–32 латинские буквы, цифры или _"),
});
export const workspaceNameSchema = z.string().trim().min(1, "Укажите название").max(80, "Название — до 80 символов");
export const columnNameSchema = z.string().trim().min(1, "Укажите название колонки").max(60, "Название колонки — до 60 символов");
export const taskTitleSchema = z.string().trim().min(1, "Укажите название задачи").max(240, "Название задачи — до 240 символов");
export const idSchema = z.uuid();
export const inviteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
