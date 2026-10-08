"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div role="alert" className="mx-auto my-12 max-w-md rounded-2xl border border-border bg-card p-8 text-center"><CircleAlert className="mx-auto mb-5 text-destructive" size={30} /><h1 className="text-xl font-medium">Не удалось загрузить данные</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Проверьте подключение и попробуйте ещё раз.</p><Button className="mt-6" onClick={retry}>Повторить</Button><Link href="/workspaces" className="mt-4 block text-sm text-muted-foreground hover:text-foreground">Вернуться к workspace</Link></div>;
}
