-- Stage 1: domain model. No application auth or invitation flows yet.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.workspace_role as enum ('owner', 'member');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  username text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
  avatar_path text check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create unique index workspace_one_owner on public.workspace_members(workspace_id) where role = 'owner';
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create index workspaces_owner_idx on public.workspaces(owner_id);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position double precision not null default 1024 check (position > '-Infinity'::float8 and position < 'Infinity'::float8),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index boards_workspace_position_idx on public.boards(workspace_id, position, id);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position double precision not null default 1024 check (position > '-Infinity'::float8 and position < 'Infinity'::float8),
  is_done boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id, workspace_id),
  foreign key (board_id, workspace_id) references public.boards(id, workspace_id) on delete cascade
);
create index columns_board_position_idx on public.columns(board_id, position, id);
create index columns_workspace_idx on public.columns(workspace_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  column_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  description text not null default '' check (char_length(description) <= 50000),
  priority public.task_priority not null default 'medium',
  due_date date,
  position double precision not null default 1024 check (position > '-Infinity'::float8 and position < 'Infinity'::float8),
  version integer not null default 1 check (version > 0),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, board_id, workspace_id),
  foreign key (column_id, board_id, workspace_id) references public.columns(id, board_id, workspace_id) on delete cascade
);
create index tasks_column_position_idx on public.tasks(column_id, position, id);
create index tasks_board_idx on public.tasks(board_id);
create index tasks_workspace_due_idx on public.tasks(workspace_id, due_date);
-- Language-neutral token search; substring search can be added after profiling.
create index tasks_search_idx on public.tasks using gin (to_tsvector('simple', title || ' ' || description));

create table public.task_assignees (
  task_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  assigned_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete cascade,
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id) on delete cascade
);
create index task_assignees_user_idx on public.task_assignees(user_id, workspace_id);
create index task_assignees_board_idx on public.task_assignees(board_id);
create index task_assignees_membership_idx on public.task_assignees(workspace_id, user_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  color text not null default '#4F7DFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index labels_workspace_name_idx on public.labels(workspace_id, lower(btrim(name)));

create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete cascade,
  foreign key (label_id, workspace_id) references public.labels(id, workspace_id) on delete cascade
);
create index task_labels_label_idx on public.task_labels(label_id, workspace_id);
create index task_labels_board_idx on public.task_labels(board_id);
create index task_labels_workspace_idx on public.task_labels(workspace_id);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  title text not null default 'Checklist' check (char_length(btrim(title)) between 1 and 120),
  position double precision not null default 1024 check (position > '-Infinity'::float8 and position < 'Infinity'::float8),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, task_id, board_id, workspace_id),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete cascade
);
create index checklists_task_position_idx on public.checklists(task_id, position, id);
create index checklists_board_idx on public.checklists(board_id);
create index checklists_workspace_idx on public.checklists(workspace_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null,
  task_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  is_completed boolean not null default false,
  position double precision not null default 1024 check (position > '-Infinity'::float8 and position < 'Infinity'::float8),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (checklist_id, task_id, board_id, workspace_id) references public.checklists(id, task_id, board_id, workspace_id) on delete cascade
);
create index checklist_items_checklist_position_idx on public.checklist_items(checklist_id, position, id);
create index checklist_items_board_idx on public.checklist_items(board_id);
create index checklist_items_workspace_idx on public.checklist_items(workspace_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete cascade
);
create index comments_task_created_idx on public.comments(task_id, created_at, id);
create index comments_board_idx on public.comments(board_id);
create index comments_workspace_idx on public.comments(workspace_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  board_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 255),
  bucket_id text not null default 'task-attachments' check (bucket_id = 'task-attachments'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = workspace_id::text and split_part(storage_path, '/', 2) = task_id::text and split_part(storage_path, '/', 3) = id::text and split_part(storage_path, '/', 4) <> '')
);
create index attachments_task_idx on public.attachments(task_id);
create index attachments_board_idx on public.attachments(board_id);
create index attachments_workspace_idx on public.attachments(workspace_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid,
  task_id uuid,
  actor_id uuid default auth.uid() references public.profiles(id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  created_at timestamptz not null default now(),
  foreign key (board_id, workspace_id) references public.boards(id, workspace_id) on delete set null (board_id),
  foreign key (task_id, workspace_id) references public.tasks(id, workspace_id) on delete set null (task_id),
  foreign key (task_id, board_id, workspace_id) references public.tasks(id, board_id, workspace_id) on delete set null (task_id)
);
create index activities_workspace_created_idx on public.activities(workspace_id, created_at desc, id);
create index activities_task_created_idx on public.activities(task_id, created_at desc, id);
create index activities_board_idx on public.activities(board_id, workspace_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index invites_workspace_idx on public.invites(workspace_id);

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.bump_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_version before update on public.tasks for each row execute function private.bump_version();
create trigger bump_version before update on public.columns for each row execute function private.bump_version();

do $$
declare relation text;
begin
  foreach relation in array array['profiles', 'workspaces', 'boards', 'columns', 'tasks', 'labels', 'checklists', 'checklist_items', 'comments'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', relation);
  end loop;
end;
$$;

-- These triggers establish database invariants, not application workflows.
create function private.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members(workspace_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger add_workspace_owner after insert on public.workspaces for each row execute function private.add_workspace_owner();

create function private.add_default_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.columns(workspace_id, board_id, name, position, is_done, created_by) values
    (new.workspace_id, new.id, 'TODO', 1024, false, new.created_by),
    (new.workspace_id, new.id, 'IN PROGRESS', 2048, false, new.created_by),
    (new.workspace_id, new.id, 'DONE', 3072, true, new.created_by);
  return new;
end;
$$;
create trigger add_default_columns after insert on public.boards for each row execute function private.add_default_columns();

-- A profile deletion must not silently remove the sole workspace owner.
-- Ownership transfer is deliberately outside this MVP.
revoke all on all functions in schema private from public, anon, authenticated;
