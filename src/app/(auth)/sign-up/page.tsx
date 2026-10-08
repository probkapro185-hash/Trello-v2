import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { authHref, safeNext } from "@/lib/navigation";
import { getSessionContext } from "@/services/session";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { user } = await getSessionContext();
  if (user) redirect(next);
  return <AuthShell eyebrow="НАЧНЁМ С ПРОСТОГО" title="Создайте аккаунт" description="Зарегистрируйтесь, подтвердите email и пригласите команду." footer={<>Уже есть аккаунт? <Link className="text-foreground hover:text-primary" href={authHref("sign-in", next)}>Войти</Link></>}>
    <AuthForm mode="sign-up" next={next} />
  </AuthShell>;
}
