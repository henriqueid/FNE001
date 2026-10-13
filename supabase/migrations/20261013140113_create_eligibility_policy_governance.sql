create table private.policy_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.eligibility_policies (
  tenant_id text not null,
  policy_id text not null,
  name text not null check (length(trim(name)) > 0),
  version_label text not null check (length(trim(version_label)) > 0),
  layer text not null check (layer in ('UNIVERSAL', 'MODALIDADE', 'INSTITUICAO', 'PRODUTO', 'CARTEIRA')),
  modality text,
  company text,
  product text,
  effective_from date not null,
  effective_to date,
  status text not null check (status in ('RASCUNHO', 'ATIVA', 'ENCERRADA')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, policy_id),
  foreign key (tenant_id) references private.policy_states(tenant_id) on delete cascade,
  check (effective_to is null or effective_to >= effective_from),
  check ((status = 'RASCUNHO') = (effective_to is null and not (snapshot ? 'approval')) or status <> 'RASCUNHO')
);

create unique index eligibility_policies_active_scope_uidx
  on private.eligibility_policies (
    tenant_id,
    layer,
    coalesce(modality, ''),
    coalesce(company, ''),
    coalesce(product, '')
  ) where status = 'ATIVA';

create table private.eligibility_policy_bindings (
  tenant_id text not null,
  policy_id text not null,
  rule_id text not null,
  enabled boolean not null,
  operator text check (operator is null or operator in ('EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN')),
  parameter jsonb not null,
  failure_outcome text not null check (failure_outcome in ('ALERTA', 'EXCECAO', 'REPROVADO')),
  action text not null check (action in ('CONTINUAR', 'SINALIZAR', 'SOLICITAR_DECISAO', 'BLOQUEAR')),
  override_allowed boolean not null,
  override_authority text,
  primary key (tenant_id, policy_id, rule_id),
  foreign key (tenant_id, policy_id)
    references private.eligibility_policies(tenant_id, policy_id) on delete restrict
);

create table private.policy_approvals (
  tenant_id text not null,
  policy_id text not null,
  approved_by text not null references private.access_users(user_id) on delete restrict,
  approved_by_name text not null check (length(trim(approved_by_name)) > 0),
  approved_at timestamptz not null,
  justification text not null check (length(trim(justification)) >= 10),
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, policy_id),
  foreign key (tenant_id, policy_id)
    references private.eligibility_policies(tenant_id, policy_id) on delete restrict
);

create table private.policy_commands (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  command_id text not null,
  request_hash text not null check (length(request_hash) = 64),
  expected_version integer not null check (expected_version >= 0),
  result_version integer not null check (result_version > 0),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  event_id text not null,
  actor_id text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, command_id),
  foreign key (tenant_id, event_id)
    references private.domain_events(tenant_id, event_id) on delete restrict
);

create index policy_states_created_by_idx on private.policy_states(created_by);
create index policy_states_updated_by_idx on private.policy_states(updated_by);
create index eligibility_policies_scope_idx
  on private.eligibility_policies(tenant_id, company, product, status, effective_from desc);
create index policy_approvals_approved_by_idx on private.policy_approvals(approved_by);
create index policy_commands_event_idx on private.policy_commands(tenant_id, event_id);
create index policy_commands_actor_idx on private.policy_commands(actor_id);

create trigger policy_approvals_prevent_update_delete
before update or delete on private.policy_approvals
for each row execute function private.prevent_append_only_mutation();

create trigger policy_commands_prevent_update_delete
before update or delete on private.policy_commands
for each row execute function private.prevent_append_only_mutation();

alter table private.policy_states enable row level security;
alter table private.policy_states force row level security;
alter table private.eligibility_policies enable row level security;
alter table private.eligibility_policies force row level security;
alter table private.eligibility_policy_bindings enable row level security;
alter table private.eligibility_policy_bindings force row level security;
alter table private.policy_approvals enable row level security;
alter table private.policy_approvals force row level security;
alter table private.policy_commands enable row level security;
alter table private.policy_commands force row level security;

revoke all on private.policy_states from public, anon, authenticated;
revoke all on private.eligibility_policies from public, anon, authenticated;
revoke all on private.eligibility_policy_bindings from public, anon, authenticated;
revoke all on private.policy_approvals from public, anon, authenticated;
revoke all on private.policy_commands from public, anon, authenticated;

comment on table private.policy_states is 'Agregado versionado das políticas de elegibilidade por tenant.';
comment on table private.eligibility_policies is 'Projeção consultável de versões, escopos e vigências das políticas.';
comment on table private.eligibility_policy_bindings is 'Parâmetros versionados das regras ligadas a cada política.';
comment on table private.policy_approvals is 'Aprovações append-only responsáveis por publicar versões de política.';
comment on table private.policy_commands is 'Recibos imutáveis para repetição idempotente de comandos de política.';
