# Churume — conciliação, extrato e transferência

Data: 2026-10-26. Ambiente: checkout local; fixtures `seedFinance("2026-10-26")`, conta `cb-1`, arquivos/descrições CHURUME. Sem rede, PostgreSQL, produção, publicação, migração ou consumo pago.

## Método e evidência

Executados handlers reais dos componentes com hooks React controlados. Motor financeiro real; somente estado React e fronteira de persistência substituídos por controle local. Formulário `TransferModal` também executado; seus resultados passam pelo handler real de `ExtractTab`.

Teste exclusivo: `tests/churume-reconcile-interaction.test.ts`.

RED inicial após ajuste do seletor do teste: 8 falhas comportamentais / 10 casos. Confirmação false/true na conciliação já funcionava. Falharam trava de clique, rejeição da conciliação, mudanças de conta/escopo, OFX atrasado e três variantes de confirmação de transferência. RED adicional: mudança da origem de transferência mantinha destino anterior (`cb-2` em lugar de `cb-1`).

GREEN final: 18 casos novos; conjunto dirigido 61 testes aprovados em 4 arquivos. Comando:

```sh
npx vitest run tests/churume-reconcile-interaction.test.ts tests/finance-reconciliation.test.ts tests/finance-ui-confirmation-audit.test.ts tests/finance.test.ts
```

ESLint dos dois componentes e teste exclusivo aprovado. Prettier aplicado somente nesses arquivos; verificação final sem diferença pendente de formatação. Suíte global/typecheck/build não executados por delimitação desta frente.

## Matriz executada

Todos resultados abaixo APROVADOS após correções. Nenhum significa homologação bancária.

| Caso | Ação e evidência observada |
| --- | --- |
| Conciliação, duplo clique | Mesmo handler antes de qualquer render: apenas uma submissão enquanto promessa pendente. |
| Conciliação, false | Modal aberto enquanto aguarda; permanece após recusa. |
| Conciliação, true | Modal aberto enquanto aguarda; fecha após confirmação. |
| Conciliação, rejeição | Erro apresentado, promessa capturada e modal preservado. |
| Conciliação, troca de conta | Modal da linha anterior descartado. |
| Conciliação, troca de escopo | Modal da linha anterior descartado mesmo com mudança externa de escopo. |
| OFX, leitura atrasada/troca de conta | Leitura resolve após mudança; zero submissões/zero mensagem de importação. |
| OFX, leitura atrasada/troca de escopo | Mesmo comportamento para empresa/escopo diferente. |
| Extrato, false | Transferência não fecha antes da resposta nem após recusa. |
| Extrato, true | Transferência fecha somente após confirmação. |
| Extrato, rejeição | Rejeição capturada; modal permanece. |
| Transferência, formulário/duplo clique | Dois cliques geram uma submissão; resultado real contém saída -15 em cb-1 e entrada +15 em cb-2; descrição preparada permanece após false. |
| Extrato, troca de conta | Modal antigo descartado. |
| Extrato, troca de escopo | Modal antigo descartado. |
| OFX, snapshot atualizado | Título adicionado durante leitura preservado no resultado; nova linha na cb-1; mensagem somente após true. |
| Transferência, troca da origem | De cb-1 para cb-2: destino exibido cb-1 e resultado real válido. |
| OFX, false | Uma submissão; nenhuma confirmação de importação. |
| OFX, rejeição | Uma submissão, sem reenvio de resultado de erro; erro apresentado. |

## Defeitos e causa

- P1: fechamento prematuro da transferência. Wrapper chamava `onApply` sem aguardar e fechava com base somente em `result.error`. Agora aguarda booleano confirmado e captura rejeição.
- P1: repetição de submissão antes da confirmação. Ausência de trava síncrona permitia dois resultados calculados do mesmo snapshot. Ref bloqueia submissão concorrente na conciliação/importação e transferência.
- P1: modal e leitura OFX mantinham contexto antigo após troca de conta/escopo. Preparação agora reinicia por contexto; token de sessão invalida resposta/leitura antiga. OFX usa estado mais recente após leitura.
- P2: rejeição de conciliação escapava; rejeição de OFX podia provocar segunda chamada a `onApply` com erro. Erros agora ficam na tela e preservam preparo.
- P2: mudança de origem da transferência mantinha destino fora das opções válidas (inclusive igual à nova origem). Handler da origem agora escolhe primeiro destino da mesma empresa ou vazio; domínio continua validando regras.

## Arquivos e limites

Alterados somente `src/features/finance/tabs/reconcile-tab.tsx`, `src/features/finance/tabs/statement-tab.tsx`, teste exclusivo e este relatório. Nenhuma regra financeira alterada; motor permanece determinístico.

NÃO EXECUTADO: navegador/DOM real, teclado, acessibilidade visual, celular, servidor HTTP, banco PostgreSQL e banco homologado. Hooks controlados comprovam efeitos/argumentos dos handlers, não montagem React integral nem persistência real. Fixtures não movimentam recursos. Mudanças anteriores do checkout preservadas.

## Revisão independente — sessão de modal

Agente carteira reproduziu P2 adicional: transferência pendente → fechar → reabrir no mesmo contexto → confirmação antiga fechava novo rascunho. Reproduzido também em lançamento do extrato e diferença: três casos RED. Tokens agora invalidam sessão ao abrir/fechar modal; resposta anterior não fecha nem limpa novo preparo. `tests/churume-reconcile-independent-review.test.ts` pertence ao revisor e foi preservado.

GREEN dirigido final desta frente: 20 casos próprios + 1 independente; com domínio/financeiro existente, 51 testes aprovados em 4 arquivos (sem arquivo paralelo ainda em desenvolvimento).

Execução intermediária incluindo `finance-ui-confirmation-audit.test.ts` encontrou 5 RED de desenvolvimento paralelo da frente principal: vencimentos 31/02/2026, 29/02/2025, 2026-04-31; competência inválida; teste parcelamento procurando campo ainda não disponível. Informados ao principal; não alterados nesta frente. Naquela execução: 64 aprovados / 5 falhas. Esses resultados substituem contagem agregada inicial de 61, anterior aos novos testes paralelos.

Verificação agregada posterior encontrou erros de tipo exclusivamente no teste novo: fixture omitia `importedAt`/`importedBy` e matriz de resultados alargava literal `reject` para string. Fixture completada, matriz marcada `as const`. `npm run typecheck` aprovado após ajuste; 21 casos próprios + independente continuam GREEN; ESLint do teste aprovado. Nenhuma alteração de produto nessa rodada.
