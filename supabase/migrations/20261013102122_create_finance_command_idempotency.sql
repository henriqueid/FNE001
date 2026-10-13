create table private.finance_commands (
  tenant_id text not null references private.finance_states(tenant_id) on delete restrict,
  command_id text not null,
  command_type text not null check (command_type in ('FINANCE_STATE_CHANGE')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expected_version integer not null check (expected_version >= 0),
  result_version integer not null check (result_version > 0),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  event_id text not null,
  actor_id text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, command_id),
  foreign key (tenant_id, event_id)
    references private.domain_events(tenant_id, event_id)
    on delete restrict
);

create index finance_commands_actor_idx on private.finance_commands(actor_id);
create index finance_commands_event_idx on private.finance_commands(tenant_id, event_id);
create index finance_commands_created_idx on private.finance_commands(tenant_id, created_at desc);

alter table private.finance_commands enable row level security;
alter table private.finance_commands force row level security;
revoke all on private.finance_commands from public, anon, authenticated;

comment on table private.finance_commands is
  'Recibos imutáveis de comandos financeiros para repetição segura sem duplicar baixa, liberação ou lançamento.';
