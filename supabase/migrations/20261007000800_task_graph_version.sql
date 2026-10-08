-- A task version covers its checklist/assignment/label relationships as well.
-- The save RPC returns the final version after all relationship mutations.
create or replace function private.touch_task_graph() returns trigger
language plpgsql security definer set search_path = '' as $$
declare task uuid := case when tg_op = 'DELETE' then old.task_id else new.task_id end;
begin
  update public.tasks set updated_at = now()
    where id = task;
  return null;
end;
$$;
revoke all on function private.touch_task_graph() from public, anon, authenticated;
do $$
declare table_name text;
begin
  foreach table_name in array array['task_assignees','task_labels','checklists','checklist_items'] loop
    execute format('create trigger task_graph_version after insert or update or delete on public.%I for each row execute function private.touch_task_graph()', table_name);
  end loop;
end;
$$;

-- An invoker RPC: all reads and writes retain the caller's RLS and column grants.
-- A rejected relationship or checklist rolls back the entire edit.
create or replace function public.save_task_details(target_task uuid, expected_version integer, details jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  task_row public.tasks%rowtype;
  checklist jsonb;
  item jsonb;
  v_checklist_id uuid;
  item_id uuid;
  checklist_ids uuid[] := array[]::uuid[];
  item_ids uuid[] := array[]::uuid[];
  label_id uuid;
  item_position integer;
  checklist_position integer := 0;
  saved_version integer;
begin
  select * into task_row from public.tasks where id = target_task for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if expected_version is null or expected_version <> task_row.version then
    return jsonb_build_object('error', 'stale_task');
  end if;
  if jsonb_typeof(details) is distinct from 'object'
    or not (details ?& array['title','description','priority','due_date','assignee','labels','checklists'])
    or jsonb_typeof(details->'labels') is distinct from 'array'
    or jsonb_typeof(details->'checklists') is distinct from 'array'
    or jsonb_array_length(details->'labels') > 100
    or jsonb_array_length(details->'checklists') > 20 then
    return jsonb_build_object('error', 'invalid_input');
  end if;
  update public.tasks set title = btrim(details->>'title'), description = details->>'description',
    priority = (details->>'priority')::public.task_priority, due_date = nullif(details->>'due_date','')::date
    where id = target_task returning version into saved_version;

  delete from public.task_assignees where task_id = target_task;
  if nullif(details->>'assignee','') is not null then
    insert into public.task_assignees(task_id,user_id,workspace_id,board_id)
      values(target_task,(details->>'assignee')::uuid,task_row.workspace_id,task_row.board_id);
  end if;
  delete from public.task_labels where task_id = target_task;
  for label_id in select distinct value::uuid from jsonb_array_elements_text(details->'labels') loop
    insert into public.task_labels(task_id,label_id,workspace_id,board_id)
      values(target_task,label_id,task_row.workspace_id,task_row.board_id);
  end loop;

  for checklist in select value from jsonb_array_elements(details->'checklists') loop
    v_checklist_id := (checklist->>'id')::uuid;
    if v_checklist_id is null or v_checklist_id = any(checklist_ids)
      or jsonb_typeof(checklist->'items') is distinct from 'array'
      or jsonb_array_length(checklist->'items') > 200 then
      raise exception 'Invalid checklist' using errcode = '22023';
    end if;
    checklist_ids := array_append(checklist_ids, v_checklist_id);
    checklist_position := checklist_position + 1024;
    update public.checklists set title = btrim(checklist->>'title'), position = checklist_position
      where id = v_checklist_id and task_id = target_task;
    if not found then
      insert into public.checklists(id,task_id,workspace_id,board_id,title,position)
        values(v_checklist_id,target_task,task_row.workspace_id,task_row.board_id,btrim(checklist->>'title'),checklist_position);
    end if;
    item_position := 0;
    for item in select value from jsonb_array_elements(checklist->'items') loop
      item_id := (item->>'id')::uuid;
      if item_id is null or item_id = any(item_ids) or jsonb_typeof(item->'is_completed') is distinct from 'boolean' then
        raise exception 'Invalid item' using errcode = '22023';
      end if;
      item_ids := array_append(item_ids, item_id);
      item_position := item_position + 1024;
      update public.checklist_items ci set text = btrim(item->>'text'), is_completed = (item->>'is_completed')::boolean, position = item_position
        where ci.id = item_id and ci.checklist_id = v_checklist_id and ci.task_id = target_task;
      if not found then
        insert into public.checklist_items(id,checklist_id,task_id,workspace_id,board_id,text,is_completed,position)
          values(item_id,v_checklist_id,target_task,task_row.workspace_id,task_row.board_id,btrim(item->>'text'),(item->>'is_completed')::boolean,item_position);
      end if;
    end loop;
  end loop;
  delete from public.checklist_items where task_id = target_task and not (id = any(item_ids));
  delete from public.checklists where task_id = target_task and not (id = any(checklist_ids));
  select version into saved_version from public.tasks where id = target_task;
  return jsonb_build_object('version', saved_version);
exception when integrity_constraint_violation or data_exception then
  return jsonb_build_object('error', 'invalid_input');
end;
$$;
revoke all on function public.save_task_details(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_task_details(uuid,integer,jsonb) to authenticated;
