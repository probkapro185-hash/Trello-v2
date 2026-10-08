-- Empty invalidations only. Membership changes rotate board Presence topics;
-- cached authorization on an old socket cannot join the new generation.
alter table public.workspaces add column realtime_epoch uuid not null default gen_random_uuid();

create or replace function private.can_join_channel(channel_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid()) and channel_topic = 'workspace:' || m.workspace_id::text
  ) or exists (
    select 1 from public.boards b
    join public.workspaces w on w.id = b.workspace_id
    join public.workspace_members m on m.workspace_id = w.id
    where m.user_id = (select auth.uid())
      and channel_topic = 'board:' || b.id::text || ':' || w.realtime_epoch::text
  );
$$;

create function private.invalidate_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  workspace uuid;
  board uuid;
  epoch uuid;
begin
  workspace := (row_data->>'workspace_id')::uuid;
  board := (row_data->>'board_id')::uuid;
  if tg_table_name = 'workspaces' then workspace := (row_data->>'id')::uuid; end if;
  if tg_table_name = 'boards' then board := (row_data->>'id')::uuid; end if;
  if tg_table_name = 'workspace_members' then
    update public.workspaces set realtime_epoch = gen_random_uuid() where id = workspace;
  elsif board is not null then
    select realtime_epoch into epoch from public.workspaces where id = workspace;
    if epoch is not null then
      perform realtime.send('{}'::jsonb, 'invalidate', 'board:' || board::text || ':' || epoch::text, true);
    end if;
  end if;
  -- Board lists, workspace properties, labels and membership affect navigation.
  if board is null or tg_table_name = 'boards' then
    perform realtime.send('{}'::jsonb, 'invalidate', 'workspace:' || workspace::text, true);
  end if;
  return null;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['workspaces','workspace_members','boards','columns','tasks','labels','task_labels','task_assignees','checklists','checklist_items'] loop
    execute format('create trigger live_invalidation after insert or update or delete on public.%I for each row execute function private.invalidate_scope()', table_name);
  end loop;
end;
$$;

create function private.invalidate_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare workspace uuid;
begin
  for workspace in select workspace_id from public.workspace_members where user_id = new.id loop
    perform realtime.send('{}'::jsonb, 'invalidate', 'workspace:' || workspace::text, true);
  end loop;
  return null;
end;
$$;
create trigger live_profile after update on public.profiles for each row execute function private.invalidate_profile();
revoke all on function private.invalidate_scope(), private.invalidate_profile() from public, anon, authenticated;

-- A null version must never bypass optimistic concurrency in the legacy RPC.
-- Acquire the board lock before the task lock, matching reorder_task below.
create or replace function private.move_task(target_task uuid, target_column uuid, expected_version integer, new_position double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks%rowtype;
begin
  select * into current_task from public.tasks where id = target_task;
  if not found or not private.is_workspace_member(current_task.workspace_id) then return jsonb_build_object('error','forbidden'); end if;
  perform 1 from public.boards where id = current_task.board_id for update;
  select * into current_task from public.tasks where id = target_task for update;
  if not found or not private.is_workspace_member(current_task.workspace_id) then return jsonb_build_object('error','forbidden'); end if;
  if expected_version is null or expected_version <> current_task.version then return jsonb_build_object('error','stale_task'); end if;
  if new_position is null or not (new_position > '-Infinity'::float8 and new_position < 'Infinity'::float8) then return jsonb_build_object('error','invalid_position'); end if;
  if not exists(select 1 from public.columns where id = target_column and board_id = current_task.board_id) then return jsonb_build_object('error','invalid_target'); end if;
  update public.tasks set column_id = target_column, position = new_position where id = target_task returning * into current_task;
  return jsonb_build_object('task_id',current_task.id,'column_id',current_task.column_id,'position',current_task.position,'version',current_task.version);
end;
$$;

-- Resolve neighbours under the same board lock, and rebalance exhausted float gaps.
create function public.reorder_task(target_task uuid, target_column uuid, expected_version integer, previous_task uuid, next_task uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_task public.tasks%rowtype;
  ids uuid[];
  insertion integer;
  left_position float8;
  right_position float8;
  new_position float8;
begin
  select * into current_task from public.tasks where id = target_task;
  if not found or not private.is_workspace_member(current_task.workspace_id) then return jsonb_build_object('error','forbidden'); end if;
  perform 1 from public.boards where id = current_task.board_id for update;
  select * into current_task from public.tasks where id = target_task for update;
  if not found or not private.is_workspace_member(current_task.workspace_id) then return jsonb_build_object('error','forbidden'); end if;
  if expected_version is null or expected_version <> current_task.version then return jsonb_build_object('error','stale_task'); end if;
  perform 1 from public.columns where id = target_column and board_id = current_task.board_id for update;
  if not found then return jsonb_build_object('error','invalid_target'); end if;
  select coalesce(array_agg(id order by position,id),array[]::uuid[]) into ids
    from public.tasks where column_id = target_column and id <> target_task;
  insertion := case when previous_task is null then 0 else array_position(ids,previous_task) end;
  if insertion is null or (ids[insertion + 1] is distinct from next_task) then return jsonb_build_object('error','stale_order'); end if;
  select position into left_position from public.tasks where id = previous_task;
  select position into right_position from public.tasks where id = next_task;
  new_position := case when left_position is null then coalesce(right_position - 1024,1024)
    when right_position is null then left_position + 1024 else left_position / 2 + right_position / 2 end;
  if not (new_position > '-Infinity'::float8 and new_position < 'Infinity'::float8)
    or (left_position is not null and new_position <= left_position)
    or (right_position is not null and new_position >= right_position) then
    update public.tasks t set position = ordered.ordinality * 1024
      from unnest(ids) with ordinality as ordered(id,ordinality) where t.id = ordered.id;
    new_position := insertion * 1024 + 512;
  end if;
  update public.tasks set column_id = target_column, position = new_position where id = target_task returning * into current_task;
  return jsonb_build_object('task_id',current_task.id,'column_id',current_task.column_id,'position',current_task.position,'version',current_task.version);
end;
$$;
revoke all on function public.reorder_task(uuid,uuid,integer,uuid,uuid) from public, anon;
grant execute on function public.reorder_task(uuid,uuid,integer,uuid,uuid) to authenticated;
