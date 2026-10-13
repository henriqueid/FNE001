create index tasks_owner_user_idx on private.tasks(owner_user_id) where owner_user_id is not null;
