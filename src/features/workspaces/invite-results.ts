import { z } from "zod";
import { inviteTokenSchema } from "@/lib/validation";

export const createdInviteSchema = z.object({ id: z.uuid(), token: inviteTokenSchema, expires_at: z.string() });
export const inspectedInviteSchema = z.object({ workspace_id: z.uuid(), name: z.string(), already_member: z.boolean(), expires_at: z.string() });
export const acceptedInviteSchema = z.object({ workspace_id: z.uuid(), already_member: z.boolean() });

export function invitationError(data: unknown): string {
  const parsed = z.object({ error: z.string() }).safeParse(data);
  const messages: Record<string, string> = {
    auth_required: "Войдите в аккаунт.",
    forbidden: "Только владелец может приглашать участников.",
    rate_limited: "Слишком много попыток. Подождите минуту.",
    too_many_invites: "Уже создано 20 активных ссылок. Отзовите ненужные.",
    profile_required: "Сначала заполните профиль.",
    invalid_invite: "Ссылка недействительна, истекла или уже использована. Попросите владельца отправить новую.",
  };
  return (parsed.success && messages[parsed.data.error]) || "Не удалось обработать приглашение. Попробуйте ещё раз.";
}
