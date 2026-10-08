begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email) values
  ('30000000-0000-0000-0000-000000000001', 'board-owner@example.test'),
  ('30000000-0000-0000-0000-000000000002', 'board-outsider@example.test');
insert into public.profiles(id, name, username) values
  ('30000000-0000-0000-0000-000000000001', 'Board Owner', 'board_owner'),
  ('30000000-0000-0000-0000-000000000002', 'Board Outsider', 'board_outsider');
insert into public.workspaces(id, name, owner_id) values
  ('30000000-0000-0000-0000-000000000010', 'Board Workspace', '30000000-0000-0000-0000-000000000001');
insert into public.boards(id, workspace_id, name) values
  ('30000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000010', 'Board');
insert into public.tasks(id, workspace_id, board_id, column_id, title, created_by)
select '30000000-0000-0000-0000-000000000030', workspace_id, board_id, id, 'Move me', '30000000-0000-0000-0000-000000000001'
from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'TODO';

select ok(not has_function_privilege('anon', 'public.move_task(uuid,uuid,integer,double precision)', 'EXECUTE'), 'anonymous cannot move tasks');
select is((select prosecdef from pg_proc where oid = 'public.move_task(uuid,uuid,integer,double precision)'::regprocedure), true, 'public move RPC is a controlled definer wrapper');
select is((select prosecdef from pg_proc where oid = 'private.move_task(uuid,uuid,integer,double precision)'::regprocedure), true, 'private move implementation is a definer function');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.move_task(uuid,uuid,integer,double precision)'::regprocedure), 'private move implementation pins search_path');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select is(public.move_task(
  '30000000-0000-0000-0000-000000000030',
  (select id from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'DONE'),
  1,
  4096
)->>'column_id', (select id::text from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'DONE'), 'member can move task atomically');
select is((select version from public.tasks where id = '30000000-0000-0000-0000-000000000030'), 2, 'move increments task version');
select is(public.move_task('30000000-0000-0000-0000-000000000030', (select id from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'TODO'), 1, 512)->>'error', 'stale_task', 'stale move is rejected');
select is(public.move_task('30000000-0000-0000-0000-000000000030', (select id from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'TODO'), 2, 'NaN'::float8)->>'error', 'invalid_position', 'non-finite move position is rejected');
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select is(public.move_task('30000000-0000-0000-0000-000000000030', (select id from public.columns where board_id = '30000000-0000-0000-0000-000000000020' and name = 'TODO'), 2, 512)->>'error', 'forbidden', 'outsider cannot move task');

reset role;
select * from finish();
rollback;
