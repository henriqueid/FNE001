create table private.import_batches (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  batch_id text not null,
  import_type text not null check (import_type in ('PORTFOLIO_SNAPSHOT', 'PARTY_MASTER', 'OPERATION_INTAKE')),
  source_system text not null,
  position_date date not null,
  status text not null check (status in ('VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED')),
  file_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(file_manifest) = 'array'),
  control_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(control_totals) = 'object'),
  result_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(result_counts) = 'object'),
  quality_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(quality_summary) = 'object'),
  created_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (tenant_id, batch_id)
);

create table private.party_source_refs (
  tenant_id text not null,
  source_system text not null,
  source_role text not null check (source_role in ('CEDENTE', 'SACADO')),
  external_code text not null,
  party_id text not null,
  source_status text not null,
  raw_name text not null,
  import_batch_id text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, source_system, source_role, external_code),
  foreign key (tenant_id, party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict,
  foreign key (tenant_id, import_batch_id)
    references private.import_batches(tenant_id, batch_id)
    on delete restrict
);

create table private.party_role_states (
  tenant_id text not null,
  party_id text not null,
  role text not null check (role in ('cedente', 'sacado')),
  source_status text not null,
  normalized_status text not null check (normalized_status in ('ACTIVE', 'INACTIVE', 'BLOCKED', 'UNKNOWN')),
  import_batch_id text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, party_id, role),
  foreign key (tenant_id, party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict,
  foreign key (tenant_id, import_batch_id)
    references private.import_batches(tenant_id, batch_id)
    on delete restrict
);

create table private.data_quality_issues (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  issue_id text not null,
  import_batch_id text,
  entity_type text not null,
  entity_id text not null,
  issue_code text not null,
  severity text not null check (severity in ('INFO', 'WARNING', 'BLOCKING')),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text references private.access_users(user_id),
  primary key (tenant_id, issue_id),
  foreign key (tenant_id, import_batch_id)
    references private.import_batches(tenant_id, batch_id)
    on delete restrict
);

create table private.portfolio_titles (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  title_id text not null,
  canonical_key text not null,
  cedent_party_id text not null,
  debtor_party_id text not null,
  source_cedent_code text not null,
  source_debtor_code text not null,
  document_number text not null,
  source_sequence text not null,
  receivable_type text not null,
  negotiation_date date not null,
  original_due_date date not null,
  current_due_date date not null,
  original_amount numeric(18, 2) not null check (original_amount > 0),
  wallet_code text not null default '',
  internal_wallet text not null default '',
  economic_group text not null default '',
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, title_id),
  unique (tenant_id, canonical_key),
  foreign key (tenant_id, cedent_party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict,
  foreign key (tenant_id, debtor_party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict
);

create table private.portfolio_title_positions (
  tenant_id text not null,
  import_batch_id text not null,
  title_id text not null,
  position_date date not null,
  source_status text not null,
  lifecycle_status text not null check (lifecycle_status in ('OPEN', 'SETTLED', 'CANCELLED', 'UNKNOWN')),
  open_amount numeric(18, 2) not null check (open_amount >= 0),
  present_amount numeric(18, 2) not null check (present_amount >= 0),
  paid_amount numeric(18, 2) not null check (paid_amount >= 0),
  discount_amount numeric(18, 2) not null check (discount_amount >= 0),
  discount_income numeric(18, 2) not null check (discount_income >= 0),
  late_fee_amount numeric(18, 2) not null check (late_fee_amount >= 0),
  monetary_correction_amount numeric(18, 2) not null check (monetary_correction_amount >= 0),
  source_delay_days integer,
  computed_days_past_due integer not null check (computed_days_past_due >= 0),
  collection_agreement boolean not null default false,
  collection_status text not null default '',
  score numeric,
  liquidation_date date,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, import_batch_id, title_id),
  foreign key (tenant_id, import_batch_id)
    references private.import_batches(tenant_id, batch_id)
    on delete restrict,
  foreign key (tenant_id, title_id)
    references private.portfolio_titles(tenant_id, title_id)
    on delete restrict
);

create table private.integration_provider_configs (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  provider_id text not null,
  capability text not null check (capability in ('CNPJ_LOOKUP')),
  status text not null check (status in ('PLANNED', 'ACTIVE', 'DEGRADED', 'SUSPENDED')),
  priority integer not null check (priority > 0),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by text not null references private.access_users(user_id),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider_id, capability)
);

create table private.cnpj_enrichment_jobs (
  tenant_id text not null,
  job_id text not null,
  party_id text not null,
  provider_id text not null,
  capability text not null default 'CNPJ_LOOKUP',
  status text not null check (status in ('QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRY', 'DEAD')),
  priority integer not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  requested_by text not null references private.access_users(user_id),
  correlation_id text not null,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  primary key (tenant_id, job_id),
  foreign key (tenant_id, party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict,
  foreign key (tenant_id, provider_id, capability)
    references private.integration_provider_configs(tenant_id, provider_id, capability)
    on delete restrict,
  constraint cnpj_enrichment_jobs_capability check (capability = 'CNPJ_LOOKUP')
);

create table private.company_evidence_snapshots (
  tenant_id text not null,
  evidence_id text not null,
  party_id text not null,
  provider_id text not null,
  registration_number text not null,
  provider_status text not null,
  fetched_at timestamptz not null,
  source_updated_at timestamptz,
  expires_at timestamptz,
  response_hash text not null,
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, evidence_id),
  unique (tenant_id, party_id, provider_id, response_hash),
  foreign key (tenant_id, party_id)
    references private.registry_parties(tenant_id, party_id)
    on delete restrict
);

insert into private.integration_provider_configs
  (tenant_id, provider_id, capability, status, priority, config, updated_by)
select t.tenant_id, p.provider_id, 'CNPJ_LOOKUP', p.status, p.priority, p.config, u.user_id
from private.tenants t
cross join lateral (
  select user_id
  from private.tenant_memberships
  where tenant_id = t.tenant_id
  order by created_at
  limit 1
) u
cross join (values
  ('BRASIL_API', 'ACTIVE', 10, '{"cacheDays":30,"timeoutMs":12000}'::jsonb),
  ('RECEITA_WS', 'PLANNED', 20, '{"cacheDays":30,"timeoutMs":15000}'::jsonb),
  ('SERPRO_CNPJ', 'PLANNED', 30, '{"official":true,"requiresContract":true}'::jsonb)
) as p(provider_id, status, priority, config)
on conflict do nothing;

create index import_batches_status_idx
  on private.import_batches(tenant_id, status, position_date desc);
create index party_source_refs_party_idx
  on private.party_source_refs(tenant_id, party_id);
create index party_source_refs_batch_idx
  on private.party_source_refs(tenant_id, import_batch_id);
create index party_role_states_batch_idx
  on private.party_role_states(tenant_id, import_batch_id);
create index data_quality_issues_open_idx
  on private.data_quality_issues(tenant_id, status, severity, created_at desc);
create index data_quality_issues_batch_idx
  on private.data_quality_issues(tenant_id, import_batch_id);
create index data_quality_issues_resolved_by_idx
  on private.data_quality_issues(resolved_by);
create index portfolio_titles_cedent_idx
  on private.portfolio_titles(tenant_id, cedent_party_id, current_due_date);
create index portfolio_titles_debtor_idx
  on private.portfolio_titles(tenant_id, debtor_party_id, current_due_date);
create index portfolio_titles_updated_by_idx on private.portfolio_titles(updated_by);
create index portfolio_titles_created_by_idx on private.portfolio_titles(created_by);
create index portfolio_positions_snapshot_idx
  on private.portfolio_title_positions(tenant_id, position_date desc, lifecycle_status);
create index portfolio_positions_title_idx
  on private.portfolio_title_positions(tenant_id, title_id, position_date desc);
create index cnpj_jobs_queue_idx
  on private.cnpj_enrichment_jobs(status, available_at, priority, tenant_id);
create index cnpj_jobs_party_idx
  on private.cnpj_enrichment_jobs(tenant_id, party_id, created_at desc);
create unique index cnpj_jobs_active_unique
  on private.cnpj_enrichment_jobs(tenant_id, party_id, provider_id)
  where status in ('QUEUED', 'RUNNING', 'RETRY');
create index company_evidence_party_idx
  on private.company_evidence_snapshots(tenant_id, party_id, fetched_at desc);
create index company_evidence_created_by_idx on private.company_evidence_snapshots(created_by);

create trigger portfolio_title_positions_prevent_update_delete
before update or delete on private.portfolio_title_positions
for each row execute function private.prevent_append_only_mutation();

create trigger company_evidence_snapshots_prevent_update_delete
before update or delete on private.company_evidence_snapshots
for each row execute function private.prevent_append_only_mutation();

alter table private.import_batches enable row level security;
alter table private.import_batches force row level security;
alter table private.party_source_refs enable row level security;
alter table private.party_source_refs force row level security;
alter table private.party_role_states enable row level security;
alter table private.party_role_states force row level security;
alter table private.data_quality_issues enable row level security;
alter table private.data_quality_issues force row level security;
alter table private.portfolio_titles enable row level security;
alter table private.portfolio_titles force row level security;
alter table private.portfolio_title_positions enable row level security;
alter table private.portfolio_title_positions force row level security;
alter table private.integration_provider_configs enable row level security;
alter table private.integration_provider_configs force row level security;
alter table private.cnpj_enrichment_jobs enable row level security;
alter table private.cnpj_enrichment_jobs force row level security;
alter table private.company_evidence_snapshots enable row level security;
alter table private.company_evidence_snapshots force row level security;

revoke all on private.import_batches from public, anon, authenticated;
revoke all on private.party_source_refs from public, anon, authenticated;
revoke all on private.party_role_states from public, anon, authenticated;
revoke all on private.data_quality_issues from public, anon, authenticated;
revoke all on private.portfolio_titles from public, anon, authenticated;
revoke all on private.portfolio_title_positions from public, anon, authenticated;
revoke all on private.integration_provider_configs from public, anon, authenticated;
revoke all on private.cnpj_enrichment_jobs from public, anon, authenticated;
revoke all on private.company_evidence_snapshots from public, anon, authenticated;

comment on table private.import_batches is 'Lotes rastreáveis de carga e snapshots oficiais de posição.';
comment on table private.party_source_refs is 'Vínculos entre a identidade canônica e os códigos legados de cedente/sacado.';
comment on table private.portfolio_titles is 'Identidade estável dos títulos importados ou originados no STRATO.';
comment on table private.portfolio_title_positions is 'Snapshots append-only de saldo e situação por título e lote.';
comment on table private.cnpj_enrichment_jobs is 'Fila controlada de consultas cadastrais externas por CNPJ.';
comment on table private.company_evidence_snapshots is 'Evidência imutável das respostas externas normalizadas e originais.';
