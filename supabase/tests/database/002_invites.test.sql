begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','invite-owner@example.test'),
 ('10000000-0000-0000-0000-000000000002','invite-member@example.test'),
 ('10000000-0000-0000-0000-000000000003','invite-outsider@example.test'),
 ('10000000-0000-0000-0000-000000000004','invite-no-profile@example.test');
insert into public.profiles(id,name,username) values
 ('10000000-0000-0000-0000-000000000001','Owner','invite_owner'),
 ('10000000-0000-0000-0000-000000000002','Member','invite_member'),
 ('10000000-0000-0000-0000-000000000003','Outsider','invite_outsider');
insert into public.workspaces(id,name,owner_id) values
 ('10000000-0000-0000-0000-000000000010','Invitation test','10000000-0000-0000-0000-000000000001');
select ok(not has_function_privilege('anon','public.create_workspace_invite(uuid)','EXECUTE'),'anonymous cannot create');
select ok(not has_function_privilege('anon','public.inspect_workspace_invite(text)','EXECUTE'),'anonymous cannot inspect');
select ok(not has_function_privilege('anon','public.accept_workspace_invite(text)','EXECUTE'),'anonymous cannot redeem');
select ok(not has_function_privilege('authenticated','private.consume_invite_attempt(text,integer)','EXECUTE'),'counter cannot be called directly');
select ok(not has_table_privilege('authenticated','private.invite_attempts','SELECT'),'rate counters are private');
select ok(not has_column_privilege('authenticated','public.invites','use_count','UPDATE'),'client cannot change use count');
select is((select count(*) from pg_proc where oid in ('public.create_workspace_invite(uuid)'::regprocedure,'public.inspect_workspace_invite(text)'::regprocedure,'public.accept_workspace_invite(text)'::regprocedure) and prosecdef),0::bigint,'public RPCs are invoker functions');
select is((select count(*) from pg_proc where oid in ('private.create_workspace_invite(uuid)'::regprocedure,'private.inspect_workspace_invite(text)'::regprocedure,'private.accept_workspace_invite(text)'::regprocedure) and prosecdef and proconfig @> array['search_path=""']),3::bigint,'private implementations pin search_path');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select is(public.create_workspace_invite('10000000-0000-0000-0000-000000000010')->>'error','forbidden','non-owner cannot create');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('test.invitation',public.create_workspace_invite('10000000-0000-0000-0000-000000000010')::text,true);
select ok(current_setting('test.invitation')::jsonb->>'token' ~ '^[a-f0-9]{64}$','token has 256 bits');
select is((select token_hash from public.invites where id=(current_setting('test.invitation')::jsonb->>'id')::uuid),encode(extensions.digest(current_setting('test.invitation')::jsonb->>'token','sha256'),'hex'),'only SHA256 stored');
select is((select max_uses from public.invites where id=(current_setting('test.invitation')::jsonb->>'id')::uuid),1,'default one use');
select ok((select expires_at=created_at+interval '7 days' from public.invites where id=(current_setting('test.invitation')::jsonb->>'id')::uuid),'default seven days');
select set_config('test.revoked',public.create_workspace_invite('10000000-0000-0000-0000-000000000010')::text,true);
update public.invites set revoked_at=now() where id=(current_setting('test.revoked')::jsonb->>'id')::uuid;
update public.invites set revoked_at=null where id=(current_setting('test.revoked')::jsonb->>'id')::uuid;
select ok((select revoked_at is not null from public.invites where id=(current_setting('test.revoked')::jsonb->>'id')::uuid),'revocation is permanent');
select set_config('test.expired',public.create_workspace_invite('10000000-0000-0000-0000-000000000010')::text,true);
reset role;
update public.invites set created_at=now()-interval '8 days', expires_at=now()-interval '1 day' where id=(current_setting('test.expired')::jsonb->>'id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select is(public.accept_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'error','profile_required','onboarding required before redeem');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.invites),0::bigint,'outsider cannot read invite table');
select is(public.inspect_workspace_invite('malformed')->>'error','invalid_invite','malformed token rejected');
select is(public.inspect_workspace_invite(repeat('0',64))->>'error','invalid_invite','unknown token rejected');
select is(public.inspect_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'name','Invitation test','valid secret previews workspace');
select is(public.inspect_workspace_invite(current_setting('test.revoked')::jsonb->>'token')->>'error','invalid_invite','revoked preview rejected');
select is(public.accept_workspace_invite(current_setting('test.revoked')::jsonb->>'token')->>'error','invalid_invite','revoked redemption rejected');
select is(public.accept_workspace_invite(current_setting('test.expired')::jsonb->>'token')->>'error','invalid_invite','expired redemption rejected');
select is(public.accept_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'already_member','false','first redemption creates membership');
select is((select role::text from public.workspace_members where workspace_id='10000000-0000-0000-0000-000000000010' and user_id=auth.uid()),'member','redeemer cannot become owner');
select is(public.accept_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'already_member','true','repeat redemption is idempotent');
select is(public.inspect_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'already_member','true','existing member can open used link');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select is(public.accept_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'error','invalid_invite','second user cannot reuse link');
select is(public.inspect_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'error','invalid_invite','exhausted link has no preview to outsider');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select is((select use_count from public.invites where id=(current_setting('test.invitation')::jsonb->>'id')::uuid),1,'repeat redemption does not increment count');
delete from public.workspace_members where workspace_id='10000000-0000-0000-0000-000000000010' and user_id='10000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is(public.accept_workspace_invite(current_setting('test.invitation')::jsonb->>'token')->>'error','invalid_invite','removed member cannot reuse spent link');
select is((select count(*) from public.workspaces),0::bigint,'removed member immediately loses workspace access');
-- Failures return JSON so their rate counters are committed by a normal RPC call.
reset role;
delete from private.invite_attempts where user_id='10000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$begin for i in 1..10 loop perform public.accept_workspace_invite('bad'); end loop; end$$;
select is(public.accept_workspace_invite('bad')->>'error','rate_limited','failed redemption attempts count toward quota');
do $$begin for i in 1..30 loop perform public.inspect_workspace_invite('bad'); end loop; end$$;
select is(public.inspect_workspace_invite('bad')->>'error','rate_limited','inspection attempts rate limited');
do $$begin for i in 1..5 loop perform public.create_workspace_invite('10000000-0000-0000-0000-000000000010'); end loop; end$$;
select is(public.create_workspace_invite('10000000-0000-0000-0000-000000000010')->>'error','rate_limited','failed creation attempts count');
reset role;
select is((select attempts from private.invite_attempts where user_id='10000000-0000-0000-0000-000000000003' and operation='accept'),11,'counter persists despite error responses');
update private.invite_attempts set window_started_at=clock_timestamp()-interval '2 minutes' where user_id='10000000-0000-0000-0000-000000000003';
set local role authenticated;
select is(public.accept_workspace_invite('bad')->>'error','invalid_invite','quota resets after time window');
reset role;
select is((select attempts from private.invite_attempts where user_id='10000000-0000-0000-0000-000000000003' and operation='accept'),1,'new window starts at one');
-- Active invite cap is separate from the per-minute creation quota.
insert into public.invites(workspace_id,token_hash) select '10000000-0000-0000-0000-000000000010',encode(extensions.digest('cap-'||n::text,'sha256'),'hex') from generate_series(1,20) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select is(public.create_workspace_invite('10000000-0000-0000-0000-000000000010')->>'error','too_many_invites','bounded active invitation count');
reset role;
select * from finish();
rollback;
