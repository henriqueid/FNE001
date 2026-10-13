create table private.finance_period_closures (
  tenant_id text not null references private.finance_states(tenant_id) on delete restrict,
  closure_id text not null,
  company text not null,
  through_date date not null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  closed_by text not null references private.access_users(user_id),
  source_closed_by text not null,
  source_closed_at text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, closure_id),
  unique (tenant_id, company, through_date)
);

create index finance_period_closures_company_idx
  on private.finance_period_closures(tenant_id, company, through_date desc);
create index finance_period_closures_closed_by_idx on private.finance_period_closures(closed_by);

create function private.assert_finance_closure_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pending_statement integer;
  pending_movements integer;
begin
  if exists (
    select 1 from private.finance_period_closures
    where tenant_id = new.tenant_id and company = new.company and through_date >= new.through_date
  ) then
    raise exception 'Já existe fechamento igual ou posterior para %.', new.company;
  end if;
  select count(*) into pending_statement
  from private.finance_statement_lines line
  join private.finance_bank_accounts account
    on account.tenant_id = line.tenant_id and account.bank_account_id = line.bank_account_id
  where line.tenant_id = new.tenant_id and account.company = new.company
    and line.line_date <= new.through_date and line.status <> 'Conciliado';
  select count(*) into pending_movements
  from private.finance_movements movement
  join private.finance_bank_accounts account
    on account.tenant_id = movement.tenant_id and account.bank_account_id = movement.bank_account_id
  where movement.tenant_id = new.tenant_id and account.company = new.company
    and movement.movement_date <= new.through_date and not movement.reconciled;
  if pending_statement > 0 or pending_movements > 0 then
    raise exception 'Fechamento bloqueado: % linha(s) de extrato e % movimento(s) pendentes.',
      pending_statement, pending_movements;
  end if;
  return new;
end;
$$;

create trigger finance_period_closures_ready
before insert on private.finance_period_closures
for each row execute function private.assert_finance_closure_ready();

create trigger finance_period_closures_append_only
before update or delete on private.finance_period_closures
for each row execute function private.prevent_append_only_mutation();

create function private.assert_finance_date_open()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_tenant text;
  target_company text;
  target_date date;
begin
  if tg_table_name = 'finance_journal_entries' then
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'reversed_by') = (to_jsonb(old) - 'reversed_by') then return new; end if;
    target_tenant := coalesce(new.tenant_id, old.tenant_id);
    target_company := coalesce(new.company, old.company);
    target_date := least(coalesce(new.entry_date, old.entry_date), coalesce(old.entry_date, new.entry_date));
  elsif tg_table_name = 'finance_journal_lines' then
    target_tenant := coalesce(new.tenant_id, old.tenant_id);
    select company, entry_date into target_company, target_date
    from private.finance_journal_entries
    where tenant_id = target_tenant
      and journal_entry_id = coalesce(new.journal_entry_id, old.journal_entry_id);
  elsif tg_table_name = 'finance_movements' then
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'reversed_by') = (to_jsonb(old) - 'reversed_by') then return new; end if;
    target_tenant := coalesce(new.tenant_id, old.tenant_id);
    target_date := least(coalesce(new.movement_date, old.movement_date), coalesce(old.movement_date, new.movement_date));
    select company into target_company from private.finance_bank_accounts
    where tenant_id = target_tenant
      and bank_account_id = coalesce(new.bank_account_id, old.bank_account_id);
  elsif tg_table_name = 'finance_statement_lines' then
    target_tenant := coalesce(new.tenant_id, old.tenant_id);
    target_date := least(coalesce(new.line_date, old.line_date), coalesce(old.line_date, new.line_date));
    select company into target_company from private.finance_bank_accounts
    where tenant_id = target_tenant
      and bank_account_id = coalesce(new.bank_account_id, old.bank_account_id);
  elsif tg_table_name = 'finance_bank_accounts' then
    if tg_op = 'UPDATE' and new.opening_balance = old.opening_balance
       and new.opening_date = old.opening_date and new.company = old.company then return new; end if;
    target_tenant := coalesce(new.tenant_id, old.tenant_id);
    target_company := coalesce(new.company, old.company);
    target_date := least(coalesce(new.opening_date, old.opening_date), coalesce(old.opening_date, new.opening_date));
  end if;
  if exists (
    select 1 from private.finance_period_closures
    where tenant_id = target_tenant and company = target_company and through_date >= target_date
  ) then
    raise exception 'Período de % fechado para a data %.', target_company, target_date;
  end if;
  return new;
end;
$$;

create trigger finance_journal_entries_period_open
before insert or update on private.finance_journal_entries
for each row execute function private.assert_finance_date_open();
create trigger finance_journal_lines_period_open
before insert on private.finance_journal_lines
for each row execute function private.assert_finance_date_open();
create trigger finance_movements_period_open
before insert or update on private.finance_movements
for each row execute function private.assert_finance_date_open();
create trigger finance_statement_lines_period_open
before insert or update on private.finance_statement_lines
for each row execute function private.assert_finance_date_open();
create trigger finance_bank_accounts_period_open
before insert or update on private.finance_bank_accounts
for each row execute function private.assert_finance_date_open();

alter table private.finance_period_closures enable row level security;
alter table private.finance_period_closures force row level security;
revoke all on private.finance_period_closures from public, anon, authenticated;

comment on table private.finance_period_closures is
  'Fechamentos imutáveis por empresa e data-base; impedem fatos retroativos no diário e na conciliação.';
