import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ eyebrow, title, description, children, footer }: {
  eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode;
}) {
  return <main className="grid min-h-svh lg:grid-cols-[1fr_1fr]">
    <aside className="relative hidden flex-col justify-between border-r border-border bg-secondary p-12 lg:flex xl:p-16">
      <Link href="/" className="text-sm font-semibold tracking-[0.22em]">CONTOUR<span className="text-primary">.</span></Link>
      <div className="max-w-md space-y-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><ArrowUpRight size={24} /></div>
        <h2 className="text-4xl font-medium leading-[1.2] tracking-tight xl:text-5xl">Меньше шума.<br /><span className="text-muted-foreground">Больше ясности.</span></h2>
        <p className="max-w-sm text-sm leading-7 text-muted-foreground">Общее пространство для вашей команды. Всё начинается с простого шага.</p>
      </div>
      <p className="text-xs text-muted-foreground/60">Работайте вместе. Двигайтесь вперёд.</p>
    </aside>
    <section className="flex min-w-0 flex-col justify-center px-6 py-12 sm:px-12">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="mb-14 block text-xs font-semibold tracking-[0.2em] lg:hidden">CONTOUR<span className="text-primary">.</span></Link>
        <p className="mb-3 text-xs font-medium tracking-wide text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
        {footer && <div className="mt-7 border-t border-border pt-6 text-sm leading-6 text-muted-foreground">{footer}</div>}
      </div>
    </section>
  </main>;
}
