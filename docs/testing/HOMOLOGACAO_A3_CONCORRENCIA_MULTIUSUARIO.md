# Homologação A3 — concorrência multiusuário no Financeiro

Data: 14/10/2026

Ambiente: aplicação local conectada ao projeto Supabase do STRATO

## Objetivo

Confirmar com duas sessões autenticadas no mesmo tenant que um estado financeiro baseado em versão obsoleta não substitui uma gravação concorrente.

## Cenário e resultado

Um tenant, dois usuários financeiros, duas sessões opacas e um estado sintético foram criados exclusivamente para o ensaio.

| Verificação | Resultado |
| --- | ---: |
| leitura da sessão A | 200, versão 1 |
| leitura da sessão B | 200, versão 1 |
| gravação da sessão A | 200, versão 2, sequência 1 |
| gravação obsoleta da sessão B | 409 |
| estado final | versão 2, sequência 1 |

A sessão B recebeu a orientação para atualizar a tela. Sua tentativa de gravar a sequência 2 não alterou o estado vencedor, não gerou segundo comando efetivo e não sobrescreveu o ledger.

## Limpeza

A limpeza administrativa foi delimitada ao tenant sintético. A verificação final confirmou zero tenants, usuários, sessões, estados financeiros, comandos, eventos e itens de outbox temporários.

Ainda falta repetir visualmente o fluxo financeiro completo em dois navegadores. A integridade da concorrência no backend e no PostgreSQL está homologada.
