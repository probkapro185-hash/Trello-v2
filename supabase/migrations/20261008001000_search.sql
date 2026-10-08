-- Invoker functions preserve the caller's RLS on every joined relation.
create function public.search_tasks(search_query text, page_number integer default 0)
returns table(id uuid, workspace_id uuid, board_id uuid, title text, description text, due_date date, priority public.task_priority, board_name text, workspace_name text, is_done boolean)
language sql stable security invoker set search_path = '' as $$
  select t.id,t.workspace_id,t.board_id,t.title,left(t.description,240),t.due_date,t.priority,b.name,w.name,c.is_done
  from public.tasks t join public.boards b on b.id=t.board_id
  join public.workspaces w on w.id=t.workspace_id join public.columns c on c.id=t.column_id
  where length(trim(search_query)) between 2 and 200
    and to_tsvector('simple',t.title || ' ' || t.description) @@ websearch_to_tsquery('simple',search_query)
  order by t.updated_at desc,t.id
  limit 31 offset (greatest(0,least(coalesce(page_number,0),10000)) * 30);
$$;
revoke all on function public.search_tasks(text,integer) from public,anon;
grant execute on function public.search_tasks(text,integer) to authenticated;

create function public.my_tasks(show_completed boolean default false, page_number integer default 0)
returns table(id uuid, workspace_id uuid, board_id uuid, title text, due_date date, priority public.task_priority, board_name text, workspace_name text, is_done boolean)
language sql stable security invoker set search_path = '' as $$
  select t.id,t.workspace_id,t.board_id,t.title,t.due_date,t.priority,b.name,w.name,c.is_done
  from public.tasks t join public.task_assignees a on a.task_id=t.id
  join public.boards b on b.id=t.board_id join public.workspaces w on w.id=t.workspace_id
  join public.columns c on c.id=t.column_id
  where a.user_id=(select auth.uid()) and c.is_done=show_completed
  order by t.due_date asc nulls last,t.id
  limit 101 offset (greatest(0,least(coalesce(page_number,0),10000)) * 100);
$$;
revoke all on function public.my_tasks(boolean,integer) from public,anon;
grant execute on function public.my_tasks(boolean,integer) to authenticated;
