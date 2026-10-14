create table private.registry_bank_account_changes (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  change_id text not null,
  party_id text not null,
  previous_accounts jsonb not null check (jsonb_typeof(previous_accounts) = 'array'),
  proposed_accounts jsonb not null check (jsonb_typeof(proposed_accounts) = 'array'),
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by text not null references private.access_users(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by text references private.access_users(user_id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  applied_at timestamptz,
  primary key (tenant_id, change_id),
  foreign key (tenant_id, party_id)
    references private.registry_parties(tenant_id, party_id) on delete restrict,
  check (previous_accounts <> proposed_accounts),
  check (decided_by is null or decided_by <> requested_by),
  check (
    (status = 'PENDING' and decided_by is null and decided_at is null and decision_reason is null and applied_at is null)
    or
    (status = 'APPROVED' and decided_by is not null and decided_at is not null
      and length(trim(decision_reason)) >= 5 and applied_at is not null)
    or
    (status = 'REJECTED' and decided_by is not null and decided_at is not null
      and length(trim(decision_reason)) >= 5 and applied_at is null)
  )
);

create unique index registry_bank_account_changes_pending_uidx
  on private.registry_bank_account_changes(tenant_id, party_id)
  where status = 'PENDING';
create index registry_bank_account_changes_queue_idx
  on private.registry_bank_account_changes(tenant_id, status, requested_at);
create index registry_bank_account_changes_requested_by_idx
  on private.registry_bank_account_changes(requested_by);
create index registry_bank_account_changes_decided_by_idx
  on private.registry_bank_account_changes(decided_by)
  where decided_by is not null;

create function private.enforce_registry_bank_account_change_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'registry bank account changes are immutable';
  end if;
  if old.status <> 'PENDING' then
    raise exception 'registry bank account change already decided';
  end if;
  if new.tenant_id is distinct from old.tenant_id
    or new.change_id is distinct from old.change_id
    or new.party_id is distinct from old.party_id
    or new.previous_accounts is distinct from old.previous_accounts
    or new.proposed_accounts is distinct from old.proposed_accounts
    or new.reason is distinct from old.reason
    or new.requested_by is distinct from old.requested_by
    or new.requested_at is distinct from old.requested_at then
    raise exception 'registry bank account change request cannot be rewritten';
  end if;
  if new.status not in ('APPROVED', 'REJECTED') then
    raise exception 'registry bank account change requires a terminal decision';
  end if;
  return new;
end;
$$;

create trigger registry_bank_account_changes_guard
before update or delete on private.registry_bank_account_changes
for each row execute function private.enforce_registry_bank_account_change_transition();

revoke execute on function private.enforce_registry_bank_account_change_transition() from public, anon, authenticated;

alter table private.registry_bank_account_changes enable row level security;
alter table private.registry_bank_account_changes force row level security;
revoke all on private.registry_bank_account_changes from public, anon, authenticated;

comment on table private.registry_bank_account_changes is
  'Solicitações maker-checker de alteração das contas bancárias do cadastro, isoladas por tenant e imutáveis após a decisão.';
