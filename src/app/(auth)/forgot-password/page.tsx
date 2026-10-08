import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="ВОССТАНОВЛЕНИЕ ДОСТУПА" title="Забыли пароль?" description="Отправим на ваш email ссылку для создания нового пароля." footer={<Link className="hover:text-foreground" href="/sign-in">Вернуться ко входу</Link>}>
    <AuthForm mode="forgot-password" />
  </AuthShell>;
}
