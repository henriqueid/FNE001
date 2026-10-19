"use client";
/** Avaliações do servidor e deliberações por regra, sem conceder alçada no navegador. */
import { useEffect, useState } from "react";
import type { Operation } from "@/src/domain/core/types";
import type { EligibilityOverrideDecision } from "@/src/domain/eligibility/model";
import { effectiveRunSummary } from "@/src/domain/eligibility/decision";
import { formatEligibilityValue } from "@/src/domain/eligibility/engine";
import {
  decideEligibility,
  loadAuthoritativeEligibility,
  type AuthoritativeEligibility,
} from "@/src/app/eligibility-decision-client";

export function ServerPolicyExecutionPanel({
  operation,
  onChange,
}: {
  operation: Operation;
  onChange: (operation: Operation) => void;
}) {
  const [analysis, setAnalysis] = useState<AuthoritativeEligibility>();
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    loadAuthoritativeEligibility(operation.id)
      .then(result => {
        if (active) setAnalysis(result);
      })
      .catch(error => {
        if (active) {
          setAnalysis(undefined);
          setMessage(error instanceof Error ? error.message : "Não foi possível executar a política.");
        }
      });
    return () => {
      active = false;
    };
  }, [operation.id, operation.persistenceVersion]);
  async function submit(evaluationId?: string, decision?: EligibilityOverrideDecision) {
    if (busy || !analysis) return;
    if (evaluationId && reason.trim().length < 10) {
      setMessage("Descreva a justificativa da avaliação em pelo menos dez caracteres.");
      return;
    }
    setBusy(true);
    try {
      const common = {
        operationId: operation.id,
        expectedVersion: analysis.version,
        reason: evaluationId ? reason.trim() : "Execução autoritativa da política vigente",
      };
      const saved = await decideEligibility(
        evaluationId && decision
          ? { ...common, action: "DECIDIR", evaluationId, decision, runHash: analysis.runHash }
          : { ...common, action: "EXECUTAR" },
      );
      onChange(saved);
      setMessage(
        evaluationId
          ? "Decisão da avaliação registrada com alçada e fatos verificados."
          : "Execução registrada pelo servidor.",
      );
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setBusy(false);
    }
  }
  const summary = analysis ? effectiveRunSummary(analysis.run, analysis.overrides) : undefined;
  return (
    <section className="policy-execution" data-testid="server-policy-execution">
      <header className="policy-execution-head">
        <div>
          <span>POLÍTICA PERSISTIDA · EXECUÇÃO NO SERVIDOR</span>
          <h4>Elegibilidade e exceções por avaliação</h4>
          <p>
            Os fatos são recalculados a partir do cadastro, carteira e política vigentes. Cada exceção exige a alçada
            definida pela própria regra.
          </p>
        </div>
        <strong>{summary?.overallOutcome ?? "Aguardando análise"}</strong>
      </header>
      {message && <p role="status">{message}</p>}
      {analysis && (
        <>
          <button type="button" disabled={busy || operation.stage !== 2} onClick={() => void submit()}>
            Executar e salvar análise vigente
          </button>
          {operation.stage === 2 && (
            <label>
              Justificativa da avaliação
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Informe motivo e evidência da decisão"
              />
            </label>
          )}
          <div className="policy-results">
            {analysis.run.evaluations.map(evaluation => {
              const override = analysis.overrides.find(item => item.evaluationId === evaluation.id);
              return (
                <article className={`policy-result ${evaluation.outcome.toLowerCase()}`} key={evaluation.id}>
                  <h5>
                    {evaluation.subjectLabel} · {evaluation.ruleName}
                  </h5>
                  <p>{evaluation.explanation}</p>
                  <p>
                    Observado: {formatEligibilityValue(evaluation.observed, evaluation.variable)} · Parâmetro:{" "}
                    {formatEligibilityValue(evaluation.parameter, evaluation.variable)}
                  </p>
                  <small>{evaluation.evidence}</small>
                  {override ? (
                    <p>
                      Decisão: {override.decision} · {override.decidedBy} · {override.authority}
                      <br />
                      {override.justification}
                    </p>
                  ) : (
                    <p>Resultado: {evaluation.outcome}</p>
                  )}
                  {operation.stage === 2 &&
                    evaluation.overrideAllowed &&
                    evaluation.overrideAuthority &&
                    !["APROVADO", "ALERTA"].includes(evaluation.outcome) && (
                      <div className="policy-override-actions">
                        <span>Alçada exigida: {evaluation.overrideAuthority}</span>
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 10}
                          onClick={() => void submit(evaluation.id, "APROVAR_EXCECAO")}
                        >
                          Aprovar exceção desta avaliação
                        </button>
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 10}
                          onClick={() => void submit(evaluation.id, "REJEITAR_EXCECAO")}
                        >
                          Rejeitar exceção desta avaliação
                        </button>
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
