create table private.task_states (
  tenant_id text primary key references private.tenants(tenant_id) on delete cascade,
  aggregate_version integer not null default 1 check (aggregate_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null references private.access_users(user_id),
  updated_by text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.tasks (
  tenant_id text not null,
  task_id text not null,
  source text not null check (source in ('automatic', 'manual')),
  status text not null check (status in ('open', 'in_progress', 'snoozed', 'completed')),
  owner_user_id text references private.access_users(user_id) on delete set null,
  owner_name text not null check (length(trim(owner_name)) > 0),
  department text not null check (length(trim(department)) > 0),
  due_at timestamptz not null,
  snoozed_until timestamptz,
  operation_id text,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  task_version integer not null check (task_version > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  primary key (tenant_id, task_id),
  foreign key (tenant_id) references private.task_states(tenant_id) on delete cascade,
  check (updated_at >= created_at),
  check ((status = 'snoozed') = (snoozed_until is not null)),
  check ((status = 'completed') = (completed_at is not null))
);

create table private.task_history (
  tenant_id text not null,
  history_id text not null,
  task_id text not null,
  occurred_at timestamptz not null,
  actor_user_id text references private.access_users(user_id) on delete set null,
  actor_name text not null check (length(trim(actor_name)) > 0),
  action text not null check (action in ('created', 'assigned', 'started', 'snoozed', 'completed', 'resolved', 'reopened')),
  detail text not null check (length(trim(detail)) > 0),
  task_version integer not null check (task_version > 0),
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, history_id),
  foreign key (tenant_id, task_id) references private.tasks(tenant_id, task_id) on delete restrict
);

create table private.task_commands (
  tenant_id text not null references private.tenants(tenant_id) on delete cascade,
  command_id text not null,
  request_hash text not null check (length(request_hash) = 64),
  expected_version integer not null check (expected_version >= 0),
  result_version integer not null check (result_version > 0),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  event_id text not null,
  actor_id text not null references private.access_users(user_id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, command_id),
  foreign key (tenant_id, event_id) references private.domain_events(tenant_id, event_id) on delete restrict
);

create index task_states_created_by_idx on private.task_states(created_by);
create index task_states_updated_by_idx on private.task_states(updated_by);
create index tasks_owner_due_idx on private.tasks(tenant_id, owner_user_id, status, due_at);
create index tasks_department_due_idx on private.tasks(tenant_id, department, status, due_at);
create index tasks_operation_idx on private.tasks(tenant_id, operation_id) where operation_id is not null;
create index task_history_task_idx on private.task_history(tenant_id, task_id, occurred_at desc);
create index task_history_actor_idx on private.task_history(actor_user_id) where actor_user_id is not null;
create index task_commands_event_idx on private.task_commands(tenant_id, event_id);
create index task_commands_actor_idx on private.task_commands(actor_id);

create trigger task_history_prevent_update_delete
before update or delete on private.task_history
for each row execute function private.prevent_append_only_mutation();

create trigger task_commands_prevent_update_delete
before update or delete on private.task_commands
for each row execute function private.prevent_append_only_mutation();

alter table private.task_states enable row level security;
alter table private.task_states force row level security;
alter table private.tasks enable row level security;
alter table private.tasks force row level security;
alter table private.task_history enable row level security;
alter table private.task_history force row level security;
alter table private.task_commands enable row level security;
alter table private.task_commands force row level security;

revoke all on private.task_states from public, anon, authenticated;
revoke all on private.tasks from public, anon, authenticated;
revoke all on private.task_history from public, anon, authenticated;
revoke all on private.task_commands from public, anon, authenticated;

comment on table private.task_states is 'Agregado versionado da Central do Dia por tenant.';
comment on table private.tasks is 'Projecao operacional de tarefas, responsaveis, prazos e situacoes.';
comment on table private.task_history is 'Historico append-only das acoes realizadas em cada tarefa.';
comment on table private.task_commands is 'Recibos imutaveis para repeticao idempotente de comandos de tarefas.';
