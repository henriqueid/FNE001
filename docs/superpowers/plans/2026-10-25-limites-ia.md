# Limites de IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** configurar limite mensal geral e cotas individuais com bloqueio autoritativo no servidor.
**Architecture:** política versionada no ledger de eventos, contador global existente e uso individual derivado das reservas/liquidações. Nova API específica, formulário explícito e fixtures locais.
**Tech Stack:** TypeScript, React, PostgreSQL privado, Vitest.
**Spec:** docs/superpowers/specs/2026-10-25-limites-ia-design.md

## Global Constraints
- Tokens por competência UTC; sem moeda presumida, migração produtiva ou chamada paga em teste.
- Autor/tenant/permissões no servidor; não apagar consumo, reservas ou mudanças paralelas locais.
- Soma de cotas <= teto; cotas zero bloqueiam, admins também sujeitos ao teto.

## Review Focus
- Duas reservas simultâneas não ultrapassam cota individual.
- Política alterada ou licença salva com estado antigo não apaga uso nem restabelece teto antigo.
- Tenant/usuário injetado e gravação sem permissão são recusados.
- Virada UTC, liquidação antiga e falha ambígua preservam saldos corretos.
- Cotas de usuário suspenso/sem vínculo, campos vazios e consumo superior ao novo teto ficam explícitos.

### Tarefa 1 — Domínio e enforcement
Files: src/domain/intelligence/budget.ts; src/server/intelligence/budget-policy.ts; src/server/intelligence/repository.ts; tests/intelligence-user-budget.test.ts; tests/helpers/intelligence-database.ts.
Interfaces: AIBudgetPolicy {mode, allocations, version}; snapshot com global/period/usage; saveIntelligenceBudget(db, tenantId, actorId, input), loadIntelligenceBudget(...). reserveIntelligenceTokens aplica cota antes do provedor.
- [x] Testes RED: soma excedente, duplicata, inteiro inválido, divisão igual, cotas ausentes/zero, concorrência, estorno de reserva e virada UTC.
- [x] Implementar validação pura, política e consulta da última versão por reserva; integrar lock e validação individual ao repositório.
- [x] GREEN: testes focados e suite; preservar contador no save legado.

### Tarefa 2 — API e autorização
Files: app/api/intelligence/budget/route.ts; src/app/intelligence-client.ts; tests/intelligence-budget-routes.test.ts; tests/postgres-intelligence-budget.test.ts.
- [x] RED: acesso negado, tenant correto, usuário de outro tenant, conflito, contadores forjados ignorados.
- [x] GET/PUT autenticados com roster server-side, versão obrigatória e política/limite gravados na mesma transação auditável.
- [x] GREEN: testes focados; PostgreSQL real isolado para consulta JSONB, rollback e serialização se binários disponíveis.

### Tarefa 3 — Formulário e validação final
Files: src/features/settings/ai-budget-panel.tsx; src/features/settings/ai-budget-panel.module.css; src/features/settings/settings-module.tsx; docs/ARCHITECTURE.md; CHANGELOG.md; CLAUDE.md.
- [x] Formulário explícito com teto geral, modos, divisão igual, cotas/uso/saldo, recarregar e erros de gravação.
- [x] Demonstração local sem chamar provedor nem API de produção; checar interações no navegador.
- [x] Check/build, revisão independente final e registro de limitações reais. Sem deploy neste lote.

## Execução
- Escopo fixado; execução inline solicitada pelo usuário (“Planeje, depois execute”). Sem parada para aprovação intermediária.

- Tarefa 1: 5 regressões de cota falharam antes do enforcement; bloqueio por saldo, concorrência, liquidação e UTC passaram após implementação.
- Tarefa 2: API autenticada, roster server-side, auditoria, versão e rollback cobertos; testes PostgreSQL acrescentados para SQL real e corrida. Binários PostgreSQL não encontrados nos caminhos locais usuais: execução nativa isolada indisponível, sem acesso a banco produtivo.
- Tarefa 3: prévia validou divisão igual, excesso de cotas rejeitado e salvamento explícito. Revisão independente final identificou corrida no save legado; teste `save legado aguarda primeira distribuição em andamento antes de decidir o teto` falhou e passou com lock/consulta em instruções separadas. Nenhum achado importante deixado sem correção.

**Verificação final:** typecheck, lint e formatação aprovados; build de produção aprovado. Suíte final: 770 aprovados, 16 ignorados. Uma execução anterior falhou no teste preexistente `operation-return-server.test.ts` (“conflito de chave ou devoluções concorrentes não repete estorno”): a asserção pressupõe que o primeiro comando vence, mas ambos calculam hash assíncrono antes da transação. Reexecução isolada (8 casos) e suíte completa passaram; código/teste de devolução preservados por estar fora do escopo. Cinco testes nativos de PostgreSQL da IA, incluindo os dois novos, permanecem ignorados sem cluster descartável. Nenhuma chamada paga, migração ou publicação deste lote.
