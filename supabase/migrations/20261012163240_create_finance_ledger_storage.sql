create table private.finance_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  sequence_number integer not null default 0 check (sequence_number >= 0),
  roles jsonb not null default '{}'::jsonb check (jsonb_typeof(roles) = 'object'),
  registrations jsonb not null default '{}'::jsonb check (jsonb_typeof(registrations) = 'object'),
  chart_origin text check (chart_origin in ('modelo', 'importado')),
  chart_imports jsonb not null default '[]'::jsonb check (jsonb_typeof(chart_imports) = 'array'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.finance_chart_accounts (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  account_code text not null,
  name text not null,
  nature text not null check (nature in ('Ativo', 'Passivo', 'Patrimônio líquido', 'Receita', 'Despesa')),
  analytic boolean not null,
  short_code text,
  referential text,
  primary key (tenant_id, account_code)
);

create table private.finance_categories (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  category_id text not null,
  name text not null,
  kind text not null check (kind in ('Receita', 'Despesa')),
  ledger_code text not null,
  account_group text not null,
  primary key (tenant_id, category_id)
);

create table private.finance_bank_accounts (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  bank_account_id text not null,
  company text not null,
  bank_code text not null,
  bank_name text not null,
  agency text not null,
  account_number text not null,
  account_type text not null,
  nickname text not null,
  ledger_code text not null,
  opening_balance numeric(18, 2) not null,
  opening_date date not null,
  minimum_balance numeric(18, 2) not null default 0,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  primary key (tenant_id, bank_account_id),
  unique (tenant_id, company, bank_code, agency, account_number)
);

create table private.finance_titles (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  title_id text not null,
  kind text not null check (kind in ('Pagar', 'Receber')),
  origin text not null,
  description text not null,
  counterparty text not null,
  counterparty_document text,
  category_id text,
  company text not null,
  competence_date date not null,
  due_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  settlement_ledger text not null,
  status text not null check (status in ('Em aberto', 'Baixado', 'Cancelado')),
  operation_id text,
  payable_id text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, title_id),
  foreign key (tenant_id, category_id)
    references private.finance_categories(tenant_id, category_id)
    on delete restrict
);

create unique index finance_titles_operation_payable_unique
  on private.finance_titles(tenant_id, operation_id, payable_id)
  where operation_id is not null and payable_id is not null;

create table private.finance_journal_entries (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  journal_entry_id text not null,
  entry_date date not null,
  company text not null,
  history text not null,
  origin_type text not null check (origin_type in ('Título', 'Movimento', 'Operação', 'Abertura', 'Transferência')),
  origin_id text not null,
  reversal_of text,
  reversed_by text,
  source_created_by text not null,
  created_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, journal_entry_id),
  foreign key (tenant_id, reversal_of)
    references private.finance_journal_entries(tenant_id, journal_entry_id)
    on delete restrict,
  foreign key (tenant_id, reversed_by)
    references private.finance_journal_entries(tenant_id, journal_entry_id)
    on delete restrict,
  check (reversal_of is null or reversal_of <> journal_entry_id),
  check (reversed_by is null or reversed_by <> journal_entry_id)
);

create unique index finance_journal_reversal_unique
  on private.finance_journal_entries(tenant_id, reversal_of)
  where reversal_of is not null;

create table private.finance_journal_lines (
  tenant_id text not null,
  journal_entry_id text not null,
  line_number integer not null check (line_number > 0),
  ledger_code text not null,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  original_ledger_code text,
  primary key (tenant_id, journal_entry_id, line_number),
  foreign key (tenant_id, journal_entry_id)
    references private.finance_journal_entries(tenant_id, journal_entry_id)
    on delete restrict,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table private.finance_movements (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  movement_id text not null,
  bank_account_id text not null,
  movement_date date not null,
  description text not null,
  amount numeric(18, 2) not null check (amount <> 0),
  kind text not null check (kind in ('Entrada', 'Saída', 'Transferência', 'Estorno')),
  title_id text,
  reversal_of text,
  reversed_by text,
  reconciled boolean not null default false,
  journal_entry_id text,
  match_group text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  primary key (tenant_id, movement_id),
  foreign key (tenant_id, bank_account_id)
    references private.finance_bank_accounts(tenant_id, bank_account_id)
    on delete restrict,
  foreign key (tenant_id, title_id)
    references private.finance_titles(tenant_id, title_id)
    on delete restrict,
  foreign key (tenant_id, reversal_of)
    references private.finance_movements(tenant_id, movement_id)
    on delete restrict,
  foreign key (tenant_id, reversed_by)
    references private.finance_movements(tenant_id, movement_id)
    on delete restrict,
  foreign key (tenant_id, journal_entry_id)
    references private.finance_journal_entries(tenant_id, journal_entry_id)
    on delete restrict
);

create table private.finance_statement_lines (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  statement_line_id text not null,
  bank_account_id text not null,
  fitid text not null,
  line_date date not null,
  amount numeric(18, 2) not null check (amount <> 0),
  memo text not null,
  status text not null check (status in ('Pendente', 'Conciliado')),
  match_group text,
  source_file text not null,
  imported_at timestamptz not null,
  imported_by text not null,
  primary key (tenant_id, statement_line_id),
  unique (tenant_id, bank_account_id, fitid),
  foreign key (tenant_id, bank_account_id)
    references private.finance_bank_accounts(tenant_id, bank_account_id)
    on delete restrict
);

create table private.finance_purchase_postings (
  tenant_id text not null references private.finance_states(tenant_id) on delete cascade,
  operation_id text not null,
  journal_entry_id text not null,
  primary key (tenant_id, operation_id),
  foreign key (tenant_id, journal_entry_id)
    references private.finance_journal_entries(tenant_id, journal_entry_id)
    on delete restrict
);

create function private.assert_finance_journal_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_tenant text := coalesce(new.tenant_id, old.tenant_id);
  target_entry text := coalesce(new.journal_entry_id, old.journal_entry_id);
  line_count integer;
  debit_total numeric(18, 2);
  credit_total numeric(18, 2);
begin
  select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into line_count, debit_total, credit_total
  from private.finance_journal_lines
  where tenant_id = target_tenant and journal_entry_id = target_entry;
  if line_count < 2 or debit_total <> credit_total then
    raise exception 'Lançamento % desbalanceado: % débito x % crédito em % linha(s)',
      target_entry, debit_total, credit_total, line_count;
  end if;
  return null;
end;
$$;

create constraint trigger finance_journal_lines_balance
after insert or update or delete on private.finance_journal_lines
deferrable initially deferred
for each row execute function private.assert_finance_journal_balanced();

create function private.protect_finance_journal_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Lançamentos contábeis são imutáveis; use estorno.';
  end if;
  if row(new.tenant_id, new.journal_entry_id, new.entry_date, new.company, new.history,
         new.origin_type, new.origin_id, new.reversal_of, new.source_created_by, new.created_by, new.created_at)
     is distinct from
     row(old.tenant_id, old.journal_entry_id, old.entry_date, old.company, old.history,
         old.origin_type, old.origin_id, old.reversal_of, old.source_created_by, old.created_by, old.created_at) then
    raise exception 'Somente o vínculo de estorno pode ser atualizado em um lançamento contábil.';
  end if;
  return new;
end;
$$;

create trigger finance_journal_entries_protect
before update or delete on private.finance_journal_entries
for each row execute function private.protect_finance_journal_entry();

create trigger finance_journal_lines_protect
before update or delete on private.finance_journal_lines
for each row execute function private.prevent_append_only_mutation();

create index finance_states_created_by_idx on private.finance_states(created_by);
create index finance_states_updated_by_idx on private.finance_states(updated_by);
create index finance_titles_due_idx on private.finance_titles(tenant_id, status, due_date);
create index finance_titles_operation_idx on private.finance_titles(tenant_id, operation_id);
create index finance_titles_created_by_idx on private.finance_titles(created_by);
create index finance_titles_updated_by_idx on private.finance_titles(updated_by);
create index finance_journal_company_date_idx on private.finance_journal_entries(tenant_id, company, entry_date);
create index finance_journal_created_by_idx on private.finance_journal_entries(created_by);
create index finance_movements_account_date_idx on private.finance_movements(tenant_id, bank_account_id, movement_date);
create index finance_movements_title_idx on private.finance_movements(tenant_id, title_id);
create index finance_movements_journal_idx on private.finance_movements(tenant_id, journal_entry_id);
create index finance_statement_pending_idx on private.finance_statement_lines(tenant_id, bank_account_id, status, line_date);
create index finance_purchase_postings_journal_idx on private.finance_purchase_postings(tenant_id, journal_entry_id);

alter table private.finance_states enable row level security;
alter table private.finance_states force row level security;
alter table private.finance_chart_accounts enable row level security;
alter table private.finance_chart_accounts force row level security;
alter table private.finance_categories enable row level security;
alter table private.finance_categories force row level security;
alter table private.finance_bank_accounts enable row level security;
alter table private.finance_bank_accounts force row level security;
alter table private.finance_titles enable row level security;
alter table private.finance_titles force row level security;
alter table private.finance_journal_entries enable row level security;
alter table private.finance_journal_entries force row level security;
alter table private.finance_journal_lines enable row level security;
alter table private.finance_journal_lines force row level security;
alter table private.finance_movements enable row level security;
alter table private.finance_movements force row level security;
alter table private.finance_statement_lines enable row level security;
alter table private.finance_statement_lines force row level security;
alter table private.finance_purchase_postings enable row level security;
alter table private.finance_purchase_postings force row level security;

revoke all on private.finance_states from public, anon, authenticated;
revoke all on private.finance_chart_accounts from public, anon, authenticated;
revoke all on private.finance_categories from public, anon, authenticated;
revoke all on private.finance_bank_accounts from public, anon, authenticated;
revoke all on private.finance_titles from public, anon, authenticated;
revoke all on private.finance_journal_entries from public, anon, authenticated;
revoke all on private.finance_journal_lines from public, anon, authenticated;
revoke all on private.finance_movements from public, anon, authenticated;
revoke all on private.finance_statement_lines from public, anon, authenticated;
revoke all on private.finance_purchase_postings from public, anon, authenticated;

comment on table private.finance_states is 'Envelope versionado do agregado financeiro por tenant.';
comment on table private.finance_journal_entries is 'Cabeçalhos imutáveis do livro diário; correções são contrapartidas.';
comment on table private.finance_journal_lines is 'Partidas contábeis append-only, balanceadas por lançamento.';
