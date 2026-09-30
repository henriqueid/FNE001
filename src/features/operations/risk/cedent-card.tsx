"use client";
/**
 * Cartão de análise do cedente: score, limite aprovado/disponível e apontamentos cadastrais.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent, type Operation } from "@/src/domain/core/types";
import { ScoreExplanation } from "./score-explanation";

export function CedentCard({
  operation,
  cedent,
  onOpenAnalysis,
}: {
  operation: Operation;
  cedent?: Cedent;
  onOpenAnalysis: () => void;
}) {
  return (
    <article className="cedent-risk-card">
      <div className="risk-entity-main">
        <span>ANÁLISE DO CEDENTE</span>
        <h4>{operation.cedent}</h4>
        <small>
          {operation.document} · {cedent?.publicStatus ?? "Cadastro ainda não consultado"}
        </small>
      </div>
      <ScoreExplanation score={cedent?.score} reasons={cedent?.scoreReasons} />
      <div className="cedent-limit">
        <span>LIMITE APROVADO</span>
        <strong>{preciseMoney.format(cedent?.creditLimit ?? 0)}</strong>
        <small>
          {preciseMoney.format(cedent?.usedLimit ?? 0)} utilizado ·{" "}
          {preciseMoney.format(Math.max(0, (cedent?.creditLimit ?? 0) - (cedent?.usedLimit ?? 0)))} disponível
        </small>
      </div>
      <div
        className="cedent-flags incident-explain"
        role="button"
        tabIndex={0}
        aria-label={`${cedent?.incidents ?? 0} apontamentos. Passe o mouse ou pressione Tab para ver os detalhes.`}
      >
        <span>APONTAMENTOS</span>
        <strong className={cedent?.incidents ? "negative" : "positive"}>{cedent?.incidents ?? 0}</strong>
        <small>{cedent?.averageDelayDays ?? 0} dias de atraso médio</small>
        <div className="incident-tooltip" role="tooltip">
          <b>Apontamentos encontrados</b>
          {cedent?.incidentDetails?.length ? (
            cedent.incidentDetails.map(item => <small key={item}>{item}</small>)
          ) : (
            <small>Nenhum apontamento cadastral ativo.</small>
          )}
        </div>
      </div>
      <button className="secondary-action" onClick={onOpenAnalysis}>
        Abrir análise completa
      </button>
    </article>
  );
}
