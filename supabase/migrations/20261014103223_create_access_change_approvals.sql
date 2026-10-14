create table private.access_change_requests (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  change_id text not null,
  subject_user_id text not null,
  previous_profile jsonb not null check (jsonb_typeof(previous_profile) = 'object'),
  proposed_profile jsonb not null check (jsonb_typeof(proposed_profile) = 'object'),
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by text not null,
  requested_by_name text not null,
  requested_at timestamptz not null default now(),
  decided_by text,
  decided_by_name text,
  decided_at timestamptz,
  decision_reason text,
  applied_at timestamptz,
  primary key (tenant_id, change_id),
  foreign key (tenant_id, subject_user_id)
    references private.tenant_memberships(tenant_id, user_id) on delete restrict,
  foreign key (tenant_id, requested_by)
    references private.tenant_memberships(tenant_id, user_id) on delete restrict,
  foreign key (tenant_id, decided_by)
    references private.tenant_memberships(tenant_id, user_id) on delete restrict,
  check (previous_profile <> proposed_profile),
  check (decided_by is null or decided_by <> requested_by),
  check (decided_by is null or decided_by <> subject_user_id),
  check (
    (status = 'PENDING' and decided_by is null and decided_by_name is null
      and decided_at is null and decision_reason is null and applied_at is null)
    or
    (status = 'APPROVED' and decided_by is not null and decided_by_name is not null
      and decided_at is not null and length(trim(decision_reason)) >= 5 and applied_at is not null)
    or
    (status = 'REJECTED' and decided_by is not null and decided_by_name is not null
      and decided_at is not null and length(trim(decision_reason)) >= 5 and applied_at is null)
  )
);

create unique index access_change_requests_pending_uidx
  on private.access_change_requests(tenant_id, subject_user_id)
  where status = 'PENDING';
create index access_change_requests_queue_idx
  on private.access_change_requests(tenant_id, status, requested_at);
create index access_change_requests_subject_idx
  on private.access_change_requests(subject_user_id, tenant_id);
create index access_change_requests_requested_by_idx
  on private.access_change_requests(tenant_id, requested_by);
create index access_change_requests_decided_by_idx
  on private.access_change_requests(tenant_id, decided_by)
  where decided_by is not null;

create function private.enforce_access_change_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'access change requests are immutable';
  end if;
  if old.status <> 'PENDING' then
    raise exception 'access change request already decided';
  end if;
  if new.tenant_id is distinct from old.tenant_id
    or new.change_id is distinct from old.change_id
    or new.subject_user_id is distinct from old.subject_user_id
    or new.previous_profile is distinct from old.previous_profile
    or new.proposed_profile is distinct from old.proposed_profile
    or new.reason is distinct from old.reason
    or new.requested_by is distinct from old.requested_by
    or new.requested_by_name is distinct from old.requested_by_name
    or new.requested_at is distinct from old.requested_at then
    raise exception 'access change request cannot be rewritten';
  end if;
  if new.status not in ('APPROVED', 'REJECTED') then
    raise exception 'access change request requires a terminal decision';
  end if;
  return new;
end;
$$;

create trigger access_change_requests_guard
before update or delete on private.access_change_requests
for each row execute function private.enforce_access_change_request_transition();

revoke execute on function private.enforce_access_change_request_transition() from public, anon, authenticated;

alter table private.access_change_requests enable row level security;
alter table private.access_change_requests force row level security;
revoke all on private.access_change_requests from public, anon, authenticated;

comment on table private.access_change_requests is
  'Solicitações maker-checker para ativação, elevação de privilégio, expansão de escopo, alçadas e identificadores de acesso.';
