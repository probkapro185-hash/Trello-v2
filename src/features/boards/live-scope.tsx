"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LiveState = { status: "connecting" | "connected" | "offline"; people: { id: string; name: string }[]; revision: number };
const LiveContext = createContext<LiveState>({ status: "connecting", people: [], revision: 0 });
export const useLiveBoard = () => useContext(LiveContext);

// One workspace subscription and one generation-scoped board subscription.
// Events carry no rows: every refresh verifies current access through RLS.
export function LiveScope({ workspaceId, boardId, userId, children }: { workspaceId: string; boardId: string | null; userId: string; children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<Omit<LiveState, "revision">>({ status: "connecting", people: [] });
  const [revision, setRevision] = useState(0);
  const [revoked, setRevoked] = useState(false);
  useEffect(() => {
    const client = createClient();
    let disposed = false;
    let denied = false;
    let reading = false;
    let rerun = false;
    let epoch = "";
    let boardChannel: RealtimeChannel | undefined;
    let workspaceChannel: RealtimeChannel | undefined;
    let boardReady = !boardId;
    let workspaceReady = false;
    let members = new Map<string, string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const requests = new AbortController();

    function connection() {
      if (!disposed && !denied) setState((value) => ({ ...value, status: boardReady && workspaceReady ? "connected" : "connecting" }));
    }
    function offline() {
      if (!disposed) setState({ status: "offline", people: [] });
    }
    function presence() {
      if (!boardChannel || disposed || denied) return;
      const ids = new Set(Object.values(boardChannel.presenceState<{ userId: string }>()).flatMap((entries) => entries.map((entry) => entry.userId)));
      // Payloads are untrusted hints, never names, profiles or authorization.
      const people = [...ids].filter((id) => members.has(id)).sort().map((id) => ({ id, name: members.get(id)! }));
      setState((value) => ({ ...value, people }));
    }
    function remove(channel: RealtimeChannel | undefined) {
      if (channel) void client.removeChannel(channel);
    }
    function invalidate() {
      if (disposed || denied) return;
      if (reading) { rerun = true; return; }
      // Fixed window: a busy board cannot starve refresh by resetting the timer.
      if (!timer) timer = setTimeout(() => { timer = undefined; void refresh(); }, 180);
    }
    async function refresh() {
      if (disposed || denied) return;
      if (reading) { rerun = true; return; }
      reading = true;
      try {
        const [workspace, board, roster] = await Promise.all([
          client.from("workspaces").select("realtime_epoch").eq("id", workspaceId).abortSignal(requests.signal).maybeSingle(),
          boardId ? client.from("boards").select("id").eq("id", boardId).eq("workspace_id", workspaceId).abortSignal(requests.signal).maybeSingle() : Promise.resolve(null),
          client.from("workspace_members").select("user_id, profiles(name)").eq("workspace_id", workspaceId).abortSignal(requests.signal),
        ]);
        if (disposed) return;
        if (workspace.error || board?.error || roster.error) { offline(); return; }
        if (!workspace.data || (boardId && !board?.data)) {
          denied = true;
          remove(boardChannel); remove(workspaceChannel);
          setState({ status: "offline", people: [] }); setRevoked(true);
          return;
        }
        members = new Map(roster.data.map((member) => [member.user_id, member.profiles?.name ?? "Участник"]));
        if (boardId && epoch !== workspace.data.realtime_epoch) {
          epoch = workspace.data.realtime_epoch;
          boardReady = false;
          remove(boardChannel);
          setState((value) => ({ ...value, people: [] }));
          const channel = client.channel(`board:${boardId}:${epoch}`, { config: { private: true, presence: { key: userId } } });
          boardChannel = channel;
          channel.on("broadcast", { event: "invalidate" }, invalidate)
            .on("presence", { event: "sync" }, () => { if (boardChannel === channel) presence(); })
            .subscribe((status) => {
              if (disposed || denied || boardChannel !== channel) return;
              boardReady = status === "SUBSCRIBED";
              if (boardReady) {
                void channel.track({ userId, onlineAt: new Date().toISOString() });
                connection(); invalidate(); // Rejoin always refetches; messages can be lost.
              } else { offline(); invalidate(); }
            });
        }
        presence(); connection();
        setRevision((value) => value + 1);
        startTransition(() => router.refresh());
      } catch { if (!disposed) offline(); }
      finally { reading = false; if (rerun) { rerun = false; invalidate(); } }
    }
    async function connect() {
      // SSR cookies must be loaded before the first private-channel join.
      await client.realtime.setAuth();
      if (disposed || denied) return;
      workspaceChannel = client.channel(`workspace:${workspaceId}`, { config: { private: true } })
        .on("broadcast", { event: "invalidate" }, invalidate)
        .subscribe((status) => {
          if (disposed || denied) return;
          workspaceReady = status === "SUBSCRIBED";
          if (workspaceReady) { connection(); invalidate(); } else { offline(); invalidate(); }
        });
      await refresh();
    }
    const { data: auth } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        denied = true; remove(boardChannel); remove(workspaceChannel); setRevoked(true);
      }
    });
    const wake = () => { if (document.visibilityState === "visible") invalidate(); };
    window.addEventListener("online", invalidate);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    // Recovery for lost events, including membership revocation, without a reload.
    const poll = setInterval(wake, 15000);
    void connect().catch(offline);
    return () => {
      disposed = true; requests.abort(); clearTimeout(timer); clearInterval(poll);
      auth.subscription.unsubscribe(); remove(boardChannel); remove(workspaceChannel);
      window.removeEventListener("online", invalidate); window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake);
    };
  }, [workspaceId, boardId, userId, router]);

  if (revoked) return <div role="alert" className="rounded-xl border border-border bg-card p-6"><p>Доска или workspace больше недоступны. Возможно, доступ был отозван.</p><Link href="/workspaces" className="mt-4 inline-block text-primary">К моим workspace</Link></div>;
  return <LiveContext value={{ ...state, revision }}>{children}</LiveContext>;
}

export function LiveStatus() {
  const { status, people } = useLiveBoard();
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
    <p role="status" className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />{status === "connected" ? "Синхронизация включена" : status === "offline" ? "Нет соединения · пробуем подключиться" : "Подключаемся…"}</p>
    {status === "connected" && <p aria-label="Участники онлайн">На доске: {people.length ? people.map((person) => person.name).join(", ") : "—"}</p>}
  </div>;
}
