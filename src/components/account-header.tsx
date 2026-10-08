import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function AccountHeader() {
  return <header className="border-b border-border">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
      <Link href="/workspaces" className="text-xs font-semibold tracking-[0.22em]">CONTOUR<span className="text-primary">.</span></Link>
      <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="Аккаунт">
        <Link className="hover:text-foreground" href="/workspaces">Workspace</Link>
        <Link className="hover:text-foreground" href="/profile">Профиль</Link>
        <form action={signOut}><Button variant="ghost" type="submit">Выйти</Button></form>
      </nav>
    </div>
  </header>;
}
