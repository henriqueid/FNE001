"use client";
/**
 * Análise do sacado selecionado: score, recomendação assistida, extrato da carteira,
 * consultas cadastrais e decisão (com a auditoria registrada).
 */
import { type Debtor } from "@/src/domain/core/types";
import { CheckIcon, SearchIcon, ShieldIcon } from "@/src/ui/icons";
import { DebtorPortfolioLedger } from "./debtor-portfolio-ledger";
import {
  type DebtorGroup,
  type RiskAuditEntry,
  type RiskDecision,
  type RiskDetailKind,
  debtorRecommendation,
  groupKey,
} from "./risk-model";
import { ScoreExplanation } from "./score-explanation";

export function DebtorStatement({
  selectedGroup,
  selectedDebtor,
  debtorDecisions,
  consulted,
  decisionAudit,
  onOpenDetail,
  onConsult,
  onDecide,
}: {
  selectedGroup?: DebtorGroup;
  selectedDebtor?: Debtor;
  debtorDecisions: Record<string, RiskDecision>;
  consulted: string[];
  decisionAudit?: RiskAuditEntry;
  onOpenDetail: (kind: Extract<RiskDetailKind, "debtor" | "group">) => void;
  onConsult: (key: string) => void;
  onDecide: (key: string, decision: RiskDecision) => void;
}) {
  const recommendation = debtorRecommendation(selectedDebtor);
  return (
    <section className="debtor-analysis">
      <div className="risk-panel-title">
        <div>
          <span>ANÁLISE DO SACADO</span>
          <strong>{selectedGroup?.name ?? "Selecione um sacado"}</strong>
        </div>
        {selectedGroup && (
          <div className="analysis-links">
            <button onClick={() => onOpenDetail("debtor")}>Ver histórico completo</button>
            <button onClick={() => onOpenDetail("group")}>Grupo econômico</button>
          </div>
        )}
      </div>
      {selectedGroup ? (
        <>
          <div className="debtor-profile-top">
            <ScoreExplanation score={selectedDebtor?.score} reasons={selectedDebtor?.scoreReasons} />
            <div>
              <b>{selectedDebtor?.score == null ? "Sacado novo no ambiente" : "Score comportamental interno"}</b>
              <small>
                {selectedDebtor?.score == null
                  ? "Sem carteira e sem liquidações anteriores. Avaliar cadastro público e documentos."
                  : `${selectedDebtor.settlements ?? 0} liquidações · ${selectedDebtor.lateSettlements ?? 0} após o vencimento`}
              </small>
            </div>
          </div>
          <div className={`debtor-recommendation ${recommendation.tone}`}>
            <span>{recommendation.label}</span>
            <strong>{recommendation.reason}</strong>
            <small>
              Recomendação assistida; a decisão e a justificativa permanecem sob responsabilidade do analista.
            </small>
          </div>
          <DebtorPortfolioLedger debtor={selectedDebtor} />
          <div className="public-check">
            <ShieldIcon />
            <span>
              <strong>{selectedDebtor?.publicStatus ?? "Consulta pública pendente"}</strong>
              <small>Receita/CPF-CNPJ · demonstração; integração oficial ainda não conectada</small>
            </span>
            <button onClick={() => onConsult(groupKey(selectedGroup))}>
              {consulted.includes(groupKey(selectedGroup)) ? "Consulta atualizada" : "Consultar cadastro"}
            </button>
            <button className="bureau-button" onClick={() => onConsult(`bureau-${groupKey(selectedGroup)}`)}>
              {consulted.includes(`bureau-${groupKey(selectedGroup)}`) ? "Serasa consultado" : "Consultar Serasa"}
            </button>
          </div>
          <div className="decision-buttons">
            <button
              className={debtorDecisions[groupKey(selectedGroup)] === "Reprovado" ? "selected reject" : "reject"}
              onClick={() => onDecide(groupKey(selectedGroup), "Reprovado")}
            >
              Reprovar sacado
            </button>
            <button
              className={debtorDecisions[groupKey(selectedGroup)] === "Aprovado" ? "selected approve" : "approve"}
              onClick={() => onDecide(groupKey(selectedGroup), "Aprovado")}
              title="Aprova também todos os títulos deste sacado"
            >
              Aprovar sacado e títulos
            </button>
          </div>
          {decisionAudit && (
            <div className="decision-audit">
              <CheckIcon />
              <span>
                <b>Decisão registrada: {decisionAudit.decision}</b>
                <small>
                  {decisionAudit.by} · {decisionAudit.at} · Política {decisionAudit.policy}
                </small>
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="risk-empty">
          <SearchIcon />
          <span>Selecione um sacado para abrir a análise.</span>
        </div>
      )}
    </section>
  );
}
