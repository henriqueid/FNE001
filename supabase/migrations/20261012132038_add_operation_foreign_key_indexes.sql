create index if not exists operations_created_by_idx on private.operations(created_by);
create index if not exists operations_updated_by_idx on private.operations(updated_by);
create index if not exists operation_events_actor_idx on private.operation_events(actor_id);
