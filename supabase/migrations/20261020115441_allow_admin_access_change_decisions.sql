-- A independência depende do administrador vigente, não apenas dos IDs da solicitação.
create function private.enforce_access_change_decider()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.decided_by is not null
    and (new.decided_by = new.requested_by or new.decided_by = new.subject_user_id)
    and not exists (
      select 1 from private.access_users u
      join private.tenant_memberships m on m.user_id = u.user_id
      where u.user_id = new.decided_by and m.tenant_id = new.tenant_id
        and u.access_level = 'admin' and u.status = 'active'
    ) then
    raise exception 'Somente administrador ativo da organização pode decidir alteração própria.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_access_change_decider() from public, anon, authenticated;

create trigger access_change_requests_decider_guard
before insert or update on private.access_change_requests
for each row execute function private.enforce_access_change_decider();

alter table private.access_change_requests
  drop constraint access_change_requests_check1,
  drop constraint access_change_requests_check2;
