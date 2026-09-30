"use client";
/**
 * Grade de títulos do sacado selecionado: prazo x política, NF-e, CFOP, monitoramento e decisão.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type ManualEntry } from "@/src/domain/core/types";
import {
  MINIMUM_TERM_DAYS,
  type RiskDecision,
  cfopMonitoring,
  isCirculationCfop,
  noteMonitoring,
  termFor,
} from "./risk-model";

export function RiskTitlesGrid({
  titles,
  titleDecisions,
  onAnalyze,
  onDecide,
}: {
  titles: ManualEntry[];
  titleDecisions: Record<string, RiskDecision>;
  onAnalyze: (title: ManualEntry) => void;
  onDecide: (id: string, decision: RiskDecision) => void;
}) {
  return (
    <section className="risk-title-section">
      <div className="risk-panel-title">
        <div>
          <span>TÍTULOS DO SACADO SELECIONADO</span>
          <strong>Prazo, documento fiscal, monitoramento e decisão</strong>
        </div>
        <small>Prazo mínimo configurado: {MINIMUM_TERM_DAYS} dias</small>
      </div>
      <div className="risk-title-scroll">
        <div className="risk-title-head">
          <span>DOCUMENTO</span>
          <span>VALOR</span>
          <span>VENCIMENTO / PRAZO</span>
          <span>CHAVE NF-e</span>
          <span>CFOP</span>
          <span>MONITORAMENTO</span>
          <span>DECISÃO</span>
        </div>
        {titles.map(title => {
          const term = termFor(title);
          const withinTerm = term != null && term >= MINIMUM_TERM_DAYS;
          return (
            <div className="risk-title-row" key={title.id}>
              <strong>{title.documentNumber}</strong>
              <span>{preciseMoney.format(title.amount)}</span>
              <span>
                <b>{title.dueDate || "Não informado"}</b>
                <small className={withinTerm ? "positive" : "negative"}>
                  {term == null
                    ? "Sem prazo calculado"
                    : withinTerm
                      ? `${term} dias · dentro da política`
                      : `${term} dias · mínimo ${MINIMUM_TERM_DAYS}`}
                </small>
              </span>
              <span className="tax-key" title={title.nfeKey}>
                {title.nfeKey || "Não informada"}
              </span>
              <span className="cfop-cell compact">
                <b>{title.cfop || "—"}</b>
                <em className={isCirculationCfop(title.cfop) ? "positive" : "warning-text"}>{cfopMonitoring(title)}</em>
              </span>
              <span>
                <b className={title.nfeKey ? "positive" : "warning-text"}>{title.nfeKey ? "Monitorada" : "Pendente"}</b>
                <small>{noteMonitoring(title)}</small>
              </span>
              <span className="title-evaluation-actions">
                <button onClick={() => onAnalyze(title)}>Analisar</button>
                <span className="mini-decisions">
                  <button
                    className={titleDecisions[title.id] === "Reprovado" ? "active reject" : "reject"}
                    onClick={() => onDecide(title.id, "Reprovado")}
                  >
                    Rejeitar
                  </button>
                  <button
                    className={titleDecisions[title.id] === "Aprovado" ? "active approve" : "approve"}
                    onClick={() => onDecide(title.id, "Aprovado")}
                  >
                    Aprovar
                  </button>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
