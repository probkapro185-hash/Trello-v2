-- Upload reservations keep incomplete objects out of the UI. Only finalization
-- can mark a file ready, after checking actual Storage metadata.
alter table public.attachments add column upload_state text not null default 'ready'
  check(upload_state in ('pending','ready'));
alter table public.attachments add column expires_at timestamptz;
revoke insert (id,task_id,workspace_id,board_id,name,storage_path,mime_type,size_bytes) on public.attachments from authenticated;

create table private.storage_cleanup (
  path text primary key,
  available_at timestamptz not null default now(),
  lease uuid,
  attempts integer not null default 0,
  first_removed_at timestamptz
);
revoke all on private.storage_cleanup from public, anon, authenticated;

create function private.queue_attachment_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.storage_cleanup(path) values(old.storage_path) on conflict(path) do nothing;
  return null;
end;
$$;
create trigger attachment_cleanup after delete on public.attachments for each row execute function private.queue_attachment_cleanup();

create function public.reserve_attachment(target_task uuid, file_name text, file_type text, file_size bigint)
returns public.attachments language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; a public.attachments%rowtype; file_id uuid := gen_random_uuid();
begin
  select * into t from public.tasks where id=target_task for no key update;
  if not found or not private.is_workspace_member(t.workspace_id) then raise exception 'Task unavailable' using errcode='42501'; end if;
  if (select count(*) from public.attachments where task_id=target_task) >= 100 then raise exception 'Attachment limit reached' using errcode='22023'; end if;
  insert into public.attachments(id,task_id,workspace_id,board_id,name,storage_path,mime_type,size_bytes,upload_state,expires_at,created_by)
    values(file_id,t.id,t.workspace_id,t.board_id,btrim(file_name),t.workspace_id::text || '/' || t.id::text || '/' || file_id::text || '/file',file_type,file_size,'pending',now()+interval '1 hour',auth.uid()) returning * into a;
  return a;
end;
$$;
create function public.finalize_attachment(attachment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.attachments%rowtype;
begin
  select * into a from public.attachments where id=attachment_id for update;
  if not found or a.created_by is distinct from auth.uid() or not private.is_workspace_member(a.workspace_id) then raise exception 'Attachment unavailable' using errcode='42501'; end if;
  if a.upload_state='ready' then return; end if;
  if a.expires_at <= now() or not exists(select 1 from storage.objects o where o.bucket_id='task-attachments' and o.name=a.storage_path
    and (o.metadata->>'size')::bigint=a.size_bytes and o.metadata->>'mimetype'=a.mime_type) then
    raise exception 'Upload incomplete or invalid' using errcode='22023';
  end if;
  update public.attachments set upload_state='ready',expires_at=null where id=a.id;
end;
$$;

create function private.can_upload_attachment(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attachments a where a.storage_path=object_name and a.upload_state='pending'
   and a.expires_at>now() and a.created_by=auth.uid() and private.is_workspace_member(a.workspace_id));
$$;
create function private.can_read_attachment(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attachments a where a.storage_path=object_name
   and (a.upload_state='ready' or a.created_by=auth.uid()) and private.is_workspace_member(a.workspace_id));
$$;
drop policy task_files_insert on storage.objects;
drop policy task_files_select on storage.objects;
create policy task_files_insert on storage.objects for insert to authenticated
  with check(bucket_id='task-attachments' and private.can_upload_attachment(name));
create policy task_files_select on storage.objects for select to authenticated
  using(bucket_id='task-attachments' and private.can_read_attachment(name));

-- A lease makes the worker retryable, including crashes after Storage deletion.
-- A second sweep closes the window for an already-in-flight upload on deletion.
create function public.claim_storage_cleanup() returns table(path text, lease uuid)
language plpgsql security definer set search_path='' as $$
begin
  delete from public.attachments where upload_state='pending' and expires_at < now();
  return query with batch as (
    select q.path from private.storage_cleanup q where q.available_at<=now()
    order by q.available_at limit 100 for update skip locked
  ) update private.storage_cleanup q set lease=gen_random_uuid(),available_at=now()+interval '5 minutes',attempts=q.attempts+1
    from batch where q.path=batch.path returning q.path,q.lease;
end;
$$;
create function public.complete_storage_cleanup(object_path text, claim_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from private.storage_cleanup where path=object_path and lease=claim_lease and first_removed_at is not null;
  update private.storage_cleanup set first_removed_at=now(),available_at=now()+interval '24 hours',lease=null
    where path=object_path and lease=claim_lease;
end;
$$;
revoke all on function public.claim_storage_cleanup(), public.complete_storage_cleanup(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_storage_cleanup(), public.complete_storage_cleanup(text,uuid) to service_role;
revoke all on function public.reserve_attachment(uuid,text,text,bigint),public.finalize_attachment(uuid) from public,anon;
grant execute on function public.reserve_attachment(uuid,text,text,bigint),public.finalize_attachment(uuid) to authenticated;
revoke all on function private.queue_attachment_cleanup(),private.can_upload_attachment(text),private.can_read_attachment(text) from public,anon,authenticated;
grant execute on function private.can_upload_attachment(text),private.can_read_attachment(text) to authenticated;

-- Semantic history, with bounded labels rather than comment bodies/file content.
create or replace function private.record_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  r jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  before_row jsonb := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  t public.tasks%rowtype;
  task uuid;
  event text;
  info jsonb := '{}'::jsonb;
  changed text[];
begin
  task := case when tg_table_name='tasks' then (r->>'id')::uuid else (r->>'task_id')::uuid end;
  select * into t from public.tasks where id=task;
  -- Parent cascades have their own task deletion event. Workspace cascades keep no history.
  if not found or not exists(select 1 from public.boards where id=t.board_id)
    or not exists(select 1 from public.workspaces where id=t.workspace_id) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='tasks' then
    if tg_op='INSERT' then event:='task.created';
    elsif tg_op='DELETE' then event:='task.deleted';
    else
      select array_agg(key order by key) into changed from jsonb_each(r)
        where key=any(array['title','description','priority','due_date','column_id']) and value is distinct from before_row->key;
      if changed is null then return null; end if;
      event := case when r->>'column_id' is distinct from before_row->>'column_id' then 'task.moved' else 'task.updated' end;
      info := jsonb_build_object('fields',changed);
      if event='task.moved' then
        info := info || jsonb_build_object('from',(select name from public.columns where id=(before_row->>'column_id')::uuid),'to',(select name from public.columns where id=(r->>'column_id')::uuid));
      end if;
    end if;
  elsif tg_table_name='comments' then
    if tg_op='UPDATE' and r->>'body' is not distinct from before_row->>'body' then return null; end if;
    event := 'comment.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  elsif tg_table_name='attachments' then
    if tg_op='UPDATE' and r->>'upload_state'='ready' and before_row->>'upload_state'='pending' then event:='attachment.added';
    elsif tg_op='DELETE' and r->>'upload_state'='ready' then event:='attachment.deleted';
    else return null; end if;
    info := jsonb_build_object('name',r->>'name');
  elsif tg_table_name='task_assignees' then
    event := case when tg_op='INSERT' then 'task.assigned' else 'task.unassigned' end;
    info := jsonb_build_object('name',(select name from public.profiles where id=(r->>'user_id')::uuid));
  elsif tg_table_name='task_labels' then
    event := case when tg_op='INSERT' then 'label.added' else 'label.removed' end;
    info := jsonb_build_object('name',(select name from public.labels where id=(r->>'label_id')::uuid));
  elsif tg_table_name='checklist_items' then
    if tg_op='UPDATE' and (r->>'text',r->>'is_completed') is not distinct from (before_row->>'text',before_row->>'is_completed') then return null; end if;
    event := case when tg_op='DELETE' then 'checklist_item.deleted' when tg_op='INSERT' then 'checklist_item.created'
      when r->>'is_completed' is distinct from before_row->>'is_completed' then case when (r->>'is_completed')::boolean then 'checklist_item.completed' else 'checklist_item.reopened' end else 'checklist_item.updated' end;
    info := jsonb_build_object('name',r->>'text');
  elsif tg_table_name='checklists' then
    if tg_op='UPDATE' and r->>'title' is not distinct from before_row->>'title' then return null; end if;
    event := 'checklist.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
    info := jsonb_build_object('name',r->>'title');
  end if;
  if event is not null then
    insert into public.activities(workspace_id,board_id,task_id,actor_id,action,metadata)
      values(t.workspace_id,t.board_id,t.id,auth.uid(),event,info || jsonb_build_object('task_title',t.title));
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger task_activity after insert or update on public.tasks for each row execute function private.record_activity();
create trigger task_deleted_activity before delete on public.tasks for each row execute function private.record_activity();
do $$
declare rel text;
begin
  foreach rel in array array['comments','attachments','task_assignees','task_labels','checklists','checklist_items'] loop
    execute format('create trigger semantic_activity after insert or update or delete on public.%I for each row execute function private.record_activity()',rel);
  end loop;
  foreach rel in array array['comments','attachments','activities'] loop
    execute format('create trigger live_invalidation after insert or update or delete on public.%I for each row execute function private.invalidate_scope()',rel);
  end loop;
end;
$$;
-- Workspace history also refreshes for board-scoped changes.
create function private.invalidate_activity_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send('{}'::jsonb,'invalidate','workspace:' || new.workspace_id::text,true);
  return null;
end;
$$;
create trigger activity_workspace after insert on public.activities for each row execute function private.invalidate_activity_workspace();
revoke all on function private.record_activity(),private.invalidate_activity_workspace() from public,anon,authenticated;

-- Preserve unchanged relationships on save: do not emit fake remove/add history.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.save_task_details(uuid,integer,jsonb)'::regprocedure) into definition;
  definition := replace(definition,'delete from public.task_assignees where task_id = target_task;',
    'delete from public.task_assignees where task_id = target_task and user_id is distinct from nullif(details->>''assignee'','''')::uuid;');
  definition := replace(definition,'values(target_task,(details->>''assignee'')::uuid,task_row.workspace_id,task_row.board_id);',
    'values(target_task,(details->>''assignee'')::uuid,task_row.workspace_id,task_row.board_id) on conflict on constraint task_assignees_pkey do nothing;');
  definition := replace(definition,'delete from public.task_labels where task_id = target_task;',
    'delete from public.task_labels tl where tl.task_id = target_task and tl.label_id not in (select value::uuid from jsonb_array_elements_text(details->''labels''));');
  definition := replace(definition,'values(target_task,label_id,task_row.workspace_id,task_row.board_id);',
    'values(target_task,label_id,task_row.workspace_id,task_row.board_id) on conflict on constraint task_labels_pkey do nothing;');
  execute definition;
end;
$$;
