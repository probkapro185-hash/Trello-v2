create function private.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members where workspace_id = target_workspace and user_id = (select auth.uid()));
$$;

create function private.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspaces where id = target_workspace and owner_id = (select auth.uid()));
$$;

create function private.can_view_profile(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user = (select auth.uid()) or exists (
    select 1 from public.workspace_members me
    join public.workspace_members colleague using (workspace_id)
    where me.user_id = (select auth.uid()) and colleague.user_id = target_user
  );
$$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_workspace_member(uuid), private.is_workspace_owner(uuid), private.can_view_profile(uuid) to authenticated;

-- Table grants are deliberate. UPDATE grants below expose only editable fields.
do $$
declare relation text;
begin
  foreach relation in array array['profiles', 'workspaces', 'workspace_members', 'boards', 'columns', 'tasks', 'task_assignees', 'labels', 'task_labels', 'checklists', 'checklist_items', 'comments', 'attachments', 'activities', 'invites'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from anon, authenticated', relation);
    execute format('grant select on public.%I to authenticated', relation);
    execute format('grant all on public.%I to service_role', relation);
  end loop;
end;
$$;

grant insert (id, name, username, avatar_path) on public.profiles to authenticated;
grant update (name, username, avatar_path) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (private.can_view_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant insert (id, name, owner_id) on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;
create policy workspaces_select on public.workspaces for select to authenticated using (private.is_workspace_member(id) or owner_id = (select auth.uid()));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated using (private.is_workspace_owner(id)) with check (private.is_workspace_owner(id));
create policy workspaces_delete on public.workspaces for delete to authenticated using (private.is_workspace_owner(id));

grant insert (workspace_id, user_id, role) on public.workspace_members to authenticated;
grant delete on public.workspace_members to authenticated;
create policy members_select on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated with check (private.is_workspace_owner(workspace_id) and role = 'member');
create policy members_delete on public.workspace_members for delete to authenticated using (role = 'member' and (user_id = (select auth.uid()) or private.is_workspace_owner(workspace_id)));

grant insert (id, workspace_id, name, position) on public.boards to authenticated;
grant update (name, position) on public.boards to authenticated;
grant insert (id, workspace_id, board_id, name, position, is_done) on public.columns to authenticated;
grant update (name, position, is_done) on public.columns to authenticated;
grant insert (id, workspace_id, board_id, column_id, title, description, priority, due_date, position) on public.tasks to authenticated;
grant update (column_id, title, description, priority, due_date, position) on public.tasks to authenticated;
grant insert (id, workspace_id, name, color) on public.labels to authenticated;
grant update (name, color) on public.labels to authenticated;
grant insert (id, task_id, workspace_id, board_id, title, position) on public.checklists to authenticated;
grant update (title, position) on public.checklists to authenticated;
grant insert (id, checklist_id, task_id, workspace_id, board_id, text, is_completed, position) on public.checklist_items to authenticated;
grant update (text, is_completed, position) on public.checklist_items to authenticated;
grant insert (id, task_id, workspace_id, board_id, name, storage_path, mime_type, size_bytes) on public.attachments to authenticated;

do $$
declare relation text;
begin
  foreach relation in array array['boards', 'columns', 'tasks', 'labels', 'checklists', 'checklist_items', 'attachments'] loop
    execute format('grant delete on public.%I to authenticated', relation);
    execute format('create policy member_select on public.%I for select to authenticated using (private.is_workspace_member(workspace_id))', relation);
    execute format('create policy member_insert on public.%I for insert to authenticated with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()))', relation);
    if relation <> 'attachments' then
      execute format('create policy member_update on public.%I for update to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id))', relation);
    end if;
    execute format('create policy member_delete on public.%I for delete to authenticated using (private.is_workspace_member(workspace_id))', relation);
  end loop;
end;
$$;

grant insert (task_id, user_id, workspace_id, board_id) on public.task_assignees to authenticated;
grant delete on public.task_assignees to authenticated;
create policy assignees_select on public.task_assignees for select to authenticated using (private.is_workspace_member(workspace_id));
create policy assignees_insert on public.task_assignees for insert to authenticated with check (private.is_workspace_member(workspace_id) and assigned_by = (select auth.uid()));
create policy assignees_delete on public.task_assignees for delete to authenticated using (private.is_workspace_member(workspace_id));

grant insert (task_id, label_id, workspace_id, board_id) on public.task_labels to authenticated;
grant delete on public.task_labels to authenticated;
create policy task_labels_select on public.task_labels for select to authenticated using (private.is_workspace_member(workspace_id));
create policy task_labels_insert on public.task_labels for insert to authenticated with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy task_labels_delete on public.task_labels for delete to authenticated using (private.is_workspace_member(workspace_id));

grant insert (id, task_id, workspace_id, board_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
create policy comments_select on public.comments for select to authenticated using (private.is_workspace_member(workspace_id));
create policy comments_insert on public.comments for insert to authenticated with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy comments_update on public.comments for update to authenticated using (private.is_workspace_member(workspace_id) and created_by = (select auth.uid())) with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy comments_delete on public.comments for delete to authenticated using (private.is_workspace_member(workspace_id) and (created_by = (select auth.uid()) or private.is_workspace_owner(workspace_id)));

-- Audit events will be written by controlled database triggers in stage 7.
create policy activities_select on public.activities for select to authenticated using (private.is_workspace_member(workspace_id));

-- Stage 2 adds token generation and atomic, rate-limited redemption.
-- A browser cannot write counters or create/guess a token through this table.
grant update (revoked_at) on public.invites to authenticated;
grant delete on public.invites to authenticated;
create policy invites_select on public.invites for select to authenticated using (private.is_workspace_owner(workspace_id));
create policy invites_update on public.invites for update to authenticated using (private.is_workspace_owner(workspace_id)) with check (private.is_workspace_owner(workspace_id));
create policy invites_delete on public.invites for delete to authenticated using (private.is_workspace_owner(workspace_id));

-- Harden future migrations: explicitly grant access when introducing a function.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;
