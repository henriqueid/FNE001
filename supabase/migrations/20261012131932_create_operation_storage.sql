create table private.operations (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  operation_id text not null,
  vehicle text not null,
  institution text not null check (institution in ('FIDC', 'Securitizadora', 'Factoring')),
  cedent_document text not null,
  status text not null,
  stage integer not null check (stage between 1 and 6),
  amount numeric(18, 2) not null check (amount >= 0),
  title_count integer not null check (title_count >= 0),
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, operation_id)
);

create table private.operation_events (
  tenant_id text not null,
  event_id text not null,
  operation_id text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  event_type text not null,
  actor_id text not null references private.access_users(user_id),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  unique (tenant_id, operation_id, aggregate_version),
  foreign key (tenant_id, operation_id)
    references private.operations(tenant_id, operation_id)
    on delete restrict
);

create table private.domain_outbox (
  tenant_id text not null,
  outbox_id text not null,
  event_id text not null,
  topic text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'PENDING' check (status in ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  primary key (tenant_id, outbox_id),
  unique (tenant_id, event_id, topic),
  foreign key (tenant_id, event_id)
    references private.operation_events(tenant_id, event_id)
    on delete restrict
);

create index operations_tenant_status_idx on private.operations(tenant_id, status, updated_at desc);
create index operations_tenant_vehicle_idx on private.operations(tenant_id, vehicle, updated_at desc);
create index operations_tenant_cedent_idx on private.operations(tenant_id, cedent_document, updated_at desc);
create index operation_events_operation_idx on private.operation_events(tenant_id, operation_id, aggregate_version);
create index domain_outbox_pending_idx on private.domain_outbox(status, available_at, tenant_id);

create trigger operation_events_prevent_update_delete
before update or delete on private.operation_events
for each row execute function private.prevent_append_only_mutation();

alter table private.operations enable row level security;
alter table private.operations force row level security;
alter table private.operation_events enable row level security;
alter table private.operation_events force row level security;
alter table private.domain_outbox enable row level security;
alter table private.domain_outbox force row level security;

revoke all on private.operations from public, anon, authenticated;
revoke all on private.operation_events from public, anon, authenticated;
revoke all on private.domain_outbox from public, anon, authenticated;

comment on table private.operations is 'Agregado operacional atual, isolado por tenant e protegido por versao otimista.';
comment on table private.operation_events is 'Historico imutavel de cada versao aceita do agregado Operation.';
comment on table private.domain_outbox is 'Fila transacional generica para publicar eventos materiais dos dominios STRATO.';
