# Churume — retomada das correções

26/10/2026. **Publicado com autorização em26/10: código `3b99d42`.** Base funcional comparada à publicação `aa1aa8b`; alterações preexistentes do checkout preservadas. Sem migração produtiva, provedor pago, remessa real ou movimentação financeira real.

## Correções concluídas

| Frente | Defeito reproduzido | Resultado validado |
| --- | --- | --- |
| Conciliação/transferência | Duplo envio antes de rerender; fechamento antes da resposta; rejeição escapava | Trava síncrona; aguarda confirmação; erro/recusa mantém preparo |
| Conta/empresa | Modal antigo e leitura OFX sobreviviam à mudança de contexto | Contexto invalidado; leitura antiga não submete; OFX usa estado atual após leitura |
| Reabertura de modal | Confirmação antiga fechava novo rascunho no mesmo contexto | Sessão identifica cada preparo; três regressões para transferência/lançamento/diferença |
| Transferência | Mudança de origem mantinha destino incompatível | Destino recalculado nas opções válidas; domínio mantém validação |
| Cobrança/checagem | Envio duplicado, rascunho de outro título, resposta tardia no próximo título | Identidade empresa+título, trava e guarda de desmontagem; grade e Central reiniciam por escopo |
| Datas operacionais | Datas vazias/impossíveis aceitas nos handlers | Calendário real e hora local válida; notas e próximo contato obrigatórios preservados |
| Promessas | Data oculta persistia após trocar desfecho; quitado contado como promessa ativa | Data só acompanha promessa; saldo positivo obrigatório na lista ativa |
| Contatos | Principal vazio ocultava secundário; DDD55 gerava link errado | Primeiro contato preenchido e telefone nacional/internacional tratados |
| Entrada financeira | Vencimentos inexistentes aceitos; competência inválida virava vencimento; Infinity aceito | Calendário canônico em criação/edição/prorrogação/diário/fechamento e validação do agregado; valor finito obrigatório |
| Importação | Linha com data impossível aparecia pronta | Prévia sinaliza erro; linha inválida não entra. Importação mista mantém comportamento explícito de importar apenas linhas prontas |
| Parcelamento | Quantidade 3,5 dividia por 3,5 e criava só três parcelas, perdendo parte do total | Quantidade inteira; centavos preservados; fim de mês ajustado para fevereiro válido |

Decisão preservada: **Acordos mostra todo histórico de negociações**, inclusive títulos já quitados. Não alteradas regras de encargos, contabilização, alçadas ou recompra.

## Evidência e revisão

Testes novos executam componentes/handlers reais com hooks controlados e domínio real. Persistência de UI simulada para respostas true/false/rejeição/pendente. Isso não equivale a navegador ou fornecedor bancário homologado.

- Reprodução RED antes dos fixes: [datas](evidencias/datas-red.log), [importação/parcelas](evidencias/importacao-red.log). Demais casos e limites nos relatórios [conciliação](conciliacao.md) e [carteira](carteira.md).
- Novas regressões: `finance-date-entry-integrity.test.ts`, complementos em `finance-ui-confirmation-audit.test.ts`, `churume-reconcile-interaction.test.ts`, `churume-reconcile-independent-review.test.ts` e `churume-portfolio-details-interaction.test.ts`.
- Revisão independente encontrou resposta antiga fechando novo modal; corrigido e confirmado GREEN. Revisão independente final de datas/persistência/importação/parcelamento e keys de escopo não encontrou novo defeito concreto. Cinco arquivos/61 casos dirigidos passaram nessa revisão antes dos complementos finais.
- [Build](evidencias/build.log): aprovado.
- [PostgreSQL descartável](evidencias/postgres.log): 40 migrações apenas no cluster temporário; 29 testes SQL aprovados, 2 de documentos aprovados, backup/restauração de 74 tabelas/1.464 linhas com hashes e metadados iguais; HTTP restaurado autenticado, isolamento e logout aprovados. Cluster encerrado. Runner existente não certifica cada novo formulário nem dados legados produtivos.
- [Check global final](evidencias/check.log): aprovado — tipos, lint, formatação; 1.177 testes aprovados e 30 ignorados, 178 arquivos aprovados e 6 ignorados. São 72 testes a mais que a publicação anterior (1.105). Nenhum ignorado contado como aprovação.

## Limites e próximos blocos

- Não houve nova execução de navegador nesta retomada. Troca real de escopo/título, teclado/foco, campos nativos, celular, clipboard e todas as subtelas continuam pendentes de homologação visual individual.
- Nenhum botão do inventário é considerado aprovado apenas por pertencer a componente coberto. Inventário geral e pendências externas do dossiê anterior permanecem válidos; não declarar cobertura total.
- Validação de agregado também recusa datas inválidas antigas. Não foram consultados nem corrigidos dados produtivos: se houver registro legado inválido, exige saneamento explícito e auditável antes de nova gravação; não normalizar silenciosamente.
- Livre catálogo de departamentos e tetos de alçada por valor continuam no planejamento anterior; não implementados neste lote.
- Publicação concluída; saúde interna/pública conferida. Registro em `docs/deployments/2026-10-26-retomada-churume.md`. Próximo bloco: homologação visual local das rotinas corrigidas, depois demais controles ainda sem execução individual.
