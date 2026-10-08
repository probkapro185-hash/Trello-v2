import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const project = "contour";
const db = `supabase_db_${project}`;
const owner = randomUUID();
const first = randomUUID();
const second = randomUUID();
const workspace = randomUUID();
const token = "b".repeat(64);

function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", db, "psql", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `psql exited ${code}`)));
    child.stdin.end(sql);
  });
}

const fixture = `
insert into auth.users(id,email) values ('${owner}','race-owner@example.test'),('${first}','race-first@example.test'),('${second}','race-second@example.test');
insert into public.profiles(id,name,username) values ('${owner}','Race Owner','race_owner'),('${first}','Race First','race_first'),('${second}','Race Second','race_second');
insert into public.workspaces(id,name,owner_id) values ('${workspace}','Invite race','${owner}');
insert into public.invites(workspace_id,token_hash) values ('${workspace}',encode(extensions.digest('${token}','sha256'),'hex'));
`;
await psql(fixture);
const accept = (user) => psql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true); select public.accept_workspace_invite('${token}'); commit;`);
try {
  const [left, right] = await Promise.all([accept(first), accept(second)]);
  const results = [left, right].join("\n");
  const useCount = await psql(`select use_count from public.invites where workspace_id='${workspace}';`);
  const members = await psql(`select count(*) from public.workspace_members where workspace_id='${workspace}' and role='member';`);
  if (!results.includes('"already_member": false') || !results.includes('"error": "invalid_invite"') || useCount !== "1" || members !== "1") {
    throw new Error(`unexpected race result: ${results.replaceAll(/\n/g, " ")} use_count=${useCount} members=${members}`);
  }
  console.log("PASS: concurrent invite redemption produced one member and one use");
} finally {
  await psql(`delete from public.workspaces where id='${workspace}'; delete from auth.users where id in ('${owner}','${first}','${second}');`);
}
