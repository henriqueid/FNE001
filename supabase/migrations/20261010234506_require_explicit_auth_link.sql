create or replace function private.strato_current_principal(p_tenant_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_result jsonb;
begin
  if v_auth_user_id is null or v_email = '' then
    raise exception using errcode = '42501', message = 'Sessão Supabase inválida.';
  end if;

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
  from private.access_users u
  join private.tenant_memberships m on m.user_id = u.user_id
  join private.tenants t on t.tenant_id = m.tenant_id
  where u.auth_user_id = v_auth_user_id
    and lower(u.email) = v_email
    and m.tenant_id = p_tenant_id
    and u.status = 'active'
    and t.status = 'active';

  if v_result is null then
    raise exception using errcode = '42501', message = 'Usuário sem vínculo ativo com esta empresa.';
  end if;

  return v_result;
end;
$$;

comment on function private.strato_current_principal(text) is
  'Resolves only identities explicitly linked by auth_user_id and matching verified email.';
