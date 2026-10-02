"use client";
/**
 * Etapa de Risco e elegibilidade: compõe cartão do cedente, lista e análise dos sacados,
 * grade de títulos, decisão da operação e modais. O estado vive em `useRiskReview`.
 */
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { CedentCard } from "./cedent-card";
import { DebtorList } from "./debtor-list";
import { DebtorStatement } from "./debtor-statement";
import { RiskDetailModal } from "./risk-detail-modal";
import { RiskFinalActions } from "./risk-final-actions";
import { RiskTitlesGrid } from "./risk-titles-grid";
import { TitleAnalysisModal } from "./title-analysis-modal";
import { PolicyExecutionPanel } from "./policy-execution-panel";
import { useRiskReview } from "./use-risk-review";

export function RiskEligibilityPanel({
  operation,
  debtors,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  onChange: (operation: Operation) => void;
}) {
  const review = useRiskReview({ operation, debtors, onChange });
  const { grouped, selectedGroup, selectedDebtor, approvedDebtors, rejectedDebtors } = review;

  return (
    <section className="risk-review">
      <div className="risk-review-head">
        <div>
          <span>RISCO E ELEGIBILIDADE</span>
          <h3>Decisão baseada no relacionamento e na carteira histórica</h3>
          <p>
            A nova operação é o pedido de crédito. O risco vem do cedente, dos sacados e do comportamento já observado
            no seu ambiente.
          </p>
        </div>
        <div className="risk-review-counts">
          <Badge tone="ready">{approvedDebtors} aprovados</Badge>
          <Badge tone={rejectedDebtors ? "cancelled" : "neutral"}>{rejectedDebtors} reprovados</Badge>
          <Badge tone="waiting">{Math.max(0, grouped.length - approvedDebtors - rejectedDebtors)} pendentes</Badge>
        </div>
      </div>

      <PolicyExecutionPanel operation={operation} debtors={debtors} cedent={review.cedent} onChange={onChange} />

      <CedentCard operation={operation} cedent={review.cedent} onOpenAnalysis={() => review.setDetail("cedent")} />

      <div className="risk-workbench">
        <DebtorList
          grouped={grouped}
          debtors={debtors}
          selectedGroup={selectedGroup}
          debtorDecisions={review.debtorDecisions}
          onSelect={review.setSelectedKey}
        />
        <DebtorStatement
          selectedGroup={selectedGroup}
          selectedDebtor={selectedDebtor}
          debtorDecisions={review.debtorDecisions}
          consulted={review.consulted}
          decisionAudit={review.selectedDecisionAudit}
          onOpenDetail={review.setDetail}
          onConsult={review.markConsulted}
          onDecide={review.decideDebtor}
        />
      </div>

      {selectedGroup && (
        <RiskTitlesGrid
          titles={review.selectedTitles}
          titleDecisions={review.titleDecisions}
          onAnalyze={review.setSelectedTitle}
          onDecide={review.decideTitle}
        />
      )}

      <RiskFinalActions
        operation={operation}
        onReject={review.rejectOperation}
        onApproveEligible={review.approveEligible}
      />

      {review.detail && (
        <RiskDetailModal
          kind={review.detail}
          operation={operation}
          cedent={review.cedent}
          selectedGroup={selectedGroup}
          selectedDebtor={selectedDebtor}
          onClose={() => review.setDetail(null)}
        />
      )}
      {review.selectedTitle && (
        <TitleAnalysisModal
          title={review.selectedTitle}
          debtorName={selectedGroup?.name}
          onClose={() => review.setSelectedTitle(null)}
          onDecide={review.decideTitle}
        />
      )}
    </section>
  );
}
