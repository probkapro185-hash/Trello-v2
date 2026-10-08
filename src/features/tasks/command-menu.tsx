"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, ArrowLeft, Plus, ListTodo, LayoutGrid } from "lucide-react";
import { Modal } from "@/components/modal";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/types/domain";
import { taskHref } from "./task-groups";

type Mode = "commands" | "search" | "task" | "board";
type Item = { id: string; label: string; detail?: string; href: string };
export function CommandMenu({ workspaces }: { workspaces: Workspace[] }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.isComposing || event.repeat || event.altKey) return;
      // Do not bypass another dialog's unsaved-change protection.
      if (document.querySelector("dialog[open]")) return;
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") { event.preventDefault(); setMode("commands"); return; }
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable='true']") || event.metaKey || event.ctrlKey) return;
      if (event.code === "KeyN") {
        event.preventDefault();
        const field = document.querySelector<HTMLInputElement>("[data-new-task]");
        if (field) { field.scrollIntoView({ block: "center", behavior: "smooth" }); field.focus({ preventScroll: true }); }
        else setMode("task");
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [pathname]);
  return <><button type="button" onClick={() => setMode("commands")} aria-label="Поиск и команды" aria-keyshortcuts="Meta+k Control+k" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Search size={16} /><span className="hidden sm:inline">Поиск</span><kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">⌘ / Ctrl K</kbd></button>{mode && <CommandDialog key={pathname} initialMode={mode} workspaces={workspaces} onClose={() => setMode(null)} />}</>;
}

function CommandDialog({ initialMode, workspaces, onClose }: { initialMode: Mode; workspaces: Workspace[]; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ items: Item[]; more: boolean; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { input.current?.focus(); }, [mode]);
  const search = query.trim();
  const searching = mode === "search" || (mode === "commands" && search.length > 0);
  useEffect(() => {
    if (!(mode === "task" || searching && search.length >= 2)) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      const client = createClient();
      if (mode === "task") {
        const escaped = search.replace(/[\\%_]/g, "\\$&");
        const { data, error } = await client.from("boards").select("id,name,workspace_id,workspaces(name)").ilike("name", `%${escaped}%`).order("name").order("id").range(page * 30, page * 30 + 30).abortSignal(abort.signal);
        if (!abort.signal.aborted) setResult({ items: (data ?? []).slice(0, 30).map((b) => ({ id: b.id, label: b.name, detail: b.workspaces?.name, href: `/workspaces/${b.workspace_id}/boards/${b.id}#new-task` })), more: (data?.length ?? 0) > 30, error: error ? "Не удалось загрузить доски." : undefined });
      } else {
        const { data, error } = await client.rpc("search_tasks", { search_query: search, page_number: page }).abortSignal(abort.signal);
        if (!abort.signal.aborted) setResult({ items: (data ?? []).slice(0, 30).map((t) => ({ id: t.id, label: t.title, detail: `${t.workspace_name} / ${t.board_name}${t.is_done ? " · Завершена" : ""}${t.description ? ` · ${t.description}` : ""}`, href: taskHref(t) })), more: (data?.length ?? 0) > 30, error: error ? "Поиск недоступен. Проверьте соединение." : undefined });
      }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [mode, search, searching, page, retry]);
  function choose(next: Mode) { setMode(next); setQuery(""); setPage(0); setResult(null); }
  function navigate(href: string) {
    onClose();
    if (href === `${window.location.pathname}#new-task`) {
      requestAnimationFrame(() => {
        const field = document.querySelector<HTMLInputElement>("[data-new-task]");
        field?.scrollIntoView({ block: "center", behavior: "smooth" }); field?.focus({ preventScroll: true });
      });
    } else router.push(href);
  }
  function focusItem(direction: number, from: EventTarget) {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("[data-command]") ?? [])];
    const index = buttons.indexOf(from as HTMLButtonElement);
    buttons[index < 0 ? direction > 0 ? 0 : buttons.length - 1 : (index + direction + buttons.length) % buttons.length]?.focus();
  }
  return <Modal onClose={onClose} label="Поиск и команды"><div onKeyDown={(event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusItem(event.key === "ArrowDown" ? 1 : -1, event.target); }
    if (event.key === "Enter" && event.target === input.current) { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>("[data-command]")?.click(); }
  }}>
    <div className="flex items-center gap-3 border-b border-border p-4">{mode !== "commands" ? <button aria-label="Назад к командам" onClick={() => choose("commands")}><ArrowLeft size={18} /></button> : <Search size={18} className="text-primary" />}<input ref={input} autoFocus aria-label={mode === "task" ? "Найти доску" : "Поиск задач"} placeholder={mode === "task" ? "Выберите доску для новой задачи…" : mode === "board" ? "Выберите workspace…" : "Поиск по названию и описанию…"} maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setResult(null); }} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" /><button className="rounded p-2 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="Закрыть поиск"><X size={18} /></button></div>
    <div ref={list} className="max-h-[55dvh] overflow-y-auto p-2">
      {mode === "commands" && !search && <><p className="px-3 py-2 text-xs text-muted-foreground">Быстрые действия</p>{[{ label: "Создать задачу", icon: Plus, action: () => choose("task"), hint: "N" }, { label: "Создать доску", icon: LayoutGrid, action: () => choose("board"), hint: "" }, { label: "Поиск задач", icon: Search, action: () => choose("search"), hint: "" }, { label: "Перейти в Мои задачи", icon: ListTodo, action: () => navigate("/my-tasks"), hint: "" }].map(({ label, icon: Icon, action, hint }) => <button key={label} data-command onClick={action} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-accent focus:bg-accent"><Icon size={17} className="text-muted-foreground" />{label}<span className="ml-auto text-xs text-muted-foreground">{hint}</span></button>)}</>}
      {mode === "board" && <><p className="px-3 py-2 text-xs text-muted-foreground">Где создать доску?</p>{workspaces.filter((w) => w.name.toLowerCase().includes(search.toLowerCase())).map((w) => <button key={w.id} data-command onClick={() => navigate(`/workspaces/${w.id}/boards#new-board`)} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-accent focus:bg-accent">{w.name}</button>)}{!workspaces.length && <button data-command onClick={() => navigate("/workspaces")} className="p-4 text-primary">Сначала создайте workspace →</button>}</>}
      {searching && search.length < 2 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Введите целые слова, минимум 2 символа.</p>}
      {(mode === "task" || searching && search.length >= 2) && (!result ? <ListSkeleton /> : result.error ? <div role="alert" className="p-4 text-sm"><p>{result.error}</p><Button variant="outline" className="mt-3" onClick={() => { setResult(null); setRetry(retry + 1); }}>Повторить</Button></div> : <>
        {result.items.map((item) => <button key={item.id} data-command onClick={() => navigate(item.href)} className="block w-full min-w-0 rounded-lg px-3 py-3 text-left hover:bg-accent focus:bg-accent"><span className="block truncate text-sm font-medium">{item.label}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.detail}</span></button>)}
        {!result.items.length && <div className="px-4 py-8 text-center"><p className="text-sm">{mode === "task" ? "Досок пока нет" : "Ничего не найдено"}</p><p className="mt-2 text-xs text-muted-foreground">{mode === "task" ? "Создайте доску, чтобы добавить первую задачу." : "Попробуйте другие слова из названия или описания."}</p>{mode === "task" && <Button variant="outline" className="mt-4" onClick={() => choose("board")}>Создать доску</Button>}</div>}
        {(page > 0 || result.more) && <div className="flex items-center justify-between p-3"><Button variant="ghost" disabled={!page} onClick={() => { setPage(page - 1); setResult(null); }}>Назад</Button><span className="text-xs text-muted-foreground">{page + 1}</span><Button variant="ghost" disabled={!result.more} onClick={() => { setPage(page + 1); setResult(null); }}>Далее</Button></div>}
      </>)}
    </div><div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">↑ ↓ выбрать · Enter открыть · Esc закрыть</div>
  </div></Modal>;
}
