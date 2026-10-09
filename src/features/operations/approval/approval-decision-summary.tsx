"use client";

import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { effectiveEvaluationOutcome, latestOverrideFor } from "@/src/domain/eligibility/decision";
import { type EligibilityOutcome } from "@/src/domain/eligibility/model";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import { buildFinalDecisionSnapshot, type FinancialFigures, decimal } from "./approval-model";

const outcomeLabel: Record<EligibilityOutcome, string> = {
  APROVADO: "Aprovado",
  ALERTA: "Alerta",
  EXCECAO: "Exceção",
  REPROVADO: "Inelegível",
  NAO_AVALIADO: "Não avaliado",
};

const outcomeWeight: Record<EligibilityOutcome, number> = {
  REPROVADO: 5,
  EXCECAO: 4,
  ALERTA: 3,
  NAO_AVALIADO: 2,
  APROVADO: 1,
};

export function ApprovalDecisionSummary({ operation, figures }: { operation: Operation; figures: FinancialFigures }) {
  const entries = operation.manualEntry?.entries ?? [];
  const review = operation.eligibilityReview;
  const decision = buildFinalDecisionSnapshot(operation);
  const summary = decision.policy;
  const attention = review
    ? review.run.evaluations
        .filter(item => item.outcome !== "APROVADO" || Boolean(latestOverrideFor(item.id, review.overrides)))
        .sort(
          (a, b) =>
            outcomeWeight[effectiveEvaluationOutcome(b, review.overrides)] -
            outcomeWeight[effectiveEvaluationOutcome(a, review.overrides)],
        )
    : [];
  const debtorGroups = Object.values(
    entries.reduce<Record<string, { name: string; document: string; amount: number; titles: number }>>(
      (groups, item) => {
        const key = item.debtorId || item.debtorDocument || item.debtorName;
        const current = groups[key] ?? { name: item.debtorName, document: item.debtorDocument, amount: 0, titles: 0 };
        current.amount += item.amount;
        current.titles += 1;
        groups[key] = current;
        return groups;
      },
      {},
    ),
  ).sort((a, b) => b.amount - a.amount);
  const totalTitles = decision.totalTitles;
  const grossAmount = figures.calculated.face || operation.amount;
  const netAmount = figures.calculated.face ? figures.finalNet : operation.netAmount;
  const projectedLimit = Math.max(0, figures.availableLimit - grossAmount);
  const result = summary?.overallOutcome ?? "NAO_AVALIADO";
  const lastroExceptions = lastroAssessmentFor(operation).exceptions;

  return (
    <section className="approval-decision-summary">
      <header className="approval-decision-head">
        <div>
          <span>ANÁLISE FINAL DA OPERAÇÃO</span>
          <h3>Contexto completo para a decisão humana</h3>
          <p>O sistema consolida o que foi processado e destaca somente o que exige atenção.</p>
        </div>
        <div className={`approval-decision-outcome ${result.toLocaleLowerCase()}`}>
          <small>RESULTADO DA POLÍTICA</small>
          <strong>{outcomeLabel[result]}</strong>
          <span>{review ? `${review.run.evaluations.length} avaliações executadas` : "Motor ainda não executado"}</span>
        </div>
      </header>

      <div className="approval-operation-strip">
        <Metric label="Cedente" value={operation.cedent} detail={operation.document} />
        <Metric label="Valor bruto" value={preciseMoney.format(grossAmount)} />
        <Metric label="Valor líquido" value={preciseMoney.format(netAmount)} />
        <Metric
          label="Taxa final"
          value={entries.length ? `${decimal(figures.calculated.allInMonthly, 2)}% a.m.` : "Não registrada"}
        />
        <Metric label="Prazo médio" value={entries.length ? `${figures.averageTerm} dias` : "Não registrado"} />
        <Metric label="Títulos" value={String(totalTitles)} />
      </div>

      <div className="approval-policy-result">
        <div className="approval-policy-counts">
          <span>
            <strong>{totalTitles}</strong> títulos analisados
          </span>
          <span>
            <strong>{decision.eligibleTitles}</strong> elegíveis
          </span>
          {decision.exceptionTitles > 0 && (
            <span className="attention">
              <strong>{decision.exceptionTitles}</strong> com exceção
            </span>
          )}
          {decision.pendingTitles > 0 && (
            <span className="attention">
              <strong>{decision.pendingTitles}</strong> pendentes
            </span>
          )}
          <span className={decision.ineligibleTitles ? "danger" : ""}>
            <strong>{decision.ineligibleTitles}</strong> inelegíveis
          </span>
          <span className={attention.length ? "attention" : ""}>
            <strong>{attention.length}</strong> pontos de atenção
          </span>
        </div>
        {summary && (
          <small>
            Motor: {summary.counts.APROVADO} aprovadas · {summary.counts.ALERTA} alertas · {summary.counts.EXCECAO}{" "}
            exceções · {summary.counts.REPROVADO} impeditivas
          </small>
        )}
      </div>

      {lastroExceptions.length > 0 && (
        <section className="approval-lastro-exceptions">
          <header>
            <span>EXCEÇÕES DE LASTRO</span>
            <strong>{lastroExceptions.length} título(s) da amostra sem confirmação plena · decisão da alçada</strong>
          </header>
          <ul>
            {lastroExceptions.map(row => {
              const item = operation.lastroReview?.items?.[row.title.id];
              return (
                <li key={row.title.id}>
                  <div>
                    <b>{row.title.documentNumber}</b>
                    <small>
                      {row.title.debtorName} · {preciseMoney.format(row.title.amount)}
                    </small>
                  </div>
                  <em>{row.confirmation}</em>
                  <p>{item?.confirmationNotes || "Sem observação registrada."}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="approval-context-grid">
        <section className="approval-context-card">
          <header>
            <span>CEDENTE</span>
            <strong>{figures.cedent?.name ?? operation.cedent}</strong>
          </header>
          <div className="approval-context-metrics">
            <Metric label="Limite" value={preciseMoney.format(figures.cedent?.creditLimit ?? 0)} />
            <Metric label="Utilizado" value={preciseMoney.format(figures.cedent?.usedLimit ?? 0)} />
            <Metric label="Disponível" value={preciseMoney.format(figures.availableLimit)} />
            <Metric label="Após operação" value={preciseMoney.format(projectedLimit)} />
            <Metric label="Score interno" value={String(figures.cedent?.score ?? "—")} />
            <Metric label="Vencido histórico" value={preciseMoney.format(figures.cedent?.portfolioOverdue ?? 0)} />
          </div>
        </section>

        <section className="approval-context-card">
          <header>
            <span>SACADOS</span>
            <strong>Principais concentrações da operação</strong>
          </header>
          <div className="approval-debtor-list">
            {debtorGroups.slice(0, 5).map(debtor => (
              <div key={`${debtor.document}:${debtor.name}`}>
                <span>
                  <strong>{debtor.name}</strong>
                  <small>
                    {debtor.titles} título(s) · {debtor.document}
                  </small>
                </span>
                <span>
                  <strong>{operation.amount ? decimal((debtor.amount / operation.amount) * 100, 1) : "0,0"}%</strong>
                  <small>{preciseMoney.format(debtor.amount)}</small>
                </span>
              </div>
            ))}
            {!debtorGroups.length && <p>Nenhum título disponível para consolidar sacados.</p>}
          </div>
        </section>
      </div>

      <div className="approval-intelligence-grid">
        <section className="approval-context-card approval-enrichment-card">
          <header>
            <span>QUALIDADE DOS DADOS</span>
            <strong>Cobertura do enriquecimento</strong>
          </header>
          {decision.enrichment ? (
            <>
              <div className="approval-source-counts">
                <Metric label="Internas" value={String(decision.internalSources)} />
                <Metric label="Oficiais" value={String(decision.officialSources)} />
                <Metric label="Demonstração" value={String(decision.demoSources)} />
                <Metric label="Pendências" value={String(decision.dataPending)} />
              </div>
              <details className="approval-evidence-drilldown">
                <summary>
                  Ver fontes e evidências <b>⌄</b>
                </summary>
                <div>
                  {decision.enrichment.checks.map(check => (
                    <p key={check.id}>
                      <span className={`approval-source-state ${check.provenance.toLocaleLowerCase()}`}>
                        {check.provenance === "DEMONSTRACAO" ? "Demonstração" : check.provenance.toLocaleLowerCase()}
                      </span>
                      <strong>{check.label}</strong>
                      <small>
                        {check.source} · {check.value} · {check.evidence}
                      </small>
                    </p>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <div className="approval-attention-empty is-unavailable">
              <strong>Enriquecimento ainda não fotografado.</strong>
              <span>Retorne ao Risco para consolidar as fontes antes da decisão final.</span>
            </div>
          )}
        </section>

        <section className="approval-context-card approval-portfolio-card">
          <header>
            <span>IMPACTO NA CARTEIRA</span>
            <strong>Efeito projetado após a operação</strong>
          </header>
          {decision.portfolioEvaluations.length ? (
            <div className="approval-portfolio-rules">
              {decision.portfolioEvaluations.map(item => {
                const effective = review ? effectiveEvaluationOutcome(item, review.overrides) : item.outcome;
                return (
                  <details key={item.id}>
                    <summary>
                      <span className={`approval-attention-state ${effective.toLocaleLowerCase()}`}>
                        {outcomeLabel[effective]}
                      </span>
                      <span>
                        <strong>{item.ruleName}</strong>
                        <small>{item.explanation}</small>
                      </span>
                      <b>⌄</b>
                    </summary>
                    <p>
                      <strong>Evidência:</strong> {item.evidence}
                    </p>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="approval-attention-empty is-unavailable">
              <strong>Sem avaliação de carteira registrada.</strong>
              <span>A decisão não deve presumir impacto quando a dimensão não foi executada.</span>
            </div>
          )}
          <div className={`approval-portfolio-status ${decision.portfolioAttention ? "attention" : "ready"}`}>
            {decision.portfolioAttention
              ? `${decision.portfolioAttention} ponto(s) da carteira exigem atenção.`
              : `${decision.portfolioEvaluations.length} regra(s) de carteira sem exceção aberta.`}
          </div>
        </section>
      </div>

      <section className="approval-attention-card">
        <header>
          <div>
            <span>EXCEÇÕES E ALERTAS</span>
            <strong>O que exige atenção antes da decisão</strong>
          </div>
          <b>{attention.length}</b>
        </header>
        {!review ? (
          <div className="approval-attention-empty is-unavailable">
            <strong>Operação histórica sem execução registrada.</strong>
            <span>O sistema não presume enquadramento quando não existe snapshot do motor.</span>
          </div>
        ) : attention.length ? (
          <div className="approval-attention-list">
            {attention.map(item => {
              const override = review ? latestOverrideFor(item.id, review.overrides) : undefined;
              const effective = review ? effectiveEvaluationOutcome(item, review.overrides) : item.outcome;
              return (
                <details key={item.id}>
                  <summary>
                    <span className={`approval-attention-state ${effective.toLocaleLowerCase()}`}>
                      {outcomeLabel[effective]}
                    </span>
                    <span>
                      <strong>{item.ruleName}</strong>
                      <small>
                        {item.subjectLabel} · {item.explanation}
                      </small>
                    </span>
                    <b>⌄</b>
                  </summary>
                  <div>
                    <p>
                      <strong>Evidência:</strong> {item.evidence}
                    </p>
                    <p>
                      <strong>Política:</strong> {item.policyName} v{item.policyVersion}
                    </p>
                    {override && (
                      <p>
                        <strong>Decisão humana:</strong>{" "}
                        {override.decision === "APROVAR_EXCECAO" ? "Exceção aprovada" : "Exceção rejeitada"} por{" "}
                        {override.decidedBy} · {override.justification}
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="approval-attention-empty">
            <strong>Nenhuma exceção aberta.</strong>
            <span>A operação está integralmente enquadrada na política executada.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="approval-decision-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
