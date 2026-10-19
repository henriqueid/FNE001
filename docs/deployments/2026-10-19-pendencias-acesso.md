# Pendências e notificações de acesso · 19/10/2026

Solicitação do usuário durante o teste produtivo: alteração própria entrou em aprovação, administrador não podia decidir e pendência não notificou. Pedido próprio pendente confirmado por leitura no banco, sem alterar o perfil.

Corrigidos endpoint legado de solicitação (administrador vigente aplica direto), decisão de pedidos antigos (administrador pode decidir o próprio, com conferência do perfil original) e fila visual. Notificações projetam pendências existentes pelo tenant com IDs estáveis e visibilidade limitada a administradores e gestores solicitantes; deixam de existir quando resolvidas. Nenhuma migração e nenhuma aprovação real automática.

Verificação: check 700 testes aprovados/14 ignorados, build aprovado, revisão independente sem bloqueios. Publicação pendente.
