-- Executa apenas em tabela temporária; não decide solicitações reais.
create temporary table access_admin_regression (like private.access_change_requests including constraints including defaults);
create trigger access_admin_test_decider before insert or update on access_admin_regression
for each row execute function private.enforce_access_change_decider();
create trigger access_admin_test_transition before update or delete on access_admin_regression
for each row execute function private.enforce_access_change_request_transition();

do $$
declare
  admin_id text;
  tenant text;
  outcome text;
begin
  select u.user_id, m.tenant_id into strict admin_id, tenant
  from private.access_users u join private.tenant_memberships m using (user_id)
  where u.access_level = 'admin' and u.status = 'active' limit 1;
  foreach outcome in array array['APPROVED', 'REJECTED'] loop
    insert into access_admin_regression
      (tenant_id, change_id, subject_user_id, previous_profile, proposed_profile,
       reason, requested_by, requested_by_name)
    values (tenant, outcome, admin_id, '{"access":"admin"}', '{"access":"admin","authorityIds":["credit-director"]}',
      'Teste administrativo isolado', admin_id, 'QA');
    update access_admin_regression set status=outcome, decided_by=admin_id,
      decided_by_name='QA', decided_at=now(), decision_reason='Conferido',
      applied_at=case when outcome='APPROVED' then now() else null end
    where change_id=outcome;
    if not found then raise exception 'Decisão não aplicada'; end if;
    begin
      update access_admin_regression set decision_reason='Reescrito' where change_id=outcome;
      raise exception 'Regressão: decisão reescrita';
    exception when raise_exception then
      if sqlerrm <> 'access change request already decided' then raise; end if;
    end;
  end loop;
  begin
    insert into access_admin_regression
      (tenant_id, change_id, subject_user_id, previous_profile, proposed_profile,
       reason, requested_by, requested_by_name, status, decided_by, decided_by_name,
       decided_at, decision_reason)
    values (tenant, 'invalid-self', 'qa-non-admin', '{}', '{"access":"admin"}',
      'Teste sem administrador', 'qa-non-admin', 'QA', 'REJECTED', 'qa-non-admin', 'QA', now(), 'Conferido');
    raise exception 'Regressão: não administrador decidiu alteração própria';
  exception when check_violation then null;
  end;
  begin
    insert into access_admin_regression
      (tenant_id, change_id, subject_user_id, previous_profile, proposed_profile,
       reason, requested_by, requested_by_name, status, decided_by, decided_by_name,
       decided_at, decision_reason)
    values ('qa-tenant-sem-vinculo', 'cross-tenant', admin_id, '{}', '{"access":"admin"}',
      'Teste de isolamento', admin_id, 'QA', 'REJECTED', admin_id, 'QA', now(), 'Conferido');
    raise exception 'Regressão: administrador sem vínculo decidiu alteração própria';
  exception when check_violation then null;
  end;
end;
$$;
drop table access_admin_regression;
