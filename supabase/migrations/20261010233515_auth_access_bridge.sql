alter table private.access_users
  add column if not exists responsibilities jsonb not null default '[]'::jsonb,
  add column if not exists operation_owner text,
  add column if not exists substitute_user_id text,
  add column if not exists cedent_documents jsonb not null default '[]'::jsonb,
  add column if not exists revenue_goal_share numeric;

alter table private.access_users
  add constraint access_users_responsibilities_array
  check (jsonb_typeof(responsibilities) = 'array'),
  add constraint access_users_cedent_documents_array
  check (jsonb_typeof(cedent_documents) = 'array');

insert into private.tenants (tenant_id, legal_name, display_name, status)
values ('strato-demo', 'STRATO', 'STRATO', 'active')
on conflict (tenant_id) do update set
  legal_name = excluded.legal_name,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = now();

insert into private.access_users (
  user_id, email, name, role, department, access_level, status,
  manager_user_id, commercial_rep_id, account_manager_id,
  responsibilities, operation_owner, cedent_documents, updated_at
)
values
  (
    'user-henrique-admin', 'henrique@strato.local', 'Henrique', 'Administrador',
    'Diretoria', 'admin', 'active', null, null, null,
    '["Visão consolidada", "Alçadas", "Metas", "Risco", "Liquidez"]'::jsonb,
    null, '[]'::jsonb, now()
  ),
  (
    'user-marina-ops', 'marina.alves@strato.local', 'Marina Alves', 'Analista operacional',
    'Operações', 'operator', 'active', 'user-gestor-ops', null, null,
    '["Esteira", "Pendências operacionais"]'::jsonb,
    'Marina Alves', '[]'::jsonb, now()
  ),
  (
    'user-gestor-ops', 'eduardo.martins@strato.local', 'Eduardo Martins', 'Gerente de operações',
    'Operações', 'manager', 'active', null, null, null,
    '["Equipe operacional", "SLA", "Escalonamentos"]'::jsonb,
    null, '[]'::jsonb, now()
  ),
  (
    'user-rafael-comercial', 'rafael.menezes@strato.local', 'Rafael Menezes', 'Executivo comercial',
    'Comercial', 'operator', 'active', 'user-bruno-contas', 'rep-1', null,
    '["Originação", "Relacionamento"]'::jsonb,
    null, '[]'::jsonb, now()
  ),
  (
    'user-bruno-contas', 'bruno.teixeira@strato.local', 'Bruno Teixeira', 'Gerente de contas',
    'Comercial', 'manager', 'active', null, null, 'rep-3',
    '["Operações recorrentes", "Pós-venda", "Carteira"]'::jsonb,
    null, '[]'::jsonb, now()
  ),
  (
    'user-lucas-risco', 'lucas.ribeiro@strato.local', 'Lucas Ribeiro', 'Analista de risco',
    'Risco e crédito', 'operator', 'active', null, null, null,
    '["Elegibilidade", "Exceções"]'::jsonb,
    null, '[]'::jsonb, now()
  )
on conflict (user_id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  department = excluded.department,
  access_level = excluded.access_level,
  status = excluded.status,
  manager_user_id = excluded.manager_user_id,
  commercial_rep_id = excluded.commercial_rep_id,
  account_manager_id = excluded.account_manager_id,
  responsibilities = excluded.responsibilities,
  operation_owner = excluded.operation_owner,
  cedent_documents = excluded.cedent_documents,
  updated_at = now();

with scopes(user_id, company_scopes) as (
  values
    ('user-henrique-admin', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única", "Órbita Securitizadora S.A.", "Lastro Fomento Mercantil"]'::jsonb),
    ('user-marina-ops', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única", "Órbita Securitizadora S.A.", "Lastro Fomento Mercantil"]'::jsonb),
    ('user-gestor-ops', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única", "Órbita Securitizadora S.A.", "Lastro Fomento Mercantil"]'::jsonb),
    ('user-rafael-comercial', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única", "Órbita Securitizadora S.A.", "Lastro Fomento Mercantil"]'::jsonb),
    ('user-bruno-contas', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única", "Órbita Securitizadora S.A.", "Lastro Fomento Mercantil"]'::jsonb),
    ('user-lucas-risco', '["Lastro Prime FIDC · Classe Sênior", "Aurora Recebíveis FIDC · Classe Única"]'::jsonb)
)
insert into private.tenant_memberships (tenant_id, user_id, company_scopes)
select 'strato-demo', user_id, company_scopes from scopes
on conflict (tenant_id, user_id) do update set
  company_scopes = excluded.company_scopes;

with permissions(user_id, permission) as (
  values
    ('user-henrique-admin', 'dashboard:view'),
    ('user-henrique-admin', 'operations:view'),
    ('user-henrique-admin', 'operations:edit'),
    ('user-henrique-admin', 'risk:decide'),
    ('user-henrique-admin', 'controlleria:formalize'),
    ('user-henrique-admin', 'portfolio:manage'),
    ('user-henrique-admin', 'finance:view'),
    ('user-henrique-admin', 'finance:release'),
    ('user-henrique-admin', 'registry:edit'),
    ('user-henrique-admin', 'settings:manage'),
    ('user-henrique-admin', 'users:manage'),
    ('user-marina-ops', 'dashboard:view'),
    ('user-marina-ops', 'operations:view'),
    ('user-marina-ops', 'operations:edit'),
    ('user-gestor-ops', 'dashboard:view'),
    ('user-gestor-ops', 'operations:view'),
    ('user-gestor-ops', 'operations:edit'),
    ('user-gestor-ops', 'users:manage'),
    ('user-rafael-comercial', 'dashboard:view'),
    ('user-rafael-comercial', 'operations:view'),
    ('user-rafael-comercial', 'portfolio:manage'),
    ('user-bruno-contas', 'dashboard:view'),
    ('user-bruno-contas', 'operations:view'),
    ('user-bruno-contas', 'portfolio:manage'),
    ('user-bruno-contas', 'users:manage'),
    ('user-lucas-risco', 'dashboard:view'),
    ('user-lucas-risco', 'operations:view'),
    ('user-lucas-risco', 'risk:decide')
)
insert into private.access_permissions (tenant_id, user_id, permission)
select 'strato-demo', user_id, permission from permissions
on conflict (tenant_id, user_id, permission) do nothing;

insert into private.authority_assignments (
  tenant_id, user_id, authority_id, valid_from, valid_until
)
values ('strato-demo', 'user-henrique-admin', 'credit-director', now(), null)
on conflict (tenant_id, user_id, authority_id) do nothing;

create or replace function private.strato_current_principal(p_tenant_id text)
returns jsonb
language plpgsql
volatile
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

  update private.access_users
  set auth_user_id = v_auth_user_id, updated_at = now()
  where auth_user_id is null and lower(email) = v_email;

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
    and m.tenant_id = p_tenant_id
    and u.status = 'active'
    and t.status = 'active';

  if v_result is null then
    raise exception using errcode = '42501', message = 'Usuário sem vínculo ativo com esta empresa.';
  end if;

  return v_result;
end;
$$;

create or replace function private.strato_access_directory(p_tenant_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_principal jsonb := private.strato_current_principal(p_tenant_id);
begin
  if not ((v_principal -> 'permissions') ? 'users:manage') then
    raise exception using errcode = '42501', message = 'Usuário sem permissão para administrar acessos.';
  end if;

  return jsonb_build_object(
    'version', 2,
    'authenticatedUserId', v_principal ->> 'id',
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.user_id,
        'email', u.email,
        'name', u.name,
        'role', u.role,
        'department', u.department,
        'access', u.access_level,
        'status', u.status,
        'tenantIds', jsonb_build_array(m.tenant_id),
        'authorityIds', coalesce((
          select jsonb_agg(a.authority_id order by a.authority_id)
          from private.authority_assignments a
          where a.tenant_id = m.tenant_id and a.user_id = u.user_id
        ), '[]'::jsonb),
        'responsibilities', u.responsibilities,
        'operationOwner', u.operation_owner,
        'commercialRepId', u.commercial_rep_id,
        'accountManagerId', u.account_manager_id,
        'companyScopes', m.company_scopes,
        'managerUserId', u.manager_user_id,
        'substituteUserId', u.substitute_user_id,
        'cedentDocuments', u.cedent_documents,
        'revenueGoalShare', u.revenue_goal_share,
        'permissions', coalesce((
          select jsonb_agg(p.permission order by p.permission)
          from private.access_permissions p
          where p.tenant_id = m.tenant_id and p.user_id = u.user_id
        ), '[]'::jsonb)
      ) order by u.name)
      from private.access_users u
      join private.tenant_memberships m on m.user_id = u.user_id
      where m.tenant_id = p_tenant_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.strato_save_access_directory(p_tenant_id text, p_state jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_principal jsonb := private.strato_current_principal(p_tenant_id);
  v_user jsonb;
  v_user_id text;
  v_permission text;
  v_authority_id text;
begin
  if not ((v_principal -> 'permissions') ? 'users:manage') then
    raise exception using errcode = '42501', message = 'Usuário sem permissão para administrar acessos.';
  end if;
  if coalesce((p_state ->> 'version')::integer, 0) <> 2 or jsonb_typeof(p_state -> 'users') <> 'array' then
    raise exception using errcode = '22023', message = 'Diretório de acesso inválido.';
  end if;

  for v_user in select value from jsonb_array_elements(p_state -> 'users')
  loop
    v_user_id := nullif(v_user ->> 'id', '');
    if v_user_id is null or nullif(v_user ->> 'email', '') is null or nullif(v_user ->> 'name', '') is null then
      raise exception using errcode = '22023', message = 'Usuário sem identificação, e-mail ou nome.';
    end if;
    if jsonb_typeof(coalesce(v_user -> 'permissions', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(v_user -> 'companyScopes', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(v_user -> 'authorityIds', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'Escopos, permissões ou alçadas inválidos.';
    end if;
    if v_user_id = (v_principal ->> 'id') and (
      v_user ->> 'status' <> 'active' or not ((v_user -> 'permissions') ? 'users:manage')
    ) then
      raise exception using errcode = '22023', message = 'O administrador não pode remover o próprio acesso.';
    end if;

    insert into private.access_users (
      user_id, email, name, role, department, access_level, status,
      manager_user_id, commercial_rep_id, account_manager_id,
      responsibilities, operation_owner, substitute_user_id, cedent_documents,
      revenue_goal_share, updated_at
    )
    values (
      v_user_id,
      lower(v_user ->> 'email'),
      v_user ->> 'name',
      v_user ->> 'role',
      v_user ->> 'department',
      v_user ->> 'access',
      v_user ->> 'status',
      nullif(v_user ->> 'managerUserId', ''),
      nullif(v_user ->> 'commercialRepId', ''),
      nullif(v_user ->> 'accountManagerId', ''),
      coalesce(v_user -> 'responsibilities', '[]'::jsonb),
      nullif(v_user ->> 'operationOwner', ''),
      nullif(v_user ->> 'substituteUserId', ''),
      coalesce(v_user -> 'cedentDocuments', '[]'::jsonb),
      nullif(v_user ->> 'revenueGoalShare', '')::numeric,
      now()
    )
    on conflict (user_id) do update set
      email = excluded.email,
      name = excluded.name,
      role = excluded.role,
      department = excluded.department,
      access_level = excluded.access_level,
      status = excluded.status,
      manager_user_id = excluded.manager_user_id,
      commercial_rep_id = excluded.commercial_rep_id,
      account_manager_id = excluded.account_manager_id,
      responsibilities = excluded.responsibilities,
      operation_owner = excluded.operation_owner,
      substitute_user_id = excluded.substitute_user_id,
      cedent_documents = excluded.cedent_documents,
      revenue_goal_share = excluded.revenue_goal_share,
      updated_at = excluded.updated_at;

    insert into private.tenant_memberships (tenant_id, user_id, company_scopes)
    values (p_tenant_id, v_user_id, coalesce(v_user -> 'companyScopes', '[]'::jsonb))
    on conflict (tenant_id, user_id) do update set
      company_scopes = excluded.company_scopes;

    delete from private.access_permissions
    where tenant_id = p_tenant_id and user_id = v_user_id;
    for v_permission in select value #>> '{}' from jsonb_array_elements(coalesce(v_user -> 'permissions', '[]'::jsonb))
    loop
      if v_permission <> all(array[
        'dashboard:view', 'operations:view', 'operations:edit', 'risk:decide',
        'controlleria:formalize', 'portfolio:manage', 'finance:view', 'finance:release',
        'registry:edit', 'settings:manage', 'users:manage'
      ]) then
        raise exception using errcode = '22023', message = 'Permissão inválida.';
      end if;
      insert into private.access_permissions (tenant_id, user_id, permission)
      values (p_tenant_id, v_user_id, v_permission);
    end loop;

    delete from private.authority_assignments
    where tenant_id = p_tenant_id and user_id = v_user_id;
    for v_authority_id in select value #>> '{}' from jsonb_array_elements(coalesce(v_user -> 'authorityIds', '[]'::jsonb))
    loop
      insert into private.authority_assignments (
        tenant_id, user_id, authority_id, valid_from, valid_until
      ) values (p_tenant_id, v_user_id, v_authority_id, now(), null);
    end loop;

    insert into private.access_events (
      event_id, tenant_id, actor_id, subject_user_id, event_type, payload
    ) values (
      gen_random_uuid()::text,
      p_tenant_id,
      v_principal ->> 'id',
      v_user_id,
      'ACCESS_PROFILE_SAVED',
      jsonb_build_object(
        'role', v_user ->> 'role',
        'department', v_user ->> 'department',
        'access', v_user ->> 'access',
        'status', v_user ->> 'status',
        'companyScopes', coalesce(v_user -> 'companyScopes', '[]'::jsonb),
        'permissions', coalesce(v_user -> 'permissions', '[]'::jsonb),
        'authorityIds', coalesce(v_user -> 'authorityIds', '[]'::jsonb)
      )
    );
  end loop;

  return private.strato_access_directory(p_tenant_id);
end;
$$;

create or replace function public.strato_current_principal(p_tenant_id text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.strato_current_principal(p_tenant_id);
$$;

create or replace function public.strato_access_directory(p_tenant_id text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.strato_access_directory(p_tenant_id);
$$;

create or replace function public.strato_save_access_directory(p_tenant_id text, p_state jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.strato_save_access_directory(p_tenant_id, p_state);
$$;

revoke all on function private.strato_current_principal(text) from public, anon;
revoke all on function private.strato_access_directory(text) from public, anon;
revoke all on function private.strato_save_access_directory(text, jsonb) from public, anon;
revoke all on function public.strato_current_principal(text) from public, anon;
revoke all on function public.strato_access_directory(text) from public, anon;
revoke all on function public.strato_save_access_directory(text, jsonb) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.strato_current_principal(text) to authenticated;
grant execute on function private.strato_access_directory(text) to authenticated;
grant execute on function private.strato_save_access_directory(text, jsonb) to authenticated;
grant execute on function public.strato_current_principal(text) to authenticated;
grant execute on function public.strato_access_directory(text) to authenticated;
grant execute on function public.strato_save_access_directory(text, jsonb) to authenticated;

comment on function public.strato_current_principal(text) is
  'Resolves the authenticated STRATO principal from a verified Supabase Auth identity.';
comment on function public.strato_access_directory(text) is
  'Returns the tenant access directory only to principals with users:manage.';
comment on function public.strato_save_access_directory(text, jsonb) is
  'Saves tenant access profiles and appends an audit event for each changed user.';
