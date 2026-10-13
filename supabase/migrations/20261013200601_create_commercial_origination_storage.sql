create table private.commercial_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.commercial_prospects (
  tenant_id text not null,
  prospect_id text not null,
  document_digits text,
  name text not null check (length(trim(name)) > 1),
  representative_id text not null,
  stage text not null check (stage in ('Lead', 'Visita', 'Proposta', 'Comitê', 'Aprovado')),
  potential numeric(18,2) not null default 0 check (potential >= 0),
  lost_reason text,
  converted_at date,
  rejected_at date,
  dossier jsonb,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, prospect_id),
  foreign key (tenant_id) references private.commercial_states(tenant_id) on delete cascade,
  check (document_digits is null or document_digits ~ '^[0-9]{14}$')
);

create table private.commercial_committees (
  tenant_id text not null,
  committee_id text not null,
  prospect_id text,
  document_digits text,
  client_name text not null,
  representative_id text not null,
  meeting_date date not null,
  request_type text not null,
  requested_amount numeric(18,2) not null default 0,
  approved_amount numeric(18,2),
  status text not null check (status in ('Em pauta', 'Aprovado', 'Aprovado com ressalvas', 'Reprovado', 'Adiado')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  decided_at date,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, committee_id),
  foreign key (tenant_id) references private.commercial_states(tenant_id) on delete cascade,
  check (document_digits is null or document_digits ~ '^[0-9]{14}$')
);

create table private.commercial_commands (
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

create index commercial_states_created_by_idx on private.commercial_states(created_by);
create index commercial_states_updated_by_idx on private.commercial_states(updated_by);
create index commercial_prospects_stage_idx on private.commercial_prospects(tenant_id, stage, updated_at desc) where lost_reason is null;
create index commercial_prospects_document_idx on private.commercial_prospects(tenant_id, document_digits) where document_digits is not null;
create index commercial_committees_status_date_idx on private.commercial_committees(tenant_id, status, meeting_date);
create index commercial_committees_document_idx on private.commercial_committees(tenant_id, document_digits) where document_digits is not null;
create index commercial_commands_event_idx on private.commercial_commands(tenant_id, event_id);
create index commercial_commands_actor_idx on private.commercial_commands(actor_id);

create trigger commercial_commands_prevent_update_delete
before update or delete on private.commercial_commands
for each row execute function private.prevent_append_only_mutation();

alter table private.commercial_states enable row level security;
alter table private.commercial_states force row level security;
alter table private.commercial_prospects enable row level security;
alter table private.commercial_prospects force row level security;
alter table private.commercial_committees enable row level security;
alter table private.commercial_committees force row level security;
alter table private.commercial_commands enable row level security;
alter table private.commercial_commands force row level security;

revoke all on private.commercial_states from public, anon, authenticated;
revoke all on private.commercial_prospects from public, anon, authenticated;
revoke all on private.commercial_committees from public, anon, authenticated;
revoke all on private.commercial_commands from public, anon, authenticated;

comment on table private.commercial_states is 'Agregado versionado do Comercial por empresa.';
comment on table private.commercial_prospects is 'Projeção de leads, dossiês e conversões da esteira comercial.';
comment on table private.commercial_committees is 'Projeção da pauta, decisões e histórico dos comitês comerciais.';
comment on table private.commercial_commands is 'Recibos imutáveis dos comandos idempotentes do Comercial.';
