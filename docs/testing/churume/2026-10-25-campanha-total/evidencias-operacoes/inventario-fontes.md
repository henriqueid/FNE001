# Inventário de fontes — operações, comercial, políticas

Inventário sintático, sem equivalência com interação de navegador. Linhas observadas em 25/10/2026; árvore com alterações anteriores preservadas.

## src/features/operations

95 arquivos; 315 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/features/operations/approval/approval-authorities.tsx` | 71 | 2 |
| `src/features/operations/approval/approval-card-head.tsx` | 53 | 1 |
| `src/features/operations/approval/approval-decision-summary.tsx` | 340 | 0 |
| `src/features/operations/approval/approval-documents.tsx` | 56 | 1 |
| `src/features/operations/approval/approval-financial-ledger.tsx` | 279 | 0 |
| `src/features/operations/approval/approval-financial-summary.tsx` | 193 | 0 |
| `src/features/operations/approval/approval-model.ts` | 391 | 0 |
| `src/features/operations/approval/approval-panel.tsx` | 514 | 2 |
| `src/features/operations/approval/approval-readiness.tsx` | 47 | 0 |
| `src/features/operations/approval/approval-reports.tsx` | 41 | 1 |
| `src/features/operations/approval/approval-signatures.tsx` | 162 | 6 |
| `src/features/operations/approval/approval-status.tsx` | 136 | 6 |
| `src/features/operations/approval/approval-timeline.tsx` | 49 | 0 |
| `src/features/operations/approval/manual-signature-form.tsx` | 84 | 10 |
| `src/features/operations/approval/report-preview-modal.tsx` | 160 | 4 |
| `src/features/operations/central/authority-queue-bar.tsx` | 43 | 2 |
| `src/features/operations/central/central-header.tsx` | 32 | 1 |
| `src/features/operations/central/central-metrics.tsx` | 66 | 0 |
| `src/features/operations/central/central-model.ts` | 171 | 0 |
| `src/features/operations/central/operations-filters.tsx` | 172 | 12 |
| `src/features/operations/central/operations-kanban.tsx` | 93 | 1 |
| `src/features/operations/central/operations-list.tsx` | 121 | 1 |
| `src/features/operations/central/operations-table.tsx` | 151 | 3 |
| `src/features/operations/central/pipeline-indicators-card.tsx` | 77 | 0 |
| `src/features/operations/central/queue-tabs.tsx` | 81 | 1 |
| `src/features/operations/central/use-operations-filters.ts` | 140 | 0 |
| `src/features/operations/components/status.tsx` | 88 | 0 |
| `src/features/operations/entry/cheque-entry-form.tsx` | 27 | 0 |
| `src/features/operations/entry/debtor-lookup.tsx` | 66 | 4 |
| `src/features/operations/entry/delete-entries-modal.tsx` | 61 | 4 |
| `src/features/operations/entry/entries-grid.tsx` | 166 | 3 |
| `src/features/operations/entry/entry-editor-bar.tsx` | 40 | 1 |
| `src/features/operations/entry/entry-field.tsx` | 55 | 1 |
| `src/features/operations/entry/entry-form-actions.tsx` | 66 | 6 |
| `src/features/operations/entry/entry-record-panel.tsx` | 188 | 0 |
| `src/features/operations/entry/manual-entry-model.ts` | 166 | 0 |
| `src/features/operations/entry/manual-entry-panel.tsx` | 116 | 3 |
| `src/features/operations/entry/quick-debtor-form.tsx` | 200 | 18 |
| `src/features/operations/entry/receivable-type-tabs.tsx` | 40 | 2 |
| `src/features/operations/entry/title-entry-form.tsx` | 34 | 0 |
| `src/features/operations/entry/use-manual-entry.ts` | 206 | 0 |
| `src/features/operations/lastro/contact-attempt-form.tsx` | 120 | 6 |
| `src/features/operations/lastro/lastro-model.ts` | 110 | 0 |
| `src/features/operations/lastro/lastro-overview.tsx` | 180 | 2 |
| `src/features/operations/lastro/lastro-sample-grid.tsx` | 163 | 5 |
| `src/features/operations/lastro/lastro-validation-panel.tsx` | 79 | 2 |
| `src/features/operations/lastro/precheck-checklist.tsx` | 64 | 1 |
| `src/features/operations/lastro/precheck-contact-card.tsx` | 56 | 3 |
| `src/features/operations/lastro/precheck-evidence.tsx` | 144 | 4 |
| `src/features/operations/lastro/precheck-modal.tsx` | 133 | 5 |
| `src/features/operations/lastro/use-lastro-validation.ts` | 217 | 0 |
| `src/features/operations/new-operation/new-operation-modal.tsx` | 413 | 11 |
| `src/features/operations/pricing/pricing-audit.tsx` | 110 | 1 |
| `src/features/operations/pricing/pricing-condition-form.tsx` | 207 | 12 |
| `src/features/operations/pricing/pricing-fees.tsx` | 189 | 10 |
| `src/features/operations/pricing/pricing-header.tsx` | 161 | 7 |
| `src/features/operations/pricing/pricing-model.ts` | 166 | 0 |
| `src/features/operations/pricing/pricing-panel.tsx` | 237 | 3 |
| `src/features/operations/pricing/pricing-result.tsx` | 85 | 0 |
| `src/features/operations/pricing/pricing-waterfall.tsx` | 130 | 1 |
| `src/features/operations/pricing/repurchase-modal.tsx` | 337 | 10 |
| `src/features/operations/pricing/repurchase-offset-grid.tsx` | 305 | 18 |
| `src/features/operations/pricing/repurchase-summary.tsx` | 128 | 3 |
| `src/features/operations/pricing/use-pricing-draft.ts` | 362 | 0 |
| `src/features/operations/release/release-panel.tsx` | 604 | 30 |
| `src/features/operations/release/released-summary.tsx` | 281 | 3 |
| `src/features/operations/risk/cedent-card.tsx` | 59 | 1 |
| `src/features/operations/risk/cedent-history-list.tsx` | 70 | 1 |
| `src/features/operations/risk/cedent-ledger-section.tsx` | 59 | 0 |
| `src/features/operations/risk/cedent-portfolio-model.ts` | 212 | 0 |
| `src/features/operations/risk/cedent-portfolio-overview.tsx` | 161 | 0 |
| `src/features/operations/risk/cedent-top-debtors.tsx` | 83 | 1 |
| `src/features/operations/risk/debtor-list.tsx` | 81 | 1 |
| `src/features/operations/risk/debtor-portfolio-ledger.tsx` | 93 | 0 |
| `src/features/operations/risk/debtor-statement.tsx` | 146 | 7 |
| `src/features/operations/risk/enrichment-panel.tsx` | 129 | 2 |
| `src/features/operations/risk/policy-execution-panel.tsx` | 490 | 13 |
| `src/features/operations/risk/risk-detail-modal.tsx` | 149 | 3 |
| `src/features/operations/risk/risk-eligibility-panel.tsx` | 114 | 2 |
| `src/features/operations/risk/risk-final-actions.tsx` | 38 | 2 |
| `src/features/operations/risk/risk-model.ts` | 215 | 0 |
| `src/features/operations/risk/risk-titles-grid.tsx` | 96 | 3 |
| `src/features/operations/risk/score-explanation.tsx` | 41 | 0 |
| `src/features/operations/risk/server-policy-execution-panel.tsx` | 155 | 6 |
| `src/features/operations/risk/title-analysis-modal.tsx` | 110 | 4 |
| `src/features/operations/risk/use-risk-review.ts` | 126 | 0 |
| `src/features/operations/workspace/assign-cedent-modal.tsx` | 95 | 3 |
| `src/features/operations/workspace/cancellation-modal.tsx` | 94 | 7 |
| `src/features/operations/workspace/operation-summary-aside.tsx` | 313 | 6 |
| `src/features/operations/workspace/operation-workspace.tsx` | 229 | 2 |
| `src/features/operations/workspace/stage-content.tsx` | 182 | 11 |
| `src/features/operations/workspace/stage-progress.tsx` | 53 | 1 |
| `src/features/operations/workspace/use-stage-advance.ts` | 48 | 0 |
| `src/features/operations/workspace/workspace-header.tsx` | 128 | 6 |
| `src/features/operations/workspace/workspace-model.ts` | 272 | 0 |

## src/features/commercial

17 arquivos; 161 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/features/commercial/commercial-indicators-card.tsx` | 140 | 0 |
| `src/features/commercial/commercial-module.tsx` | 794 | 9 |
| `src/features/commercial/commercial-ui.tsx` | 135 | 0 |
| `src/features/commercial/modals/client-modals.tsx` | 474 | 33 |
| `src/features/commercial/modals/committee-modal.tsx` | 309 | 17 |
| `src/features/commercial/modals/prospect-dossier-modal.tsx` | 355 | 27 |
| `src/features/commercial/modals/rep-modal.tsx` | 113 | 12 |
| `src/features/commercial/modals/rules-modal.tsx` | 141 | 10 |
| `src/features/commercial/modals/visit-modal.tsx` | 187 | 14 |
| `src/features/commercial/tabs/commissions-tab.tsx` | 331 | 9 |
| `src/features/commercial/tabs/committees-tab.tsx` | 282 | 5 |
| `src/features/commercial/tabs/deals-tab.tsx` | 258 | 5 |
| `src/features/commercial/tabs/funnel-tab.tsx` | 201 | 10 |
| `src/features/commercial/tabs/new-accounts-tab.tsx` | 182 | 0 |
| `src/features/commercial/tabs/portfolio-tab.tsx` | 251 | 6 |
| `src/features/commercial/tabs/team-dynamics-tab.tsx` | 379 | 2 |
| `src/features/commercial/tabs/visits-tab.tsx` | 163 | 2 |

## src/features/policies

1 arquivos; 44 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/features/policies/policies-module.tsx` | 803 | 44 |

## src/server/operations

13 arquivos; 0 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/server/operations/approval-evidence.ts` | 156 | 0 |
| `src/server/operations/approval-policy.ts` | 182 | 0 |
| `src/server/operations/approval.ts` | 214 | 0 |
| `src/server/operations/eligibility-exceptions.ts` | 211 | 0 |
| `src/server/operations/exception-evidence.ts` | 88 | 0 |
| `src/server/operations/formalization-documents.ts` | 35 | 0 |
| `src/server/operations/governance.ts` | 163 | 0 |
| `src/server/operations/release-approval.ts` | 87 | 0 |
| `src/server/operations/repository.ts` | 90 | 0 |
| `src/server/operations/repurchase.ts` | 162 | 0 |
| `src/server/operations/return.ts` | 283 | 0 |
| `src/server/operations/storage.ts` | 139 | 0 |
| `src/server/operations/validation.ts` | 249 | 0 |

## src/server/commercial

4 arquivos; 0 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/server/commercial/access.ts` | 185 | 0 |
| `src/server/commercial/commission-command.ts` | 114 | 0 |
| `src/server/commercial/history.ts` | 28 | 0 |
| `src/server/commercial/repository.ts` | 252 | 0 |

## src/domain/operations

14 arquivos; 0 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/domain/operations/approval-readiness.ts` | 96 | 0 |
| `src/domain/operations/auto-advance.ts` | 170 | 0 |
| `src/domain/operations/automation.ts` | 73 | 0 |
| `src/domain/operations/create-operation.ts` | 123 | 0 |
| `src/domain/operations/dates.ts` | 32 | 0 |
| `src/domain/operations/format.ts` | 22 | 0 |
| `src/domain/operations/intake.ts` | 525 | 0 |
| `src/domain/operations/lastro.ts` | 182 | 0 |
| `src/domain/operations/mutation-permissions.ts` | 100 | 0 |
| `src/domain/operations/pace.ts` | 47 | 0 |
| `src/domain/operations/persistence.ts` | 43 | 0 |
| `src/domain/operations/pricing.ts` | 363 | 0 |
| `src/domain/operations/queries.ts` | 43 | 0 |
| `src/domain/operations/stage-insight.ts` | 248 | 0 |

## src/domain/commercial

7 arquivos; 0 ocorrências de handlers/links/disabled (não são contagem de controles).

| Arquivo | Linhas | Ocorrências |
|---|---:|---:|
| `src/domain/commercial/actions.ts` | 678 | 0 |
| `src/domain/commercial/calendar.ts` | 51 | 0 |
| `src/domain/commercial/finance-transfer.ts` | 106 | 0 |
| `src/domain/commercial/persistence.ts` | 94 | 0 |
| `src/domain/commercial/rules.ts` | 234 | 0 |
| `src/domain/commercial/seed.ts` | 636 | 0 |
| `src/domain/commercial/types.ts` | 250 | 0 |
