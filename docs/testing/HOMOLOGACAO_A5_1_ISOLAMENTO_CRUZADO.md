# Homologação A5.1 — isolamento cruzado

Data: 14/10/2026

Ambiente: aplicação local conectada ao projeto Supabase do STRATO

## Objetivo

Confirmar em execução real que a sessão é vinculada ao tenant e que o escopo empresarial limita leitura e alteração de operações, mesmo quando o cliente forja o cabeçalho ou o corpo da requisição.

## Cenário controlado

Foram criados temporariamente:

- dois tenants independentes;
- um usuário e uma sessão opaca por tenant;
- uma operação visível para cada usuário;
- uma segunda operação no tenant A, vinculada a empresa fora do escopo do usuário A.

Os registros usaram apenas identificadores e dados sintéticos de homologação.

## Resultados

| Verificação | Resultado | Evidência |
| --- | ---: | --- |
| sessão A no tenant A | 200 | principal retornou `uat-cross-a` |
| sessão A forjando tenant B | 401 | sessão não foi aceita fora do vínculo |
| sessão B no tenant B | 200 | principal retornou `uat-cross-b` |
| sessão B forjando tenant A | 401 | sessão não foi aceita fora do vínculo |
| operações A no tenant A | 200 | somente `op-uat-cross-a` |
| operações A forjando tenant B | 401 | nenhum dado retornado |
| operações B no tenant B | 200 | somente `op-uat-cross-b` |
| operações B forjando tenant A | 401 | nenhum dado retornado |
| operação de outra empresa no mesmo tenant | oculta | a leitura manteve somente a operação permitida |
| alteração da operação oculta | 403 | origem fora do escopo foi recusada |
| mudança da operação visível para empresa não autorizada | 403 | destino fora do escopo foi recusado |

As verificações complementam os testes automatizados de Carteira, Recebíveis, Financeiro, Tarefas, Outbox, Comercial, Cadastro, Configurações e Copiloto. O vínculo da sessão ao tenant acontece antes de qualquer repositório de domínio ser consultado.

## Limpeza

Após o ensaio, uma consulta independente confirmou contagem zero para:

- tenants temporários;
- usuários temporários;
- sessões temporárias;
- vínculos e permissões temporários;
- operações temporárias.

Nenhum dado operacional existente foi alterado.
