begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
 ('60000000-0000-0000-0000-000000000001','live-owner@example.test'),
 ('60000000-0000-0000-0000-000000000002','live-member@example.test');
insert into public.profiles(id,name,username) values
 ('60000000-0000-0000-0000-000000000001','Owner','live_test_owner'),
 ('60000000-0000-0000-0000-000000000002','Member','live_test_member');
insert into public.workspaces(id,name,owner_id) values('60000000-0000-0000-0000-000000000010','Live','60000000-0000-0000-0000-000000000001');
insert into public.workspace_members(workspace_id,user_id) values('60000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000002');
insert into public.boards(id,workspace_id,name) values('60000000-0000-0000-0000-000000000020','60000000-0000-0000-0000-000000000010','Live');
select set_config('test.topic','board:60000000-0000-0000-0000-000000000020:' || realtime_epoch::text,true) from public.workspaces where id='60000000-0000-0000-0000-000000000010';
select set_config('test.column',id::text,true) from public.columns where board_id='60000000-0000-0000-0000-000000000020' and name='TODO';
insert into public.tasks(id,workspace_id,board_id,column_id,title,position) values
 ('60000000-0000-0000-0000-000000000031','60000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000020',current_setting('test.column')::uuid,'Left',1),
 ('60000000-0000-0000-0000-000000000032','60000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000020',current_setting('test.column')::uuid,'Right',1.0000000000000002),
 ('60000000-0000-0000-0000-000000000033','60000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000020',current_setting('test.column')::uuid,'Move',2048);
select ok(not has_column_privilege('authenticated','public.workspaces','realtime_epoch','UPDATE'),'clients cannot forge channel generation');
select ok(not has_function_privilege('anon','public.reorder_task(uuid,uuid,integer,uuid,uuid)','EXECUTE'),'anonymous cannot reorder');
select ok(not has_function_privilege('authenticated','private.invalidate_scope()','EXECUTE'),'clients cannot invoke broadcast trigger');
select ok(exists(select 1 from realtime.messages where topic=current_setting('test.topic') and event='invalidate'),'task insert queues board invalidation');
select ok(not exists(select 1 from realtime.messages where topic=current_setting('test.topic') and (payload - 'id' <> '{}'::jsonb or not private)),'messages contain no application data and are private');
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select ok(private.can_join_channel(current_setting('test.topic')),'member joins current generation');
select ok(not private.can_join_channel('board:60000000-0000-0000-0000-000000000020'),'unversioned Presence topic rejected');
select is(public.reorder_task('60000000-0000-0000-0000-000000000033',current_setting('test.column')::uuid,null,null,null)->>'error','stale_task','reorder requires a version');
select is(public.move_task('60000000-0000-0000-0000-000000000033',current_setting('test.column')::uuid,null,100)->>'error','stale_task','legacy move cannot bypass version');
select is(public.reorder_task('60000000-0000-0000-0000-000000000033',current_setting('test.column')::uuid,1,null,null)->>'error','stale_order','stale neighbours rejected');
select is(public.reorder_task('60000000-0000-0000-0000-000000000033',current_setting('test.column')::uuid,1,'60000000-0000-0000-0000-000000000031','60000000-0000-0000-0000-000000000032')->>'position','1536','exhausted midpoint rebalances atomically');
select is((select position from public.tasks where id='60000000-0000-0000-0000-000000000031'),1024::float8,'left neighbour rebalanced');
select is((select position from public.tasks where id='60000000-0000-0000-0000-000000000032'),2048::float8,'right neighbour rebalanced');
select is((select version from public.tasks where id='60000000-0000-0000-0000-000000000031'),2,'rebalance invalidates old neighbour versions');
select is(public.reorder_task('60000000-0000-0000-0000-000000000033',current_setting('test.column')::uuid,1,null,null)->>'error','stale_task','duplicate mutation rejected');
reset role;
select set_config('test.version',(select version::text from public.tasks where id='60000000-0000-0000-0000-000000000033'),true);
insert into public.checklists(id,workspace_id,board_id,task_id,title) values('60000000-0000-0000-0000-000000000040','60000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000020','60000000-0000-0000-0000-000000000033','List');
select is((select version from public.tasks where id='60000000-0000-0000-0000-000000000033'),current_setting('test.version')::int+1,'direct child mutation advances aggregate task version');
savepoint before_delete;
delete from public.tasks where id='60000000-0000-0000-0000-000000000033';
rollback to before_delete;
select is((select version from public.tasks where id='60000000-0000-0000-0000-000000000033'),current_setting('test.version')::int+1,'rollback preserves task graph');
delete from public.workspace_members where workspace_id='60000000-0000-0000-0000-000000000010' and user_id='60000000-0000-0000-0000-000000000002';
select ok(current_setting('test.topic') <> 'board:60000000-0000-0000-0000-000000000020:' || (select realtime_epoch::text from public.workspaces where id='60000000-0000-0000-0000-000000000010'),'membership removal rotates board topic');
set local role authenticated;
select ok(not private.can_join_channel(current_setting('test.topic')),'removed member cannot rejoin old topic');
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select ok(not private.can_join_channel(current_setting('test.topic')),'remaining member must move to fresh topic');
select ok(private.can_join_channel('board:60000000-0000-0000-0000-000000000020:' || (select realtime_epoch::text from public.workspaces where id='60000000-0000-0000-0000-000000000010')),'remaining member joins fresh topic');
reset role;
select * from finish();
rollback;
