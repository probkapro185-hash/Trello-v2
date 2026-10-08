import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { invitationStatus, requireWorkspace, workspaceMembers } from "@/services/workspaces";
import { ActionForm, Field } from "@/components/action-form";
import { UserAvatar } from "@/components/user-avatar";
import { createInvite, deleteWorkspace, leaveWorkspace, removeMember, renameWorkspace, revokeInvite } from "@/features/workspaces/actions";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const { workspace, supabase, user, isOwner } = await requireWorkspace(workspaceId);
  const members = await workspaceMembers(workspaceId);
  const { data: invites, error } = isOwner
    ? await supabase.from("invites").select("id, created_at, expires_at, use_count, max_uses, revoked_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20)
    : { data: [], error: null };
  if (error) throw new Error("Не удалось загрузить приглашения.");
  return <div className="mx-auto max-w-6xl space-y-8">
    <Link href="/workspaces" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Все workspace</Link>
    <div className="mb-10 flex items-start justify-between gap-4"><div className="min-w-0">
      <p className="mb-3 text-xs tracking-wide text-primary">WORKSPACE</p><h1 className="break-words text-3xl font-medium tracking-tight">{workspace.name}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Управляйте командой и доступом к пространству.</p>
    </div><span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{isOwner ? "Владелец" : "Участник"}</span></div>
    <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <section id="members" className="self-start rounded-2xl border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between border-b border-border p-5"><h2 className="flex items-center gap-2 font-medium"><Users size={17} /> Участники</h2><span className="text-xs text-muted-foreground">{members.length}</span></div>
        <ul className="divide-y divide-border">{members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center gap-3 p-5">
          <UserAvatar name={member.profiles?.name ?? "Участник"} url={member.avatarUrl} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.profiles?.name}{member.user_id === user.id && <span className="font-normal text-muted-foreground"> · вы</span>}</p><p className="mt-1 text-xs text-muted-foreground">@{member.profiles?.username}</p></div>
          {member.role === "owner" ? <span className="text-xs text-muted-foreground">Владелец</span> : isOwner ? <ActionForm action={removeMember.bind(null, workspaceId, member.user_id)} submit="Удалить" variant="ghost" className="text-right" /> : <span className="text-xs text-muted-foreground">Участник</span>}
        </li>)}</ul>
        {members.length === 1 && <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">Пока здесь только вы. Пригласите команду, чтобы работать вместе.</p>}
      </section>
      <div className="space-y-6">
        {isOwner ? <>
          <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-2 font-medium">Пригласить участника</h2><p className="mb-5 text-sm leading-6 text-muted-foreground">Создайте одноразовую ссылку и отправьте её коллеге. Ссылка действует 7 дней.</p><ActionForm action={createInvite.bind(null, workspaceId)} submit="Создать приглашение" /></section>
          <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-5 font-medium">Настройки workspace</h2><ActionForm action={renameWorkspace.bind(null, workspaceId)} submit="Сохранить название" variant="outline"><Field label="Название" name="name" defaultValue={workspace.name} required maxLength={80} /></ActionForm></section>
          {invites && invites.length > 0 && <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 font-medium">Последние приглашения</h2><ul className="divide-y divide-border">{invites.map((invite) => {
            const status = invitationStatus(invite);
            return <li key={invite.id} className="flex items-center justify-between gap-3 py-3"><div className="text-xs"><p>{status}</p><p className="mt-1 text-muted-foreground">Создано {new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(invite.created_at))}</p></div>{status === "Активно" && <ActionForm action={revokeInvite.bind(null, workspaceId, invite.id)} submit="Отозвать" variant="ghost" />}</li>;
          })}</ul></section>}
          <details className="rounded-xl border border-border p-5"><summary className="cursor-pointer text-sm text-destructive">Удалить workspace</summary><p className="my-4 text-sm leading-6 text-muted-foreground">Workspace, доски и задачи будут удалены без возможности восстановления. Для подтверждения введите «{workspace.name}».</p><ActionForm action={deleteWorkspace.bind(null, workspaceId)} submit="Удалить навсегда" variant="destructive"><Field label="Подтверждение названия" name="confirmation" required autoComplete="off" /></ActionForm></details>
        </> : <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-2 font-medium">Доступ к workspace</h2><p className="mb-5 text-sm leading-6 text-muted-foreground">Приглашениями и участниками управляет владелец. Вы можете выйти из workspace в любой момент.</p><ActionForm action={leaveWorkspace.bind(null, workspaceId)} submit="Выйти из workspace" variant="outline" /></section>}
      </div>
    </div>
  </div>;
}
