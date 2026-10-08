import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ProfileForm } from "@/features/profiles/profile-form";
import { requireUser } from "@/services/session";
import { safeNext } from "@/lib/navigation";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { supabase, user } = await requireUser(next);
  const { data: profile, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Не удалось загрузить профиль.");
  if (profile) redirect(next);
  return <AuthShell eyebrow="ДАВАЙТЕ ПОЗНАКОМИМСЯ" title="Ваш профиль" description="Так вас будут видеть участники команды." footer={<form action={signOut}><Button type="submit" variant="ghost">Войти другим аккаунтом</Button></form>}>
    <ProfileForm next={next} />
  </AuthShell>;
}
