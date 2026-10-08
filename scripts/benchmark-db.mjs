import { spawnSync } from "node:child_process";

// Local-only transaction: no user rows are altered and all fixtures roll back.
const sql = `
begin;
insert into auth.users(id,email) values('b0000000-0000-0000-0000-000000000001','benchmark@example.test');
insert into public.profiles(id,name,username) values('b0000000-0000-0000-0000-000000000001','Benchmark','benchmark_stage10');
insert into public.workspaces(id,name,owner_id) values('b0000000-0000-0000-0000-000000000010','Benchmark','b0000000-0000-0000-0000-000000000001');
insert into public.boards(id,workspace_id,name) values('b0000000-0000-0000-0000-000000000020','b0000000-0000-0000-0000-000000000010','Benchmark');
insert into public.tasks(workspace_id,board_id,column_id,title,description,position)
select c.workspace_id,c.board_id,c.id,'Benchmark task '||n,repeat('brief ',1600),n*1024
from public.columns c cross join generate_series(1,1000) n where c.board_id='b0000000-0000-0000-0000-000000000020' and c.name='TODO';
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
select 'full_task_json_bytes',sum(octet_length(to_jsonb(t)::text)) from public.tasks t where board_id='b0000000-0000-0000-0000-000000000020';
select 'card_json_bytes',sum(octet_length(to_jsonb(t)::text)) from (select id,workspace_id,board_id,column_id,title,priority,due_date,position,version from public.tasks where board_id='b0000000-0000-0000-0000-000000000020') t;
explain (analyze,buffers,format text) select id,title,position from public.tasks where board_id='b0000000-0000-0000-0000-000000000020' order by position,id limit 500;
explain (analyze,buffers,format text) select * from public.workspace_summaries();
reset role;
rollback;
`;
const result = spawnSync("docker", ["exec", "-i", "supabase_db_contour", "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
if (result.status !== 0) { console.error(result.stderr || "Benchmark failed"); process.exit(1); }
console.log(result.stdout);
