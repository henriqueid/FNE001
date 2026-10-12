alter table private.access_users
  add column if not exists login_name text,
  add column if not exists cpf text;

alter table private.access_users
  alter column email drop not null;

drop index if exists private.access_users_email_lower_uidx;

create unique index if not exists access_users_email_lower_uidx
  on private.access_users (lower(email))
  where email is not null;

create unique index if not exists access_users_login_name_lower_uidx
  on private.access_users (lower(login_name))
  where login_name is not null;

create unique index if not exists access_users_cpf_uidx
  on private.access_users (cpf)
  where cpf is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'access_users_login_name_check'
      and conrelid = 'private.access_users'::regclass
  ) then
    alter table private.access_users
      add constraint access_users_login_name_check
      check (login_name is null or login_name ~ '^[a-z][a-z0-9._-]{2,39}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'access_users_cpf_check'
      and conrelid = 'private.access_users'::regclass
  ) then
    alter table private.access_users
      add constraint access_users_cpf_check
      check (cpf is null or cpf ~ '^[0-9]{11}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'access_users_identifier_check'
      and conrelid = 'private.access_users'::regclass
  ) then
    alter table private.access_users
      add constraint access_users_identifier_check
      check (email is not null or login_name is not null or cpf is not null);
  end if;
end $$;

update private.access_users
set login_name = 'henrique', updated_at = now()
where user_id = 'user-henrique-admin' and login_name is null;
