import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { safeNext } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let destination = "/sign-in?message=invalid-link";
  if (tokenHash && tokenHash.length <= 512 && (type === "signup" || type === "recovery" || type === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) destination = type === "recovery" ? "/reset-password" : safeNext(request.nextUrl.searchParams.get("next"));
  }
  const response = NextResponse.redirect(new URL(destination, getAppOrigin()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
