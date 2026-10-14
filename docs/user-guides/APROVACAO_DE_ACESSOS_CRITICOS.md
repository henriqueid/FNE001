# Aprovação de acessos críticos

Atualizado em 14/10/2026.

## Quando a aprovação independente é obrigatória

O STRATO exige uma segunda pessoa para mudanças que ampliem poder ou alterem a identidade usada no acesso:

- ativar um usuário novo ou reativar um acesso;
- promover operador para gestor ou administrador;
- adicionar permissões, áreas de atuação ou alçadas formais;
- ampliar empresas e veículos visíveis;
- trocar e-mail, login personalizado ou CPF de acesso.

Suspensão e redução de privilégio continuam imediatas para não atrasar uma contenção de segurança.

## Fluxo operacional

1. O administrador prepara a alteração no perfil.
2. O STRATO identifica os itens críticos e mantém o perfil vigente sem mudanças.
3. O solicitante informa motivo e evidência e seleciona **Enviar para aprovação**.
4. A solicitação aparece na fila com o perfil anterior, a proposta e as diferenças relevantes.
5. Outro administrador confere a origem da solicitação e escolhe **Aprovar e aplicar** ou **Rejeitar**.
6. Na aprovação, o servidor confere novamente se o perfil vigente ainda é igual ao observado na solicitação.
7. Se houve mudança concorrente, a aplicação é recusada e uma nova proposta deve ser preparada.

## Regras de segregação

- o solicitante não pode decidir a própria solicitação;
- o usuário beneficiado não pode aprovar a própria elevação;
- somente um administrador ativo pode tomar a decisão;
- cada usuário admite apenas uma alteração crítica pendente;
- a proposta fica congelada e não pode ser reescrita;
- aprovação e rejeição são decisões terminais;
- a autoria é obtida da sessão autenticada, nunca do navegador;
- o evento de aplicação fica registrado na trilha imutável de acessos.

## Conferência recomendada

- confirme a identidade do usuário por canal independente;
- valide se a função exige realmente cada permissão, alçada e empresa solicitada;
- verifique conflitos de função entre preparação, decisão, liberação e pagamento;
- para alteração de login, e-mail ou CPF, confira a documentação e a solicitação formal;
- rejeite propostas genéricas, sem prazo ou sem justificativa verificável.

## Senhas e sessões

Senhas não aparecem na proposta nem na fila de aprovação. O STRATO armazena somente hashes. Recuperação de senha, MFA e revisão centralizada de sessões pertencem ao pacote de segurança de conta e não devem ser substituídos por envio de senha em mensagens ou por edição direta no banco.

## Ambiente de demonstração

O modo de demonstração mantém alterações diretas para facilitar treinamento. A segregação é obrigatória no ambiente real autenticado.
