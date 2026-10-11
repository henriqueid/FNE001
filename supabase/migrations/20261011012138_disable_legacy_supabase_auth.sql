revoke all on function public.strato_save_access_directory(text, jsonb) from public, anon, authenticated;
revoke all on function public.strato_access_directory(text) from public, anon, authenticated;
revoke all on function public.strato_current_principal(text) from public, anon, authenticated;

revoke all on function private.strato_save_access_directory(text, jsonb) from public, anon, authenticated;
revoke all on function private.strato_access_directory(text) from public, anon, authenticated;
revoke all on function private.strato_current_principal(text) from public, anon, authenticated;

comment on column private.access_users.auth_user_id is
  'Inactive legacy Supabase Auth link retained only for rollback safety and audit history.';
