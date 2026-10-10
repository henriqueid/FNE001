create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

create table private.tenants (
  tenant_id text primary key,
  legal_name text not null,
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.access_users (
  user_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  name text not null,
  role text not null,
  department text not null,
  access_level text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  manager_user_id text references private.access_users(user_id) on delete set null,
  commercial_rep_id text,
  account_manager_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index access_users_email_lower_uidx
  on private.access_users (lower(email));

create table private.tenant_memberships (
  tenant_id text not null references private.tenants(tenant_id) on delete restrict,
  user_id text not null references private.access_users(user_id) on delete restrict,
  company_scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  check (jsonb_typeof(company_scopes) = 'array')
);

create index tenant_memberships_user_idx
  on private.tenant_memberships (user_id, tenant_id);

create table private.access_permissions (
  tenant_id text not null,
  user_id text not null,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, permission),
  foreign key (tenant_id, user_id)
    references private.tenant_memberships(tenant_id, user_id)
    on delete cascade
);

create table private.authority_assignments (
  tenant_id text not null,
  user_id text not null,
  authority_id text not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, authority_id),
  foreign key (tenant_id, user_id)
    references private.tenant_memberships(tenant_id, user_id)
    on delete cascade,
  check (valid_until is null or valid_until > valid_from)
);

create table private.access_events (
  event_id text primary key,
  tenant_id text not null references private.tenants(tenant_id) on delete restrict,
  actor_id text not null,
  subject_user_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object')
);

create index access_events_tenant_created_idx
  on private.access_events (tenant_id, created_at desc);

create table private.decision_events (
  tenant_id text not null references private.tenants(tenant_id) on delete restrict,
  event_id text not null,
  event_version integer not null check (event_version > 0),
  event_type text not null,
  decision_id text not null,
  operation_id text not null,
  entity_refs jsonb not null default '[]'::jsonb,
  decision_type text not null,
  requested_action text not null,
  actor_id text not null,
  actor_role text not null,
  authority_id text,
  policy_id text not null,
  policy_version text not null,
  input_snapshot_id text not null,
  input_snapshot_hash text not null,
  computed_metrics jsonb not null default '{}'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  human_rationale text,
  supporting_evidence_refs jsonb not null default '[]'::jsonb,
  prior_decision_refs jsonb not null default '[]'::jsonb,
  outcome text not null,
  conditions jsonb not null default '[]'::jsonb,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  correlation_id text not null,
  primary key (tenant_id, event_id),
  unique (tenant_id, decision_id, event_version),
  check (jsonb_typeof(entity_refs) = 'array'),
  check (jsonb_typeof(computed_metrics) = 'object'),
  check (jsonb_typeof(reason_codes) = 'array'),
  check (jsonb_typeof(supporting_evidence_refs) = 'array'),
  check (jsonb_typeof(prior_decision_refs) = 'array'),
  check (jsonb_typeof(conditions) = 'array'),
  check (valid_until is null or valid_until > valid_from)
);

create index decision_events_tenant_decision_idx
  on private.decision_events (tenant_id, decision_id, event_version);

create index decision_events_tenant_operation_idx
  on private.decision_events (tenant_id, operation_id, created_at desc);

create table private.decision_idempotency (
  tenant_id text not null,
  idempotency_key text not null,
  event_id text not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key),
  foreign key (tenant_id, event_id)
    references private.decision_events(tenant_id, event_id)
    on delete restrict
);

create table private.decision_outbox (
  tenant_id text not null,
  outbox_id text not null,
  topic text not null,
  aggregate_id text not null,
  event_id text not null,
  payload jsonb not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  primary key (tenant_id, outbox_id),
  unique (tenant_id, event_id, topic),
  foreign key (tenant_id, event_id)
    references private.decision_events(tenant_id, event_id)
    on delete restrict,
  check (jsonb_typeof(payload) = 'object')
);

create index decision_outbox_pending_idx
  on private.decision_outbox (status, available_at, tenant_id);

create table private.decision_notifications (
  tenant_id text not null,
  notification_id text not null,
  source_outbox_id text not null,
  source_event_id text not null,
  decision_id text not null,
  operation_id text not null,
  kind text not null
    check (kind in ('decision', 'release', 'pace', 'collection')),
  tone text not null
    check (tone in ('critical', 'warning', 'info', 'good')),
  title text not null,
  summary text not null,
  detail text not null,
  impact text not null,
  next_action text not null,
  owner text not null,
  department text not null,
  timing text not null,
  view_name text not null,
  required_permission text,
  authority_id text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (tenant_id, notification_id),
  unique (tenant_id, source_outbox_id),
  foreign key (tenant_id, source_outbox_id)
    references private.decision_outbox(tenant_id, outbox_id)
    on delete restrict
);

create index decision_notifications_open_idx
  on private.decision_notifications (tenant_id, status, created_at desc);

create index decision_notifications_decision_idx
  on private.decision_notifications (tenant_id, decision_id, status);

create function private.prevent_append_only_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I.%I is append-only', tg_table_schema, tg_table_name);
end;
$$;

revoke execute on function private.prevent_append_only_mutation() from public;
revoke execute on function private.prevent_append_only_mutation() from anon;
revoke execute on function private.prevent_append_only_mutation() from authenticated;

create trigger access_events_prevent_update_delete
before update or delete on private.access_events
for each row execute function private.prevent_append_only_mutation();

create trigger decision_events_prevent_update_delete
before update or delete on private.decision_events
for each row execute function private.prevent_append_only_mutation();

alter table private.tenants enable row level security;
alter table private.access_users enable row level security;
alter table private.tenant_memberships enable row level security;
alter table private.access_permissions enable row level security;
alter table private.authority_assignments enable row level security;
alter table private.access_events enable row level security;
alter table private.decision_events enable row level security;
alter table private.decision_idempotency enable row level security;
alter table private.decision_outbox enable row level security;
alter table private.decision_notifications enable row level security;

comment on schema private is
  'STRATO internal application data. Not exposed through the Supabase Data API.';
comment on table private.decision_events is
  'Append-only decision ledger. Updates and deletes are rejected by trigger.';
comment on table private.access_events is
  'Append-only audit trail for access and authorization changes.';
