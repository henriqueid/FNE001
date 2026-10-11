alter table private.access_users drop constraint if exists access_users_status_check;
alter table private.access_users
  add constraint access_users_status_check check (status in ('pending', 'active', 'suspended'));

comment on column private.access_users.auth_user_id is
  'Legacy Supabase Auth link retained temporarily for rollback safety. STRATO internal authentication does not use it.';

create table if not exists private.access_credentials (
  user_id text primary key references private.access_users(user_id) on delete restrict,
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index access_credentials_status_idx
  on private.access_credentials (status, locked_until);

create table if not exists private.app_sessions (
  token_hash text primary key check (length(token_hash) = 64),
  user_id text not null references private.access_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index app_sessions_user_active_idx
  on private.app_sessions (user_id, expires_at desc)
  where revoked_at is null;

alter table private.access_credentials enable row level security;
alter table private.app_sessions enable row level security;

comment on table private.access_credentials is
  'STRATO-owned credentials. Password hashes never leave server-only operations.';
comment on table private.app_sessions is
  'Opaque STRATO sessions stored as SHA-256 token hashes; raw tokens exist only in HttpOnly cookies.';

create or replace function private.strato_internal_principal(p_tenant_id text, p_token_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  update private.app_sessions
  set last_seen_at = now()
  where token_hash = p_token_hash
    and revoked_at is null
    and expires_at > now();

  select jsonb_build_object(
    'id', u.user_id,
    'name', u.name,
    'role', u.role,
    'department', u.department,
    'access', u.access_level,
    'status', u.status,
    'tenantId', m.tenant_id,
    'permissions', coalesce((
      select jsonb_agg(p.permission order by p.permission)
      from private.access_permissions p
      where p.tenant_id = m.tenant_id and p.user_id = u.user_id
    ), '[]'::jsonb),
    'authorityIds', coalesce((
      select jsonb_agg(a.authority_id order by a.authority_id)
      from private.authority_assignments a
      where a.tenant_id = m.tenant_id
        and a.user_id = u.user_id
        and a.valid_from <= now()
        and (a.valid_until is null or a.valid_until >= now())
    ), '[]'::jsonb)
  )
  into v_result
  from private.app_sessions s
  join private.access_users u on u.user_id = s.user_id
  join private.tenant_memberships m on m.user_id = u.user_id and m.tenant_id = p_tenant_id
  join private.tenants t on t.tenant_id = m.tenant_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
    and t.status = 'active';

  return v_result;
end;
$$;

create or replace function public.strato_internal_principal(p_tenant_id text, p_token_hash text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.strato_internal_principal(p_tenant_id, p_token_hash);
$$;

revoke all on table private.access_credentials from public, anon, authenticated;
revoke all on table private.app_sessions from public, anon, authenticated;
revoke all on function private.strato_internal_principal(text, text) from public, anon, authenticated;
revoke all on function public.strato_internal_principal(text, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.strato_internal_principal(text, text) to service_role;
grant execute on function public.strato_internal_principal(text, text) to service_role;
