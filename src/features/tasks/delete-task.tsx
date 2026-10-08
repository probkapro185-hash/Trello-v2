"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toasts";
import { deleteTask } from "./actions";

export function DeleteTask({ taskId, version, disabled, onBusy, onDeleted }: { taskId: string; version: number; disabled: boolean; onBusy: (value: boolean) => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const toast = useToast();
  const router = useRouter();
  function remove() {
    onBusy(true); setError("");
    start(async () => {
      try {
        const result = await deleteTask(taskId, version);
        if (result.error) { setError(result.error); toast(result.error, true); }
        else { onDeleted(); toast("Задача удалена"); router.refresh(); }
      } catch { setError("Не удалось подтвердить удаление. Обновите доску перед повторной попыткой."); toast("Ошибка удаления задачи", true); }
      finally { onBusy(false); }
    });
  }
  return <section className="border-t border-border p-6"><Button type="button" variant="ghost" disabled={disabled || pending} onClick={() => setConfirm(true)}>Удалить задачу</Button>{confirm && <div className="mt-3 space-y-3 rounded-xl border border-destructive/30 p-4"><p className="text-sm">Удалить задачу вместе с комментариями, вложениями и несохранёнными правками? Отменить это действие нельзя.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="destructive" disabled={disabled || pending} onClick={remove}>Удалить навсегда</Button><Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm(false)}>Оставить задачу</Button></div></div>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</section>;
}
