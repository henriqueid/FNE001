create table private.operational_parameter_commands (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  command_id text not null,
  request_hash text not null check (length(request_hash) = 64),
  expected_version integer not null check (expected_version >= 0),
  result_version integer not null check (result_version > 0),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  event_id text not null,
  actor_id text not null references private.access_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, command_id)
);

create index operational_parameter_commands_actor_idx
  on private.operational_parameter_commands(actor_id);
create index operational_parameter_commands_event_idx
  on private.operational_parameter_commands(tenant_id, event_id);

alter table private.operational_parameter_commands enable row level security;
alter table private.operational_parameter_commands force row level security;

revoke all on private.operational_parameter_commands from public, anon, authenticated;

comment on table private.operational_parameter_commands is
  'Registro idempotente das gravações diretas dos padrões operacionais por usuários autorizados.';
