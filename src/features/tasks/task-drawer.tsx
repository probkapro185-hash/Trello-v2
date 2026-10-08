"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTaskLabel, loadTaskDetails, saveTaskDetails } from "./actions";
import { priorityNames, type TaskDetails, type TaskEdit } from "./contracts";
import { TaskCollaboration } from "./task-collaboration";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/toasts";
import { DeleteTask } from "./delete-task";

const control = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-primary";

export function TaskDrawer({ taskId, liveVersion, onClose }: { taskId: string; liveVersion: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<TaskDetails | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discussionDirty, setDiscussionDirty] = useState(false);
  const [discussionBusy, setDiscussionBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [, startTransition] = useTransition();
  const reloadVersion = dirty || busy ? 0 : liveVersion;
  useEffect(() => { if (confirmClose) keepEditing.current?.focus(); }, [confirmClose]);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!reloadVersion) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const result = await loadTaskDetails(taskId);
        if (cancelled) return;
        if (result.data) setData(result.data);
        setError(result.error ?? "");
      } catch { if (!cancelled) setError("Не удалось загрузить задачу. Попробуйте снова."); }
    });
    return () => { cancelled = true; };
  }, [taskId, attempt, reloadVersion]);
  function close() {
    if (busy || discussionBusy) return;
    if (dirty || discussionDirty) setConfirmClose(true); else onClose();
  }
  return <dialog ref={dialog} aria-labelledby="task-drawer-title" onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[620px] border-l border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/65">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-5">
      <div><p className="text-xs uppercase tracking-[0.18em] text-primary">Задача</p><h2 id="task-drawer-title" className="mt-1 text-lg font-medium">Детали задачи</h2></div>
      <Button variant="ghost" type="button" onClick={close} disabled={busy || discussionBusy} aria-label="Закрыть задачу"><X size={20} /></Button>
    </header>
    {confirmClose && <div className="m-6 space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4" role="alert">
      <p className="text-sm">Есть несохранённые изменения. Закрыть без сохранения?</p>
      <div className="flex flex-wrap gap-2"><button ref={keepEditing} type="button" className="rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setConfirmClose(false)}>Продолжить редактирование</button><Button type="button" variant="destructive" onClick={onClose}>Не сохранять</Button></div>
    </div>}
    {error ? <div role="alert" className="space-y-4 p-6"><p>{error}</p><Button onClick={() => setAttempt((value) => value + 1)}>Повторить</Button></div> : data ? <TaskEditor key={`${data.task.version}:${attempt}`} data={data} liveVersion={liveVersion} onDirty={setDirty} onBusy={setBusy} onReload={() => { setDirty(false); setAttempt((value) => value + 1); }} /> : <ListSkeleton />}
    {data && <TaskCollaboration taskId={taskId} workspaceId={data.task.workspace_id} boardId={data.task.board_id} onDirty={setDiscussionDirty} onBusy={setDiscussionBusy} />}
    {data && <DeleteTask taskId={taskId} version={liveVersion} disabled={busy || discussionBusy} onBusy={setBusy} onDeleted={onClose} />}
  </dialog>;
}

function TaskEditor({ data, liveVersion, onDirty, onBusy, onReload }: { data: TaskDetails; liveVersion: number; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; onReload: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<TaskEdit>(data.edit);
  const [version, setVersion] = useState(data.task.version);
  const [labels, setLabels] = useState(data.labels);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#4F7DFF");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmReload, setConfirmReload] = useState(false);
  const total = edit.checklists.flatMap((list) => list.items);
  function change(next: TaskEdit) { setEdit(next); onDirty(true); setMessage(""); }
  function updateList(index: number, next: TaskEdit["checklists"][number]) {
    change({ ...edit, checklists: edit.checklists.map((list, i) => i === index ? next : list) });
  }
  function save() {
    onBusy(true); setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await saveTaskDetails(data.task.id, version, edit);
        if (result.error) { setError(result.error); toast(result.error, true); }
        else if (result.version) { setVersion(result.version); onDirty(false); setMessage("Изменения сохранены"); toast("Изменения сохранены"); }
      } catch { setError("Соединение прервалось. Проверьте сохранённую версию перед повторной попыткой."); toast("Изменения не подтверждены сервером", true); }
      finally { onBusy(false); }
    });
  }
  function addLabel() {
    onBusy(true); setError("");
    startTransition(async () => {
      try {
        const result = await createTaskLabel(data.task.id, labelName, labelColor);
        if (result.error) setError(result.error);
        if (result.data) { setLabels([...labels, result.data]); change({ ...edit, labels: [...edit.labels, result.data.id] }); setLabelName(""); }
      } catch { setError("Не удалось создать метку. Попробуйте снова."); }
      finally { onBusy(false); }
    });
  }
  return <form onSubmit={(event) => { event.preventDefault(); save(); }} className="p-6">
    {liveVersion > version && <div role="status" className="mb-5 space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm"><p>Задача изменилась в другой сессии. Ваш черновик сохранён в этой вкладке.</p><Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmReload(true)}>Загрузить актуальную версию</Button>{confirmReload && <div className="space-y-2"><p>Заменить несохранённый черновик данными сервера?</p><Button type="button" onClick={onReload}>Заменить черновик</Button><Button type="button" variant="ghost" onClick={() => setConfirmReload(false)}>Оставить черновик</Button></div>}</div>}
    <fieldset disabled={pending} className="space-y-7 disabled:opacity-65">
      <label className="block space-y-2 text-sm"><span>Название задачи</span><Input required maxLength={240} value={edit.title} onChange={(event) => change({ ...edit, title: event.target.value })} className="h-auto py-3 text-base" /></label>
      <label className="block space-y-2 text-sm"><span>Описание</span><textarea className={`${control} min-h-36 resize-y leading-6`} maxLength={50000} placeholder="Что нужно сделать? Добавьте контекст и ожидаемый результат." value={edit.description} onChange={(event) => change({ ...edit, description: event.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>Исполнитель</span><select className={control} value={edit.assignee} onChange={(event) => change({ ...edit, assignee: event.target.value })}><option value="">Не назначен</option>{data.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label className="space-y-2 text-sm"><span>Приоритет</span><select className={control} value={edit.priority} onChange={(event) => change({ ...edit, priority: event.target.value as TaskEdit["priority"] })}>{Object.entries(priorityNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-2 text-sm"><span>Срок</span><Input type="date" min="0001-01-01" max="9999-12-31" value={edit.due_date} onInput={(event) => change({ ...edit, due_date: event.currentTarget.value })} onChange={(event) => change({ ...edit, due_date: event.target.value })} /></label>
        <div className="flex items-end"><Button type="button" variant="ghost" onClick={() => change({ ...edit, due_date: "" })} disabled={!edit.due_date}>Убрать срок</Button></div>
      </div>
      <section aria-labelledby="task-labels-title" className="space-y-3 border-t border-border pt-5">
        <h3 id="task-labels-title" className="text-sm font-medium">Метки</h3>
        <div className="flex flex-wrap gap-2">{labels.map((label) => <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={edit.labels.includes(label.id)} onChange={(event) => change({ ...edit, labels: event.target.checked ? [...edit.labels, label.id] : edit.labels.filter((id) => id !== label.id) })} className="accent-primary" /><span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</label>)}{!labels.length && <p className="text-sm text-muted-foreground">В workspace пока нет меток.</p>}</div>
        <div className="flex items-end gap-2"><label className="flex-1 space-y-2 text-xs text-muted-foreground"><span>Новая метка</span><Input value={labelName} onChange={(event) => setLabelName(event.target.value)} maxLength={32} placeholder="Например, Дизайн" /></label><label className="space-y-2 text-xs text-muted-foreground"><span>Цвет</span><input type="color" aria-label="Цвет метки" value={labelColor} onChange={(event) => setLabelColor(event.target.value)} className="block h-10 w-10 rounded border border-input bg-background p-1" /></label><Button type="button" variant="outline" onClick={addLabel} disabled={!labelName.trim()} aria-label="Создать метку"><Plus size={16} /></Button></div>
        <p className="text-xs text-muted-foreground">Новые метки доступны всему workspace. Выбор меток для задачи сохраняется вместе с задачей.</p>
      </section>
      <section aria-labelledby="task-checklists-title" className="space-y-4 border-t border-border pt-5">
        <div className="flex items-center justify-between"><h3 id="task-checklists-title" className="text-sm font-medium">Чеклисты</h3><span className="text-xs text-muted-foreground">{total.filter((item) => item.is_completed).length} / {total.length}</span></div>
        {edit.checklists.map((list, index) => <div key={list.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Input aria-label={`Название чеклиста ${index + 1}`} required maxLength={120} value={list.title} onChange={(event) => updateList(index, { ...list, title: event.target.value })} /><Button variant="ghost" type="button" aria-label={`Удалить чеклист ${index + 1}`} onClick={() => change({ ...edit, checklists: edit.checklists.filter((entry) => entry.id !== list.id) })}><Trash2 size={15} /></Button></div>
          <progress aria-label={`Прогресс: ${list.title}`} max={list.items.length || 1} value={list.items.filter((item) => item.is_completed).length} className="h-1 w-full accent-primary" />
          {list.items.map((item, itemIndex) => <div key={item.id} className="flex items-center gap-2">
            <input type="checkbox" aria-label={`Выполнено: ${item.text || `пункт ${itemIndex + 1}`}`} checked={item.is_completed} onChange={(event) => updateList(index, { ...list, items: list.items.map((entry) => entry.id === item.id ? { ...entry, is_completed: event.target.checked } : entry) })} className="h-4 w-4 accent-primary" />
            <Input aria-label={`Пункт ${itemIndex + 1} чеклиста ${index + 1}`} required maxLength={500} value={item.text} className={item.is_completed ? "text-muted-foreground line-through" : ""} onChange={(event) => updateList(index, { ...list, items: list.items.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry) })} />
            <Button type="button" variant="ghost" aria-label={`Удалить пункт ${itemIndex + 1} чеклиста ${index + 1}`} onClick={() => updateList(index, { ...list, items: list.items.filter((entry) => entry.id !== item.id) })}><X size={14} /></Button>
          </div>)}
          <Button type="button" variant="ghost" disabled={list.items.length >= 200} onClick={() => updateList(index, { ...list, items: [...list.items, { id: crypto.randomUUID(), text: "", is_completed: false }] })}><Plus size={14} />Добавить пункт</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={edit.checklists.length >= 20} onClick={() => change({ ...edit, checklists: [...edit.checklists, { id: crypto.randomUUID(), title: "Чеклист", items: [] }] })}><Plus size={15} />Добавить чеклист</Button>
      </section>
      <p className="text-xs text-muted-foreground">Создана {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(data.task.created_at))}</p>
    </fieldset>
    <footer className="sticky bottom-0 -mx-6 mt-6 space-y-3 border-t border-border bg-background px-6 py-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="flex items-center gap-2 text-sm text-emerald-400"><Check size={15} />{message}</p>}
      <Button type="submit" disabled={pending}>{pending && <LoaderCircle size={15} className="animate-spin" />}{pending ? "Сохраняем…" : "Сохранить изменения"}</Button>
    </footer>
  </form>;
}
