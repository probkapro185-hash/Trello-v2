import "server-only";
import { notFound } from "next/navigation";
import { requireProfile } from "@/services/session";
import { idSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET } from "@/lib/constants";

export function invitationStatus(invite: { revoked_at: string | null; use_count: number; max_uses: number; expires_at: string }) {
  return invite.revoked_at ? "Отозвано" : invite.use_count >= invite.max_uses ? "Использовано" : Date.parse(invite.expires_at) <= Date.now() ? "Истекло" : "Активно";
}

export async function avatarUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(AVATARS_BUCKET).createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}

export async function requireWorkspace(workspaceId: string) {
  const context = await requireProfile(`/workspaces/${workspaceId}`);
  if (!idSchema.safeParse(workspaceId).success) notFound();
  const { data: workspace, error } = await context.supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle();
  if (error) throw new Error("Не удалось загрузить workspace.");
  if (!workspace) notFound();
  return { ...context, workspace, isOwner: workspace.owner_id === context.user.id };
}

export async function workspaceMembers(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_members")
    .select("user_id, role, joined_at, profiles(id, name, username, avatar_path)")
    .eq("workspace_id", workspaceId).order("joined_at");
  if (error) throw new Error("Не удалось загрузить участников.");
  return Promise.all(data.map(async (member) => ({ ...member, avatarUrl: await avatarUrl(member.profiles?.avatar_path ?? null) })));
}
