begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
 ('50000000-0000-0000-0000-000000000001','details-owner@example.test'),
 ('50000000-0000-0000-0000-000000000002','details-member@example.test'),
 ('50000000-0000-0000-0000-000000000003','details-outsider@example.test');
insert into public.profiles(id,name,username) values
 ('50000000-0000-0000-0000-000000000001','Owner','details_owner'),
 ('50000000-0000-0000-0000-000000000002','Member','details_member'),
 ('50000000-0000-0000-0000-000000000003','Outsider','details_outsider');
insert into public.workspaces(id,name,owner_id) values
 ('50000000-0000-0000-0000-000000000010','Details','50000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000011','Other','50000000-0000-0000-0000-000000000003');
insert into public.workspace_members(workspace_id,user_id) values('50000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000002');
insert into public.boards(id,workspace_id,name) values('50000000-0000-0000-0000-000000000020','50000000-0000-0000-0000-000000000010','Details');
insert into public.tasks(id,workspace_id,board_id,column_id,title)
 select '50000000-0000-0000-0000-000000000030',workspace_id,board_id,id,'Original' from public.columns where board_id='50000000-0000-0000-0000-000000000020' and name='TODO';
insert into public.labels(id,workspace_id,name) values
 ('50000000-0000-0000-0000-000000000040','50000000-0000-0000-0000-000000000010','Design'),
 ('50000000-0000-0000-0000-000000000041','50000000-0000-0000-0000-000000000011','Foreign');
select set_config('test.details', '{"title":"Edited","description":"Detailed brief","priority":"urgent","due_date":"2026-10-14","assignee":"50000000-0000-0000-0000-000000000002","labels":["50000000-0000-0000-0000-000000000040"],"checklists":[{"id":"50000000-0000-0000-0000-000000000050","title":"Release","items":[{"id":"50000000-0000-0000-0000-000000000060","text":"Review","is_completed":true},{"id":"50000000-0000-0000-0000-000000000061","text":"Ship","is_completed":false}]}]}',true);
select ok(not has_function_privilege('anon','public.save_task_details(uuid,integer,jsonb)','EXECUTE'),'anonymous cannot save');
select ok(not (select prosecdef from pg_proc where oid='public.save_task_details(uuid,integer,jsonb)'::regprocedure),'save retains invoker RLS');
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select ok((public.save_task_details('50000000-0000-0000-0000-000000000030',1,current_setting('test.details')::jsonb)->>'version')::int > 1,'member saves full task in one transaction');
select set_config('test.saved_version',(select version::text from public.tasks where id='50000000-0000-0000-0000-000000000030'),true);
select is((select title from public.tasks where id='50000000-0000-0000-0000-000000000030'),'Edited','title saved');
select is((select due_date::text from public.tasks where id='50000000-0000-0000-0000-000000000030'),'2026-10-14','deadline stored as calendar date');
select is((select priority::text from public.tasks where id='50000000-0000-0000-0000-000000000030'),'urgent','priority saved');
select is((select description from public.tasks where id='50000000-0000-0000-0000-000000000030'),'Detailed brief','description saved');
select is((select count(*) from public.task_assignees where task_id='50000000-0000-0000-0000-000000000030'),1::bigint,'one assignee');
select is((select count(*) from public.task_labels where task_id='50000000-0000-0000-0000-000000000030'),1::bigint,'label attached');
select is((select count(*) from public.checklist_items where task_id='50000000-0000-0000-0000-000000000030' and is_completed),1::bigint,'checklist completion persisted');
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',1,current_setting('test.details')::jsonb)->>'error','stale_task','stale edits rejected');
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',null,current_setting('test.details')::jsonb)->>'error','stale_task','version is mandatory');
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',current_setting('test.saved_version')::int,jsonb_set(current_setting('test.details')::jsonb,'{assignee}','"50000000-0000-0000-0000-000000000003"'))->>'error','invalid_input','foreign assignee rejected');
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',current_setting('test.saved_version')::int,jsonb_set(current_setting('test.details')::jsonb,'{labels}','["50000000-0000-0000-0000-000000000041"]'))->>'error','invalid_input','foreign label rejected');
select is((select version from public.tasks where id='50000000-0000-0000-0000-000000000030'),current_setting('test.saved_version')::int,'failed relations roll back task version');
select is((select count(*) from public.task_labels where task_id='50000000-0000-0000-0000-000000000030'),1::bigint,'failed edit preserves old labels');
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',current_setting('test.saved_version')::int,jsonb_set(current_setting('test.details')::jsonb,'{checklists,0,items,0,text}','""'))->>'error','invalid_input','empty checklist item rolls back');
select is((select text from public.checklist_items where id='50000000-0000-0000-0000-000000000060'),'Review','old item preserved after failure');
select ok((public.save_task_details('50000000-0000-0000-0000-000000000030',current_setting('test.saved_version')::int,jsonb_set(current_setting('test.details')::jsonb,'{checklists,0,items,0,text}','"Reviewed"'))->>'version')::int > current_setting('test.saved_version')::int,'existing checklist edited without replacing ids');
select set_config('test.saved_version',(select version::text from public.tasks where id='50000000-0000-0000-0000-000000000030'),true);
select is((select text from public.checklist_items where id='50000000-0000-0000-0000-000000000060'),'Reviewed','item text updated');
select ok((public.save_task_details('50000000-0000-0000-0000-000000000030',current_setting('test.saved_version')::int,current_setting('test.details')::jsonb || '{"assignee":"","due_date":"","labels":[],"checklists":[]}'::jsonb)->>'version')::int > current_setting('test.saved_version')::int,'clear optional properties and checklists');
select is((select count(*) from public.checklist_items where task_id='50000000-0000-0000-0000-000000000030'),0::bigint,'removed checklist items cleared');
select is((select count(*) from public.task_assignees where task_id='50000000-0000-0000-0000-000000000030'),0::bigint,'assignee cleared');
select ok((select due_date is null from public.tasks where id='50000000-0000-0000-0000-000000000030'),'deadline cleared');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
select is(public.save_task_details('50000000-0000-0000-0000-000000000030',4,current_setting('test.details')::jsonb)->>'error','not_found','outsider cannot read or save task');
reset role;
select * from finish();
rollback;
