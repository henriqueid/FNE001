# Matriz de acesso e escopo do STRATO

Atualizada em 13/10/2026. Esta matriz descreve os controles efetivamente aplicados pelo backend; a visibilidade do menu não substitui autorização da API.

## Camadas obrigatórias

1. **Sessão:** token opaco, válido, não revogado e não expirado.
2. **Tenant:** o usuário precisa possuir vínculo ativo com o `x-strato-tenant-id` solicitado.
3. **Permissão:** a ação exige a capacidade funcional correspondente.
4. **Empresa/veículo:** registros operacionais só podem ser lidos ou alterados quando o veículo está em `company_scopes` do vínculo.
5. **Alçada:** decisões materiais podem exigir uma atribuição de alçada vigente além da permissão.
6. **Concorrência e idempotência:** comandos materiais precisam impedir sobrescrita silenciosa e repetição de efeitos.

Escopo vazio significa nenhum veículo autorizado. O valor `*` é reservado para atribuição explícita de acesso a todos os veículos do tenant.

## Perfis e capacidades padrão

| Perfil          | Leitura principal                            | Comandos materiais                                                 |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| Diretoria/admin | Todas as áreas atribuídas                    | Administração, parâmetros e comandos funcionais conforme escopo    |
| Operações       | Operações                                    | Criar e alterar operação                                           |
| Risco e crédito | Operações e decisões                         | Decidir exceções dentro da alçada atribuída                        |
| Controladoria   | Operações e carteira                         | Formalizar e manter carteira                                       |
| Financeiro      | Financeiro e operação necessária à liberação | Liberar, liquidar, estornar e fechar                               |
| Comercial       | Comercial, operação e carteira comercial     | Manter funil, vínculos, visitas, propostas e cobranças autorizadas |
| Cadastro        | Cadastro                                     | Criar e atualizar partes                                           |

## Matriz de APIs

| API                               | Leitura                      | Escrita                                                                                 | Escopo adicional                                                | Situação                                |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| `/api/operations`                 | capacidade operacional       | uma entre `operations:edit`, `risk:decide`, `controlleria:formalize`, `finance:release` | tenant + empresa/veículo atual e solicitado                     | empresa aplicada                        |
| `/api/decisions`                  | `operations:view`            | permissão por tipo de evento + alçada quando exigida                                    | tenant + empresa/veículo da operação                            | empresa aplicada                        |
| `/api/commercial`                 | `dashboard:view`             | `portfolio:manage`; decisão exige `risk:decide`                                         | tenant                                                          | revisar segmentação futura              |
| `/api/portfolio`                  | `dashboard:view`             | `portfolio:manage` ou `controlleria:formalize`                                          | tenant + empresa do título; merge preserva títulos não visíveis | empresa aplicada                        |
| `/api/finance`                    | `finance:view`               | `finance:release`; configuração global exige `settings:manage`                          | tenant + empresa; merge preserva dados não visíveis             | empresa aplicada                        |
| `/api/registry/parties`           | sessão do tenant             | `registry:edit`                                                                         | tenant                                                          | permissão de leitura explícita pendente |
| `/api/receivables`                | capacidade operacional       | sem escrita direta                                                                      | tenant + empresa da operação                                    | empresa aplicada                        |
| `/api/tasks`                      | `dashboard:view`             | `dashboard:view`, com regras de autoria                                                 | tenant + empresa da operação referenciada                       | empresa aplicada                        |
| `/api/eligibility-policies`       | `settings:manage`            | `settings:manage` + aprovação identificada                                              | tenant                                                          | concluído                               |
| `/api/access/users`               | `users:manage`               | `users:manage`                                                                          | tenant                                                          | concluído                               |
| `/api/company`                    | sessão do tenant             | `settings:manage`                                                                       | tenant                                                          | concluído                               |
| `/api/integrations/cnpj`          | sessão/permissões funcionais | consulta externa autorizada                                                             | tenant                                                          | concluído                               |
| `/api/intelligence/configuration` | `settings:manage`            | `settings:manage`                                                                       | tenant                                                          | concluído                               |
| `/api/copilot/chat`               | `dashboard:view`             | consulta assistida, sem comando material                                                | tenant                                                          | revisar fontes por empresa              |
| `/api/outbox/process`             | `operations:view`            | reprocessamento exige `users:manage`                                                    | tenant + empresa da operação                                    | empresa aplicada                        |

## Regras já verificadas

- Uma sessão do tenant A não autentica no tenant B sem vínculo correspondente.
- A consulta de operação usa o tenant da identidade autenticada, nunca um tenant do corpo da requisição.
- A listagem de operações remove veículos fora de `company_scopes`.
- A atualização valida tanto o veículo atualmente persistido quanto o veículo solicitado, impedindo trazer para o próprio escopo uma operação alheia pelo mesmo identificador.
- Decisões só podem ser lidas ou criadas quando a operação associada pertence ao escopo de empresa do usuário.
- A Carteira retorna somente títulos das empresas autorizadas e recompõe o agregado completo no servidor, preservando títulos de outros escopos durante a gravação.
- Recebíveis são filtrados pela empresa da operação de origem; consulta explícita a operação fora do escopo é recusada.
- Notificações operacionais exigem que a operação relacionada pertença a uma empresa autorizada.
- O Financeiro filtra todo o grafo por empresa e recompõe o agregado completo na gravação, sem apagar ou substituir dados ocultos.
- Tarefas com operação vinculada exigem o escopo da empresa dessa operação; o perfil administrativo não ignora essa barreira.
- Publicação, contadores de saúde e reprocessamento manual da outbox usam a empresa da operação do evento como filtro no banco.

## Próximos endurecimentos

1. Separar permissões de leitura e manutenção onde hoje uma permissão ampla atende aos dois usos.
2. Aplicar maker-checker em liberação financeira, exceção de risco e alterações críticas de configuração.
3. Centralizar recibos idempotentes, event ledger e outbox em um contrato comum.
4. Executar homologação com duas sessões e dois tenants, incluindo tentativas deliberadas de acesso cruzado.
