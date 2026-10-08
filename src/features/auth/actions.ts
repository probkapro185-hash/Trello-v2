"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { safeNext } from "@/lib/navigation";
import { emailSchema, passwordSchema, field } from "@/lib/validation";
import { requireUser } from "@/services/session";
import type { ActionState } from "@/types/actions";

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(field(form, "email").trim());
  const password = field(form, "password");
  if (!email.success || !password || password.length > 128) return { error: "Проверьте email и пароль." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Подтвердите email по ссылке в письме, затем войдите." };
    if (error.status === 429) return { error: "Слишком много попыток. Подождите немного." };
    return { error: error.status && error.status >= 500 ? "Сервис входа временно недоступен. Попробуйте ещё раз." : "Не удалось войти. Проверьте email и пароль." };
  }
  redirect(safeNext(field(form, "next")));
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(field(form, "email").trim());
  const password = passwordSchema.safeParse(field(form, "password"));
  if (!email.success) return { error: "Введите корректный email." };
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (password.data !== field(form, "confirm_password")) return { error: "Пароли не совпадают." };
  const next = safeNext(field(form, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: email.data, password: password.data,
    options: { emailRedirectTo: `${getAppOrigin()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.status === 429 ? "Слишком много запросов. Попробуйте немного позже." : "Не удалось отправить письмо регистрации. Попробуйте ещё раз." };
  if (data.session) redirect(next);
  return { success: "Проверьте почту. Если адрес доступен для регистрации, мы отправили ссылку подтверждения. Уже есть аккаунт? Войдите." };
}

export async function forgotPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(field(form, "email").trim());
  if (!email.success) return { error: "Введите корректный email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${getAppOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error) return { error: error.status === 429 ? "Подождите немного перед следующим запросом." : "Не удалось отправить письмо. Попробуйте позже." };
  return { success: "Если аккаунт с этим email существует, письмо со ссылкой для восстановления уже отправлено." };
}

export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const password = passwordSchema.safeParse(field(form, "password"));
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (password.data !== field(form, "confirm_password")) return { error: "Пароли не совпадают." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: error.code === "same_password" ? "Выберите пароль, который отличается от прежнего." : "Не удалось сменить пароль. Запросите новую ссылку восстановления." };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) return { success: "Пароль изменён. Не удалось завершить сессию: выйдите из аккаунта вручную." };
  redirect("/sign-in?message=password-updated");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Не удалось выйти из аккаунта. Попробуйте ещё раз.");
  redirect("/sign-in");
}
