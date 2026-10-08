import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { cleanupStorage } from "../src/lib/storage-cleanup.ts";
export { cleanupStorage };

export function cleanupClient(local = false) {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (local) {
    const status = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
    if (status.status) throw new Error("Local Supabase is not running");
    const values = JSON.parse(status.stdout);
    url = values.API_URL; key = values.SERVICE_ROLE_KEY;
    if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Expected local Supabase");
  }
  if (!url || !key) throw new Error("Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use --local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
  } });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = cleanupClient(process.argv.includes("--local"));
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { const result = await cleanupStorage(client); console.log("Storage cleanup:", result); process.exitCode = result.failed || result.deferred ? 1 : 0; }
    catch { console.error("Storage cleanup failed; pending jobs will retry."); process.exitCode = 1; }
    finally { running = false; }
  };
  await run();
  if (process.argv.includes("--watch")) setInterval(run, 60000);
}
