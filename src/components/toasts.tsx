"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

type Toast = { id: string; message: string; error: boolean };
const Context = createContext<(message: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(Context);

function ToastItem({ item, remove }: { item: Toast; remove: (id: string) => void }) {
  useEffect(() => { const timer = setTimeout(() => remove(item.id), item.error ? 10000 : 6000); return () => clearTimeout(timer); }, [item, remove]);
  return <div role={item.error ? "alert" : "status"} className="toast flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl">{item.error ? <CircleAlert size={18} className="mt-0.5 shrink-0 text-destructive" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" />}<p className="flex-1 text-sm leading-5">{item.message}</p><button onClick={() => remove(item.id)} aria-label="Закрыть уведомление" className="p-1 text-muted-foreground"><X size={15} /></button></div>;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    const update = () => setTarget([...document.querySelectorAll("dialog[open]")].at(-1) ?? document.body);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  const notify = useCallback((message: string, error = false) => setItems((current) => [...current.slice(-2), { id: crypto.randomUUID(), message, error }]), []);
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
  return <Context.Provider value={notify}>{children}{target && createPortal(<aside aria-label="Уведомления" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] space-y-2 sm:left-auto sm:w-96"><div className="pointer-events-auto space-y-2">{items.map((item) => <ToastItem key={item.id} item={item} remove={remove} />)}</div></aside>, target)}</Context.Provider>;
}
