-- Stage 4: one locked transaction for moving a task between columns.
-- The public wrapper stays invoker-safe; the private implementation performs
-- explicit tenant and membership checks while holding the board lock.
create function private.move_task(
  target_task uuid,
  target_column uuid,
  expected_version integer,
  new_position double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks%rowtype;
  destination public.columns%rowtype;
  updated_task public.tasks%rowtype;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('error', 'auth_required');
  end if;
  if new_position is null or new_position <> new_position or new_position <= '-Infinity'::float8 or new_position >= 'Infinity'::float8 then
    return jsonb_build_object('error', 'invalid_position');
  end if;

  select * into current_task from public.tasks where id = target_task for update;
  if not found then
    return jsonb_build_object('error', 'task_not_found');
  end if;
  if not private.is_workspace_member(current_task.workspace_id) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- Serialize reorders for one board and keep task/column reads consistent.
  perform 1 from public.boards where id = current_task.board_id and workspace_id = current_task.workspace_id for update;
  if expected_version is not null and expected_version <> current_task.version then
    return jsonb_build_object('error', 'stale_task', 'version', current_task.version);
  end if;

  select * into destination
  from public.columns
  where id = target_column
    and board_id = current_task.board_id
    and workspace_id = current_task.workspace_id
  for update;
  if not found then
    return jsonb_build_object('error', 'invalid_target');
  end if;

  update public.tasks
  set column_id = destination.id, position = new_position
  where id = current_task.id
  returning * into updated_task;

  return jsonb_build_object(
    'task_id', updated_task.id,
    'column_id', updated_task.column_id,
    'position', updated_task.position,
    'version', updated_task.version
  );
end;
$$;

create function public.move_task(
  target_task uuid,
  target_column uuid,
  expected_version integer,
  new_position double precision
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.move_task(target_task, target_column, expected_version, new_position);
$$;

revoke all on function public.move_task(uuid, uuid, integer, double precision) from public, anon;
grant execute on function public.move_task(uuid, uuid, integer, double precision) to authenticated;
revoke all on function private.move_task(uuid, uuid, integer, double precision) from public, anon, authenticated;
