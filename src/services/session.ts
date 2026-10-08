import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authHref, safeNext } from "@/lib/navigation";

export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && (error.status && error.status >= 500 || !["AuthSessionMissingError", "AuthApiError"].includes(error.name))) {
    throw new Error("Не удалось проверить сессию. Попробуйте ещё раз.");
  }
  return { supabase, user };
});

export async function requireUser(next = "/workspaces") {
  const context = await getSessionContext();
  if (!context.user) redirect(authHref("sign-in", next));
  return { ...context, user: context.user };
}

export async function requireProfile(next = "/workspaces") {
  const { supabase, user } = await requireUser(next);
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Не удалось загрузить профиль.");
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(safeNext(next))}`);
  return { supabase, user, profile };
}
