import { createClient } from "@supabase/supabase-js";
import { cleanupStorage } from "@/lib/storage-cleanup";
import { validCronAuthorization } from "@/lib/cron-auth";
import { validateOrigin, validateServerKey } from "@/lib/env";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Worker not configured" }, { status: 503, headers });
  try {
    validateOrigin(url, "Supabase URL");
    validateServerKey(key);
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
    const result = await cleanupStorage(client, 35000);
    return Response.json(result, { status: result.failed || result.deferred ? 503 : 200, headers });
  } catch {
    return Response.json({ error: "Cleanup failed; retry scheduled by lease" }, { status: 503, headers });
  }
}
