"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6">
    <p className="text-xs tracking-widest text-primary">CONTOUR</p>
    <h1 className="text-2xl font-medium">Не удалось открыть страницу</h1>
    <p className="text-sm leading-6 text-muted-foreground">Проверьте подключение и попробуйте ещё раз. Если вы запускаете проект локально, убедитесь, что Supabase запущен.</p>
    <Button onClick={retry} className="self-start">Попробовать снова</Button>
  </main>;
}
