create table private.intelligence_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  contracted boolean not null default false,
  enabled boolean not null default false,
  status text not null default 'AI_DISABLED'
    check (status in ('AI_DISABLED', 'AI_AVAILABLE', 'AI_DEGRADED', 'AI_UNAVAILABLE', 'AI_PROCESSING')),
  monthly_token_budget bigint not null default 0 check (monthly_token_budget >= 0),
  used_tokens bigint not null default 0 check (used_tokens >= 0),
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  updated_by text references private.access_users(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  check (contracted or not enabled),
  check (enabled or status = 'AI_DISABLED')
);

create index intelligence_states_updated_by_idx
  on private.intelligence_states(updated_by);

alter table private.intelligence_states enable row level security;
alter table private.intelligence_states force row level security;

revoke all on private.intelligence_states from public, anon, authenticated;

comment on table private.intelligence_states is
  'Configuração persistente da licença, ativação, disponibilidade e orçamento de IA por organização.';
