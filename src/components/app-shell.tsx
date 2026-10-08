"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, LayoutDashboard, LayoutGrid, ListTodo, LogOut, Menu, Settings2, Users, X } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { UserAvatar } from "@/components/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile, Workspace } from "@/types/domain";
import { LiveScope } from "@/features/boards/live-scope";
import { Modal } from "@/components/modal";
import { CommandMenu } from "@/features/tasks/command-menu";

type AppShellProps = { children: ReactNode; profile: Profile; workspaces: Workspace[] };

function currentWorkspaceId(pathname: string) {
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  return match?.[1] ?? null;
}

function pageTitle(pathname: string) {
  if (pathname === "/workspaces") return "Обзор";
  if (pathname === "/profile") return "Профиль";
  if (pathname === "/my-tasks") return "Мои задачи";
  if (pathname.includes("/boards/")) return "Доска";
  if (pathname.endsWith("/activity")) return "Активность";
  if (pathname.endsWith("/boards")) return "Доски";
  if (pathname.startsWith("/workspaces/")) return "Настройки workspace";
  return "Contour";
}

function Sidebar({ pathname, profile, workspaces, open, onClose }: { pathname: string; profile: Profile; workspaces: Workspace[]; open: boolean; onClose: () => void }) {
  const activeWorkspaceId = currentWorkspaceId(pathname);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const workspaceHref = activeWorkspace ? `/workspaces/${activeWorkspace.id}` : "/workspaces";
  const boardsHref = activeWorkspace ? `${workspaceHref}/boards` : "/workspaces";
  const navItems = [
    { href: "/workspaces", label: "Обзор", icon: LayoutDashboard, active: pathname === "/workspaces" },
    { href: "/my-tasks", label: "Мои задачи", icon: ListTodo, active: pathname === "/my-tasks" },
    { href: boardsHref, label: "Доски", icon: LayoutGrid, active: pathname.endsWith("/boards") || pathname.includes("/boards/") },
  ];

  const content = <div className="flex h-full min-h-dvh flex-col bg-[#101012] px-3 py-4">
      <div className="flex items-center justify-between px-3 pb-6">
        <Link href="/workspaces" onClick={onClose} className="text-sm font-semibold tracking-[0.22em]">CONTOUR<span className="text-primary">.</span></Link>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Закрыть меню"><X size={17} /></button>
      </div>
      <div className="mb-5 rounded-xl border border-border/80 bg-card/60 p-2">
        <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Ваши workspace</p>
        {activeWorkspace ? <Link href={workspaceHref} onClick={onClose} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-xs font-semibold text-primary">{activeWorkspace.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{activeWorkspace.name}</span><ChevronDown size={14} className="text-muted-foreground" />
        </Link> : <Link href="/workspaces" onClick={onClose} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-xs font-semibold text-primary">C</span><span className="min-w-0 flex-1 truncate">Все workspace</span><ChevronDown size={14} className="text-muted-foreground" /></Link>}
      </div>
      <nav aria-label="Основная навигация" className="space-y-1">
        <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Работа</p>
        {navItems.map(({ href, label, icon: Icon, active }) => <Link key={`${label}-${href}`} href={href} onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors", active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon size={17} strokeWidth={1.8} />{label}</Link>)}
        {activeWorkspace && <Link href={`${workspaceHref}/activity`} onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", pathname.endsWith("/activity") ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><BarChart3 size={17} strokeWidth={1.8} />Активность</Link>}
      </nav>
      {activeWorkspace && <div className="mt-7 space-y-1"><p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</p><Link href={workspaceHref} onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", pathname === workspaceHref ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Settings2 size={17} strokeWidth={1.8} />Настройки</Link><Link href={`${workspaceHref}#members`} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Users size={17} strokeWidth={1.8} />Участники</Link></div>}
      <div className="mt-auto border-t border-border pt-3">
        <Link href="/profile" onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2.5", pathname === "/profile" ? "bg-muted" : "hover:bg-muted")}><UserAvatar name={profile.name} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{profile.name}</span><span className="block truncate text-xs text-muted-foreground">@{profile.username}</span></span></Link>
        <form action={signOut} className="mt-1"><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={16} />Выйти</button></form>
      </div>
    </div>;
  return <><aside className="fixed inset-y-0 left-0 z-40 hidden w-64 overflow-y-auto border-r border-border md:block">{content}</aside>{open && <Modal label="Навигация" onClose={onClose} className="inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(86vw,280px)] rounded-none border-y-0 border-l-0">{content}</Modal>}</>;
}

export function AppShell({ children, profile, workspaces }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const resized = () => { if (media.matches) setSidebarOpen(false); };
    media.addEventListener("change", resized);
    return () => media.removeEventListener("change", resized);
  }, []);
  const title = pageTitle(pathname);
  const workspaceId = currentWorkspaceId(pathname);
  const boardId = pathname.match(/\/boards\/([^/]+)/)?.[1] ?? null;
  return <div className="min-h-svh bg-background">
    <Sidebar pathname={pathname} profile={profile} workspaces={workspaces} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="min-h-svh md:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6">
        <button onClick={() => setSidebarOpen(true)} className="mr-3 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Открыть меню"><Menu size={19} /></button>
        <div className="flex min-w-0 items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">Contour</span><span className="hidden text-muted-foreground/40 sm:inline">/</span><h1 className="truncate text-sm font-medium">{title}</h1></div>
        <div className="ml-auto flex items-center gap-2"><CommandMenu workspaces={workspaces} /><Link href="/profile" className={cn(buttonVariants({ variant: "ghost", className: "px-2" }))} aria-label="Открыть профиль"><UserAvatar name={profile.name} /></Link></div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10">{workspaceId ? <LiveScope key={`${workspaceId}:${boardId}`} workspaceId={workspaceId} boardId={boardId} userId={profile.id}>{children}</LiveScope> : children}</main>
    </div>
  </div>;
}
