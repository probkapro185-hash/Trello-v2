"use client";

import { ActionForm, Field } from "@/components/action-form";
import { signIn, signUp, forgotPassword, resetPassword } from "@/features/auth/actions";

export function AuthForm({ mode, next = "/workspaces" }: {
  mode: "sign-in" | "sign-up" | "forgot-password" | "reset-password"; next?: string;
}) {
  const actions = { "sign-in": signIn, "sign-up": signUp, "forgot-password": forgotPassword, "reset-password": resetPassword };
  const labels = { "sign-in": "Войти", "sign-up": "Создать аккаунт", "forgot-password": "Отправить ссылку", "reset-password": "Сохранить новый пароль" };
  const newPassword = mode === "sign-up" || mode === "reset-password";
  return <ActionForm action={actions[mode]} submit={labels[mode]} className="[&_button[type=submit]]:w-full">
    <input type="hidden" name="next" value={next} />
    {mode !== "reset-password" && <Field label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required maxLength={254} />}
    {mode !== "forgot-password" && <Field label={newPassword ? "Новый пароль" : "Пароль"} name="password" type="password" autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 10 : 1} maxLength={128} required hint={newPassword ? "Не менее 10 символов" : undefined} />}
    {newPassword && <Field label="Повторите пароль" name="confirm_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />}
  </ActionForm>;
}
