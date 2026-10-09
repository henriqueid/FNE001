"use client";
/**
 * Rodapé de decisão da operação: status da decisão do cedente, "Reprovar operação" e "Aprovar elegíveis".
 */
import { type Operation } from "@/src/domain/core/types";

export function RiskFinalActions({
  operation,
  onReject,
  onApproveEligible,
}: {
  operation: Operation;
  onReject: () => void;
  onApproveEligible: () => void;
}) {
  return (
    <div className="risk-final-actions">
      <div>
        <strong>Decisão da operação</strong>
        <span>
          {operation.riskReview?.cedentDecision
            ? `${operation.riskReview.cedentDecision} por Henrique · Política ${operation.policy}`
            : "A operação só avança quando cedente, sacados e títulos tiverem decisão registrada."}
        </span>
      </div>
      <button className="danger-secondary" onClick={onReject}>
        Reprovar operação
      </button>
      <button
        className="primary-action"
        title="Aprova só o que a política permite: sacado com score ≥ 600, título com prazo ≥ mínimo e sem reprovação manual. O restante fica para decisão individual."
        onClick={onApproveEligible}
      >
        Aprovar elegíveis
      </button>
    </div>
  );
}
