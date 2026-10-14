create table private.integration_provider_change_requests (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  change_id text not null,
  command_id text not null,
  request_hash text not null check (length(request_hash) = 64),
  capability text not null check (capability in (
    'CNPJ_LOOKUP',
    'CEP_LOOKUP',
    'BANK_DIRECTORY',
    'HOLIDAY_CALENDAR',
    'PIX_DIRECTORY'
  )),
  previous_payload jsonb not null check (jsonb_typeof(previous_payload) = 'array'),
  proposed_payload jsonb not null check (jsonb_typeof(proposed_payload) = 'array'),
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by text not null references private.access_users(user_id) on delete restrict,
  requested_by_name text not null check (length(trim(requested_by_name)) > 0),
  requested_at timestamptz not null default now(),
  decided_by text references private.access_users(user_id) on delete restrict,
  decided_by_name text,
  decided_at timestamptz,
  decision_reason text,
  primary key (tenant_id, change_id),
  unique (tenant_id, command_id),
  check (previous_payload <> proposed_payload),
  check (decided_by is null or decided_by <> requested_by),
  check (
    (status = 'PENDING' and decided_by is null and decided_by_name is null
      and decided_at is null and decision_reason is null)
    or
    (status in ('APPROVED', 'REJECTED') and decided_by is not null and decided_by_name is not null
      and decided_at is not null and length(trim(decision_reason)) >= 5)
  )
);

create unique index integration_provider_change_pending_uidx
  on private.integration_provider_change_requests(tenant_id, capability)
  where status = 'PENDING';
create index integration_provider_change_queue_idx
  on private.integration_provider_change_requests(tenant_id, status, requested_at desc);
create index integration_provider_change_requester_idx
  on private.integration_provider_change_requests(requested_by);
create index integration_provider_change_decider_idx
  on private.integration_provider_change_requests(decided_by)
  where decided_by is not null;

create function private.enforce_integration_provider_change_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'integration provider change requests are immutable';
  end if;
  if old.status <> 'PENDING' then
    raise exception 'integration provider change request already decided';
  end if;
  if new.tenant_id is distinct from old.tenant_id
    or new.change_id is distinct from old.change_id
    or new.command_id is distinct from old.command_id
    or new.request_hash is distinct from old.request_hash
    or new.capability is distinct from old.capability
    or new.previous_payload is distinct from old.previous_payload
    or new.proposed_payload is distinct from old.proposed_payload
    or new.reason is distinct from old.reason
    or new.requested_by is distinct from old.requested_by
    or new.requested_by_name is distinct from old.requested_by_name
    or new.requested_at is distinct from old.requested_at then
    raise exception 'integration provider change request cannot be rewritten';
  end if;
  if new.status not in ('APPROVED', 'REJECTED') then
    raise exception 'integration provider change request requires a terminal decision';
  end if;
  return new;
end;
$$;

create trigger integration_provider_change_requests_guard
before update or delete on private.integration_provider_change_requests
for each row execute function private.enforce_integration_provider_change_transition();

revoke execute on function private.enforce_integration_provider_change_transition() from public, anon, authenticated;

alter table private.integration_provider_change_requests enable row level security;
alter table private.integration_provider_change_requests force row level security;
revoke all on private.integration_provider_change_requests from public, anon, authenticated;

comment on table private.integration_provider_change_requests is
  'Propostas imutáveis e maker-checker para ativação, suspensão, prioridade e troca de provedores por capacidade.';
