import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";
import { contentSecurityPolicy } from "@/lib/security";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnvironment();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, url, process.env.NODE_ENV === "development");
  // Replace supplied headers; Next reads this nonce during dynamic rendering.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Verifies the JWT and refreshes cookies. Each protected page/action also verifies its user.
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Content-Security-Policy", policy);
  return response;
}
