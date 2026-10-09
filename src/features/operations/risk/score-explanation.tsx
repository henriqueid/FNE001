"use client";
/**
 * Anel de score com tooltip acessível (hover ou Tab) explicando os fatores da nota.
 */
import { scoreLabel, scoreTone } from "./risk-model";

export function ScoreExplanation({
  score,
  reasons = [],
  bureau,
}: {
  score?: number;
  reasons?: string[];
  bureau?: number;
}) {
  return (
    <div
      className="score-explain"
      role="button"
      tabIndex={0}
      aria-label={`Score ${score ?? "novo"}, ${scoreLabel(score)}. Passe o mouse ou pressione Tab para entender a nota.`}
    >
      <div className={`score-ring ${scoreTone(score)}`}>
        <strong>{score ?? "—"}</strong>
        <span>{scoreLabel(score)}</span>
      </div>
      <div className="score-tooltip" role="tooltip">
        <b>Por que esta nota?</b>
        {reasons.length ? (
          reasons.map(reason => <small key={reason}>{reason}</small>)
        ) : (
          <small>Histórico insuficiente para detalhar os fatores da nota.</small>
        )}
        <small className="score-scale">
          Score de qualidade 0–1000, calculado pela política de qualidade (o mesmo do painel de Risco)
          {bureau != null ? ` · bureau externo: ${Math.round(bureau)}` : ""}.
        </small>
      </div>
    </div>
  );
}
