import { requireProfile } from "@/services/session";
import { avatarUrl } from "@/services/workspaces";
import { ProfileForm } from "@/features/profiles/profile-form";

export default async function ProfilePage() {
  const { profile, user } = await requireProfile("/profile");
  return <div className="mx-auto max-w-2xl space-y-7">
    <p className="mb-3 text-xs tracking-wide text-primary">АККАУНТ</p>
    <h1 className="text-3xl font-medium tracking-tight">Ваш профиль</h1>
    <p className="mb-8 mt-3 text-sm text-muted-foreground">{user.email}</p>
    <ProfileForm profile={profile} avatarUrl={await avatarUrl(profile.avatar_path)} />
  </div>;
}
