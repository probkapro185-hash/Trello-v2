"use client";

import { useActionState, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState, FormAction } from "@/types/actions";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toasts";

export function Field({ label, hint, defaultValue = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  const [value, setValue] = useState(String(defaultValue));
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm text-foreground/85">{label}</label>
    <Input {...props} id={id} value={value} onChange={(event) => setValue(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint && <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>}
  </div>;
}

function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
    <label htmlFor="new-invite-link" className="text-xs text-muted-foreground">Одноразовая ссылка · действует 7 дней</label>
    <div className="flex gap-2">
      <Input id="new-invite-link" value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
      <Button type="button" variant="outline" aria-label="Скопировать ссылку" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); setFailed(false); }
        catch { setFailed(true); }
      }}>{copied ? <Check size={16} /> : <Copy size={16} />}</Button>
    </div>
    <p aria-live="polite" className="text-xs text-muted-foreground">{failed ? "Выделите и скопируйте ссылку вручную." : copied ? "Ссылка скопирована" : "Сохраните ссылку сейчас: повторно показать её нельзя."}</p>
  </div>;
}

export function ActionForm({ action, children, submit, className, variant = "default", refreshOnSuccess = false }: {
  action: FormAction; children?: ReactNode; submit: string; className?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  refreshOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (state.error) toast(state.error, true);
    else if (state.success) toast(state.success);
    if (state.navigateTo) router.push(state.navigateTo);
  }, [state, toast, router]);
  useEffect(() => {
    if (refreshOnSuccess && state.success) router.refresh();
  }, [refreshOnSuccess, router, state.success]);
  return <form action={formAction} className={cn("space-y-4", className)}>
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      {children}
      <Button type="submit" variant={variant} disabled={pending}>
        {pending && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}{pending ? "Подождите…" : submit}
      </Button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm leading-6 text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-sm leading-6 text-muted-foreground">{state.success}</p>}
    {state.link && <InviteLink key={state.link} link={state.link} />}
  </form>;
}
