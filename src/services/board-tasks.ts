import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function readBoardTasks(client: SupabaseClient<Database>, workspaceId: string, boardId: string) {
  const page = (offset: number) => client.from("tasks").select("id,workspace_id,board_id,column_id,title,priority,due_date,position,version,task_assignees(workspace_members(profiles(name,avatar_path))),task_labels(labels(id,name,color)),checklists(checklist_items(is_completed))")
    .eq("board_id", boardId).eq("workspace_id", workspaceId).order("position").order("id").range(offset, offset + 499);
  let result = await page(0);
  if (result.error) throw new Error("Не удалось загрузить задачи.");
  const rows = [...result.data];
  for (let offset = 500; result.data?.length === 500; offset += 500) {
    result = await page(offset);
    if (result.error) throw new Error("Не удалось загрузить все задачи. Повторите попытку.");
    rows.push(...result.data);
  }
  // A concurrent move may repeat a row across pages. Realtime refresh reconciles it.
  return { data: [...new Map(rows.map((row) => [row.id, row])).values()], error: null };
}
