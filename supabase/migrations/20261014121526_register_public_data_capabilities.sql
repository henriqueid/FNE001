alter table private.integration_provider_configs
  drop constraint integration_provider_configs_capability_check;

alter table private.integration_provider_configs
  add constraint integration_provider_configs_capability_check
  check (capability in (
    'CNPJ_LOOKUP',
    'CEP_LOOKUP',
    'BANK_DIRECTORY',
    'HOLIDAY_CALENDAR',
    'PIX_DIRECTORY'
  ));

insert into private.integration_provider_configs
  (tenant_id, provider_id, capability, status, priority, config, updated_by)
select
  tenant.tenant_id,
  'BRASIL_API',
  capability.name,
  'ACTIVE',
  10,
  capability.config,
  membership.user_id
from private.tenants tenant
cross join lateral (
  select user_id
  from private.tenant_memberships
  where tenant_id = tenant.tenant_id
  order by created_at
  limit 1
) membership
cross join (values
  ('CEP_LOOKUP', '{"cacheDays":7,"timeoutMs":10000,"sourceType":"PUBLIC"}'::jsonb),
  ('BANK_DIRECTORY', '{"cacheDays":7,"timeoutMs":10000,"sourceType":"PUBLIC"}'::jsonb),
  ('HOLIDAY_CALENDAR', '{"cacheDays":30,"timeoutMs":10000,"sourceType":"PUBLIC"}'::jsonb),
  ('PIX_DIRECTORY', '{"cacheDays":7,"timeoutMs":10000,"sourceType":"PUBLIC"}'::jsonb)
) as capability(name, config)
on conflict (tenant_id, provider_id, capability) do nothing;

update private.integration_provider_configs
set config = config || '{"sourceType":"PUBLIC"}'::jsonb
where provider_id = 'BRASIL_API'
  and not (config ? 'sourceType');

comment on table private.integration_provider_configs is
  'Registro server-only de provedores por capacidade; não armazena segredos e governa quais chamadas externas podem executar.';
