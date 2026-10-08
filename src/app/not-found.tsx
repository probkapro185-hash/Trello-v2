import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6"><p className="text-xs tracking-widest text-primary">CONTOUR · 404</p><h1 className="text-2xl font-medium">Страница недоступна</h1><p className="text-sm leading-6 text-muted-foreground">Она удалена или у вас нет доступа к этому workspace.</p><Link className={buttonVariants({ variant: "outline", className: "self-start" })} href="/workspaces">К моим workspace</Link></main>;
}
