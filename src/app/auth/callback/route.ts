import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { safeNext } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/sign-in?message=invalid-link";
  if (code && code.length <= 512) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) destination = request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : safeNext(request.nextUrl.searchParams.get("next"));
  }
  const response = NextResponse.redirect(new URL(destination, getAppOrigin()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
