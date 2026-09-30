"use client";
/**
 * Cabeçalho, indicadores (cobertura, amostra, confirmações, divergências) e
 * quadro de resultado do painel de lastro.
 */
import { type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";
import { type LastroAssessment, type lastroIndicators } from "./lastro-model";

export function LastroHeader({ assessment }: { assessment: LastroAssessment }) {
  return (
    <div className="lastro-head">
      <div>
        <span>LASTRO E CONFIRMAÇÃO</span>
        <h3>Validação documental e confirmação por título</h3>
        <p>
          A amostra é priorizada automaticamente por risco, concentração, qualidade do sacado e ausência de evidência.
        </p>
      </div>
      <Badge tone={assessment.ready ? "ready" : assessment.divergences ? "cancelled" : "attention"}>
        {assessment.ready
          ? "Pronto para avançar"
          : assessment.divergences
            ? `${assessment.divergences} divergência(s)`
            : "Intervenção necessária"}
      </Badge>
    </div>
  );
}

export function LastroKpis({
  assessment,
  indicators,
  risk,
}: {
  assessment: LastroAssessment;
  indicators: ReturnType<typeof lastroIndicators>;
  risk: Operation["risk"];
}) {
  const { coverage, sampledNotes, confirmedDebtors, sampledDebtors, optionalConfirmed } = indicators;
  return (
    <div className="lastro-kpis">
      <div>
        <span>COBERTURA DOCUMENTAL</span>
        <strong className={coverage === 100 ? "positive" : "warning-text"}>{coverage}%</strong>
        <small>
          {assessment.evidenceValid} de {assessment.rows.length} evidências validadas
        </small>
      </div>
      <div>
        <span>AMOSTRA OBRIGATÓRIA</span>
        <strong>{assessment.sampleSize}</strong>
        <small>
          {sampledNotes.length} nota(s) · risco {risk.toLowerCase()}
        </small>
      </div>
      <div>
        <span>CONFIRMAÇÕES DA AMOSTRA</span>
        <strong
          className={confirmedDebtors === sampledDebtors.length && sampledDebtors.length ? "positive" : "warning-text"}
        >
          {confirmedDebtors}/{sampledDebtors.length}
        </strong>
        <small>
          {assessment.confirmed} obrigatória(s) · {optionalConfirmed} voluntária(s)
        </small>
      </div>
      <div>
        <span>DIVERGÊNCIAS</span>
        <strong className={assessment.divergences ? "negative" : "positive"}>{assessment.divergences}</strong>
        <small>{assessment.divergences ? "Bloqueiam o avanço" : "Nenhuma divergência registrada"}</small>
      </div>
    </div>
  );
}

export function LastroResult({ assessment }: { assessment: LastroAssessment }) {
  return (
    <div className={`lastro-result ${assessment.ready ? "ready" : "pending"}`}>
      {assessment.ready ? <CheckIcon /> : <AlertIcon />}
      <div>
        <strong>{assessment.ready ? "Lastro concluído" : "A operação ainda não pode avançar"}</strong>
        <span>
          {assessment.ready
            ? "Evidências validadas e sacados da amostra confirmados."
            : `${assessment.rows.length - assessment.evidenceValid} evidência(s) e ${assessment.sampleSize - assessment.confirmed} confirmação(ões) ainda pendentes.`}
        </span>
      </div>
    </div>
  );
}
