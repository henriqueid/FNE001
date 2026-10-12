create table private.company_profiles (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  legal_name text not null check (length(trim(legal_name)) >= 3),
  trade_name text not null check (length(trim(trade_name)) >= 2),
  document_digits text not null unique check (document_digits ~ '^[0-9]{14}$'),
  institution_type text not null check (institution_type in ('Factoring', 'FIDC', 'Securitizadora', 'Empresa de fomento', 'Outro')),
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  foundation_date date,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.registry_parties (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  party_id text not null,
  kind text not null check (kind in ('PJ', 'PF')),
  document_digits text not null check (document_digits ~ '^[0-9]{11}([0-9]{3})?$'),
  name text not null check (length(trim(name)) >= 2),
  trade_name text not null default '',
  status text not null check (status in ('Ativo', 'Inativo')),
  roles text[] not null default '{}',
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, party_id),
  unique (tenant_id, document_digits)
);

create table private.registry_party_events (
  event_id text primary key,
  tenant_id text not null,
  party_id text not null,
  actor_id text not null references private.access_users(user_id),
  event_type text not null check (event_type in ('CREATED', 'UPDATED', 'INACTIVATED', 'REACTIVATED')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, party_id) references private.registry_parties(tenant_id, party_id) on delete restrict
);

create index registry_parties_tenant_status_idx on private.registry_parties(tenant_id, status);
create index registry_parties_tenant_name_idx on private.registry_parties(tenant_id, lower(name));
create index registry_parties_roles_idx on private.registry_parties using gin(roles);
create index registry_party_events_party_created_idx on private.registry_party_events(tenant_id, party_id, created_at desc);
create index company_profiles_created_by_idx on private.company_profiles(created_by);
create index company_profiles_updated_by_idx on private.company_profiles(updated_by);
create index registry_parties_created_by_idx on private.registry_parties(created_by);
create index registry_parties_updated_by_idx on private.registry_parties(updated_by);
create index registry_party_events_actor_idx on private.registry_party_events(actor_id);

alter table private.company_profiles enable row level security;
alter table private.company_profiles force row level security;
alter table private.registry_parties enable row level security;
alter table private.registry_parties force row level security;
alter table private.registry_party_events enable row level security;
alter table private.registry_party_events force row level security;

revoke all on private.company_profiles from public, anon, authenticated;
revoke all on private.registry_parties from public, anon, authenticated;
revoke all on private.registry_party_events from public, anon, authenticated;

comment on table private.company_profiles is 'Dados da empresa operadora do STRATO, mantidos no banco privado.';
comment on table private.registry_parties is 'Cadastro mestre de pessoas e empresas por tenant; o payload preserva a ficha completa versionada pela aplicacao.';
comment on table private.registry_party_events is 'Auditoria imutavel das alteracoes do cadastro mestre.';
