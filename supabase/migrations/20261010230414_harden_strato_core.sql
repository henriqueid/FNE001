revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

create index access_users_manager_idx
  on private.access_users (manager_user_id)
  where manager_user_id is not null;

create index decision_idempotency_event_idx
  on private.decision_idempotency (tenant_id, event_id);

comment on function public.rls_auto_enable() is
  'Supabase automatic RLS trigger helper. Direct API execution is revoked.';
