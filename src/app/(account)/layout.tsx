import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/services/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { supabase, profile } = await requireProfile();
  const { data: workspaces, error } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Не удалось загрузить workspace.");
  return <AppShell profile={profile} workspaces={workspaces}>{children}</AppShell>;
}
