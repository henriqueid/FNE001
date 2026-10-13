-- Leitura e manutenção cadastral são capacidades distintas. Usuários que já
-- podiam editar preservam o acesso de leitura durante a transição.
insert into private.access_permissions (tenant_id, user_id, permission)
select tenant_id, user_id, 'registry:view'
from private.access_permissions
where permission = 'registry:edit'
on conflict (tenant_id, user_id, permission) do nothing;
