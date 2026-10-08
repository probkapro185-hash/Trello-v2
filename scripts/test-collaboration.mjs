import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cleanupClient, cleanupStorage } from "./storage-cleanup.mjs";

const admin = cleanupClient(true);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")]; }));
assert(["localhost", "127.0.0.1"].includes(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname));
const fixture = { workspaceId: randomUUID(), boardId: randomUUID(), taskId: randomUUID(), users: [] };
const clients = [];
const unwrap = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
async function cleanup(f) {
  unwrap(await admin.from("workspaces").delete().eq("id", f.workspaceId));
  await cleanupStorage(admin);
  for (const user of f.users) unwrap(await admin.auth.admin.deleteUser(user.id));
}
if (process.argv[2] === "--cleanup") {
  await cleanup(JSON.parse(readFileSync(process.argv[3], "utf8")));
  console.log("PASS: only recorded collaboration fixtures removed");
  process.exit(0);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(test, label) { for (let i = 0; i < 100; i++) { if (test()) return; await sleep(80); } throw new Error(label); }
let success = false;
try {
  for (const role of ["owner", "member", "outsider"]) {
    const email = `collab-${role}-${randomUUID().slice(0, 8)}@example.test`;
    const password = `Local-${randomUUID()}!`;
    const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    fixture.users.push({ id: user.id, email, password });
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    unwrap(await client.auth.signInWithPassword({ email, password }));
    unwrap(await client.from("profiles").insert({ id: user.id, name: `Collab ${role}`, username: `collab_${user.id.slice(0, 8)}` }));
  }
  const [owner, member, outsider] = clients;
  unwrap(await owner.from("workspaces").insert({ id: fixture.workspaceId, name: "Stage 7 collaboration", owner_id: fixture.users[0].id }));
  unwrap(await owner.from("workspace_members").insert({ workspace_id: fixture.workspaceId, user_id: fixture.users[1].id }));
  unwrap(await owner.from("boards").insert({ id: fixture.boardId, workspace_id: fixture.workspaceId, name: "Collaboration test" }));
  const columns = unwrap(await owner.from("columns").select("*").eq("board_id", fixture.boardId).order("position"));
  const scope = { workspace_id: fixture.workspaceId, board_id: fixture.boardId, task_id: fixture.taskId };
  unwrap(await owner.from("tasks").insert({ id: fixture.taskId, workspace_id: fixture.workspaceId, board_id: fixture.boardId, column_id: columns[0].id, title: "Stage 7 browser test" }));
  const epoch = unwrap(await owner.from("workspaces").select("realtime_epoch").eq("id", fixture.workspaceId).single()).realtime_epoch;
  const events = [];
  const channel = member.channel(`board:${fixture.boardId}:${epoch}`, { config: { private: true } }).on("broadcast", { event: "invalidate" }, (message) => events.push(message.payload));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime timeout")), 10000);
    channel.subscribe((status) => { if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); } });
  });
  // A cold local Realtime service can establish its WAL slot after SUBSCRIBED.
  // Warm up with harmless no-op writes before asserting delivery of one event.
  for (let attempt = 0; !events.length && attempt < 20; attempt++) {
    unwrap(await owner.from("tasks").update({ title: "Stage 7 browser test" }).eq("id", fixture.taskId));
    await sleep(150);
  }
  await until(() => events.length > 0, "database broadcaster ready");
  events.length = 0;
  assert((await owner.rpc("claim_storage_cleanup")).error, "cleanup is server-only");
  const comment = unwrap(await member.from("comments").insert({ ...scope, body: "Hello from the second session" }).select("*").single());
  await until(() => events.length > 0, "comment invalidation");
  assert.equal(unwrap(await owner.from("comments").select("body").eq("id", comment.id).single()).body, comment.body);
  assert.equal(unwrap(await owner.from("comments").update({ body: "forged" }).eq("id", comment.id).select("id")).length, 0);
  assert.equal(unwrap(await outsider.from("comments").select("id").eq("id", comment.id)).length, 0);
  const edited = unwrap(await member.from("comments").update({ body: "Edited" }).eq("id", comment.id).eq("updated_at", comment.updated_at).select("*").single());
  assert.equal(unwrap(await member.from("comments").update({ body: "stale" }).eq("id", comment.id).eq("updated_at", comment.updated_at).select("id")).length, 0);
  assert.equal(unwrap(await owner.from("comments").delete().eq("id", edited.id).select("id")).length, 1);
  console.log("PASS: comments realtime, authorship, owner deletion, outsider and stale-edit protection");

  const fileBody = new Blob(["Contour Stage 7 attachment\n"], { type: "text/plain" });
  async function reserve(client, task = fixture.taskId, size = fileBody.size, type = "text/plain") {
    return client.rpc("reserve_attachment", { target_task: task, file_name: "brief.txt", file_type: type, file_size: size });
  }
  assert((await reserve(outsider)).error);
  assert((await reserve(owner, fixture.taskId, 10485761)).error);
  assert((await reserve(owner, fixture.taskId, 1, "text/html")).error);
  const attachment = unwrap(await reserve(owner));
  assert((await owner.rpc("finalize_attachment", { attachment_id: attachment.id })).error);
  assert((await member.rpc("finalize_attachment", { attachment_id: attachment.id })).error);
  assert((await member.storage.from("task-attachments").upload(attachment.storage_path, fileBody)).error);
  unwrap(await owner.storage.from("task-attachments").upload(attachment.storage_path, fileBody, { contentType: "text/plain", upsert: false }));
  assert((await outsider.storage.from("task-attachments").download(attachment.storage_path)).error);
  unwrap(await owner.rpc("finalize_attachment", { attachment_id: attachment.id }));
  assert.equal(await unwrap(await member.storage.from("task-attachments").download(attachment.storage_path)).text(), await fileBody.text());
  const fileEvents = events.length;
  unwrap(await owner.from("attachments").delete().eq("id", attachment.id));
  await until(() => events.length > fileEvents, "attachment invalidation");
  assert((await member.storage.from("task-attachments").download(attachment.storage_path)).error);
  const clean = await cleanupStorage(admin);
  assert(clean.removed > 0);
  assert((await admin.storage.from("task-attachments").download(attachment.storage_path)).error);
  console.log("PASS: file limits, reservation ownership, actual Storage upload/finalize/download and durable deletion");

  const abandoned = unwrap(await reserve(owner));
  unwrap(await owner.storage.from("task-attachments").upload(abandoned.storage_path, fileBody, { contentType: "text/plain" }));
  unwrap(await admin.from("attachments").update({ expires_at: "2000-01-01T00:00:00Z" }).eq("id", abandoned.id));
  await cleanupStorage(admin);
  assert((await admin.storage.from("task-attachments").download(abandoned.storage_path)).error);
  assert.equal(unwrap(await owner.from("attachments").select("id").eq("id", abandoned.id)).length, 0);
  console.log("PASS: abandoned upload expires and its bytes are removed");

  const task = unwrap(await owner.from("tasks").select("*").eq("id", fixture.taskId).single());
  const details = { title: task.title, description: "Brief", priority: "high", due_date: "2026-11-01", assignee: fixture.users[1].id, labels: [], checklists: [{ id: randomUUID(), title: "Release", items: [{ id: randomUUID(), text: "Review result", is_completed: false }] }] };
  let saved = unwrap(await owner.rpc("save_task_details", { target_task: task.id, expected_version: task.version, details }));
  assert(saved.version);
  const beforeNoop = unwrap(await owner.from("activities").select("id").eq("task_id", task.id)).length;
  saved = unwrap(await owner.rpc("save_task_details", { target_task: task.id, expected_version: saved.version, details }));
  assert(saved.version);
  assert.equal(unwrap(await owner.from("activities").select("id").eq("task_id", task.id)).length, beforeNoop, "no-op save must not invent history");
  details.checklists[0].items[0].is_completed = true;
  saved = unwrap(await owner.rpc("save_task_details", { target_task: task.id, expected_version: saved.version, details }));
  unwrap(await owner.rpc("reorder_task", { target_task: task.id, target_column: columns[1].id, expected_version: saved.version, previous_task: null, next_task: null }));
  const history = unwrap(await member.from("activities").select("*").eq("task_id", task.id));
  for (const action of ["task.created", "task.updated", "task.assigned", "task.moved", "checklist_item.completed", "comment.created", "comment.updated", "comment.deleted", "attachment.added", "attachment.deleted"]) assert(history.some((entry) => entry.action === action), action);
  assert((await owner.from("activities").insert({ workspace_id: fixture.workspaceId, action: "task.created" })).error);
  assert.equal(unwrap(await outsider.from("activities").select("id").eq("workspace_id", fixture.workspaceId)).length, 0);
  assert(events.every((payload) => Object.keys(payload).every((key) => key === "id")));
  console.log("PASS: semantic activity, no-op suppression, safe realtime payloads and read-only history");

  const cascadeTask = randomUUID();
  unwrap(await owner.from("tasks").insert({ id: cascadeTask, workspace_id: fixture.workspaceId, board_id: fixture.boardId, column_id: columns[0].id, title: "Cascade fixture" }));
  const cascadeFile = unwrap(await reserve(owner, cascadeTask));
  unwrap(await owner.storage.from("task-attachments").upload(cascadeFile.storage_path, fileBody, { contentType: "text/plain" }));
  unwrap(await owner.rpc("finalize_attachment", { attachment_id: cascadeFile.id }));
  unwrap(await owner.from("tasks").delete().eq("id", cascadeTask));
  await cleanupStorage(admin);
  assert((await admin.storage.from("task-attachments").download(cascadeFile.storage_path)).error);
  assert(unwrap(await owner.from("activities").select("id").eq("workspace_id", fixture.workspaceId).eq("action", "task.deleted").is("task_id", null)).length > 0);
  console.log("PASS: task cascade deletes file bytes and retains history without dangling links");
  if (process.argv[2] === "--keep") writeFileSync(process.argv[3], JSON.stringify(fixture), { mode: 0o600 });
  success = true;
} finally {
  await Promise.allSettled(clients.map((client) => client.removeAllChannels()));
  clients.forEach((client) => client.realtime.disconnect());
  if (!success || process.argv[2] !== "--keep") await cleanup(fixture);
}
