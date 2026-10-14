create table private.company_destinations (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  destination_id uuid not null,
  legal_name text not null check (length(trim(legal_name)) >= 3),
  trade_name text not null check (length(trim(trade_name)) >= 2),
  document_digits text not null check (document_digits ~ '^[0-9]{14}$'),
  institution_type text not null check (institution_type in ('FIDC', 'Securitizadora', 'Factoring')),
  detail text not null check (length(trim(detail)) >= 3),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, destination_id),
  unique (tenant_id, document_digits)
);

create index company_destinations_tenant_status_idx
  on private.company_destinations (tenant_id, status, lower(trade_name));
create index company_destinations_created_by_idx on private.company_destinations (created_by);
create index company_destinations_updated_by_idx on private.company_destinations (updated_by);

insert into private.company_destinations
  (tenant_id, destination_id, legal_name, trade_name, document_digits, institution_type, detail, status, created_by, updated_by)
select tenant_id, gen_random_uuid(), legal_name, trade_name, document_digits,
  case when institution_type in ('FIDC', 'Securitizadora') then institution_type else 'Factoring' end,
  'Empresa principal', 'ACTIVE', created_by, updated_by
from private.company_profiles
on conflict (tenant_id, document_digits) do nothing;

alter table private.company_destinations enable row level security;
alter table private.company_destinations force row level security;
revoke all on private.company_destinations from public, anon, authenticated;

comment on table private.company_destinations is
  'Empresas, fundos e veículos operacionais isolados por tenant e mantidos exclusivamente pelo servidor STRATO.';
