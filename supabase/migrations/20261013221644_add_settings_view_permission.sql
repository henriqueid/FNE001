-- Todo membro do tenant precisa ler a empresa e as políticas efetivas para
-- executar o trabalho, sem receber capacidade de alterá-las.
insert into private.access_permissions (tenant_id, user_id, permission)
select tenant_id, user_id, 'settings:view'
from private.tenant_memberships
on conflict (tenant_id, user_id, permission) do nothing;
