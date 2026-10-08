"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/services/session";
import { profileSchema, field } from "@/lib/validation";
import { safeNext } from "@/lib/navigation";
import { AVATARS_BUCKET, MAX_AVATAR_BYTES } from "@/lib/constants";
import type { ActionState } from "@/types/actions";

export async function saveProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser(safeNext(field(form, "next")));
  const input = profileSchema.safeParse({ name: field(form, "name"), username: field(form, "username") });
  if (!input.success) return { error: input.error.issues[0]?.message };
  const { data: existing, error: readError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (readError) return { error: "Не удалось загрузить профиль. Попробуйте ещё раз." };
  let avatarPath = field(form, "remove_avatar") === "on" ? null : existing?.avatar_path ?? null;
  let uploadedPath: string | null = null;
  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > MAX_AVATAR_BYTES) return { error: "Аватар должен быть не больше 2 МБ." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatar.type)) return { error: "Выберите изображение JPEG, PNG или WebP." };
    let image: Buffer;
    try {
      image = await sharp(Buffer.from(await avatar.arrayBuffer()), { limitInputPixels: 16000000 })
        .rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
    } catch { return { error: "Не удалось прочитать изображение. Выберите другой файл." }; }
    uploadedPath = `${user.id}/${randomUUID()}.webp`;
    const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(uploadedPath, image, { contentType: "image/webp", upsert: false });
    if (error) return { error: "Не удалось загрузить аватар. Попробуйте ещё раз." };
    avatarPath = uploadedPath;
  }
  const values = { ...input.data, avatar_path: avatarPath };
  const { error } = existing
    ? await supabase.from("profiles").update(values).eq("id", user.id)
    : await supabase.from("profiles").insert({ id: user.id, ...values });
  if (error) {
    if (uploadedPath) await supabase.storage.from(AVATARS_BUCKET).remove([uploadedPath]);
    return { error: error.code === "23505" ? "Этот username уже занят. Выберите другой." : "Не удалось сохранить профиль." };
  }
  let cleanupFailed = false;
  if (existing?.avatar_path && existing.avatar_path !== avatarPath) {
    const { error: cleanupError } = await supabase.storage.from(AVATARS_BUCKET).remove([existing.avatar_path]);
    cleanupFailed = Boolean(cleanupError);
  }
  revalidatePath("/", "layout");
  if (!existing) redirect(safeNext(field(form, "next")));
  return { success: cleanupFailed ? "Профиль сохранён. Старое изображение пока не удалось удалить из хранилища." : "Профиль сохранён." };
}
