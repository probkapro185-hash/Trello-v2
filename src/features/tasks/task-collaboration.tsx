"use client";
import { ListSkeleton } from "@/components/ui/skeleton";

import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLiveBoard } from "@/features/boards/live-scope";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import type { Attachment, Comment } from "@/types/domain";
import { ActivityFeed } from "./activity-feed";
import { attachmentTypes, maxAttachmentSize, formatTimestamp } from "./collaboration-contracts";

type CommentRow = Comment & { profiles: { name: string } | null };
export function TaskCollaboration({ taskId, workspaceId, boardId, onDirty, onBusy }: { taskId: string; workspaceId: string; boardId: string; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void }) {
  const { revision } = useLiveBoard();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [viewer, setViewer] = useState("");
  const [owner, setOwner] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<CommentRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "comment" | "file"; id: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      const client = createClient();
      const [session, workspace, list, attachments] = await Promise.all([
        client.auth.getUser(),
        client.from("workspaces").select("owner_id").eq("id", workspaceId).abortSignal(controller.signal).maybeSingle(),
        client.from("comments").select("*, profiles(name)").eq("task_id", taskId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 30, page * 30 + 30).abortSignal(controller.signal),
        client.from("attachments").select("*").eq("task_id", taskId).eq("upload_state", "ready").order("created_at", { ascending: false }).abortSignal(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setLoaded(true);
      if (session.error || workspace.error || list.error || attachments.error) { setLoadError("Не удалось загрузить обсуждение и файлы."); return; }
      setViewer(session.data.user?.id ?? ""); setOwner(workspace.data?.owner_id === session.data.user?.id);
      setComments(list.data.slice(0, 30)); setMore(list.data.length > 30); setFiles(attachments.data); setLoadError("");
    }
    void read();
    return () => controller.abort();
  }, [workspaceId, taskId, revision, refresh, page]);
  function draft(value: string) { setText(value); onDirty(Boolean(value.trim())); }
  async function perform(operation: () => Promise<void>) {
    setPending(true); onBusy(true); setError(""); setNotice("");
    try { await operation(); setRefresh((value) => value + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось выполнить действие."); }
    finally { setPending(false); onBusy(false); }
  }
  async function saveComment() {
    const body = text.trim();
    if (!body || body.length > 10000) return;
    await perform(async () => {
      const client = createClient();
      const result = editing
        ? await client.from("comments").update({ body }).eq("id", editing.id).eq("updated_at", editing.updated_at).select("id")
        : await client.from("comments").insert({ task_id: taskId, board_id: boardId, workspace_id: workspaceId, body }).select("id");
      if (result.error || !result.data?.length) throw new Error("Комментарий не сохранён: проверьте доступ или загрузите изменившуюся версию. Черновик оставлен здесь.");
      draft(""); setEditing(null); setPage(0); setNotice("Комментарий сохранён.");
    });
  }
  async function upload(file: File) {
    if (!file.size || file.size > maxAttachmentSize) { setError("Выберите непустой файл размером до 10 МБ."); return; }
    if (!attachmentTypes.includes(file.type)) { setError("Поддерживаются изображения, PDF, текст и документы Office."); return; }
    if (file.name.length > 255) { setError("Имя файла должно быть не длиннее 255 символов."); return; }
    await perform(async () => {
      const client = createClient();
      const reservation = await client.rpc("reserve_attachment", { target_task: taskId, file_name: file.name, file_type: file.type, file_size: file.size });
      if (reservation.error || !reservation.data) throw new Error("Не удалось подготовить загрузку. Проверьте доступ и лимит 100 файлов на задачу.");
      const attachment = reservation.data;
      try {
        const uploaded = await client.storage.from("task-attachments").upload(attachment.storage_path, file, { contentType: file.type, upsert: false });
        if (uploaded.error) throw new Error("Файл не загружен. Проверьте соединение и повторите попытку.");
        const completed = await client.rpc("finalize_attachment", { attachment_id: attachment.id });
        if (completed.error) throw new Error("Не удалось завершить загрузку. Повторите попытку.");
        setNotice("Файл прикреплён.");
      } catch (failure) {
        const current = await client.from("attachments").select("upload_state").eq("id", attachment.id).maybeSingle();
        if (current.data?.upload_state === "ready") { setNotice("Файл прикреплён."); return; }
        // Best-effort compensation now; DB queue survives disconnects and cascades.
        if (!current.error && current.data?.upload_state === "pending") {
          await client.storage.from("task-attachments").remove([attachment.storage_path]);
          await client.from("attachments").delete().eq("id", attachment.id).eq("upload_state", "pending");
        }
        throw failure;
      }
    });
    if (input.current) input.current.value = "";
  }
  async function removeConfirmed() {
    const target = confirmDelete;
    if (!target) return;
    await perform(async () => {
      const client = createClient();
      const file = files.find((entry) => entry.id === target.id);
      const result = await client.from(target.type === "file" ? "attachments" : "comments").delete().eq("id", target.id).select("id");
      if (result.error || !result.data?.length) throw new Error("Не удалось удалить запись. Возможно, она уже удалена или доступ изменился.");
      // Reads disappear immediately. Worker owns durable file deletion after commit.
      if (file) await client.storage.from("task-attachments").remove([file.storage_path]);
      if (editing?.id === target.id) { setEditing(null); draft(""); }
      setConfirmDelete(null); setNotice("Запись удалена.");
    });
  }
  async function download(file: Attachment) {
    await perform(async () => {
      // Authenticated download, no long-lived URL surviving access revocation.
      const result = await createClient().storage.from("task-attachments").download(file.storage_path);
      if (result.error) throw new Error("Файл недоступен. Проверьте доступ и соединение.");
      const url = URL.createObjectURL(result.data);
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }
  return <div className="space-y-8 border-t border-border px-6 py-7">
    {(error || loadError) && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><p>{error || loadError}</p>{loadError && <Button variant="ghost" onClick={() => setRefresh((n) => n + 1)}>Повторить загрузку</Button>}</div>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {confirmDelete && <div role="alert" className="space-y-3 rounded-xl border border-border p-4 text-sm"><p>Удалить {confirmDelete.type === "file" ? "файл" : "комментарий"}? Это действие нельзя отменить.</p><Button type="button" variant="destructive" disabled={pending} onClick={removeConfirmed}>Подтвердить удаление</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmDelete(null)}>Отмена</Button></div>}
    <section className="space-y-4" aria-labelledby="attachments-title"><div className="flex items-center justify-between"><h3 id="attachments-title" className="font-medium">Вложения</h3><Button variant="outline" type="button" disabled={pending || !loaded} onClick={() => input.current?.click()}><Paperclip size={15} />Прикрепить файл</Button><input ref={input} type="file" aria-label="Файл для задачи" className="hidden" accept={attachmentTypes.join(",")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></div>
      <p className="text-xs text-muted-foreground">Изображения, PDF и документы · до 10 МБ на файл</p>
      {!loaded ? <ListSkeleton /> : !files.length && <p className="text-sm text-muted-foreground">Пока нет вложений.</p>}
      <ul className="space-y-2">{files.map((file) => <li key={file.id} className="flex items-center gap-2 rounded-xl border border-border p-3"><Paperclip size={16} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-words text-sm">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size_bytes / 1024).toFixed(1)} КБ</p></div><Button type="button" variant="ghost" disabled={pending} onClick={() => download(file)} aria-label={`Скачать ${file.name}`}><Download size={15} /></Button><Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmDelete({ type: "file", id: file.id })} aria-label={`Удалить ${file.name}`}><Trash2 size={15} /></Button></li>)}</ul>
    </section>
    <section className="space-y-4" aria-labelledby="comments-title"><h3 id="comments-title" className="font-medium">Обсуждение</h3>
      <form onSubmit={(event) => { event.preventDefault(); void saveComment(); }} className="space-y-3"><label className="block text-sm">{editing ? "Редактирование комментария" : "Новый комментарий"}<textarea aria-label="Текст комментария" className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm" maxLength={10000} required disabled={pending} value={text} onChange={(event) => draft(event.target.value)} placeholder="Напишите команде…" /></label><div className="flex gap-2"><Button type="submit" disabled={pending || !text.trim()}>{pending ? "Подождите…" : editing ? "Сохранить комментарий" : "Отправить"}</Button>{editing && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setEditing(null); draft(""); }}>Отменить редактирование</Button>}</div></form>
      {loaded && !comments.length && <p className="text-sm text-muted-foreground">Начните обсуждение задачи.</p>}
      <ul className="space-y-4">{comments.map((comment) => <li key={comment.id} className="rounded-xl border border-border p-4"><div className="flex items-center gap-2"><UserAvatar name={comment.profiles?.name ?? "Удалённый участник"} /><div className="flex-1"><p className="text-sm font-medium">{comment.profiles?.name ?? "Удалённый участник"}</p><p className="text-[11px] text-muted-foreground"><time dateTime={comment.created_at}>{formatTimestamp(comment.created_at)}</time>{comment.updated_at !== comment.created_at && " · изменён"}</p></div>{comment.created_by === viewer && <Button type="button" variant="ghost" disabled={pending || Boolean(text.trim())} aria-label="Редактировать комментарий" onClick={() => { setEditing(comment); draft(comment.body); }}><Pencil size={14} /></Button>}{(comment.created_by === viewer || owner) && <Button type="button" variant="ghost" disabled={pending} aria-label="Удалить комментарий" onClick={() => setConfirmDelete({ type: "comment", id: comment.id })}><Trash2 size={14} /></Button>}</div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p></li>)}</ul>
      {(page > 0 || more) && <div className="flex justify-between"><Button variant="ghost" disabled={!page} onClick={() => setPage(page - 1)}>Новее</Button><Button variant="ghost" disabled={!more} onClick={() => setPage(page + 1)}>Ранее</Button></div>}
    </section>
    <section className="space-y-4 border-t border-border pt-6"><h3 className="font-medium">История задачи</h3><ActivityFeed taskId={taskId} refresh={refresh} /></section>
  </div>;
}
