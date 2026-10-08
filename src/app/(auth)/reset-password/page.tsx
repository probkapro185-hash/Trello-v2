import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { getSessionContext } from "@/services/session";

export default async function ResetPasswordPage() {
  const { user } = await getSessionContext();
  if (!user) redirect("/forgot-password");
  return <AuthShell eyebrow="ВОССТАНОВЛЕНИЕ ДОСТУПА" title="Новый пароль" description="После сохранения войдите в аккаунт с новым паролем.">
    <AuthForm mode="reset-password" />
  </AuthShell>;
}
