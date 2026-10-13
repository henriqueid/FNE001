create table private.user_function_assignments (
  tenant_id text not null,
  user_id text not null,
  function_area text not null check (
    function_area in ('Diretoria', 'Operações', 'Risco e crédito', 'Controladoria', 'Financeiro', 'Comercial', 'Cadastro')
  ),
  assigned_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, function_area),
  foreign key (tenant_id, user_id)
    references private.tenant_memberships(tenant_id, user_id) on delete cascade
);

create index user_function_assignments_user_idx
  on private.user_function_assignments(user_id);
create index user_function_assignments_assigned_by_idx
  on private.user_function_assignments(assigned_by);

insert into private.user_function_assignments (tenant_id, user_id, function_area, assigned_by)
select membership.tenant_id, membership.user_id, access_user.department, membership.user_id
from private.tenant_memberships membership
join private.access_users access_user on access_user.user_id = membership.user_id
on conflict do nothing;

alter table private.user_function_assignments enable row level security;
alter table private.user_function_assignments force row level security;
revoke all on private.user_function_assignments from public, anon, authenticated;

comment on table private.user_function_assignments is
  'Áreas funcionais acumuláveis por usuário e tenant usadas no roteamento do Copiloto, notificações e tarefas.';
