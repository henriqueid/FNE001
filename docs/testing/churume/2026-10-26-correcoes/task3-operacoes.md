# Task3 — operações e continuidade

26/10/2026. Correções autorizadas OP-01–04 e UI-01–03. Checkout compartilhado; alterações anteriores preservadas. Sem commit, publicação, migração, fornecedor ou dinheiro real.

## Resultado

| Achado | Correção                                                                                                                                                                                                                                   | Evidência                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| OP-01  | Crédito estruturado/CCB desabilitado com motivo no seletor; construtor e guarda de criação no servidor rejeitam origem. Consulta/cancelamento de operações legadas preservados. Não foi inventado contrato financeiro.                     | 3 regressões UI/construtor/guarda, RED→GREEN                                |
| OP-02  | Dossiê do comitê usa prospectId. ID ausente ou ambíguo não abre outro homônimo. Legado sem ID só abre quando existe candidato único.                                                                                                       | Handler real com dois homônimos, ID inexistente e legado ambíguo; RED→GREEN |
| OP-03  | Receita/bureau configurados ATIVA ficam indisponíveis sem fornecedor conectado; configuração não produz consulta concluída nem afirma fonte oficial. Demonstração tem rótulos explícitos de simulação.                                     | SSR com ambas fontes ATIVA e chaves de consultas antigas; RED→GREEN         |
| OP-04  | Novo comando autoritativo Aprovação→Risco, ligado ao painel. Intenção, versão, autorização, empresa, transação e histórico no servidor; não usa PUT genérico.                                                                              | 10 testes de comando + 2 cliente + 3 testes PostgreSQL reais                |
| UI-01  | Linha do tempo revela registros existentes do próprio aditivo (entrada, etapas, risco, lastro, preço, aprovação, liberação/cancelamento), sem eventos Serasa fictícios.                                                                    | Disclosure nativo com autoria/detalhe da fixture; RED→GREEN                 |
| UI-02  | Estrutura do veículo abre dados preservados na operação: nome, instituição, classe e participantes, com ausência explícita. Não finge consultar cadastro jurídico.                                                                         | Disclosure nativo com contexto do veículo da fixture; RED→GREEN             |
| UI-03  | Antes de condição salva, resumo usa a própria projeção da composição e identifica LÍQUIDO SIMULADO. Não mistura líquido bruto de origem com descontos simulados. Sem alteração do cálculo financeiro autoritativo ou netAmount persistido. | Reconciliação da composição + preservação do líquido de origem; RED→GREEN   |

## Contrato OP-04 e integração

`POST /api/operations/return-to-risk`

```json
{
  "operationId": "id-persistido",
  "expectedVersion": 3,
  "commandId": "UUID v4",
  "reason": "Justificativa com pelo menos oito caracteres"
}
```

Resposta: `{ operation }`, reconstruída do snapshot persistido. Corpo estrito, ID limitado, versão inteira positiva, razão de 8–2000 caracteres. Somente sessão ativa com `controlleria:formalize`, empresa autorizada e operação aberta na etapa5, antes de qualquer liberação preparada. Recusa snapshots e campos extras.

- Transação e trava financeira por tenant; lock da operação; expectedVersion. Replay de mesma chave/ator/conteúdo retorna confirmação; conteúdo ou ator diferente não reutiliza chave.
- Preserva entrada, risco, elegibilidade/exceções, lastro e condição comercial. Invalida aprovações, documentos, assinaturas e conclusões das etapas2 em diante. Histórico anterior de aprovação continua no audit; snapshot decisório e conclusões anteriores também ficam no evento imutável `OperationRiskReturn`.
- `loadOperationApprovalGrants` corta concessões anteriores a `OperationRiskReturn`, mantendo histórico e exceções de Risco anteriores. Retorno financeiro anterior continua respeitado. Novas alçadas precisam nova deliberação, mesmo quando dados financeiros não mudaram.
- Cliente em `operations/approval/return-to-risk-client.ts` cria chave uma vez, retenta somente transporte, marca resultado com `operationSavedByServer`. `ApprovalPanel` entrega esse mesmo objeto ao `onChange`; raiz existente consome recibo e não repete PUT. Nenhuma alteração/prop nova exigida em `strato-app.tsx`.
- Painel bloqueia ações finais durante devolução e só muda operação após confirmação; erro permanece visível. Modo demonstração usa a mesma transformação pura, sem chamar servidor.

Devolução é solicitação de revisão, não concessão de crédito: exige permissão da área responsável; não concede nem simula alçada. Aprovações futuras continuam exigindo atribuição formal vigente.

## Arquivos da frente

Produto (16):

- `src/domain/operations/create-operation.ts`, `history.ts` (novo), `return-to-risk.ts` (novo).
- `src/server/operations/governance.ts`, `approval-evidence.ts`, `return-to-risk.ts` (novo).
- `app/api/operations/return-to-risk/route.ts` (novo).
- `src/features/operations/new-operation/new-operation-modal.tsx`.
- `src/features/operations/risk/debtor-statement.tsx`.
- `src/features/operations/workspace/workspace-model.ts`, `operation-summary-aside.tsx`.
- `src/features/operations/approval/approval-model.ts`, `approval-panel.tsx`, `approval-status.tsx`, `return-to-risk-client.ts` (novo).
- `src/features/commercial/tabs/committees-tab.tsx`: extensão de escopo autorizada pelo principal para corrigir OP-02 na origem do defeito.

Regressões (5): `tests/operation-churume-controls.test.ts`, `commercial-committee-dossier-identity.test.ts`, `operation-return-to-risk.test.ts`, `operation-return-to-risk-client.test.ts` (novos), `postgres-approval-evidence.test.ts` (ampliado).

Nenhuma edição desta frente em raiz, acesso, tarefas, cadastros, carteira, settings, financeiro ou documentação canônica.

## RED→GREEN observado

- 10:41:26: 8 falhas esperadas nos controles UI, CCB, dossiê, consulta e composição. Após correções, 8/8 aprovados.
- 10:43:36: 10 falhas esperadas do comando ainda indisponível, antes de implementar validação/transação. Após implementação, 10/10 aprovados.
- 10:45:00: 2 falhas esperadas do cliente ainda indisponível; após implementação, 2/2 aprovados.
- 10:45:30: SQL real reusava alçada anterior a OperationRiskReturn (esperado0, observado1). Após correção do cutoff, 2/2 casos SQL aprovados; ampliado com comando completo persistência/autoria/replay: **3/3 aprovados** em26/10 às10:48:08.
- 10:49:22: caso adicional legado ambíguo falhou antes do ajuste; candidato único e identidade explícita preservados depois do ajuste.

## Verificação

- **18 arquivos dirigidos, 117 testes aprovados**, incluindo as20 regressões novas, fluxo/alçada, exceções, preço, recompra e devolução financeira anterior. Comando listado abaixo.
- **PostgreSQL real: 3/3 casos aprovados**, 40 migrações em cluster local novo. Testa cutoff de evidências por ciclo/empresa, preservação de exceções e comando completo com versão/replay/autoria. Não depende de banco remoto.
- Lint dirigido dos21 arquivos de produto/testes: aprovado. Formatação aplicada somente a arquivos desta frente. `git diff --check` dirigido: aprovado.
- Typecheck durante integração paralela não apontou erros desta frente após corrigir fixture `Destination.detail`. Ainda havia erros transitórios externos em `churume-live-provenance`, `churume-portfolio-coverage`, `postgres-financial-integration`, `registry-route-integrity` e `task-security`; principal informado, sem editar arquivos de outras frentes.
- Uma suíte global observada durante edições paralelas:941 aprovados,23 pulados,17 falhas em5 arquivos. Snapshot transitório, **não é aceite global**; incluía frentes de tarefas ainda em RED (`same is not a function`) e testes de cobertura/presença em elaboração. Principal executará check/build/suíte/PG integrados após estabilização; não repetir global nesta frente.
- Runner PG parcial terminou com código1 **depois** de passar SQL3/3 e documentos backup2/2: recovery HTTP exige fixtures financeiras não criadas quando só roda arquivo de aprovação. Mensagem: `Fixtures de recuperação/login ausentes`. Não afirmar runner completo aprovado. Cluster encerrado corretamente. Evidência temporária: `/var/folders/hr/fdtrdch96_xbvmnfl1c83pm40000gn/T/strato-isolated-pg-1Tduzs`.

Comandos de reprodução:

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/operation-churume-controls.test.ts tests/commercial-committee-dossier-identity.test.ts tests/operation-return-to-risk.test.ts tests/operation-return-to-risk-client.test.ts tests/operation-server-approval-command.test.ts tests/operation-server-approval.test.ts tests/operation-workflow-guardrails.test.ts tests/operation-consistency.test.ts tests/eligibility.test.ts tests/operation-server-exception-evidence.test.ts tests/operation-server-validation.test.ts tests/lastro-exceptions.test.ts tests/operation-return-server.test.ts tests/operation-return-domain.test.ts tests/real-repurchase.test.ts tests/real-repurchase-pricing.test.ts tests/pricing.test.ts tests/operation-persistence.test.ts

env -u DATABASE_URL -u OPENAI_API_KEY STRATO_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin STRATO_TEST_PG_FILES=tests/postgres-approval-evidence.test.ts node scripts/test-postgres-isolated.mjs
```

## Pendências de integração

- Navegador pertence ao principal: confirmar clique dos disclosures, recusa explícita de CCB, indisponibilidade oficial, dossiê correto e devolução autenticada com recarga. SSR/handler isolado não equivale a clique.
- Executar validação integrada após estabilizar outras frentes. Sem publicação ou certificado produtivo nesta entrega.

## Suplemento autorizado: UI-04 e UI-05

Escopo adicional delegado pelo principal após estabilizar Task3: apenas `src/features/settings/ai-configuration-panel.tsx`, `outbox-health-panel.tsx`, `src/app/notification-client.ts`, `src/features/finance/finance-ui.tsx` e regressões respectivas. `SettingsModule` permaneceu com a outra frente.

- **UI-04:** ambos painéis recebem `demoMode?: boolean` (padrão `false`). Com `true`, não chamam configuração/provedor/outbox em efeitos nem ações; mostram demonstração explicitamente. Não exibem credencial/fila real como resultado demonstrativo. Autenticado preserva carregamento anterior.
- **Integração necessária:** principal deve passar `demoMode={isDemo}` a `AIConfigurationPanel` e `OutboxHealthPanel` dentro de SettingsModule. Contrato enviado ao principal; nenhuma edição dessa frente no módulo integrador.
- **Falhas de notificação:** JSON inválido, HTML de proxy, erro estruturado e transporte são convertidos em mensagens legíveis. Mensagem humana de autorização é preservada. Não exibir objeto nem texto cru do parser como mensagem de interface.
- **UI-05:** `br` aceita datas ISO e ptBR válidas, inclusive timestamp ISO compatível. Valida calendário/bissexto e horário; ausente, malformada ou impossível retorna `—`. Exemplo corrigido: `26/10/2026` antes virava `26//2/26/1`; agora permanece `26/10/2026`. Não altera valores nem regras financeiras.

Regressões novas: `tests/settings-demo-network.test.ts`, `tests/finance-date-format.test.ts`, `tests/notification-client-errors.test.ts`.

RED às10:56:13:19 falhas e9 aprovações em28 casos, incluindo chamada real dos efeitos em modo demo, data ptBR malformada e mensagens do parser. GREEN após correções:28/28. Verificação ampliada final às10:57:31: **7 arquivos / 53 testes aprovados**, incluindo views adjacentes de cobrança/bancos, comercial e controles operacionais. Lint dos7 arquivos e diff-check: aprovados. Não repetida suíte global durante integração paralela.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/settings-demo-network.test.ts tests/finance-date-format.test.ts tests/notification-client-errors.test.ts tests/finance-collection-view.test.ts tests/commercial.test.ts tests/bank-settings-view.test.ts tests/operation-churume-controls.test.ts
```

Prova dos efeitos dos painéis usa executor de hooks controlado e dependências externas substituídas; prova da formatação e do cliente usa implementações reais com respostas HTTP controladas. Não equivale a teste de navegador ou fornecedor real. Clique/integrador e check global continuam com principal.

## Suplemento autorizado: hipóteses financeiras I01, I03 e I05

Reprodução dirigida confirmou os três comportamentos. **I02 (acordos) permaneceu intacta**, conforme determinação do principal; nenhum cálculo/contrato financeiro alterado.

| Hipótese | Resultado/correção                                                                                                                                                                                                                                                                                                                                                  | Regressão                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I01      | `ChartImportModal` aguarda `onApply: boolean / Promise<boolean>`. Fecha somente depois de `true`; `false` ou rejeição mantêm arquivo, modo e mapeamento, mostram falha. Referência síncrona evita envio duplicado; campos ficam desabilitados durante confirmação. `AccountingTab` aplica mesmo contrato a nova conta/categoria e só limpa campos após confirmação. | Promessa pendente, false, rejeição e true do plano; conta/categoria preservadas após false/rejeição e limpas após true.                                                                    |
| I03      | Controladoria Auditoria mostra total e pagina30 eventos com Anterior/Próxima e limites. Não corta histórico além dos30 iniciais. Eventos de operações também filtrados por `companyScope`, como já ocorria com títulos.                                                                                                                                             | Percurso de65 eventos em3 páginas, volta para página2, última Próxima desabilitada; evento de outra empresa fora da lista. Filtro é defesa de apresentação, não prova de vazamento de API. |
| I05      | Empresa explícita resolve primeiro correspondência exata única; caso contrário, aceita somente prefixo único. Texto desconhecido/ambíguo gera erro de linha e não usa empresa ativa. Em branco conserva fallback, desde que empresa exista no diretório autorizado.                                                                                                 | Inexistente e prefixo ambíguo bloqueados; exata, prefixo único e campo vazio seguem destino esperado.                                                                                      |

Arquivos adicionais desta frente: `src/features/finance/chart-import-modal.tsx`, `src/features/finance/tabs/accounting-tab.tsx`, `src/features/finance/titles/import-titles-modal.tsx`, `src/features/controlleria/controlleria-module.tsx`, `tests/finance-ui-confirmation-audit.test.ts`. Root/FinanceModule não editado; callback `apply` já retorna `Promise<boolean>`, compatível com o novo contrato contábil.

RED às11:04:14:7 falhas esperadas /4 aprovações, reproduzindo fechamento precoce, perda dos campos, auditoria sem acesso integral/escopo local e destino silencioso. GREEN às11:06:01:11/11. Acrescentadas provas específicas de rejeição de conta/categoria. Verificação final às11:07:37: **7 arquivos /79 testes aprovados**, incluindo13 regressões novas e testes adjacentes financeiro/journal/cobrança/datas/notificações/demo. Lint dirigido, `npm run typecheck` e diff-check: aprovados. Nenhuma suíte global repetida nesta ampliação.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/finance-ui-confirmation-audit.test.ts tests/finance.test.ts tests/finance-journal-integrity.test.ts tests/finance-collection-view.test.ts tests/finance-date-format.test.ts tests/notification-client-errors.test.ts tests/settings-demo-network.test.ts
```

Provas executam componentes/handlers reais com executor controlado de hooks; usam motores reais de plano e títulos sobre fixtures locais, sem API financeira ou banco remoto. Confirmação/rejeição é callback controlado. Paginação, falha assíncrona e prévia da empresa ainda precisam clique de navegador na integração final do principal.

## Suplemento autorizado: R3 — CAS da licença/configuração de IA

Revisão de origem: `task2-revisao-independente.md`, probe preservado em `evidencias-revisao/config-live-probes.test.ts.txt`. Reproduzido com repositório real/adaptador e em PostgreSQL real: editorA desligava licença; editorB reaplicava snapshot antigo e recebia sucesso/reativação.

Correção em `src/server/intelligence/repository.ts` e `app/api/intelligence/state/route.ts`:

- `state.persistenceVersion` representa versão do snapshot editado. Ausente equivale0 somente para criação. String, null, negativo, fracionário ou não finito são inválidos400.
- Criação0 usa INSERT condicional (`ON CONFLICT DO NOTHING RETURNING`), sem sobrescrever linha já existente. Outra versão de tenant inexistente também conflita.
- Atualização existente adquire row lock e compara `aggregate_version`; UPDATE ainda exige CAS no WHERE. Conflito retorna409 legível e preserva licença, habilitação, contador e versão.
- Contador continua autoritativo e nunca é regravado do navegador. Política orçamentária confirmada mantém o teto após lock; cotas/reservas/consumo não mudaram de contrato.
- Cliente `persistIntelligenceState` já enviava snapshot incluindo persistenceVersion. Não foi alterado; regressão comprova token exato no corpo e propagação de409 sem retentativa/rebase silencioso.

Regressões novas: `tests/intelligence-state-cas.test.ts` e `intelligence-state-route-cas.test.ts`. Incluem licença desligada, dois editores da mesma versão, criação0, versão ausente em linha existente, tipos inválidos, caminho atual autorizado, API409/400/403/401 e cliente.

`tests/helpers/intelligence-database.ts` passou a representar incremento de versão/INSERT condicional/CAS fielmente. Fixtures existentes de `intelligence-usage`, `intelligence-server-budget`, `intelligence-budget-configuration` e duas chamadas existentes em `postgres-intelligence-budget` receberam apenas token atual, conforme novo contrato autorizado; asserções de orçamento permaneceram. Novo caso SQL de licença foi acrescentado nesse arquivo PostgreSQL.

Evidência RED→GREEN:

- 11:10:29:9 falhas /2 aprovações em11 casos, incluindo API200 indevido e reativação por snapshot antigo.
- 11:11:21: PostgreSQL real,1 falha /5 aprovações; licença antiga reativada em vez de conflito.
- 11:13:01: PostgreSQL real **6/6 aprovados**, mantendo cinco casos anteriores de orçamento e novo caso CAS de licença; 40 migrações em cluster local descartável.
- 11:14:08: versão null retornava409 em vez de400; corrigido para validação estrita.
- 11:14:16: **7 arquivos /45 testes dirigidos aprovados** (licença/API/cliente, consumo/cotas, orçamento/regras existentes).
- Lint dos9 arquivos e diff-check: aprovados. Typecheck final só apontava quatro erros externos em `tests/company-context-access.test.ts` (response possivelmente undefined); principal informado. Sem erro desta frente.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/intelligence-state-cas.test.ts tests/intelligence-state-route-cas.test.ts tests/intelligence-budget-configuration.test.ts tests/intelligence-server-budget.test.ts tests/intelligence-usage.test.ts tests/intelligence-user-budget.test.ts tests/intelligence-budget-routes.test.ts

env -u DATABASE_URL -u OPENAI_API_KEY STRATO_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin STRATO_TEST_PG_FILES=tests/postgres-intelligence-budget.test.ts node scripts/test-postgres-isolated.mjs
```

Runner parcial SQL passou6/6 e backup de documentos2/2, depois terminou1 na recuperação HTTP por `Fixtures de recuperação/login ausentes` (arquivo financeiro não executado nesse recorte). Cluster encerrado, evidência temporária em `/var/folders/hr/fdtrdch96_xbvmnfl1c83pm40000gn/T/strato-isolated-pg-Va7pZm`. Não afirmar runner integrado aprovado. Nenhum provedor pago foi chamado; root segue dono de check/build/SQL integrado e integração visual da recuperação de conflito.

## Suplemento autorizado: GET self-only de acesso para operador

Bug confirmado pelo principal no navegador: operador real recebia403 em `/api/access/users`; raiz conservava perfil administrativo demonstrativo após falha. Raiz corrigiu inicialização/efeitos fail-closed; esta frente alterou exclusivamente API users e regressões.

- `GET` autentica sessão/tenant sem exigir `users:manage`. Carrega diretório persistido; confere próprio usuário ativo e vinculado ao tenant. Sem próprio perfil válido, retorna401.
- Sem `users:manage`, responde **AccessState versão2, authenticatedUserId real e somente próprio AccessUser**. Não retorna preview, outro usuário ou fallback seed. Parâmetro `?userId=outro` não altera identidade consultada da sessão.
- Com `users:manage`, continua retornando diretório completo autorizado ao tenant. POST e PUT conservam contexto administrativo padrão: operador recebe403 antes de validar corpo/mutar perfis.
- Nenhum arquivo de sessão/autenticação/race foi alterado. Sem ampliar autorização de escrita ou permitir consulta de outro usuário ao operador.

Arquivos: `app/api/access/users/route.ts`, novo `tests/access-users-self-route.test.ts`, ampliação GET em `tests/postgres-access-lifecycle.test.ts`. Expectativa antiga de403 no GET do operador foi substituída por200+self no caso de ciclo existente; novo caso específico verifica self, diretório administrativo, POST/PUT403, tenant não vinculado401 e suspensão401 em PostgreSQL real.

RED direto às11:17:27:4 falhas /3 aprovações (GET403 indevido e falhas fechadas esperadas401). RED SQL às11:17:39:2 falhas /3 aprovações. GREEN direto às11:18:12: **2 arquivos /19 testes aprovados**. GREEN PostgreSQL às11:18:16: **5/5 casos aprovados**, handlers e persistência reais em cluster local novo,40 migrações. Lint dos3 arquivos, `npm run typecheck` e diff-check: aprovados.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/access-users-self-route.test.ts tests/access-route-validation.test.ts

env -u DATABASE_URL -u OPENAI_API_KEY STRATO_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin STRATO_TEST_PG_FILES=tests/postgres-access-lifecycle.test.ts node scripts/test-postgres-isolated.mjs
```

Como demais recortes parciais, runner SQL passou5/5 e backup2/2, depois terminou1 no recovery HTTP sem fixtures financeiras. Cluster encerrado. Evidência temporária: `/var/folders/hr/fdtrdch96_xbvmnfl1c83pm40000gn/T/strato-isolated-pg-xtkLwG`. Integração de perfil hidratado/fail-closed no navegador e runner completo continuam com principal; não confundir aprovação dos handlers/SQL com clique final.

## Revisão cruzada RC-02 — conversão de operação existente em CCB

Probe de Task1 em `evidencias-revisao-cruzada/ccb-conversion.test.ts.txt` mostrou que a guarda inicial só proibia criação: rascunho manual existente podia receber `source: Crédito estruturado` e `operationType: CCB` por PUT. Validação estrutural e permissão de Operações aceitavam; transição também aceitava.

Correção final limitada a `src/server/operations/governance.ts` e novo `tests/operation-ccb-conversion.test.ts`:

- Detecta modalidade não implementada pela origem ou token CCB no tipo. Proíbe introdução por criação **ou conversão de operação existente**, inclusive mudança de apenas um dos indicadores.
- Legado CCB permanece consultável; aceita somente snapshot idêntico ou cancelamento que preserve demais dados. Recusa edição, avanço, cancelamento combinado com alteração financeira e troca de origem/tipo para contornar restrição. Guarda terminal anterior continua impedindo reescrita de operação já encerrada.
- Nenhum arquivo de raiz ou contrato financeiro foi alterado. Probe antigo preservado como evidência do comportamento anterior, não adaptado para passar após correção.

RED às11:29:53:4/4 casos falharam contra guarda antiga. GREEN às11:30:24: **7 arquivos /41 testes dirigidos aprovados**, incluindo4 regressões novas e aprovação/devolução/validação/consulta existentes. Lint dos2 arquivos e diff-check: aprovados. Principal informado de produto estável para build/SQL final antes deste registro documental.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/operation-ccb-conversion.test.ts tests/operation-churume-controls.test.ts tests/operation-server-validation.test.ts tests/operation-server-approval-command.test.ts tests/operation-return-to-risk.test.ts tests/operation-return-domain.test.ts tests/operation-workflow-guardrails.test.ts
```
