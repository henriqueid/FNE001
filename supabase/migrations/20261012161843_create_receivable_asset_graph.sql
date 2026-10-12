create table private.domain_events (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  event_id text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  event_type text not null,
  actor_id text not null references private.access_users(user_id),
  correlation_id text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, event_id),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version)
);

insert into private.domain_events
  (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload, created_at)
select tenant_id, event_id, 'Operation', operation_id, aggregate_version, event_type, actor_id, payload, created_at
from private.operation_events
on conflict do nothing;

alter table private.domain_outbox
  drop constraint domain_outbox_tenant_id_event_id_fkey;
alter table private.domain_outbox
  add constraint domain_outbox_domain_event_fkey
  foreign key (tenant_id, event_id)
  references private.domain_events(tenant_id, event_id)
  on delete restrict;

create function private.mirror_operation_event_to_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.domain_events
    (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload, created_at)
  values
    (new.tenant_id, new.event_id, 'Operation', new.operation_id, new.aggregate_version,
     new.event_type, new.actor_id, new.payload, new.created_at)
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function private.mirror_operation_event_to_domain() from public, anon, authenticated;

create trigger operation_events_mirror_to_domain
after insert on private.operation_events
for each row execute function private.mirror_operation_event_to_domain();

create table private.fiscal_documents (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  fiscal_document_id text not null,
  document_type text not null check (document_type in ('NFE', 'CTE', 'NFSE', 'OTHER')),
  access_key text not null,
  issuer_document text not null default '',
  recipient_document text not null default '',
  issue_date date,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, fiscal_document_id),
  unique (tenant_id, document_type, access_key)
);

create table private.receivables (
  tenant_id text not null,
  receivable_id text not null,
  operation_id text not null,
  source_entry_id text not null,
  canonical_key text not null,
  receivable_type text not null,
  lifecycle_status text not null
    check (lifecycle_status in ('DRAFT', 'APPROVED', 'REJECTED', 'ASSIGNED', 'REMOVED')),
  owner_document text not null,
  debtor_document text not null,
  document_number text not null,
  issue_date date,
  due_date date not null,
  original_amount numeric(18, 2) not null check (original_amount > 0),
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, receivable_id),
  unique (tenant_id, canonical_key),
  unique (tenant_id, operation_id, source_entry_id),
  foreign key (tenant_id, operation_id)
    references private.operations(tenant_id, operation_id)
    on delete restrict
);

create table private.receivable_fiscal_documents (
  tenant_id text not null,
  receivable_id text not null,
  fiscal_document_id text not null,
  relationship_type text not null default 'ORIGIN'
    check (relationship_type in ('ORIGIN', 'SUPPORT', 'SUBSTITUTE')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, receivable_id, fiscal_document_id, relationship_type),
  foreign key (tenant_id, receivable_id)
    references private.receivables(tenant_id, receivable_id)
    on delete restrict,
  foreign key (tenant_id, fiscal_document_id)
    references private.fiscal_documents(tenant_id, fiscal_document_id)
    on delete restrict
);

create index domain_events_aggregate_idx
  on private.domain_events(tenant_id, aggregate_type, aggregate_id, aggregate_version);
create index domain_events_actor_idx on private.domain_events(actor_id);
create index receivables_operation_idx on private.receivables(tenant_id, operation_id, lifecycle_status);
create index receivables_debtor_idx on private.receivables(tenant_id, debtor_document, due_date);
create index receivables_status_due_idx on private.receivables(tenant_id, lifecycle_status, due_date);
create index receivables_created_by_idx on private.receivables(created_by);
create index receivables_updated_by_idx on private.receivables(updated_by);
create index fiscal_documents_created_by_idx on private.fiscal_documents(created_by);
create index fiscal_documents_updated_by_idx on private.fiscal_documents(updated_by);
create index receivable_fiscal_documents_fiscal_idx
  on private.receivable_fiscal_documents(tenant_id, fiscal_document_id);

create trigger domain_events_prevent_update_delete
before update or delete on private.domain_events
for each row execute function private.prevent_append_only_mutation();

with extracted as (
  select
    o.tenant_id,
    o.operation_id,
    o.created_by,
    o.updated_by,
    o.payload,
    entry.value as entry,
    coalesce(o.payload #>> '{manualEntry,receivableType}', 'Duplicata') as receivable_type,
    'rcv:' || o.operation_id || ':' || (entry.value ->> 'id') as receivable_id,
    lower(coalesce(o.payload #>> '{manualEntry,receivableType}', 'Duplicata')) || '|' ||
      regexp_replace(coalesce(o.payload ->> 'document', ''), '\D', '', 'g') || '|' ||
      regexp_replace(coalesce(entry.value ->> 'debtorDocument', ''), '\D', '', 'g') || '|' ||
      lower(trim(coalesce(entry.value ->> 'documentNumber', ''))) as canonical_key,
    case
      when o.status = 'Cancelada' then 'REMOVED'
      when o.payload #>> array['riskReview', 'titleDecisions', entry.value ->> 'id'] = 'Reprovado' then 'REJECTED'
      when o.status = 'Liberada ao financeiro' then 'ASSIGNED'
      when o.payload #>> array['riskReview', 'titleDecisions', entry.value ->> 'id'] = 'Aprovado' then 'APPROVED'
      else 'DRAFT'
    end as lifecycle_status
  from private.operations o
  cross join lateral jsonb_array_elements(coalesce(o.payload #> '{manualEntry,entries}', '[]'::jsonb)) entry(value)
)
insert into private.receivables
  (tenant_id, receivable_id, operation_id, source_entry_id, canonical_key, receivable_type,
   lifecycle_status, owner_document, debtor_document, document_number, issue_date, due_date,
   original_amount, aggregate_version, payload, created_by, updated_by)
select
  tenant_id,
  receivable_id,
  operation_id,
  entry ->> 'id',
  canonical_key,
  receivable_type,
  lifecycle_status,
  regexp_replace(coalesce(payload ->> 'document', ''), '\D', '', 'g'),
  regexp_replace(coalesce(entry ->> 'debtorDocument', ''), '\D', '', 'g'),
  entry ->> 'documentNumber',
  nullif(entry ->> 'issueDate', '')::date,
  (entry ->> 'dueDate')::date,
  (entry ->> 'amount')::numeric,
  1,
  jsonb_build_object(
    'id', receivable_id,
    'operationId', operation_id,
    'sourceEntryId', entry ->> 'id',
    'canonicalKey', canonical_key,
    'receivableType', receivable_type,
    'lifecycleStatus', lifecycle_status,
    'company', payload ->> 'vehicle',
    'institution', payload ->> 'institution',
    'proposal', payload ->> 'proposal',
    'aditivoNumber', payload ->> 'aditivoNumber',
    'borderoNumber', payload ->> 'borderoNumber',
    'operationType', payload ->> 'operationType',
    'ownerName', payload ->> 'cedent',
    'ownerDocument', payload ->> 'document',
    'entry', entry
  ),
  created_by,
  updated_by
from extracted;

insert into private.domain_events
  (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload, created_at)
select
  tenant_id,
  'receivable-backfill:' || md5(tenant_id || ':' || receivable_id),
  'Receivable',
  receivable_id,
  aggregate_version,
  'RECEIVABLE_INCLUDED',
  created_by,
  jsonb_build_object('operationId', operation_id, 'migration', true),
  created_at
from private.receivables
on conflict do nothing;

insert into private.domain_outbox
  (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
select
  tenant_id,
  'receivable-outbox-backfill:' || md5(tenant_id || ':' || receivable_id),
  'receivable-backfill:' || md5(tenant_id || ':' || receivable_id),
  'strato.receivables',
  'Receivable',
  receivable_id,
  aggregate_version,
  jsonb_build_object('eventType', 'RECEIVABLE_INCLUDED', 'receivableId', receivable_id, 'migration', true)
from private.receivables
on conflict do nothing;

insert into private.fiscal_documents
  (tenant_id, fiscal_document_id, document_type, access_key, issuer_document, recipient_document,
   issue_date, payload, created_by, updated_by)
select distinct on (tenant_id, regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g'))
  tenant_id,
  'nfe:' || regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g'),
  'NFE',
  regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g'),
  owner_document,
  debtor_document,
  issue_date,
  jsonb_build_object('accessKey', regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g')),
  created_by,
  updated_by
from private.receivables
where length(regexp_replace(coalesce(payload #>> '{entry,nfeKey}', ''), '\D', '', 'g')) = 44
order by tenant_id, regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g'), created_at;

insert into private.receivable_fiscal_documents
  (tenant_id, receivable_id, fiscal_document_id, relationship_type)
select
  tenant_id,
  receivable_id,
  'nfe:' || regexp_replace(payload #>> '{entry,nfeKey}', '\D', '', 'g'),
  'ORIGIN'
from private.receivables
where length(regexp_replace(coalesce(payload #>> '{entry,nfeKey}', ''), '\D', '', 'g')) = 44
on conflict do nothing;

update private.operations
set payload = jsonb_set(payload, '{manualEntry,entries}', '[]'::jsonb, false)
where jsonb_typeof(payload #> '{manualEntry,entries}') = 'array';

alter table private.domain_events enable row level security;
alter table private.domain_events force row level security;
alter table private.fiscal_documents enable row level security;
alter table private.fiscal_documents force row level security;
alter table private.receivables enable row level security;
alter table private.receivables force row level security;
alter table private.receivable_fiscal_documents enable row level security;
alter table private.receivable_fiscal_documents force row level security;

revoke all on private.domain_events from public, anon, authenticated;
revoke all on private.fiscal_documents from public, anon, authenticated;
revoke all on private.receivables from public, anon, authenticated;
revoke all on private.receivable_fiscal_documents from public, anon, authenticated;

comment on table private.domain_events is 'Ledger imutavel e comum aos agregados materiais do STRATO.';
comment on table private.receivables is 'Fonte unica dos recebiveis, com identidade canonica e ciclo independente da operacao.';
comment on table private.fiscal_documents is 'Documentos fiscais vinculados ao grafo do ativo.';
comment on table private.receivable_fiscal_documents is 'Relacoes entre recebiveis e evidencias fiscais.';
