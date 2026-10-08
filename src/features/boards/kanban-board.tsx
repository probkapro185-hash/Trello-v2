"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardColumn, TaskCard as Task } from "@/types/domain";
import { moveTask } from "./actions";
import { priorityNames, type CardDetails } from "@/features/tasks/contracts";
import { UserAvatar } from "@/components/user-avatar";

type TaskMap = Record<string, Task[]>;

function taskMap(columns: BoardColumn[], tasks: Task[]): TaskMap {
  return Object.fromEntries(columns.map((column) => [column.id, tasks.filter((task) => task.column_id === column.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))]));
}

function findTask(map: TaskMap, taskId: string) {
  for (const [columnId, tasks] of Object.entries(map)) {
    const index = tasks.findIndex((task) => task.id === taskId);
    const task = tasks[index];
    if (task) return { columnId, index, task };
  }
  return null;
}

function TaskPreview({ task, details, overlay = false }: { task: Task; details?: CardDetails; overlay?: boolean }) {
  return <article className={cn("rounded-xl border border-border bg-card p-3 shadow-sm", overlay && "w-72 rotate-2 shadow-xl")}>
    <p className="break-words pr-4 text-sm leading-5 text-foreground">{task.title}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">{details?.labels.map((label) => <span key={label.id} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</span>)}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className={task.priority === "urgent" ? "text-destructive" : ""}>{priorityNames[task.priority]}</span>{task.due_date && <time dateTime={task.due_date}>{task.due_date.split("-").reverse().join(".")}</time>}{!!details?.total && <span>☑ {details.completed}/{details.total}</span>}</div>
    {details?.assignee && <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><UserAvatar name={details.assignee} url={details.avatarUrl} />{details.assignee}</div>}
  </article>;
}

function SortableTask({ task, details, onOpen, disabled }: { task: Task; details?: CardDetails; onOpen: (id: string) => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative", isDragging && "opacity-35")} role="listitem">
    <button type="button" data-task-open={task.id} disabled={disabled} onClick={() => onOpen(task.id)} aria-label={`Открыть задачу: ${task.title}`} className="block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-primary"><TaskPreview task={task} details={details} /></button>
    <button type="button" {...attributes} {...listeners} disabled={disabled} className="absolute right-1 top-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Перетащить задачу: ${task.title}`}><GripVertical size={14} /></button>
  </div>;
}

function KanbanColumn({ column, tasks, details, onOpen, disabled }: { column: BoardColumn; tasks: Task[]; details: Record<string, CardDetails>; onOpen: (id: string) => void; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return <section ref={setNodeRef} className={cn("flex min-h-[19rem] w-[18rem] shrink-0 flex-col rounded-2xl border border-border bg-secondary/35 p-3 transition-colors", isOver && "border-primary/70 bg-primary/5")} aria-label={`Колонка ${column.name}`}>
    <header className="flex items-center justify-between gap-3 px-1 pb-3">
      <div className="flex min-w-0 items-center gap-2"><span className={cn("h-2 w-2 shrink-0 rounded-full", column.is_done ? "bg-emerald-400" : "bg-primary")} /><h2 className="truncate text-sm font-medium">{column.name}</h2></div>
      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{tasks.length}</span>
    </header>
    <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
      <div className="flex flex-1 flex-col gap-2 rounded-xl" role="list">
        {tasks.map((task) => <SortableTask task={task} details={details[task.id]} onOpen={onOpen} disabled={disabled} key={task.id} />)}
        {tasks.length === 0 && <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">Перетащите задачу сюда</div>}
      </div>
    </SortableContext>
  </section>;
}

export function KanbanBoard({ workspaceId, boardId, columns, tasks, details, onOpen }: { workspaceId: string; boardId: string; columns: BoardColumn[]; tasks: Task[]; details: Record<string, CardDetails>; onOpen: (id: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const router = useRouter();
  const [draft, setItems] = useState<TaskMap | null>(null);
  const items = useMemo(() => draft ?? taskMap(columns, tasks), [draft, columns, tasks]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useRef<TaskMap | null>(null);

  const activeTask = useMemo(() => activeId ? findTask(items, activeId)?.task ?? null : null, [activeId, items]);

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    snapshot.current = Object.fromEntries(Object.entries(items).map(([columnId, columnTasks]) => [columnId, [...columnTasks]]));
    setItems(snapshot.current);
    setActiveId(id);
    setError(null);
  }

  function onDragOver(event: DragOverEvent) {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;
    setItems((current) => {
      if (!current) return current;
      const source = findTask(current, active);
      if (!source) return current;
      const targetColumnId = current[over] ? over : findTask(current, over)?.columnId;
      if (!targetColumnId) return current;
      const target = findTask(current, over);
      if (source.columnId === targetColumnId) {
        if (!target || target.task.id === active || target.index === source.index) return current;
        const sourceTasks = current[source.columnId] ?? [];
        const next = { ...current, [source.columnId]: arrayMove(sourceTasks, source.index, target.index) };
        return next;
      }
      const next = { ...current };
      const sourceTasks = current[source.columnId] ?? [];
      const targetTasks = current[targetColumnId] ?? [];
      next[source.columnId] = sourceTasks.filter((task) => task.id !== active);
      const moved = { ...source.task, column_id: targetColumnId };
      const insertionIndex = target?.columnId === targetColumnId ? target.index : targetTasks.length;
      next[targetColumnId] = [...targetTasks.slice(0, insertionIndex), moved, ...targetTasks.slice(insertionIndex)];
      return next;
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    setActiveId(null);
    if (!over || !snapshot.current) { setItems(null); snapshot.current = null; return; }
    const current = items;
    const destination = findTask(current, active);
    if (!destination) { snapshot.current = null; setItems(null); return; }
    const targetColumnId = current[over] ? over : destination.columnId;
    const ordered = current[targetColumnId] ?? [];
    const taskIndex = ordered.findIndex((task) => task.id === active);
    if (taskIndex < 0) { snapshot.current = null; setItems(null); return; }
    const previous = ordered[taskIndex - 1];
    const next = ordered[taskIndex + 1];
    const position = previous && next ? (previous.position + next.position) / 2 : previous ? previous.position + 1024 : next ? next.position - 1024 : 1024;
    const original = findTask(snapshot.current, active)?.task;
    if (!original) { snapshot.current = null; setItems(null); return; }
    const nextTask = { ...destination.task, column_id: targetColumnId, position };
    setItems((map) => map && ({ ...map, [targetColumnId]: (map[targetColumnId] ?? []).map((task) => task.id === active ? nextTask : task) }));
    setPendingId(active);
    try {
      const result = await moveTask({ workspaceId, boardId, taskId: active, targetColumnId, expectedVersion: original.version, previousTask: previous?.id ?? null, nextTask: next?.id ?? null });
      if (result.error) setError(result.error);
    } catch {
      setError("Соединение прервалось. Проверяем актуальный порядок на сервере.");
    } finally {
      // Drop only this gesture's overlay. Never roll a newer server snapshot back.
      setItems(null); setPendingId(null); snapshot.current = null; router.refresh();
    }
  }

  return <div className="space-y-3">
    {tasks.length === 0 && <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[.03] px-5 py-6 text-center"><Plus className="mx-auto mb-3 text-primary" size={24} /><h3 className="text-sm font-medium">Дайте работе отправную точку</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Добавьте первую задачу, назначьте исполнителя и двигайтесь к результату.</p><button className="mt-4 text-sm text-primary" onClick={() => { const input = document.querySelector<HTMLInputElement>("[data-new-task]"); input?.scrollIntoView({ block: "center", behavior: "smooth" }); input?.focus({ preventScroll: true }); }}>Создать первую задачу →</button></div>}
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="overflow-x-auto pb-3">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setItems(null); snapshot.current = null; setActiveId(null); }}>
        <div className="flex min-w-max gap-4">
          {columns.map((column) => <KanbanColumn key={column.id} column={column} tasks={items[column.id] ?? []} details={details} onOpen={onOpen} disabled={Boolean(pendingId)} />)}
          <div className="flex w-[18rem] shrink-0 items-start justify-center rounded-2xl border border-dashed border-border px-4 py-7 text-center text-xs text-muted-foreground"><Plus size={14} className="mr-2" />Новая колонка добавляется справа</div>
        </div>
        <DragOverlay>{activeTask ? <TaskPreview task={activeTask} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
    {pendingId && <p className="text-xs text-muted-foreground">Сохраняем перемещение…</p>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><GripVertical size={14} />Перетащите карточку в другую колонку или измените порядок внутри колонки.</p>
  </div>;
}
