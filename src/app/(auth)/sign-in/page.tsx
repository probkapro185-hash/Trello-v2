import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { authHref, safeNext } from "@/lib/navigation";
import { getSessionContext } from "@/services/session";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const { user } = await getSessionContext();
  if (user && params.message !== "invalid-link") redirect(next);
  return <AuthShell eyebrow="С ВОЗВРАЩЕНИЕМ" title="Войдите в Contour" description="Ваше пространство для совместной работы." footer={<>Ещё нет аккаунта? <Link className="text-foreground hover:text-primary" href={authHref("sign-up", next)}>Зарегистрироваться</Link></>}>
    {params.message === "password-updated" && <p role="status" className="mb-5 text-sm text-muted-foreground">Пароль изменён. Войдите с новым паролем.</p>}
    {params.message === "invalid-link" && <p role="alert" className="mb-5 text-sm leading-6 text-destructive">Ссылка недействительна или уже использована. Войдите в аккаунт или запросите новую ссылку восстановления.</p>}
    <AuthForm mode="sign-in" next={next} />
    <Link className="mt-5 inline-block text-sm text-muted-foreground hover:text-foreground" href="/forgot-password">Забыли пароль?</Link>
  </AuthShell>;
}
