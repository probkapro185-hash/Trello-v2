"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/services/session";
import { requireWorkspace } from "@/services/workspaces";
import { workspaceNameSchema, idSchema, inviteTokenSchema, field } from "@/lib/validation";
import { getAppOrigin } from "@/lib/env";
import type { ActionState } from "@/types/actions";
import { createdInviteSchema, acceptedInviteSchema, invitationError } from "./invite-results";

export async function createWorkspace(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireProfile();
  const name = workspaceNameSchema.safeParse(field(form, "name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { data, error } = await supabase.from("workspaces").insert({ name: name.data, owner_id: user.id }).select("id").single();
  if (error) return { error: "Не удалось создать workspace. Попробуйте ещё раз." };
  revalidatePath("/workspaces");
  redirect(`/workspaces/${data.id}`);
}

export async function createBoard(workspaceId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireWorkspace(workspaceId);
  const name = workspaceNameSchema.safeParse(field(form, "name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { data, error } = await supabase.from("boards").insert({ workspace_id: workspaceId, name: name.data }).select("id").single();
  if (error) return { error: "Не удалось создать доску. Попробуйте ещё раз." };
  revalidatePath(`/workspaces/${workspaceId}`, "layout");
  return { success: "Доска создана.", navigateTo: `/workspaces/${workspaceId}/boards/${data.id}` };
}

export async function renameWorkspace(workspaceId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, isOwner } = await requireWorkspace(workspaceId);
  if (!isOwner) return { error: "Изменить название может только владелец." };
  const name = workspaceNameSchema.safeParse(field(form, "name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { data, error } = await supabase.from("workspaces").update({ name: name.data }).eq("id", workspaceId).select("id").maybeSingle();
  if (error || !data) return { error: "Не удалось изменить название." };
  revalidatePath("/workspaces", "layout");
  return { success: "Название обновлено." };
}

export async function removeMember(workspaceId: string, userId: string): Promise<ActionState> {
  const { supabase, isOwner, user } = await requireWorkspace(workspaceId);
  if (!isOwner || userId === user.id || !idSchema.safeParse(userId).success) return { error: "Нельзя удалить этого участника." };
  const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("role", "member");
  if (error) return { error: "Не удалось удалить участника." };
  revalidatePath(`/workspaces/${workspaceId}`);
  return { success: "Участник удалён." };
}

export async function leaveWorkspace(workspaceId: string): Promise<ActionState> {
  const { supabase, isOwner, user } = await requireWorkspace(workspaceId);
  if (isOwner) return { error: "Владелец не может выйти из своего workspace." };
  const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", user.id).eq("role", "member");
  if (error) return { error: "Не удалось выйти из workspace." };
  revalidatePath("/workspaces");
  redirect("/workspaces");
}

export async function deleteWorkspace(workspaceId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, isOwner, workspace } = await requireWorkspace(workspaceId);
  if (!isOwner) return { error: "Удалить workspace может только владелец." };
  if (field(form, "confirmation") !== workspace.name) return { error: "Введите точное название workspace для подтверждения." };
  const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
  if (error) return { error: "Не удалось удалить workspace." };
  revalidatePath("/workspaces");
  redirect("/workspaces");
}

export async function createInvite(workspaceId: string): Promise<ActionState> {
  const { supabase, isOwner } = await requireWorkspace(workspaceId);
  if (!isOwner) return { error: "Приглашать участников может только владелец." };
  const { data, error } = await supabase.rpc("create_workspace_invite", { target_workspace: workspaceId });
  if (error) return { error: "Не удалось создать приглашение." };
  const result = createdInviteSchema.safeParse(data);
  if (!result.success) return { error: invitationError(data) };
  revalidatePath(`/workspaces/${workspaceId}`);
  return { link: `${getAppOrigin()}/invite/${result.data.token}`, success: "Приглашение создано. Отправьте ссылку участнику." };
}

export async function revokeInvite(workspaceId: string, inviteId: string): Promise<ActionState> {
  const { supabase, isOwner } = await requireWorkspace(workspaceId);
  if (!isOwner || !idSchema.safeParse(inviteId).success) return { error: "Нет доступа к приглашению." };
  const { error } = await supabase.from("invites").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", inviteId);
  if (error) return { error: "Не удалось отозвать приглашение." };
  revalidatePath(`/workspaces/${workspaceId}`);
  return { success: "Приглашение отозвано." };
}

export async function acceptInvite(token: string): Promise<ActionState> {
  const { supabase } = await requireProfile(`/invite/${token}`);
  if (!inviteTokenSchema.safeParse(token).success) return { error: "Ссылка приглашения некорректна." };
  const { data, error } = await supabase.rpc("accept_workspace_invite", { invite_token: token });
  if (error) return { error: "Не удалось присоединиться. Попробуйте ещё раз." };
  const result = acceptedInviteSchema.safeParse(data);
  if (!result.success) return { error: invitationError(data) };
  revalidatePath("/workspaces");
  redirect(`/workspaces/${result.data.workspace_id}`);
}
