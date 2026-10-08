-- Private operational data stays inaccessible even if schema exposure changes.
alter table private.storage_cleanup enable row level security;
create index storage_cleanup_available_idx on private.storage_cleanup(available_at);
create index attachments_pending_expiry_idx on public.attachments(expires_at) where upload_state='pending';
create index tasks_board_position_idx on public.tasks(board_id,position,id);
create index activities_workspace_timeline_idx on public.activities(workspace_id,created_at desc,id desc);
create index activities_task_timeline_idx on public.activities(task_id,created_at desc,id desc);

-- Replaces three HTTP queries per workspace with one RLS-respecting request.
create function public.workspace_summaries()
returns table(workspace_id uuid,board_count bigint,member_count bigint,task_count bigint,recent_boards jsonb)
language sql stable security invoker set search_path='' as $$
  select w.id,
    (select count(*) from public.boards b where b.workspace_id=w.id),
    (select count(*) from public.workspace_members m where m.workspace_id=w.id),
    (select count(*) from public.tasks t where t.workspace_id=w.id),
    coalesce((select jsonb_agg(to_jsonb(recent) order by recent.position,recent.id) from
      (select b.id,b.name,b.position from public.boards b where b.workspace_id=w.id order by b.position,b.id limit 4) recent),'[]'::jsonb)
  from public.workspaces w order by w.created_at desc,w.id;
$$;
revoke all on function public.workspace_summaries() from public,anon;
grant execute on function public.workspace_summaries() to authenticated;
