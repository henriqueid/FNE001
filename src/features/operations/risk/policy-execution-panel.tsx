"use client";

import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";
import { useEligibilityPolicies } from "@/src/app/eligibility-policy-context";
import { effectiveRunSummary, latestOverrideFor } from "@/src/domain/eligibility/decision";
import { formatEligibilityValue } from "@/src/domain/eligibility/engine";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { eligibilityRouteFor, withEligibilityRoute } from "@/src/domain/eligibility/orchestration";
import { type EligibilityOutcome, type EligibilityOverrideDecision } from "@/src/domain/eligibility/model";
import { useEffect, useMemo, useState } from "react";

const outcomeLabel: Record<EligibilityOutcome, string> = {
  APROVADO: "Aprovado",
  ALERTA: "Alerta",
  EXCECAO: "Exceção",
  REPROVADO: "Inelegível",
  NAO_AVALIADO: "Não avaliado",
};

const actionLabel = {
  CONTINUAR: "Continuar",
  SINALIZAR: "Sinalizar",
  SOLICITAR_DECISAO: "Solicitar decisão humana",
  BLOQUEAR: "Bloquear",
};

const operatorLabel = { EQ: "=", NE: "≠", GT: ">", GTE: "≥", LT: "<", LTE: "≤", IN: "está em", NOT_IN: "não está em" };

export function PolicyExecutionPanel({
  operation,
  debtors,
  cedent,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  cedent?: Cedent;
  onChange: (operation: Operation) => void;
}) {
  const configuredPolicies = useEligibilityPolicies();
  const [expanded, setExpanded] = useState(false);
  const [showApproved, setShowApproved] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<{
    evaluationId: string;
    decision: EligibilityOverrideDecision;
  } | null>(null);
  const [justification, setJustification] = useState("");
  const calculatedRun = useMemo(
    () => evaluateOperationEligibility({ operation, debtors, cedent, policies: configuredPolicies ?? undefined }),
    [operation, debtors, cedent, configuredPolicies],
  );
  const run = operation.eligibilityReview?.run ?? calculatedRun;
  const hasHistoricalSnapshot = Boolean(operation.eligibilityReview?.run);
  const overrides = operation.eligibilityReview?.overrides ?? [];
  const effective = effectiveRunSummary(run, overrides);
  const route = eligibilityRouteFor({ ...operation, eligibilityReview: { run, overrides } });
  const visible = run.evaluations.filter(item => showApproved || item.outcome !== "APROVADO");
  const availableTitles = operation.manualEntry?.entries.length ?? 0;
  const readOnly = operation.stage !== 2;

  useEffect(() => {
    if (operation.stage !== 2 || operation.eligibilityReview || calculatedRun.evaluations.length === 0) return;
    onChange(withEligibilityRoute({ ...operation, eligibilityReview: { run: calculatedRun, overrides: [] } }));
  }, [calculatedRun, onChange, operation]);

  const registerOverride = () => {
    if (!pendingDecision || justification.trim().length < 8) return;
    const evaluation = run.evaluations.find(item => item.id === pendingDecision.evaluationId);
    if (!evaluation?.overrideAllowed) return;
    const nextOperation: Operation = {
      ...operation,
      eligibilityReview: {
        run,
        overrides: [
          ...overrides,
          {
            id: `override:${Date.now()}`,
            evaluationId: evaluation.id,
            ruleId: evaluation.ruleId,
            subjectId: evaluation.subjectId,
            originalOutcome: evaluation.outcome,
            observed: evaluation.observed,
            parameter: evaluation.parameter,
            decision: pendingDecision.decision,
            justification: justification.trim(),
            authority: evaluation.overrideAuthority ?? "Alçada configurada",
            decidedBy: "Henrique",
            decidedAt: new Date().toISOString(),
            evidence: evaluation.evidence,
          },
        ],
      },
    };
    onChange(withEligibilityRoute(nextOperation));
    setPendingDecision(null);
    setJustification("");
  };

  const returnToRisk = () => {
    onChange({
      ...withEligibilityRoute({ ...operation, eligibilityReview: { run, overrides } }),
      stage: 2,
      status: "Em atenção",
      blockers: Math.max(1, route.blockers),
      nextAction: route.nextAction,
    });
  };

  return (
    <section className="policy-execution" data-testid="policy-execution">
      <header className="policy-execution-head">
        <div>
          <span>RESULTADO DA POLÍTICA · {hasHistoricalSnapshot ? "EXECUÇÃO VERSIONADA" : "PRÉVIA NÃO HISTÓRICA"}</span>
          <h4>Motor Universal de Elegibilidade</h4>
          <p>
            {hasHistoricalSnapshot
              ? "A execução fica congelada com as versões aplicadas. Exceções preservam o resultado original e qualquer decisão humana posterior."
              : "Esta operação não possui um snapshot original. O cálculo atual serve somente como prévia e não será gravado como se tivesse ocorrido no passado."}
          </p>
        </div>
        <div className="policy-execution-head-actions">
          <strong className={`policy-outcome ${effective.overallOutcome.toLocaleLowerCase()}`}>
            {outcomeLabel[effective.overallOutcome]}
          </strong>
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>
            {expanded ? "Fechar detalhes" : "Abrir detalhes"}
            <i aria-hidden="true">⌄</i>
          </button>
        </div>
      </header>

      <div className={`policy-routing ${route.state.toLocaleLowerCase()}`}>
        <div>
          <span>COMPORTAMENTO NA ESTEIRA</span>
          <strong>{route.label}</strong>
          <small>{route.explanation}</small>
        </div>
        <div className="policy-routing-action">
          <b>
            {route.canAdvance ? "FLUXO LIBERADO" : route.requiresHumanDecision ? "AGUARDA ALÇADA" : "FLUXO BLOQUEADO"}
          </b>
          {!route.canAdvance && operation.stage > 2 && operation.stage < 6 && (
            <button type="button" onClick={returnToRisk}>
              Devolver para Risco
            </button>
          )}
        </div>
      </div>

      {!expanded && (
        <button className="policy-collapsed-summary" type="button" onClick={() => setExpanded(true)}>
          <span>
            <b>{run.evaluations.length}</b> avaliações
          </span>
          <span className="approved">
            <b>{effective.counts.APROVADO}</b> aprovadas
          </span>
          <span className="warning">
            <b>{effective.counts.ALERTA}</b> alertas
          </span>
          <span className="exception">
            <b>{effective.counts.EXCECAO}</b> exceções
          </span>
          <span className="rejected">
            <b>{effective.counts.REPROVADO}</b> inelegíveis
          </span>
          <small>Clique para ver regras, parâmetros e evidências</small>
        </button>
      )}

      {expanded && (
        <>
          <div className="policy-summary" aria-label="Resumo da execução da política">
            <div>
              <span>Avaliações</span>
              <strong>{run.evaluations.length}</strong>
              <small>
                {availableTitles} de {operation.titleCount} títulos com dados disponíveis
              </small>
            </div>
            <div className="approved">
              <span>Aprovadas</span>
              <strong>{effective.counts.APROVADO}</strong>
              <small>seguem sem intervenção</small>
            </div>
            <div className="warning">
              <span>Alertas</span>
              <strong>{effective.counts.ALERTA}</strong>
              <small>não impedem continuidade</small>
            </div>
            <div className="exception">
              <span>Exceções</span>
              <strong>{effective.counts.EXCECAO}</strong>
              <small>exigem decisão humana</small>
            </div>
            <div className="rejected">
              <span>Inelegíveis</span>
              <strong>{effective.counts.REPROVADO}</strong>
              <small>critério impeditivo</small>
            </div>
          </div>

          <div className="policy-toolbar">
            <div>
              {run.policyVersions.map(policy => (
                <span key={policy.id}>
                  {policy.name} {policy.version}
                </span>
              ))}
              <span>Executada em {new Date(run.evaluatedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            <button type="button" onClick={() => setShowApproved(current => !current)}>
              {showApproved ? "Ocultar aprovadas" : `Ver ${effective.counts.APROVADO} aprovadas`}
            </button>
          </div>

          <div className="policy-results">
            {visible.length === 0 ? (
              <p className="policy-empty">Nenhuma situação exige atenção nesta execução.</p>
            ) : (
              visible.map(item => {
                const override = latestOverrideFor(item.id, overrides);
                return (
                  <details
                    className={`policy-result ${item.outcome.toLocaleLowerCase()} ${override ? "resolved" : ""}`}
                    key={item.id}
                  >
                    <summary>
                      <span className="policy-result-state">{outcomeLabel[item.outcome]}</span>
                      <span>
                        <strong>{item.subjectLabel}</strong>
                        <small>{item.explanation}</small>
                        {override && (
                          <em className={override.decision === "APROVAR_EXCECAO" ? "approved" : "rejected"}>
                            {override.decision === "APROVAR_EXCECAO" ? "Exceção aprovada" : "Exceção rejeitada"} por{" "}
                            {override.decidedBy}
                          </em>
                        )}
                      </span>
                      <b>{item.ruleId}</b>
                    </summary>
                    <div className="policy-result-detail">
                      <dl>
                        <div>
                          <dt>Regra</dt>
                          <dd>{item.ruleName}</dd>
                        </div>
                        <div>
                          <dt>Encontrado</dt>
                          <dd>{formatEligibilityValue(item.observed, item.variable)}</dd>
                        </div>
                        <div>
                          <dt>Operador</dt>
                          <dd>{operatorLabel[item.operator]}</dd>
                        </div>
                        <div>
                          <dt>Parâmetro</dt>
                          <dd>{formatEligibilityValue(item.parameter, item.variable)}</dd>
                        </div>
                        <div>
                          <dt>Ação</dt>
                          <dd>{actionLabel[item.action]}</dd>
                        </div>
                        <div>
                          <dt>Política</dt>
                          <dd>
                            {item.policyName} {item.policyVersion}
                          </dd>
                        </div>
                      </dl>
                      <p>
                        <strong>Evidência:</strong> {item.evidence}
                      </p>
                      <p>
                        <strong>Override:</strong>{" "}
                        {item.overrideAllowed
                          ? `permitido para ${item.overrideAuthority ?? "alçada configurada"}`
                          : "não permitido"}
                      </p>
                      {override && (
                        <div className="policy-override-record">
                          <strong>Decisão humana preservada</strong>
                          <span>{override.justification}</span>
                          <small>
                            {override.decidedBy} · {new Date(override.decidedAt).toLocaleString("pt-BR")} ·{" "}
                            {override.authority}
                          </small>
                        </div>
                      )}
                      {!override && item.outcome === "EXCECAO" && item.overrideAllowed && (
                        <div className="policy-override-actions">
                          {readOnly ? (
                            <small>Etapa concluída: decisão disponível somente para consulta.</small>
                          ) : pendingDecision?.evaluationId === item.id ? (
                            <div className="policy-override-form">
                              <label>
                                Justificativa obrigatória
                                <textarea
                                  value={justification}
                                  onChange={event => setJustification(event.target.value)}
                                  placeholder="Registre o contexto e o fundamento da decisão..."
                                />
                              </label>
                              <div>
                                <button type="button" onClick={() => setPendingDecision(null)}>
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={justification.trim().length < 8}
                                  onClick={registerOverride}
                                >
                                  Confirmar decisão
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>Decisão da alçada: {item.overrideAuthority}</span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingDecision({ evaluationId: item.id, decision: "REJEITAR_EXCECAO" })
                                  }
                                >
                                  Rejeitar exceção
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingDecision({ evaluationId: item.id, decision: "APROVAR_EXCECAO" })
                                  }
                                >
                                  Aprovar override
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })
            )}
          </div>

          <footer>
            {hasHistoricalSnapshot
              ? "A execução salva o resultado e as versões utilizadas. "
              : "Prévia não persistida: o sistema não fabrica histórico retroativo. "}
            Parâmetros demonstrativos devem ser substituídos pela política real antes de o motor controlar o fluxo da
            operação.
          </footer>
        </>
      )}
    </section>
  );
}
