# Homologação A1 — concorrência multiusuário em Operações

Data: 14/10/2026

Ambiente: aplicação local conectada ao projeto Supabase do STRATO

## Objetivo

Confirmar com duas sessões autenticadas no mesmo tenant que uma atualização baseada em versão obsoleta não sobrescreve a gravação de outra pessoa.

## Cenário

Foram criados temporariamente um tenant, dois usuários com o mesmo escopo empresarial, duas sessões opacas e uma operação sintética na versão 1.

As duas sessões leram a mesma versão antes de qualquer alteração. Em seguida:

1. a sessão A salvou sua mudança com `expectedVersion = 1`;
2. a operação avançou para a versão 2;
3. a sessão B tentou salvar sua cópia ainda baseada na versão 1;
4. o servidor respondeu 409 e orientou atualizar a tela;
5. uma nova leitura confirmou a versão 2 e preservou integralmente a alteração da sessão A.

## Defeito encontrado e corrigido

Na primeira execução, o PostgreSQL recusou a gravação porque o parâmetro `operationId` usado no JSON da outbox não possuía cast explícito. A consulta foi corrigida para `?::text` e recebeu teste automatizado de regressão.

Após a correção, o resultado foi:

| Verificação | Resultado |
| --- | ---: |
| leitura da sessão A | 200, versão 1 |
| leitura da sessão B | 200, versão 1 |
| gravação da sessão A | 200, versão 2 |
| gravação obsoleta da sessão B | 409 |
| versão final | 2 |
| conteúdo final | alteração da sessão A preservada |

## Limpeza

O mecanismo append-only bloqueou a primeira tentativa de excluir o evento de teste, como esperado. A limpeza foi então executada em uma transação administrativa restrita ao tenant sintético. A conferência final retornou zero tenants, usuários, sessões, operações, recebíveis, eventos e itens de outbox temporários.

Ainda falta repetir visualmente a experiência completa em dois navegadores. A integridade do backend, do banco e da mensagem de conflito está homologada.
