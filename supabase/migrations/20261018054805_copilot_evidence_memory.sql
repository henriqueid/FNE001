-- Memória privada do Copiloto. Não concede acesso pela Data API.
create table private.copilot_reports (
  tenant_id text not null references private.tenants(tenant_id),
  report_id text not null,
  actor_id text not null references private.access_users(user_id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, report_id)
);
create index copilot_reports_actor_idx on private.copilot_reports(tenant_id, actor_id, created_at desc);

create table private.copilot_memories (
  tenant_id text not null references private.tenants(tenant_id),
  memory_id text not null,
  actor_id text not null references private.access_users(user_id),
  company text not null,
  entity_id text not null,
  visibility text not null check (visibility in ('private', 'company')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, memory_id)
);
create index copilot_memories_entity_idx on private.copilot_memories(tenant_id, entity_id);

create table private.copilot_memory_reviews (
  review_version bigint generated always as identity primary key,
  tenant_id text not null,
  memory_id text not null,
  reviewer_id text not null references private.access_users(user_id),
  status text not null check (status in ('validated', 'rejected', 'revoked')),
  rationale text not null check (length(trim(rationale)) between 1 and 2000),
  reviewed_at timestamptz not null default now(),
  foreign key (tenant_id, memory_id) references private.copilot_memories(tenant_id, memory_id)
);
create index copilot_memory_reviews_latest_idx on private.copilot_memory_reviews(tenant_id, memory_id, review_version desc);

alter table private.copilot_reports enable row level security;
alter table private.copilot_reports force row level security;
alter table private.copilot_memories enable row level security;
alter table private.copilot_memories force row level security;
alter table private.copilot_memory_reviews enable row level security;
alter table private.copilot_memory_reviews force row level security;
revoke all on private.copilot_reports, private.copilot_memories, private.copilot_memory_reviews from public, anon, authenticated;
revoke all on sequence private.copilot_memory_reviews_review_version_seq from public, anon, authenticated;

create function private.copilot_preserve_history() returns trigger language plpgsql as $$
begin
  raise exception 'Histórico do Copiloto é imutável; registre uma revisão.';
end;
$$;
revoke all on function private.copilot_preserve_history() from public, anon, authenticated;
create trigger copilot_reports_immutable before update or delete on private.copilot_reports for each row execute function private.copilot_preserve_history();
create trigger copilot_memories_immutable before update or delete on private.copilot_memories for each row execute function private.copilot_preserve_history();
create trigger copilot_reviews_immutable before update or delete on private.copilot_memory_reviews for each row execute function private.copilot_preserve_history();
