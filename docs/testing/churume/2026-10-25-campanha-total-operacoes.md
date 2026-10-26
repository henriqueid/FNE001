# Churume — campanha total: operações, comercial e políticas

Data: iniciada em 25/10/2026; probe OP-04 concluído em 26/10/2026, 00:01, America/Sao_Paulo. Auditoria local, árvore de trabalho com alterações anteriores preservadas. Produto não corrigido. Sem banco remoto, credenciais, consulta paga, transmissão bancária ou movimentação real.

## Cobertura e evidência

Inventário integral: **151 arquivos** — 95 operações UI, 17 comercial UI, 1 políticas UI, 13 servidor operações, 4 servidor comercial, 14 domínio operações, 7 domínio comercial. Cada arquivo, quantidade de linhas e ocorrências de controles constam em [inventário](2026-10-25-campanha-total/evidencias-operacoes/inventario-fontes.md); [JSON](2026-10-25-campanha-total/evidencias-operacoes/inventario-fontes.json) preserva handlers e linhas. Inventário sintático não comprova funcionamento.

Executados nesta frente: **233 testes existentes, 36 arquivos, todos aprovados; 4 probes adicionais, aprovados ao reproduzir defeitos**. Total 237 asserções/cenários de teste aprovados não representa 237 controles navegados. Testes usam funções, SSR e adaptadores locais; não representam PostgreSQL real. Comandos e prova preservados em [evidências](2026-10-25-campanha-total/evidencias-operacoes/README.md).

Nenhuma interação de navegador nesta frente: navegador reservado ao agente principal. Estado por família abaixo separa inspeção, execução dirigida e bloqueios. Todas as linhas de UI permanecem **INSPECIONADO / NÃO EXECUTADO em navegador**, exceto provas de composição/handlers indicadas explicitamente. APIs externas e persistência PostgreSQL: **BLOQUEADO nesta frente**.

## Achados reproduzidos

### OP-01 — P1 — CCB disponível, criação sem saída operacional

Estado: **FALHOU**, composição + domínio + SSR executados; clique de navegador não executado nesta frente.

1. Nova operação; cedente válido; escolher Crédito estruturado; iniciar.
2. Esperado: cadastrar partes, condições financeiras, cronograma e garantias prometidos pelo modal.
3. Observado: `buildNewOperation` cria CCB em Entrada com zero títulos; `StageContent` monta `EntryRecordPanel`, somente consulta, sem input. Avanço retorna “ao menos um título válido”. Não há editor CCB ou ação de incluir carteira nessa tela.
4. Consequência: modalidade anunciada cria operação que não pode completar a Entrada; resta cancelamento.

Causa: `src/features/operations/new-operation/new-operation-modal.tsx:362` promete editor; criação habilitada em `:393`; `src/features/operations/workspace/stage-content.tsx:91` envia toda origem diferente de digitação manual ao painel de leitura. Bloqueio em `src/features/operations/workspace/workspace-model.ts:80`.

Prova: `reproduz CCB criada vazia, Entrada só leitura, avanço bloqueado` no probe preservado. Recomendação: implementar jornada CCB ou indisponibilizar origem com motivo explícito até existir implementação.

### OP-02 — P2 — Comitê abre dossiê de homônimo errado

Estado: **FALHOU**, handler real do componente executado com fixture controlada.

1. Dois prospects com mesmo nome e IDs/documentos distintos; comitê vinculado por `prospectId` ao segundo.
2. Acionar `Ver dossiê` no card desse comitê.
3. Esperado: abrir prospect identificado pelo `prospectId`.
4. Observado: callback recebe primeiro prospect com mesmo nome; card técnico já usa resolução por ID, mas botão refaz busca apenas por nome.
5. Consequência: analista examina documentos de outra oportunidade antes de decisão de limite. Não foi demonstrado vazamento entre tenants; cenário reproduzido dentro do mesmo estado autorizado.

Causa: `src/features/commercial/tabs/committees-tab.tsx:139–142`; resolução correta do card em `:68–70` não é reaproveitada.

Prova: `reproduz Ver dossiê de comitê enviando homônimo errado ao handler`. Recomendação: usar prospect já resolvido por ID; fallback nominal apenas para legado sem ID, com ambiguidade tratada.

### OP-03 — P2 — Consulta ativa Receita/bureau só altera indicador local

Estado: **FALHOU**, handlers do componente e hook real executados com provedores configurados ATIVA; nenhum fornecedor chamado.

1. Configuração Receita/Bureau `ATIVA`; operação em Risco com sacado.
2. Acionar `Consultar cadastro` e `Consultar bureau`, ambos habilitados.
3. Esperado: executar consulta suportada ou comunicar indisponibilidade sem afirmar consulta concluída.
4. Observado: ambos chamam `markConsulted`, apenas `setConsulted`; nenhuma chamada de rede, alteração de operação ou evidência. Após chave em `consulted`, rótulos tornam-se “Consulta atualizada” e “Bureau consultado”. Receita exibe “fonte oficial ativa” por configuração, sem resposta oficial obtida.
5. Consequência: sinal de consulta concluída pode induzir revisão de crédito com dados não atualizados. Limitação do provedor não justifica feedback conclusivo.

Causa: `src/features/operations/risk/debtor-statement.tsx:89–107`; `src/features/operations/risk/use-risk-review.ts:93`.

Prova: `reproduz consulta Receita/bureau ativa que apenas marca estado local`. Recomendação: conectar endpoint/evidência e estado de erro ou desabilitar consulta real e identificar simulação explicitamente.

### OP-04 — P1 — Devolver Aprovação ao Risco usa persistência que proíbe retorno

Estado: **FALHOU**, transformação real e guarda do servidor executadas juntas; fluxo de encaminhamento inspecionado. Clique autenticado HTTP não executado.

1. Operação etapa 5; preencher justificativa válida; acionar Devolver para risco.
2. `ApprovalPanel.returnToRisk` chama `withOperationReturnedToRisk`, muda etapa para 2, limpa decisões e chama `onChange` genérico.
3. `strato-app.persistRealOperation` encaminha alteração ao `persistOperation`, sempre `PUT /api/operations`.
4. Rota rejeita alteração de `approvals`/`finalDecision` fora do comando dedicado; mesmo sem essa diferença, `assertOperationTransition` rejeita qualquer retrocesso com “O retorno de etapa exige o fluxo explícito de devolução.”
5. Esperado: devolução autorizada à análise de risco, trilha e pacote decisório invalidado. Observado dirigido: transformação produz etapa 2 e guarda real rejeita. `/api/operations/return` só atende devolução financeira liberada e não está ligado a esse botão.

Consequência: retorno da aprovação para correção de risco não persiste no autenticado. Demonstração sem servidor pode aparentar sucesso; risco de tela local divergente até recarga/erro.

Causa: `src/features/operations/approval/approval-panel.tsx`, `returnToRisk`; `src/features/operations/approval/approval-model.ts:327`; `src/app/operations-client.ts:18`; `app/api/operations/route.ts:78`; `src/server/operations/governance.ts:133`. Prova `reproduz devolução da Aprovação ao Risco recusada pelo guard usado no PUT`. Recomendação: comando dedicado autorizado de devolução pré-liberação, com invalidação auditável, conectado ao botão.

## Limitações de interface inspecionadas

- `ApprovalSignatures > Configurar` chama somente `setFeedback` com disponibilidade futura (`approval-panel.tsx`, callback `onConfigureProvider`); não navega às configurações. **INSPECIONADO**, sem execução do botão nesta frente.
- `Enviar para assinaturas` chama `sendForSignatures`, marca registros `Enviado` e informa “na simulação”; fornecedor não é chamado. A UI não recebe prop de modo no cartão. Registro eletrônico real não homologado. **INSPECIONADO**, não confundir marcação local com entrega eletrônica.
- `Carteira comercial > Cadastro` chama apenas `onNavigate("registry")`, sem identidade do cedente. Destino é módulo correto, porém não existe abertura direta da ficha pelo contrato do callback. **INSPECIONADO**.
- Ranking comercial usa `<tr onClick>` sem teclado/`pressable`; expansão de comitês, comissões e negócios também usa linhas clicáveis. Navegação por teclado não comprovada; ocorrência sintática preservada.
- Vários registros locais de risco/lastro/preço/cancelamento usam nome literal “Henrique”. Eventos de servidor registram `actor_id`; auditoria não comprovou que todo campo de autoria do payload seja substituído. Não classificado como fraude/autoria efetivamente incorreta sem execução autenticada por outro usuário.

## Matriz completa de famílias e destinos

Legenda: **I** = INSPECIONADO, UI em navegador NÃO EXECUTADA nesta frente; **T** = regra/serviço executado em teste dirigido, sem equivalência a clique; **F** = falha reproduzida acima; **B** = depende integração/ambiente ausente. Os arquivos auxiliares sem controles aparecem no inventário e alimentam família correspondente.

### Central e workspace

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Nova operação, voltar, abrir linha/card | `onNew`, `onOpen(op)`, `onBack` → modal/workspace/central em `strato-app` | Operação selecionada preserva ID/empresa | I |
| Filas ativa/intervenção/alçada/formalização/liberada/cancelada | `selectQueue` → scope; redefine filtro de alçada; fila não ativa força lista | Contagem e linhas coerentes com empresa/período/filtros | I |
| Hoje/histórico/período, busca, etapa/status/origem, filtros e limpar | `useOperationsFilters` → listas derivadas; `clearFilters` volta Hoje | Limpar também muda recorte temporal; limites datas merecem browser | I |
| Lista/kanban; alçada exigida | `setDisplayMode`, `setAuthorityFilter`; `pendingAuthoritiesFor` | Somente alçadas ainda pendentes; filtros da tela aplicados ao kanban | I/T eligibility |
| Restaurar demo | `onReset` → callback do app; comercial usa `seedCommercial` após confirmação nativa | Exclusivo demonstração; nunca autenticado | I |
| Etapas 1–6, etapa atual, resumo liberado/etapas | `setActive`, `setWorkspaceView`, `onGoToCurrentStage` | Futuras bloqueadas; anteriores/finalizadas consulta | I/T workflow-guardrails |
| Concluir e avançar | `useStageAdvance` → `stageAdvanceBlocker` → `withCurrentStageCompleted` → `commit` | Cedente/títulos/decisões/lastro/preço/assinaturas; área da etapa no servidor | I/T consistency, validation |
| Cancelar, motivo/categoria/confirmar/fechar | `CancellationModal` → `cancelOperation` → `withCancellation` | Sem exclusão; liberadas não oferecem cancelar; `operations:edit` | I/T workflow/governance |
| Associar cedente, buscar/escolher, voltar | `AssignCedentModal` → `assignCedent`/`withCedent` | Cedente obrigatório; documento, limite, score e lastro do escolhido | I |
| Resumo lateral, pin/densidade, observação financeira | setters locais; blur/commit → operação | Histórico/finalizada somente consulta; texto financeiro auditável | I |

### Entrada

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Cedente, origem (5 opções), destino | `setCedentId`, `chooseSource` limpa análise, `setDestinationName` | Empresa existente e cedente correto; `operations:edit` no servidor | I |
| Selecionar/trocar XML, CNAB, CSV; modelo CSV | `analyzeFile` → `normalizeOperationIntake`; `downloadTemplate` → `saveFile` | XML válido/inválido; CNAB 240/400 comum; CSV UTF8; XLSX exige conversão; duplicidade | I/T intake; leitura bancária real B |
| Iniciar/cancelar/fechar/fundo modal | `onCreate` com dados normalizados; `onClose` | Bloqueado sem cedente e lote BLOQUEADO; novos sacados explícitos | I/T intake |
| Crédito estruturado / CCB | criação → `EntryRecordPanel` sem editor | Partes/cronograma/garantias anunciados indisponíveis | F OP-01 |
| Tipo recebível, cheque separado, modo individual/parcelas | `chooseType`, setters; bloqueio mistura após títulos | Duplicata/cheque/promissória/transferibilidade/garantia; tipo travado após gravação | I/T consistency |
| Busca sacado, selecionar, cadastrar agora | `changeDebtorQuery`, `searchDebtor`, `openDebtorFormWithQuery` | Sacado existente/provisório; documento/endereço/contato conforme requisitos | I |
| Cadastro rápido, Receita/CEP, salvar/fechar | `QuickDebtorForm` → consulta cadastral/endereço e `registerDebtor` | CPF/CNPJ válido, campos obrigatórios; fonte externa falha e pendência | I; externo B |
| Campos título/cheque/CMC7/valor/desconto/datas | `setField`, `completeDraft`, `entryDraftBlockers` | Valores positivos, data, desconto ≤ valor, NF-e quando exigida | I/T consistency |
| Salvar/atualizar, copiar anterior, parcelas ≤120 | `saveSingle`, `copyPrevious`, `generateInstallments` | Sem sacado, duplicidade, parcelas inválidas, centavos rateados | I/T consistency/intake |
| Editar/cancelar edição/excluir um/excluir todos/confirmação | `editEntry`, `cancelEdit`, `deleteEntry`, `deleteAllEntries` | Recalcula agregado; modal exclusão; nenhuma mutação etapa histórica | I |
| Registro importado, lote/hash/linhas/rejeições | `EntryRecordPanel` somente leitura | Evidência preservada; lote vazio não avança | I/T workflow-guardrails |

### Risco, política aplicada e lastro

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Seleção sacado, cedente, histórico/grupo/título/fechar | `setSelectedKey`, `setDetail`, `setSelectedTitle` → modais/ledgers | Entidade e documento corretos; sem aprovação ao simplesmente consultar | I |
| Consultar cadastro/bureau | `onConsult` → `markConsulted` | Ativa não consulta fornecedor; indicador local conclusivo | F OP-03 |
| Aprovar/reprovar sacado/título/operação; Aprovar elegíveis | `decideDebtor`, `decideTitle`, `rejectOperation`, `approveEligible` → `riskReview` | Aprovar sacado aprova seus títulos; elegibilidade determinística; `risk:decide` | I/T validation/eligibility |
| Hub fontes expandir/atualizar fotografia | `setExpanded`, `rerun` → `buildEnrichmentSnapshot` com histórico | Configuração mudada destaca fotografia antiga; não realiza consulta oficial | I/T eligibility |
| Política demo expandir/aprovados/reexecutar/exportar/decidir exceção | `DemoPolicyExecutionPanel` → motor puro, snapshot/overrides; pacote auditável | Justificativa e alçada demonstrativa; jamais promover ao autenticado | I/T eligibility |
| Política real executar/aprovar/rejeitar por avaliação | `ServerPolicyExecutionPanel.submit` → `/api/operations/eligibility` → `executeEligibilityDecision` | expectedVersion + runHash + justificativa ≥10, regra permite exceção, alçada da própria regra | I/T eligibility-command, exception-evidence |
| Alçadas de exceção e aprovação: identificação | DTO server → `overrideAuthority`, `ApprovalSlot.authorityId`, grants persistidos | Sem autoridade não produz decisão; fatos/política recalculados; comandos dedicados | T approval-command/approval-policy/exceptions |
| Lastro filtros/amostra/abrir título | `setFilter`, `setSelectedId` → `filterLastroRows`, `PrecheckModal` | Abrir item certo; lastro dispensado pelo cedente pode avançar só até Preço | I/T lastro-exceptions/consistency |
| Ver contato/Ligar/WhatsApp | `revealPhone`; `tel:` dígitos; `https://wa.me/` telefone resolvido | Não cadastrado bloqueia links; abertura externa sem envio automático | I; comunicação real B |
| Checklist, canal/resultado/nota/sacado/próximo contato/observação | setters → `registerAttempt` e `updateChecklist` | Confirmado exige item; exceções exigem nota; Sem contato exige próxima data; escopo replica nos títulos correspondentes | I/T lastro-exceptions |
| Validar/Pendente/Divergente e motivo; salvar/fechar | `setEvidenceDecision`, `savePrecheck`, `updateItem` | Divergente exige motivo; histórico de tentativas preservado | I/T lastro-exceptions |

### Preço, aprovação, formalização e liberação

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Taxa, método, prazo/float, tarifa/operação/título/ad valorem/IOF/retenção | `numberField`, `updateDraft`, `balanceFinalRate` → cálculo puro | Face aprovada, centavos, piso, spread e líquido positivos; `operations:edit` | I/T pricing/consistency |
| Taxa alvo, regresso/coobrigação, tarifas manuais adicionar/remover | `updateResponsibility`, `addManualFee`, `removeManualFee` | Alteração volta Simulação; sem tarifa silenciosa | I/T pricing |
| Simular/salvar/proteger/editar condição/nova versão/motivo | `savePricing`, `startNewPricingVersion` → snapshot e audit | Piso sem alçada bloqueia; condição salva trava edição; histórico anterior | I/T pricing/consistency |
| Recompra abrir/fechar/buscar/selecionar/limpar/termos/baixar SIM-NÃO | `RepurchaseModal`, `setRepurchaseSelection`, `updateRepurchaseTerms`, `clearOffsets` | Fonte autoritativa, mesmo cedente/empresa, principal integral, sem encargos no real, escolha explícita baixa | I/T real-repurchase/pricing/availability |
| Compensação/ação por título/restaurar taxa | `toggleSettlementAdjustment`, `restoreAcquisitionRate`; demo vs real | Real não oferece compensações sem fonte; legado inválido sinaliza | I/T repurchase-availability |
| Aprovação seções recolher/observação/enviar/retornar/reprovar/aprovar | `sectionToggle`, `submitForApproval`, `returnToRisk`, `rejectOperation`, `approveOperation` | Prontidão única; devolução com motivo; aprovação real só comando dedicado | F OP-04; I/T consistency/approval/return |
| Cada alçada aprovar/reprovar | `decideServerApproval` → `/api/operations/approval` | Slot correto, versão, justificativa ≥10, autoridade persistida, sem dupla decisão divergente | I/T approval-command |
| Documentos marcar pronto/pendente | `toggleDocument` → review; servidor `assertFormalizationDocuments` | Não basta marcar contrato pronto sem documento exigido no real | I/T formalization/documents |
| Assinaturas enviar/configurar/eletrônica/manual | `sendForSignatures`, feedback Configurar, `registerSignature` abre manual no real | Eletrônica não integrada; assinatura manual exige aprovação prévia/data/motivo | I; eletrônica B |
| Assinatura manual campos/upload/confirmar/cancelar/desfazer/download | `confirmManualSignature`, `undoManualSignature`, upload/download de documentos | Operação do arquivo, hash, MIME, tenant, permissão, estágio, tamanho; só etapa 5 desfaz | I/T documents/formalization |
| Relatórios/borderô/prévia/fechar/imprimir | `setReportType` → `ReportPreviewModal`; `window.print()` | Relatório do aditivo atual; saída do navegador não conferida | I |
| Liberação favorecido/cedente/terceiro/PIX/TED/conta interna | `chooseCedentAccount`, `addCedentAccount`, `addThirdParty`, `updatePayee` | Justificativa terceiro; documento/conta/chave obrigatórios; contas reais não usam seed | I/T release-approval |
| Distribuir restante/remover/data/observação/preparar/liberar | `fillRemaining`, `removePayee`, `prepare`, `release` → `governReleaseTransition` | Distribuição fecha líquido; pacote preparado; autorização servidor; proibição alteração durante aprovação | I/T release-approval, finance-coordination |
| Envio financeiro, resumo liberado, devolução/estorno | `saveOperation` → receivables + finance mesma transação; `/api/operations/return` | Idempotência, versão, reversão recompra, recebimento posterior e baixa bancária impedem retorno inseguro | T return-server/domain, real-repurchase, bank-writeoff; pagamento real B |

### Comercial: todas nove abas e diálogos

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Abas Painel/Equipe/Carteira/Negócios/Contas/Visitas/Funil/Comitês/Comissões | `ModuleTabs.onChange` → `setTab`; comercial/período/custom → filtros | 9 abas; comissões têm competência própria | I |
| Painel ranking/abrir funil/avisos fechar | ranking define rep e Carteira; funil define Funil; toast fecha | Rep correto selecionado | I |
| Alertas visita atrasada/comitê/sem 1ª operação/inativo/meta | `pressable` → Visitas/Comitês/Contas/Carteira/Carteira | Destino é aba; não seleciona entidade. Alerta meta por rep também não seta rep | I; seleção exata no navegador NÃO EXECUTADA |
| Equipe gráficos/selecionar comercial | `onSelectRep` → `setRepFilter` | Drilldown permanece Equipe com filtro; comparações conforme período | I |
| Carteira novo/editar representante/filtro/busca/transferir/Cadastro | `setModal(rep/transfer)`, `setRepFilter`, busca; `onNavigate(registry)` | Vínculo por documento, histórico, sem perda de atribuição antiga | I/T commercial/history/access |
| Representante nome/tipo/documento/meta/taxa/ativo/salvar/fechar | `RepModal` → `saveRep` via `apply`/`confirmStateCommit` | Company padrão; inválido não fecha; falha persistência explicita | I/T commercial/access |
| Transferência comercial motivo/destino/confirmar/fechar | `TransferModal` → `transferClient` → histórico append-only | Novo responsável aplica dali em diante; atribuição passada preservada | I/T commercial/history |
| Negócios agrupar/buscar/exportar/abrir operação/expandir cliente | `setGroupBy`, `setQ`, `exportCsv`, `onOpenOperation(op)` | Operação via ID; negócio sem operação não abre | I/T commercial |
| Contas novas | Componente informativo, sem controles próprios | Novas/ativadas aguardando primeira operação; período/rep herdados | I/T commercial |
| Visitas agendar/registrar resultado | `setModal(visit)` → `scheduleVisit`/`recordVisit` → estado confirmado | Comercial/alvo/data/hora/endereço; realizada exige resultado e próximo passo | I/T commercial |
| Funil nova/voltar etapa/agendar visita/preparar proposta/dossiê/perdido | `moveProspect`, `onVisit`, `onOpenDossier`, `LostModal` | Não pular visitas/proposta; encerramento preserva histórico | I/T commercial/onboarding |
| Oportunidade/dossiê campos/consulta CNPJ/salvar/enviar comitê | `ProspectModal`, `ProspectDossierModal` → `addProspect`, `saveProspectDossier`, `dossierReadiness` | Documentos, receita, limite, taxa, sacados, concentração; proposta completa obrigatória | I/T commercial/onboarding; Receita externa B |
| Conversão legada CNPJ/consulta/limite/segmento/cidade/gerente/criar/cancelar | `ConvertModal` → `convertProspect`; exportado mas não montado pelo módulo atual | NÃO EXECUTADO; entrada de comitê atual usa onboarding automático | I/T commercial/onboarding |
| Comitês dossiê/decidir/histórico/filtro status/busca | `onOpenDossier`, `onDecide`, `setOpen`, `setStatus`, `setQ` | Ver dossiê errado em homônimos; botão decisão exige `canDecideCommittee` | F OP-02; I/T commercial-access |
| Comitê novo/decisão/taxa/limite/data/ressalva/parecer/salvar | `CommitteeModal` → ações → servidor `authorizeCommercialTransition` | `risk:decide`; escopo empresa; histórico/autoria preservados; novos cedentes só aprovação | I/T commercial-access/history/onboarding |
| Comissões competência/regras/exportar/fechar/reabrir/enviar/expandir linha | `closeCommission`, `reopenCommission`, `sendToFinance`, exportação | Mês atual só prévia; freeze linhas/regras; enviada não reabre; envio busy/idempotente | I/T commission-command/client, persistence |
| Regras base/bônus/janela/clawback/faixas/restaurar/salvar/fechar | `RulesModal` → estado `rules` via `onApply`, regra prospectiva | Faixas ordenadas e valores válidos; fechamento anterior mantém snapshot | I/T commercial |
| Envio comissão → Financeiro | `onSendCommission` → POST `/api/commercial/commissions` → command transacional | Cliente só competência/versões; autoridade financeira calcula do fechamento persistido; não duplicar obrigação | T commission-command/client |

### Políticas: cadastro, catálogo e publicação

| Família / controles | Handler → destino / efeito esperado | Cenário e permissão | Evidência/estado |
|---|---|---|---|
| Selecionar política, regras/catálogo, pesquisar catálogo | `setSelectedId`, `setDetailSection`, `setCatalogSearch` | Política, modalidade/empresa e catálogo corretos | I |
| Nova política campos nome/empresa/produto/versão/vigência/cancelar/criar | `createPolicy` → `createBlankPolicy` → rascunho | Empresa existente; modalidade derivada; nome obrigatório | I/T eligibility |
| Nova versão | `createVersion` → `createPolicyVersion` | Ativa não muda; evita duplicar mesmo próximo ID | I/T policy-persistence |
| Modelo CSV/importar arquivo/erros | `downloadTemplate`; `importFile` → `importPolicyCsv` | Empresa/modalidade compatíveis; importa como rascunho; reset file input | I/T eligibility |
| Nome/vigência/versão; regra enabled/operador/parâmetro/resultado/ação/override/alçada | `replacePolicy`, `updatePolicyBinding`, `parsePolicyParameter` | Somente rascunho e sem publicação pendente; número ptBR/unidade correta; alçada quando exceção | I/T parameter-presentation/policy-persistence |
| Adicionar regra do catálogo | `addPolicyRule` → binding | Sem duplicidade; preenchimento institucional antes de publicar | I/T eligibility |
| Gravar todas | `save` → `onSave` → `/api/eligibility-policies` | `settings:manage`; versão, tenant e escopo server-side; erro não declara sucesso | I/T policy-persistence |
| Justificativa/enviar aprovação/aprovar/rejeitar publicação | `activate`, `rejectPublication` → publicação/`activatePolicyVersion` | ≥10 caracteres; grava antes; solicitante não aprova/rejeita próprio envio; outro usuário autorizado; histórico congelado | I/T policy-persistence |

## Destinos e segurança transversal

- `PUT /api/operations`: sessão/tenant, permissões por domínio, empresa atual e nova, lock transacional por tenant, versão; aprovação/exceção forjadas no agregado rejeitadas. **INSPECIONADO + testes dirigidos**.
- `/api/operations/approval` e `/eligibility`: comandos com identidade/alçada no servidor; UI manda intenção, versão e justificativa. Ausência de permissão, versão/hash velho, prova antiga ou autor indevido não deve virar aprovação. **Testes de comandos aprovados**.
- `src/server/commercial/access.ts`: leitura/merge por representante/gerente; limites e decisões exigem `risk:decide`, inclusive alterações materiais. Histórico anterior não pode ser reescrito. **Testes dirigidos aprovados**.
- Operações geram outbox e eventos com `actor_id`; UI de alertas globais e tarefas atribuídas é responsabilidade da frente transversal. Este relatório prova destino de alertas comerciais e resolução de slots/autoridade, não entrega de notificação externa.
- Pagamento, banco, conciliação e recebimento não foram executados por esta frente; somente coordenação/estorno de operação via fixtures.

## Testes executados e resultados

| Grupo | Arquivos | Testes | Resultado |
|---|---:|---:|---|
| Fluxo/comercial/preço/lastro/alçada/exceções/retorno/recompra | 20 | 133 | APROVADO |
| Políticas/validação/documentos/persistência/coordenação/devolução | 13 | 80 | APROVADO |
| Entrada/recompra UI/baixa bancária de recompra | 3 | 20 | APROVADO |
| Probes temporários preservados fora da suíte | 1 | 4 | APROVADO ao reproduzir OP-01/02/03/04 |

Casos existentes particularmente relevantes: `mantém etapas concluídas e operações encerradas somente para consulta`, `não permite avançar uma importação vazia`, `mostra evidência NF-e pendente no mesmo checklist que bloqueia conclusão`, `reconcilia IOF e retenção em centavos, VA=%s`, `fecha resíduo de rateio com vários títulos sem alterar líquido agregado`, `desabilita ambos atalhos reais com motivo visível`, `sinaliza seleção legada real que não entrou no cálculo`, `identifica recompra demonstrativa como simulação`.

## Falta para homologação

- Interagir com cada controle inventariado em navegador, incluindo filtros vazios, erro, loading, teclado e celular; associar evidência visual por cenário. Resultado de SSR ou handler isolado não substitui isso.
- Jornada autenticada com usuários de Operação/Risco/Controladoria/Financeiro, empresas distintas, duas sessões concorrentes e persistência PostgreSQL; validar também autoria exibida no payload, recarga e tarefas/notificações recebidas pelo usuário correto.
- Assinatura eletrônica, Receita/bureau, canais de contato e layouts bancários em homologação própria, sem transmissão real nesta auditoria.
- Reproduzir OP-01/02/03/04 em navegador; corrigi-los exige pedido separado. Relatório não certifica prontidão produtiva.
