"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/action-form";
import { UserAvatar } from "@/components/user-avatar";
import { saveProfile } from "@/features/profiles/actions";
import type { Profile } from "@/types/domain";
import { MAX_AVATAR_BYTES } from "@/lib/constants";

export function ProfileForm({ profile, avatarUrl, next = "/workspaces" }: { profile?: Profile; avatarUrl?: string | null; next?: string }) {
  const [fileError, setFileError] = useState("");
  return <ActionForm action={saveProfile} submit={profile ? "Сохранить профиль" : "Продолжить"}>
    <input type="hidden" name="next" value={next} />
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <UserAvatar name={profile?.name ?? "Вы"} url={avatarUrl} />
      <div className="min-w-0 space-y-2">
        <label htmlFor="avatar" className="block text-sm">Аватар <span className="text-muted-foreground">· необязательно</span></label>
        <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1.5 file:text-foreground" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && file.size > MAX_AVATAR_BYTES) { setFileError("Максимум 2 МБ"); event.target.value = ""; }
          else setFileError("");
        }} />
        <p className="text-xs text-muted-foreground">JPEG, PNG или WebP · до 2 МБ</p>
        {fileError && <p role="alert" className="text-xs text-destructive">{fileError}</p>}
      </div>
    </div>
    {profile?.avatar_path && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input name="remove_avatar" type="checkbox" className="accent-primary" /> Удалить текущий аватар</label>}
    <Field label="Имя" name="name" autoComplete="name" required maxLength={80} defaultValue={profile?.name ?? ""} placeholder="Как к вам обращаться?" />
    <Field label="Username" name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" defaultValue={profile?.username ?? ""} placeholder="alex" hint="Латинские буквы, цифры и _ · от 3 до 32 символов" />
  </ActionForm>;
}
