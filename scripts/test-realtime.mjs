import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Local-only, real Auth sessions and WebSockets. Deletes only its own UUIDs.
const config = readFileSync("supabase/config.toml", "utf8");
const project = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
function sql(query) {
  const result = spawnSync("docker", ["exec", "-i", `supabase_db_${project}`, "psql", "-U", "postgres", "-XAt", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8" });
  if (result.status) throw new Error(result.stderr);
  return result.stdout.trim();
}
function clean(fixture) {
  const ids = [fixture.workspaceId, ...fixture.users.map((user) => user.id)];
  assert(ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
  sql(`delete from public.workspaces where id='${fixture.workspaceId}'; delete from auth.users where id in (${fixture.users.map((user) => `'${user.id}'`).join(",")});`);
}
if (process.argv[2] === "--cleanup") {
  clean(JSON.parse(readFileSync(process.argv[3], "utf8")));
  console.log("PASS: removed only recorded realtime fixtures");
  process.exit(0);
}
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
assert(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "test must use local Supabase");
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const fixture = { workspaceId: randomUUID(), boardId: randomUUID(), taskId: randomUUID(), users: [] };
const clients = [];
const channels = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!condition()) { if (Date.now() > deadline) throw new Error(`Timeout: ${label}`); await pause(80); }
}
function unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data; }
async function join(client, topic, userId, denied = false) {
  const received = [];
  const channel = client.channel(topic, { config: { private: true, broadcast: { ack: true }, presence: { key: userId } } });
  channels.push([client, channel]);
  channel.on("broadcast", { event: "invalidate" }, (message) => received.push(message.payload));
  channel.on("presence", { event: "sync" }, () => {});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Join timed out: ${topic}`)), 12000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        if ((status === "SUBSCRIBED") === !denied) resolve(); else reject(new Error(`Unexpected channel status: ${status}`));
      }
    });
  });
  return { channel, received };
}
const peers = (channel) => new Set(Object.values(channel.presenceState()).flat().map((entry) => entry.userId));
let succeeded = false;
try {
  for (const role of ["owner", "member", "outsider"]) {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    const email = `live-${role}-${randomUUID().slice(0, 8)}@example.test`;
    const password = `Local-${randomUUID()}!`;
    const { user } = unwrap(await client.auth.signUp({ email, password }));
    assert(user);
    fixture.users.push({ id: user.id, email, password });
    sql(`update auth.users set email_confirmed_at=now() where id='${user.id}';`);
    unwrap(await client.auth.signInWithPassword({ email, password }));
    unwrap(await client.from("profiles").insert({ id: user.id, name: `Live ${role}`, username: `live_${user.id.slice(0, 8)}` }));
  }
  const [owner, member, outsider] = clients;
  const [ownerUser, memberUser, outsiderUser] = fixture.users;
  unwrap(await owner.from("workspaces").insert({ id: fixture.workspaceId, name: "Stage 6 realtime test", owner_id: ownerUser.id }));
  sql(`insert into public.workspace_members(workspace_id,user_id) values('${fixture.workspaceId}','${memberUser.id}');`);
  unwrap(await owner.from("boards").insert({ id: fixture.boardId, workspace_id: fixture.workspaceId, name: "Live collaboration" }));
  const columns = unwrap(await owner.from("columns").select("*").eq("board_id", fixture.boardId).order("position"));
  const getEpoch = async () => unwrap(await owner.from("workspaces").select("realtime_epoch").eq("id", fixture.workspaceId).single()).realtime_epoch;
  let epoch = await getEpoch();
  const topic = `board:${fixture.boardId}:${epoch}`;
  const a = await join(owner, topic, ownerUser.id);
  const b = await join(member, topic, memberUser.id);
  await join(outsider, topic, outsiderUser.id, true);
  console.log("PASS: members join private channels; outsider denied");
  assert.equal(await a.channel.track({ userId: ownerUser.id, onlineAt: new Date().toISOString() }), "ok");
  assert.equal(await b.channel.track({ userId: memberUser.id, onlineAt: new Date().toISOString() }), "ok");
  await until(() => peers(a.channel).size === 2 && peers(b.channel).size === 2, "two-user Presence");
  await b.channel.untrack();
  await until(() => peers(a.channel).size === 1, "Presence leave");
  console.log("PASS: Presence join and leave across two authenticated sessions");

  async function event(write, label) {
    const before = b.received.length;
    unwrap(await write());
    await until(() => b.received.length > before, label);
    assert(b.received.every((payload) => Object.keys(payload).every((key) => key === "id")), "broadcast may contain only Realtime's generated message UUID, never row data");
  }
  await event(() => owner.from("tasks").insert({ id: fixture.taskId, workspace_id: fixture.workspaceId, board_id: fixture.boardId, column_id: columns[0].id, title: "Realtime task", position: 1024 }), "task INSERT");
  await event(() => owner.from("tasks").update({ title: "Realtime updated" }).eq("id", fixture.taskId), "task UPDATE");
  assert.equal(unwrap(await member.from("tasks").select("title").eq("id", fixture.taskId).single()).title, "Realtime updated");
  const newColumn = randomUUID();
  await event(() => owner.from("columns").insert({ id: newColumn, workspace_id: fixture.workspaceId, board_id: fixture.boardId, name: "Review", position: 4096 }), "column INSERT");
  await event(() => owner.from("columns").update({ name: "Review updated" }).eq("id", newColumn), "column UPDATE");
  await event(() => owner.from("columns").delete().eq("id", newColumn), "column DELETE");
  const list = randomUUID();
  const versionBeforeChild = unwrap(await owner.from("tasks").select("version").eq("id", fixture.taskId).single()).version;
  await event(() => owner.from("checklists").insert({ id: list, workspace_id: fixture.workspaceId, board_id: fixture.boardId, task_id: fixture.taskId, title: "Remote checklist" }), "checklist INSERT");
  const task = unwrap(await member.from("tasks").select("*").eq("id", fixture.taskId).single());
  assert(task.version > versionBeforeChild, "child mutation increments aggregate version");
  console.log("PASS: task/column/checklist events are empty; RLS refetch returns current data");

  const move = (client, column) => client.rpc("reorder_task", { target_task: task.id, target_column: column, expected_version: task.version, previous_task: null, next_task: null });
  const race = await Promise.all([move(owner, columns[1].id), move(member, columns[2].id)]);
  assert.equal(race.map(unwrap).filter((result) => result.error === "stale_task").length, 1);
  assert.equal(race.map(unwrap).filter((result) => result.version).length, 1);
  console.log("PASS: simultaneous reorders produce one winner and one version conflict");

  await member.removeChannel(b.channel);
  unwrap(await owner.from("tasks").update({ title: "Changed while disconnected" }).eq("id", fixture.taskId));
  const rejoined = await join(member, topic, memberUser.id);
  assert.equal(unwrap(await member.from("tasks").select("title").eq("id", fixture.taskId).single()).title, "Changed while disconnected");
  console.log("PASS: reconnect and full refetch recover a missed update");

  const beforeDeniedSend = a.received.length;
  const sent = await rejoined.channel.send({ type: "broadcast", event: "invalidate", payload: { unauthorized: "data" } });
  assert.notEqual(sent, "ok");
  await pause(250);
  assert.equal(a.received.length, beforeDeniedSend);
  console.log("PASS: arbitrary client Broadcast is denied");

  unwrap(await owner.from("workspace_members").delete().eq("workspace_id", fixture.workspaceId).eq("user_id", memberUser.id));
  const newEpoch = await getEpoch();
  assert.notEqual(newEpoch, epoch);
  epoch = newEpoch;
  const freshTopic = `board:${fixture.boardId}:${epoch}`;
  await owner.removeChannel(a.channel);
  const fresh = await join(owner, freshTopic, ownerUser.id);
  await fresh.channel.track({ userId: ownerUser.id, onlineAt: new Date().toISOString() });
  await join(member, freshTopic, memberUser.id, true);
  await pause(300);
  const oldCount = rejoined.received.length;
  unwrap(await owner.from("tasks").update({ title: "Visible to remaining members" }).eq("id", fixture.taskId));
  await until(() => fresh.received.length > 0, "new-generation update");
  await pause(400);
  assert.equal(rejoined.received.length, oldCount, "old connected socket receives no new board events");
  assert.equal(unwrap(await member.from("tasks").select("id").eq("id", fixture.taskId)).length, 0);
  assert(!peers(rejoined.channel).has(ownerUser.id), "old socket cannot see new-generation Presence");
  console.log("PASS: connected revoked member cannot join rotated channel, read tasks or receive new board events/Presence");
  const deletedBefore = fresh.received.length;
  unwrap(await owner.from("tasks").delete().eq("id", fixture.taskId));
  await until(() => fresh.received.length > deletedBefore, "task DELETE");
  console.log("PASS: task DELETE invalidates the board");
  // Retain a fresh task and member only for an explicitly requested local UI check.
  if (process.argv[2] === "--keep") {
    sql(`insert into public.workspace_members(workspace_id,user_id) values('${fixture.workspaceId}','${memberUser.id}');`);
    unwrap(await owner.from("tasks").insert({ id: fixture.taskId, workspace_id: fixture.workspaceId, board_id: fixture.boardId, column_id: columns[0].id, title: "Realtime browser test", position: 1024 }));
    writeFileSync(process.argv[3], JSON.stringify(fixture), { mode: 0o600 });
  }
  succeeded = true;
} finally {
  await Promise.allSettled(channels.map(([client, channel]) => client.removeChannel(channel)));
  await Promise.allSettled(clients.map((client) => client.auth.signOut({ scope: "local" })));
  if (!succeeded || process.argv[2] !== "--keep") clean(fixture);
}
