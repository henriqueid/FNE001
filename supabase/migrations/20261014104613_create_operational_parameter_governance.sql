create table private.operational_parameter_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id) on delete restrict,
  updated_by text not null references private.access_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.operational_parameter_change_requests (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  change_id text not null,
  command_id text not null,
  request_hash text not null check (length(request_hash) = 64),
  expected_version integer not null check (expected_version >= 0),
  previous_payload jsonb not null check (jsonb_typeof(previous_payload) = 'object'),
  proposed_payload jsonb not null check (jsonb_typeof(proposed_payload) = 'object'),
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by text not null references private.access_users(user_id) on delete restrict,
  requested_by_name text not null check (length(trim(requested_by_name)) > 0),
  requested_at timestamptz not null default now(),
  decided_by text references private.access_users(user_id) on delete restrict,
  decided_by_name text,
  decided_at timestamptz,
  decision_reason text,
  applied_version integer check (applied_version > 0),
  primary key (tenant_id, change_id),
  unique (tenant_id, command_id),
  check (previous_payload <> proposed_payload),
  check (decided_by is null or decided_by <> requested_by),
  check (
    (status = 'PENDING' and decided_by is null and decided_by_name is null
      and decided_at is null and decision_reason is null and applied_version is null)
    or
    (status = 'APPROVED' and decided_by is not null and decided_by_name is not null
      and decided_at is not null and length(trim(decision_reason)) >= 5 and applied_version is not null)
    or
    (status = 'REJECTED' and decided_by is not null and decided_by_name is not null
      and decided_at is not null and length(trim(decision_reason)) >= 5 and applied_version is null)
  )
);

create unique index operational_parameter_change_pending_uidx
  on private.operational_parameter_change_requests(tenant_id)
  where status = 'PENDING';
create index operational_parameter_change_queue_idx
  on private.operational_parameter_change_requests(tenant_id, status, requested_at);
create index operational_parameter_change_requester_idx
  on private.operational_parameter_change_requests(requested_by);
create index operational_parameter_change_decider_idx
  on private.operational_parameter_change_requests(decided_by)
  where decided_by is not null;
create index operational_parameter_states_created_by_idx on private.operational_parameter_states(created_by);
create index operational_parameter_states_updated_by_idx on private.operational_parameter_states(updated_by);

create function private.enforce_operational_parameter_change_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'operational parameter change requests are immutable';
  end if;
  if old.status <> 'PENDING' then
    raise exception 'operational parameter change request already decided';
  end if;
  if new.tenant_id is distinct from old.tenant_id
    or new.change_id is distinct from old.change_id
    or new.command_id is distinct from old.command_id
    or new.request_hash is distinct from old.request_hash
    or new.expected_version is distinct from old.expected_version
    or new.previous_payload is distinct from old.previous_payload
    or new.proposed_payload is distinct from old.proposed_payload
    or new.reason is distinct from old.reason
    or new.requested_by is distinct from old.requested_by
    or new.requested_by_name is distinct from old.requested_by_name
    or new.requested_at is distinct from old.requested_at then
    raise exception 'operational parameter change request cannot be rewritten';
  end if;
  if new.status not in ('APPROVED', 'REJECTED') then
    raise exception 'operational parameter change request requires a terminal decision';
  end if;
  return new;
end;
$$;

create trigger operational_parameter_change_requests_guard
before update or delete on private.operational_parameter_change_requests
for each row execute function private.enforce_operational_parameter_change_transition();

revoke execute on function private.enforce_operational_parameter_change_transition() from public, anon, authenticated;

alter table private.operational_parameter_states enable row level security;
alter table private.operational_parameter_states force row level security;
alter table private.operational_parameter_change_requests enable row level security;
alter table private.operational_parameter_change_requests force row level security;

revoke all on private.operational_parameter_states from public, anon, authenticated;
revoke all on private.operational_parameter_change_requests from public, anon, authenticated;

comment on table private.operational_parameter_states is
  'Versão efetiva dos padrões operacionais globais, taxas, tarifas, limites, lastro e metas por tenant.';
comment on table private.operational_parameter_change_requests is
  'Propostas imutáveis e maker-checker para alterar os padrões operacionais globais.';
