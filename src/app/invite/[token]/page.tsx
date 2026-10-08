import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/action-form";
import { requireProfile } from "@/services/session";
import { inviteTokenSchema } from "@/lib/validation";
import { acceptInvite } from "@/features/workspaces/actions";
import { inspectedInviteSchema, invitationError } from "@/features/workspaces/invite-results";
import { buttonVariants } from "@/components/ui/button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await requireProfile(`/invite/${token}`);
  const valid = inviteTokenSchema.safeParse(token).success;
  const { data, error } = valid ? await supabase.rpc("inspect_workspace_invite", { invite_token: token }) : { data: { error: "invalid_invite" }, error: null };
  const invite = inspectedInviteSchema.safeParse(data);
  return <AuthShell eyebrow="ПРИГЛАШЕНИЕ В КОМАНДУ" title={invite.success ? invite.data.name : "Не удалось открыть приглашение"} description={invite.success ? "Вас приглашают присоединиться к рабочему пространству." : error ? "Сервис временно недоступен. Попробуйте открыть ссылку ещё раз." : invitationError(data)} footer={<Link className="hover:text-foreground" href="/workspaces">К моим workspace</Link>}>
    {invite.success && <><p className="mb-6 break-all text-sm text-muted-foreground">Вы войдёте как {user.email}</p>{invite.data.already_member ? <Link className={buttonVariants()} href={`/workspaces/${invite.data.workspace_id}`}>Открыть workspace</Link> : <ActionForm action={acceptInvite.bind(null, token)} submit="Присоединиться к workspace" />}</>}
  </AuthShell>;
}
