create extension if not exists pgcrypto with schema extensions;

-- One bounded counter per user and operation; inaccessible through the Data API.
create table private.invite_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('create', 'inspect', 'accept')),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 1,
  primary key (user_id, operation)
);
alter table private.invite_attempts enable row level security;
revoke all on private.invite_attempts from public, anon, authenticated;

create function private.consume_invite_attempt(target_operation text, max_attempts integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if auth.uid() is null then return false; end if;
  insert into private.invite_attempts as counter(user_id, operation)
    values (auth.uid(), target_operation)
  on conflict (user_id, operation) do update set
    attempts = case when counter.window_started_at < clock_timestamp() - interval '1 minute' then 1 else counter.attempts + 1 end,
    window_started_at = case when counter.window_started_at < clock_timestamp() - interval '1 minute' then clock_timestamp() else counter.window_started_at end
  returning attempts into attempt_count;
  return attempt_count <= max_attempts;
end;
$$;

create function private.create_workspace_invite(target_workspace uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare raw_token text; invitation public.invites;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth_required'); end if;
  if not private.consume_invite_attempt('create', 5) then return jsonb_build_object('error', 'rate_limited'); end if;
  perform 1 from public.workspaces where id = target_workspace and owner_id = auth.uid() for update;
  if not found then return jsonb_build_object('error', 'forbidden'); end if;
  if (select count(*) from public.invites where workspace_id = target_workspace and revoked_at is null and expires_at > now() and use_count < max_uses) >= 20 then
    return jsonb_build_object('error', 'too_many_invites');
  end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites(workspace_id, token_hash, created_by)
    values (target_workspace, encode(extensions.digest(raw_token, 'sha256'), 'hex'), auth.uid())
    returning * into invitation;
  return jsonb_build_object('id', invitation.id, 'token', raw_token, 'expires_at', invitation.expires_at);
end;
$$;

create function private.inspect_workspace_invite(invite_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.invites; workspace_name text; already_member boolean;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth_required'); end if;
  if not private.consume_invite_attempt('inspect', 30) then return jsonb_build_object('error', 'rate_limited'); end if;
  if invite_token is null or invite_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error', 'invalid_invite'); end if;
  select * into invitation from public.invites where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('error', 'invalid_invite'); end if;
  already_member := private.is_workspace_member(invitation.workspace_id);
  if not already_member and (invitation.revoked_at is not null or invitation.expires_at <= now() or invitation.use_count >= invitation.max_uses) then
    return jsonb_build_object('error', 'invalid_invite');
  end if;
  select name into workspace_name from public.workspaces where id = invitation.workspace_id;
  return jsonb_build_object('workspace_id', invitation.workspace_id, 'name', workspace_name, 'already_member', already_member, 'expires_at', invitation.expires_at);
end;
$$;

create function private.accept_workspace_invite(invite_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.invites; target_workspace uuid; inserted_rows integer;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth_required'); end if;
  -- Return failures instead of raising, so failed attempts remain counted.
  if not private.consume_invite_attempt('accept', 10) then return jsonb_build_object('error', 'rate_limited'); end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then return jsonb_build_object('error', 'profile_required'); end if;
  if invite_token is null or invite_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error', 'invalid_invite'); end if;
  select workspace_id into target_workspace from public.invites where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('error', 'invalid_invite'); end if;
  -- Serialize with workspace deletion and other redemptions before locking the invite.
  perform 1 from public.workspaces where id = target_workspace for update;
  if not found then return jsonb_build_object('error', 'invalid_invite'); end if;
  select * into invitation from public.invites where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('error', 'invalid_invite'); end if;
  if private.is_workspace_member(target_workspace) then return jsonb_build_object('workspace_id', target_workspace, 'already_member', true); end if;
  if invitation.revoked_at is not null or invitation.expires_at <= now() or invitation.use_count >= invitation.max_uses then
    return jsonb_build_object('error', 'invalid_invite');
  end if;
  insert into public.workspace_members(workspace_id, user_id, role) values (target_workspace, auth.uid(), 'member') on conflict do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.invites set use_count = use_count + 1 where id = invitation.id;
  end if;
  return jsonb_build_object('workspace_id', target_workspace, 'already_member', inserted_rows = 0);
end;
$$;

-- Only invoker wrappers are exposed. The private implementations still check JWT identity.
create function public.create_workspace_invite(target_workspace uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.create_workspace_invite(target_workspace);
$$;
create function public.inspect_workspace_invite(invite_token text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.inspect_workspace_invite(invite_token);
$$;
create function public.accept_workspace_invite(invite_token text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.accept_workspace_invite(invite_token);
$$;

revoke all on function private.consume_invite_attempt(text, integer) from public, anon, authenticated;
revoke all on function private.create_workspace_invite(uuid), private.inspect_workspace_invite(text), private.accept_workspace_invite(text) from public, anon, authenticated;
revoke all on function public.create_workspace_invite(uuid), public.inspect_workspace_invite(text), public.accept_workspace_invite(text) from public, anon, authenticated;
grant execute on function private.create_workspace_invite(uuid), private.inspect_workspace_invite(text), private.accept_workspace_invite(text) to authenticated;
grant execute on function public.create_workspace_invite(uuid), public.inspect_workspace_invite(text), public.accept_workspace_invite(text) to authenticated;

-- Revocation is permanent through the client API; a new link requires a new token.
create function private.prevent_invite_unrevocation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null then new.revoked_at := old.revoked_at; end if;
  return new;
end;
$$;
revoke all on function private.prevent_invite_unrevocation() from public, anon, authenticated;
create trigger prevent_invite_unrevocation before update of revoked_at on public.invites for each row execute function private.prevent_invite_unrevocation();
