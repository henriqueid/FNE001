# Churume: correções, usuários e permissões — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para integração; superpowers:dispatching-parallel-agents para frentes independentes. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** corrigir os bloqueadores do dossiê e comprovar criação, aprovação, autenticação, suspensão, escopo, módulos e alçadas de usuários.

**Architecture:** manter React/vinext, APIs autoritativas e PostgreSQL privado. Departamento é área funcional; permissões liberam módulos/ações; alçadas concedem competência decisória. Reutilizar governança existente, sem substituir por permissões apenas visuais.

**Tech Stack:** TypeScript, React, Vitest, PostgreSQL isolado e navegador.

**Spec:** pedido de26/10/2026, recomendações autorizadas e `docs/testing/churume/2026-10-25-campanha-total.md`.

## Global Constraints

- Preservar alterações anteriores; trabalhar no checkout atual, que contém a implementação auditada. Não recriar migrações aplicadas, publicar ou usar banco produtivo.
- Nenhuma credencial administrativa ou conexão de banco no navegador. Dados/usuários novos de teste identificados CHURUME em ambiente descartável.
- Tenant, empresa, permissões, alçadas, autoria, histórico e valores validados no servidor.
- Sem novo contrato financeiro de CCB: bloquear criação não suportada com explicação; não inventar cronograma/contabilidade para contornar o bloqueio.
- Cada defeito terá regressão que falha antes da correção. Casos existentes permanecem, com asserções alteradas somente quando contradizem o contrato correto.
- Código compartilhado `src/app/strato-app.tsx`, documentação canônica e integração pertencem ao agente principal. Frentes não editam esses arquivos simultaneamente.
- Inventário mantém cada achado com estado e evidência; hipótese, demonstração, mocks e PostgreSQL real são identificados separadamente.

## Review Focus

- Usuário novo não recebe sessão ativa nem permissões implícitas; login recusado antes de aprovação e depois de suspensão.
- Revogação, mudança de empresa e limites de alçada valem para sessão já aberta e chamadas diretas de API.
- Tarefa não pode migrar de empresa, trocar snapshot ou ganhar conclusão por payload do navegador; novos alertas são derivados no servidor.
- Histórico cadastral não pode ser removido, reescrito ou atribuído a terceiro; motivo precisa chegar ao servidor.
- Corridas de configuração/financeiro preservam versão, idempotência e trilha; teste isolado nunca usa conexão existente.

## Task1: tarefas, alertas e notificações

**Files:** `src/domain/tasks`, `src/server/tasks`, `app/api/tasks`, `src/domain/copilot/attention-center.ts`, listagem de notificações/outbox e testes específicos. Raiz integra assignees/carregamento.

- [x] Escrever e executar regressões positivas para F01–F05, F07, F09–F11 a partir das sondas preservadas.
- [x] Derivar criação/reconciliação no servidor a partir das fontes autorizadas; proteger snapshot e transições, validar destinatário e histórico autoritativo; separar agregado por empresa/escopo.
- [x] Fazer novo episódio voltar a alertar sem apagar conclusão humana anterior; limitar notificações depois do filtro.
- [x] Executar testes dirigidos; entregar interfaces/ajustes de raiz necessários e relatório `task1-tarefas.md`.

## Task2: ciclo de usuário, departamento, módulos e alçadas

**Files:** `src/domain/access`, `src/server/access`, `app/api/access`, `app/api/auth`, `src/features/auth`, `src/features/settings/users-access-panel.tsx`, `policy-approval-panel.tsx`, testes de acesso. Raiz integra aplicação.

- [x] Mapear controles já existentes de departamento, nível, empresas, permissões e alçadas; não criar catálogo concorrente.
- [x] Testar usuário criado em análise, duplicidade, obrigatórios/senha, liberação autorizada, login correto/incorreto, sessão, logout, suspensão e revogação em sessão aberta.
- [x] Testar perfis somente consulta/operador/gestor/admin; UI e API concordam; ocultar/desabilitar manutenção para consulta (CFG-03).
- [x] Testar atuação multidepartamento, isolamento de empresas e permissão por módulo/ação; testar autoridade de crédito independente da permissão de editar.
- [x] Conferir configuração de alçadas existente. Corrigir lacunas comprovadas; se cadastro livre de departamentos/alçadas não existir, documentar desenho de extensão e seus limites sem fingir funcionalidade entregue.
- [x] Entregar regressões e cenário HTTP/PostgreSQL executável isoladamente; relatório `task2-acessos.md`.

## Task3: operações e continuidade

**Files:** `src/features/operations`, `src/domain/operations`, `src/server/operations`, rotas pertinentes, dossiê comercial, testes próprios. Não editar raiz nem arquivos de acesso/tarefas/cadastros.

- [x] Regressões para OP-01–04, UI-01–03; diagnóstico do resumo antes de salvar preço.
- [x] Bloquear CCB não suportada explicitamente; corrigir dossiê por identidade; consultas oficiais precisam evidência ou indisponibilidade explícita; retorno Aprovação→Risco por comando autoritativo específico.
- [x] Substituir botões sem ação por destinos funcionais e contexto correto; resumo deve fechar sem alterar lógica financeira autoritativa.
- [x] Testar caminhos válidos, recusa, histórico e readonly; entregar `task3-operacoes.md` e interfaces para raiz.

## Task4: integridade cadastral e pendências transversais

**Files:** API/repositório de cadastros, validadores de empresa, carteira/grade, Operação ao Vivo, estado IA/filas, raiz e testes. Exclusivos do agente principal.

- [x] CFG-01: motivo explícito, diferenças e histórico gerados no servidor com autor/data reais; negar adulteração e preservar histórico anterior.
- [x] CFG-02: corpos null/parcial/tipos inválidos respondem400. CFG-04/05: erro de gravação/fila visível e recuperável.
- [x] F06: paginação/acesso integral e exportação sem corte200. F08: remover presença inventada de ambiente autenticado; identificar demonstração/ausência de telemetria.
- [x] UI-04/05: coerência de disponibilidade IA, falhas legíveis, datas válidas. Unificar entradas de integrações, orientar campos obrigatórios e atalhos bloqueados.
- [x] Integrar interfaces das três frentes e revisar cada achado do dossiê, inclusive hipóteses; justificar qualquer pendência.

## Task5: verificação integral e entrega

- [x] Executar `npm run check`, build e testes PostgreSQL descartáveis disponíveis; completar infraestrutura local necessária sem conexão produtiva.
- [x] Rodar Churume em navegador: regressões, usuário real de teste aprovado, acesso por esse usuário, bloqueios de módulos/ações, suspensão, alçadas e recarga.
- [x] Revisão independente do diff desta campanha, sem confundir alterações anteriores. Corrigir problemas importantes encontrados.
- [x] Atualizar fontes canônicas e dossiê com estados por achado, cobertura executada e pendências concretas. Não declarar totalidade por contagem de testes.

## Registro

- Autorização: usuário pediu seguir recomendações e ampliar ciclo de acesso. Não pedir nova aprovação para correções já autorizadas.
- Baseline preservada em `/tmp/strato-churume-before-20261026.patch`; fontes não rastreadas listadas separadamente. Sem commit automático deste checkout compartilhado.
- PostgreSQL nativo não encontrado inicialmente; investigar ambiente isolado local, nunca reutilizar `DATABASE_URL` existente.

## Fechamento26/10

Entregas e verificações registradas em `docs/testing/churume/2026-10-26-correcoes/resultado.md`. Marcação das tarefas corresponde aos escopos do plano; não certifica cada ocorrência do inventário nem fornecedores externos. Autoridades/empresas/negações cobertas por testes SQL; navegador percorreu ciclo de identidade e configuração IA com falha controlada. Catálogo livre/tetos monetários seguem planejamento, não implementação.
