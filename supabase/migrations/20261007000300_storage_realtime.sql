insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('task-attachments', 'task-attachments', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create function private.can_access_task_object(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.workspace_id::text = split_part(object_name, '/', 1)
      and t.id::text = split_part(object_name, '/', 2)
      and split_part(object_name, '/', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(object_name, '/', 4) <> ''
      and m.user_id = (select auth.uid())
  );
$$;

create function private.can_view_avatar(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id::text = split_part(object_name, '/', 1) and private.can_view_profile(p.id));
$$;

create policy task_files_select on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments' and private.can_access_task_object(name));
create policy task_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments' and private.can_access_task_object(name));
create policy task_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-attachments' and private.can_access_task_object(name));
-- No UPDATE policy: uploads use unique paths and cannot overwrite existing files.

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and private.can_view_avatar(name));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) <> '');
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- Reserve private board/workspace channels. Stage 6 adds subscriptions and
-- empty-payload invalidation broadcasts; clients re-fetch through RLS.
create function private.can_join_channel(channel_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid()) and channel_topic = 'workspace:' || m.workspace_id::text
  ) or exists (
    select 1 from public.boards b
    join public.workspace_members m on m.workspace_id = b.workspace_id
    where m.user_id = (select auth.uid()) and channel_topic = 'board:' || b.id::text
  );
$$;

create policy channel_receive on realtime.messages for select to authenticated
  using (extension in ('broadcast', 'presence') and private.can_join_channel((select realtime.topic())));
create policy channel_presence on realtime.messages for insert to authenticated
  with check (extension = 'presence' and private.can_join_channel((select realtime.topic())));
-- Broadcast writes belong to DB triggers, never arbitrary client payloads.

revoke all on function private.can_access_task_object(text), private.can_view_avatar(text), private.can_join_channel(text) from public, anon, authenticated;
grant execute on function private.can_access_task_object(text), private.can_view_avatar(text), private.can_join_channel(text) to authenticated;
