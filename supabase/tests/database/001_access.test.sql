begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'member@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@example.test');
insert into public.profiles(id, name, username) values
  ('00000000-0000-0000-0000-000000000001', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'Member', 'member'),
  ('00000000-0000-0000-0000-000000000003', 'Outsider', 'outsider');
insert into public.workspaces(id, name, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Team One', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Team Two', '00000000-0000-0000-0000-000000000003');
insert into public.workspace_members(workspace_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.boards(id, workspace_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Development'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Private'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Marketing');
insert into public.tasks(id, workspace_id, board_id, column_id, title, created_by)
select 'cccccccc-0000-0000-0000-000000000001', workspace_id, board_id, id, 'First task', '00000000-0000-0000-0000-000000000001'
from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000001' and name = 'TODO';
insert into public.labels(id, workspace_id, name) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Design'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Secret');
insert into public.task_labels(task_id, label_id, workspace_id, board_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.task_assignees(task_id, user_id, workspace_id, board_id) values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.checklists(id, task_id, workspace_id, board_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.checklist_items(checklist_id, task_id, workspace_id, board_id, text) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Review');
insert into public.comments(id, task_id, workspace_id, board_id, body, created_by) values
  ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Owner comment', '00000000-0000-0000-0000-000000000001');
insert into public.attachments(id, task_id, workspace_id, board_id, name, storage_path, mime_type, size_bytes) values
  ('ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'brief.pdf', 'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000002/brief.pdf', 'application/pdf', 100);
insert into public.activities(workspace_id, board_id, task_id, action) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'task.created');
insert into public.invites(workspace_id, token_hash) values
  ('aaaaaaaa-0000-0000-0000-000000000001', repeat('a', 64));

select is((select count(*) from public.workspace_members where role = 'owner' and workspace_id in ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002')), 2::bigint, 'workspace owner membership is automatic');
select is((select count(*) from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 3::bigint, 'board creates three default columns');
select is((select count(*) from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000001' and is_done), 1::bigint, 'done status is semantic, independent of column name');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anonymous cannot read profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass), 'workspaces has RLS');
select ok(not has_table_privilege('anon', 'public.workspaces', 'SELECT'), 'anonymous cannot read workspaces');
select ok((select relrowsecurity from pg_class where oid = 'public.workspace_members'::regclass), 'workspace_members has RLS');
select ok(not has_table_privilege('anon', 'public.workspace_members', 'SELECT'), 'anonymous cannot read workspace_members');
select ok((select relrowsecurity from pg_class where oid = 'public.boards'::regclass), 'boards has RLS');
select ok(not has_table_privilege('anon', 'public.boards', 'SELECT'), 'anonymous cannot read boards');
select ok((select relrowsecurity from pg_class where oid = 'public.columns'::regclass), 'columns has RLS');
select ok(not has_table_privilege('anon', 'public.columns', 'SELECT'), 'anonymous cannot read columns');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS');
select ok(not has_table_privilege('anon', 'public.tasks', 'SELECT'), 'anonymous cannot read tasks');
select ok((select relrowsecurity from pg_class where oid = 'public.task_assignees'::regclass), 'task_assignees has RLS');
select ok(not has_table_privilege('anon', 'public.task_assignees', 'SELECT'), 'anonymous cannot read task_assignees');
select ok((select relrowsecurity from pg_class where oid = 'public.labels'::regclass), 'labels has RLS');
select ok(not has_table_privilege('anon', 'public.labels', 'SELECT'), 'anonymous cannot read labels');
select ok((select relrowsecurity from pg_class where oid = 'public.task_labels'::regclass), 'task_labels has RLS');
select ok(not has_table_privilege('anon', 'public.task_labels', 'SELECT'), 'anonymous cannot read task_labels');
select ok((select relrowsecurity from pg_class where oid = 'public.checklists'::regclass), 'checklists has RLS');
select ok(not has_table_privilege('anon', 'public.checklists', 'SELECT'), 'anonymous cannot read checklists');
select ok((select relrowsecurity from pg_class where oid = 'public.checklist_items'::regclass), 'checklist_items has RLS');
select ok(not has_table_privilege('anon', 'public.checklist_items', 'SELECT'), 'anonymous cannot read checklist_items');
select ok((select relrowsecurity from pg_class where oid = 'public.comments'::regclass), 'comments has RLS');
select ok(not has_table_privilege('anon', 'public.comments', 'SELECT'), 'anonymous cannot read comments');
select ok((select relrowsecurity from pg_class where oid = 'public.attachments'::regclass), 'attachments has RLS');
select ok(not has_table_privilege('anon', 'public.attachments', 'SELECT'), 'anonymous cannot read attachments');
select ok((select relrowsecurity from pg_class where oid = 'public.activities'::regclass), 'activities has RLS');
select ok(not has_table_privilege('anon', 'public.activities', 'SELECT'), 'anonymous cannot read activities');
select ok((select relrowsecurity from pg_class where oid = 'public.invites'::regclass), 'invites has RLS');
select ok(not has_table_privilege('anon', 'public.invites', 'SELECT'), 'anonymous cannot read invites');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.profiles where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')), 0::bigint, 'outsider cannot read profiles');
select is((select count(*) from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read workspaces');
select is((select count(*) from public.workspace_members where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read workspace_members');
select is((select count(*) from public.boards where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read boards');
select is((select count(*) from public.columns where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read columns');
select is((select count(*) from public.tasks where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read tasks');
select is((select count(*) from public.task_assignees where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read task_assignees');
select is((select count(*) from public.labels where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read labels');
select is((select count(*) from public.task_labels where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read task_labels');
select is((select count(*) from public.checklists where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read checklists');
select is((select count(*) from public.checklist_items where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read checklist_items');
select is((select count(*) from public.comments where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read comments');
select is((select count(*) from public.attachments where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read attachments');
select is((select count(*) from public.activities where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read activities');
select is((select count(*) from public.invites where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read invites');

select throws_ok($$insert into public.tasks(workspace_id, board_id, column_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), 'Attack')$$, '42501', null, 'outsider cannot insert task');
with changed as (update public.tasks set title = 'Attack' where id = 'cccccccc-0000-0000-0000-000000000001' returning id) select is((select count(*) from changed), 0::bigint, 'outsider update affects no task');
with removed as (delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001' returning id) select is((select count(*) from removed), 0::bigint, 'outsider delete affects no task');
select ok(not private.can_join_channel('board:bbbbbbbb-0000-0000-0000-000000000001'), 'outsider cannot join board channel');
select ok(not private.can_access_task_object('aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000002/brief.pdf'), 'outsider cannot read task storage');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select ok((select count(*) from public.profiles) > 0, 'member can read profiles');
select ok((select count(*) from public.workspaces) > 0, 'member can read workspaces');
select ok((select count(*) from public.workspace_members) > 0, 'member can read workspace_members');
select ok((select count(*) from public.boards) > 0, 'member can read boards');
select ok((select count(*) from public.columns) > 0, 'member can read columns');
select ok((select count(*) from public.tasks) > 0, 'member can read tasks');
select ok((select count(*) from public.task_assignees) > 0, 'member can read task_assignees');
select ok((select count(*) from public.labels) > 0, 'member can read labels');
select ok((select count(*) from public.task_labels) > 0, 'member can read task_labels');
select ok((select count(*) from public.checklists) > 0, 'member can read checklists');
select ok((select count(*) from public.checklist_items) > 0, 'member can read checklist_items');
select ok((select count(*) from public.comments) > 0, 'member can read comments');
select ok((select count(*) from public.attachments) > 0, 'member can read attachments');
select ok((select count(*) from public.activities) > 0, 'member can read activities');

select is((select count(*) from public.invites), 0::bigint, 'member cannot read invite hashes');
select ok(private.can_join_channel('board:bbbbbbbb-0000-0000-0000-000000000001:' || (select realtime_epoch::text from public.workspaces where id='aaaaaaaa-0000-0000-0000-000000000001')), 'member can join current board channel');
select ok(private.can_join_channel('workspace:aaaaaaaa-0000-0000-0000-000000000001'), 'member can join workspace channel');
select ok(not private.can_join_channel('board:invalid'), 'malformed channel safely rejected');
select ok(private.can_access_task_object('aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000002/brief.pdf'), 'member can read task storage');
select ok(not private.can_access_task_object('bad/path'), 'malformed object path safely rejected');
select ok(private.can_view_avatar('00000000-0000-0000-0000-000000000001/avatar.png'), 'member can view colleague avatar');
select ok(not private.can_view_avatar('00000000-0000-0000-0000-000000000003/avatar.png'), 'member cannot view stranger avatar');
select set_config('test.upload_path',(public.reserve_attachment('cccccccc-0000-0000-0000-000000000001','brief.pdf','application/pdf',10)).storage_path,true);
select lives_ok($$insert into storage.objects(bucket_id, name) values ('task-attachments',current_setting('test.upload_path'))$$, 'member can upload to reserved task path');
select throws_ok($$insert into storage.objects(bucket_id, name) values ('task-attachments', 'aaaaaaaa-0000-0000-0000-000000000002/cccccccc-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000002/leak.pdf')$$, '42501', null, 'member cannot upload to another workspace path');
select lives_ok($$insert into storage.objects(bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000002/avatar.png')$$, 'member can upload own avatar');
select throws_ok($$insert into storage.objects(bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000001/forged.png')$$, '42501', null, 'member cannot upload another user avatar');
select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 1::bigint, 'member can read own task object');
with changed as (update public.profiles set name = 'Forged' where id = '00000000-0000-0000-0000-000000000001' returning id) select is((select count(*) from changed), 0::bigint, 'member cannot edit colleague profile');
select lives_ok($$update public.profiles set name = 'New name' where id = '00000000-0000-0000-0000-000000000002'$$, 'member can edit own profile');
select set_config('test.task_version',(select version::text from public.tasks where id='cccccccc-0000-0000-0000-000000000001'),true);
select lives_ok($$update public.tasks set title = 'Edited by member', due_date = '2026-10-14' where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'member can edit task');
select is((select version from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), current_setting('test.task_version')::int + 1, 'task version increments on edit');
select lives_ok($$update public.tasks set column_id = (select id from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000001' and name = 'IN PROGRESS'), position = 512 where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'member can move task within board');
select is((select position from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'), 512::float8, 'position is persisted');
select throws_ok($$update public.tasks set column_id = (select id from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000003' and name = 'TODO') where id = 'cccccccc-0000-0000-0000-000000000001'$$, '23503', null, 'cannot move task into a different board');
select throws_ok($$update public.tasks set workspace_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, '42501', null, 'workspace identity is immutable to clients');
select throws_ok($$update public.tasks set created_by = '00000000-0000-0000-0000-000000000002'$$, '42501', null, 'cannot replace task author');
select throws_ok($$update public.tasks set version = 100$$, '42501', null, 'cannot forge task version');
select throws_ok($$update public.tasks set position = 'NaN'$$, '23514', null, 'non-finite order is rejected');
select throws_ok($$insert into public.task_assignees(task_id, user_id, workspace_id, board_id) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001')$$, '23503', null, 'assignee must belong to same workspace');
select throws_ok($$insert into public.task_labels(task_id, label_id, workspace_id, board_id) values ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001')$$, '23503', null, 'label must belong to same workspace');
select throws_ok($$insert into public.workspace_members(workspace_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')$$, '42501', null, 'member cannot add users');
select throws_ok($$update public.workspace_members set role = 'owner'$$, '42501', null, 'member cannot escalate role');
with changed as (update public.workspaces set name = 'Hijacked' returning id) select is((select count(*) from changed), 0::bigint, 'member cannot rename workspace');
with changed as (update public.comments set body = 'Forged' where id = 'ffffffff-0000-0000-0000-000000000001' returning id) select is((select count(*) from changed), 0::bigint, 'member cannot edit someone else comment');
select throws_ok($$insert into public.activities(workspace_id, action) values ('aaaaaaaa-0000-0000-0000-000000000001', 'task.created')$$, '42501', null, 'member cannot forge audit history');
select throws_ok($$update public.invites set use_count = 0$$, '42501', null, 'member cannot reset invitation counters');
select throws_ok($$select public.reserve_attachment('cccccccc-0000-0000-0000-000000000001','large.pdf','application/pdf',10485761)$$, '23514', null, 'invalid attachment rejected');

select lives_ok($$insert into public.tasks(id, workspace_id, board_id, column_id, title) select 'cccccccc-0000-0000-0000-000000000002', workspace_id, board_id, id, 'Quick task' from public.columns where board_id = 'bbbbbbbb-0000-0000-0000-000000000001' and name = 'TODO'$$, 'member can create task');
select is((select created_by from public.tasks where id = 'cccccccc-0000-0000-0000-000000000002'), '00000000-0000-0000-0000-000000000002'::uuid, 'task author comes from JWT');
select lives_ok($$delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000002'$$, 'member can delete task');
select lives_ok($$update public.checklist_items set is_completed = true$$, 'member can complete checklist item');
select lives_ok($$insert into public.comments(task_id, workspace_id, board_id, body) values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Member comment')$$, 'member can comment');
select lives_ok($$update public.comments set body = 'Edited' where created_by = '00000000-0000-0000-0000-000000000002'$$, 'member can edit own comment');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.invites), 1::bigint, 'owner can see invites');
select lives_ok($$update public.workspaces set name = 'Renamed' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'owner can rename workspace');
with removed as (delete from public.workspace_members where user_id = '00000000-0000-0000-0000-000000000001' returning user_id) select is((select count(*) from removed), 0::bigint, 'owner cannot abandon workspace');
select lives_ok($$insert into public.workspaces(id, name, owner_id) values ('aaaaaaaa-0000-0000-0000-000000000004', 'Created through RLS', '00000000-0000-0000-0000-000000000001') returning id$$, 'workspace creation works through RLS with RETURNING');
select lives_ok($$insert into public.boards(workspace_id, name) values ('aaaaaaaa-0000-0000-0000-000000000004', 'New board') returning id$$, 'board creation and default columns work through RLS');
select lives_ok($$delete from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$, 'owner can delete workspace with cascades');
select lives_ok($$delete from public.workspace_members where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002'$$, 'owner can remove member');
select is((select count(*) from public.task_assignees), 0::bigint, 'removing member clears assignments');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.tasks), 0::bigint, 'removed member loses task access');
select ok(not private.can_join_channel('board:bbbbbbbb-0000-0000-0000-000000000001'), 'removed member cannot rejoin channel');
select ok(not private.can_access_task_object('aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000002/brief.pdf'), 'removed member loses storage access');


select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 0::bigint, 'removed member cannot read stored task objects');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok($$delete from public.tasks where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'owner deletes task with dependent records');
select is((select count(*) from public.checklist_items), 0::bigint, 'task deletion cascades through checklist items');
select is((select count(*) from public.attachments), 0::bigint, 'task deletion clears attachment metadata');
select is((select count(*) from public.comments), 0::bigint, 'task deletion clears comments');
select ok((select count(*) from public.activities where task_id is null) > 0, 'task deletion retains activity with null reference');
select lives_ok($$delete from public.boards where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, 'board deletion succeeds with retained activity');
select ok((select count(*) from public.activities where board_id is null) > 0, 'board deletion retains workspace activity');

reset role;
select is((select file_size_limit from storage.buckets where id = 'task-attachments'), 10485760::bigint, 'Storage attachment limit is enforced at bucket');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 2097152::bigint, 'Storage avatar limit is enforced at bucket');
select is((select count(*) from storage.buckets where public), 0::bigint, 'no public buckets');
select throws_ok($$delete from public.profiles where id = '00000000-0000-0000-0000-000000000001'$$, '23503', null, 'owner profile cannot be deleted while owning workspace');
select * from finish();
rollback;
