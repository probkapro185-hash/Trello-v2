import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export async function cleanupStorage(client: SupabaseClient<Database>, budgetMs = 40000) {
  const deadline = Date.now() + budgetMs;
  const result = await client.rpc("claim_storage_cleanup");
  if (result.error) throw new Error("Could not claim Storage cleanup jobs");
  const jobs = result.data ?? [];
  let cursor = 0, removed = 0, failed = 0;
  async function worker() {
    while (cursor < jobs.length && Date.now() < deadline) {
      const job = jobs[cursor++];
      if (!job) break;
      try {
        const deletion = await client.storage.from("task-attachments").remove([job.path]);
        if (deletion.error) { failed++; continue; }
        const completed = await client.rpc("complete_storage_cleanup", { object_path: job.path, claim_lease: job.lease });
        if (completed.error) failed++; else removed++;
      } catch { failed++; }
      // Failed or unprocessed claims retain their lease and become retryable.
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { claimed: jobs.length, removed, failed, deferred: jobs.length - cursor };
}
