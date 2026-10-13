create table private.portfolio_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.portfolio_collection_occurrences (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  occurrence_id text not null,
  title_id text not null,
  charged_at timestamptz not null,
  channel text not null,
  outcome text not null,
  next_contact_at timestamptz not null,
  created_by text not null references private.access_users(user_id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  primary key (tenant_id, occurrence_id)
);

create table private.portfolio_confirmations (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  title_id text not null,
  status text not null,
  updated_by text not null references private.access_users(user_id),
  updated_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (tenant_id, title_id)
);

create table private.portfolio_maintenance_events (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  event_id text not null,
  title_id text not null,
  occurred_at timestamptz not null,
  actor_id text references private.access_users(user_id),
  actor_name text not null,
  action text not null,
  detail text not null,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, event_id)
);

create table private.portfolio_commands (
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
  foreign key (tenant_id, event_id) references private.domain_events(tenant_id, event_id) on delete restrict
);

create index portfolio_states_created_by_idx on private.portfolio_states(created_by);
create index portfolio_states_updated_by_idx on private.portfolio_states(updated_by);
create index portfolio_collection_title_idx on private.portfolio_collection_occurrences(tenant_id, title_id, charged_at desc);
create index portfolio_collection_created_by_idx on private.portfolio_collection_occurrences(created_by);
create index portfolio_confirmations_updated_by_idx on private.portfolio_confirmations(updated_by);
create index portfolio_maintenance_title_idx on private.portfolio_maintenance_events(tenant_id, title_id, occurred_at desc);
create index portfolio_maintenance_actor_idx on private.portfolio_maintenance_events(actor_id);
create index portfolio_commands_event_idx on private.portfolio_commands(tenant_id, event_id);
create index portfolio_commands_actor_idx on private.portfolio_commands(actor_id);

create trigger portfolio_collection_prevent_update_delete before update or delete on private.portfolio_collection_occurrences
for each row execute function private.prevent_append_only_mutation();
create trigger portfolio_maintenance_events_prevent_update_delete before update or delete on private.portfolio_maintenance_events
for each row execute function private.prevent_append_only_mutation();
create trigger portfolio_commands_prevent_update_delete before update or delete on private.portfolio_commands
for each row execute function private.prevent_append_only_mutation();

alter table private.portfolio_states enable row level security;
alter table private.portfolio_states force row level security;
alter table private.portfolio_collection_occurrences enable row level security;
alter table private.portfolio_collection_occurrences force row level security;
alter table private.portfolio_confirmations enable row level security;
alter table private.portfolio_confirmations force row level security;
alter table private.portfolio_maintenance_events enable row level security;
alter table private.portfolio_maintenance_events force row level security;
alter table private.portfolio_commands enable row level security;
alter table private.portfolio_commands force row level security;

revoke all on private.portfolio_states from public, anon, authenticated;
revoke all on private.portfolio_collection_occurrences from public, anon, authenticated;
revoke all on private.portfolio_confirmations from public, anon, authenticated;
revoke all on private.portfolio_maintenance_events from public, anon, authenticated;
revoke all on private.portfolio_commands from public, anon, authenticated;

comment on table private.portfolio_states is 'Agregado versionado da manutenção operacional da Carteira.';
comment on table private.portfolio_collection_occurrences is 'Ocorrências append-only de cobrança por título.';
comment on table private.portfolio_confirmations is 'Última confirmação de lastro registrada pela Controladoria.';
comment on table private.portfolio_maintenance_events is 'Histórico append-only das ações operacionais por título.';
comment on table private.portfolio_commands is 'Recibos imutáveis para repetição idempotente de comandos da Carteira.';
