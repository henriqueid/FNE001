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
        <span>LASTRO · PARECER OPERACIONAL</span>
        <h3>{assessment.required ? "Pré-checagem exigida pelo cadastro" : "Pré-checagem dispensada"}</h3>
        <p>
          {assessment.required
            ? "Registre um status geral. Evidências, confirmações e checklist são apoios opcionais para a análise."
            : "O cadastro do cedente não exige pré-checagem; a etapa segue automaticamente para Preço."}
        </p>
      </div>
      <Badge tone={assessment.ready ? "ready" : assessment.divergences ? "cancelled" : "attention"}>
        {assessment.status}
      </Badge>
    </div>
  );
}

const defaultOpinion = (status: NonNullable<Operation["lastroReview"]>["status"]) =>
  status === "Favorável"
    ? "Pré-checagem favorável. Nenhum ponto impeditivo foi identificado para a análise de preço."
    : status === "Favorável com ressalvas"
      ? "Pré-checagem favorável com ressalvas. Os pontos registrados devem ser considerados na formação do preço."
      : status === "Desfavorável"
        ? "Pré-checagem desfavorável. O risco identificado deve ser considerado antes de definir a condição comercial."
        : "";

export function LastroOpinion({
  operation,
  assessment,
  onChange,
}: {
  operation: Operation;
  assessment: LastroAssessment;
  onChange: (operation: Operation) => void;
}) {
  const update = (patch: Partial<NonNullable<Operation["lastroReview"]>>) =>
    onChange({
      ...operation,
      lastroReview: {
        ...operation.lastroReview,
        ...patch,
        reviewedAt: new Date().toISOString(),
        reviewedBy: "Henrique",
      },
    });
  return (
    <section className="lastro-opinion" aria-label="Parecer geral do lastro">
      <div>
        <span>STATUS OBRIGATÓRIO</span>
        <strong>Parecer da pré-checagem</strong>
        <small>Este resultado será apresentado ao analista na etapa de Preço.</small>
      </div>
      <label>
        Status
        <select
          aria-label="Status do parecer de lastro"
          value={assessment.status}
          onChange={event => {
            const status = event.target.value as NonNullable<Operation["lastroReview"]>["status"];
            update({ status, opinion: operation.lastroReview?.opinion || defaultOpinion(status) });
          }}
        >
          <option value="Pendente">Selecione o resultado</option>
          <option value="Favorável">Favorável</option>
          <option value="Favorável com ressalvas">Favorável com ressalvas</option>
          <option value="Desfavorável">Desfavorável</option>
        </select>
      </label>
      <label>
        Parecer para o analista de preço
        <textarea
          aria-label="Parecer do lastro para preço"
          rows={4}
          value={operation.lastroReview?.opinion ?? ""}
          onChange={event => update({ opinion: event.target.value })}
          placeholder="Registre os pontos que devem ser considerados na formação do preço."
        />
      </label>
    </section>
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
        <span>CONFIRMAÇÃO POR QUANTIDADE</span>
        <strong
          className={confirmedDebtors === sampledDebtors.length && sampledDebtors.length ? "positive" : "warning-text"}
        >
          {Math.round(assessment.confirmationCountPercent)}%
        </strong>
        <small>
          mínimo {assessment.minimumConfirmationCountPercent}% · {assessment.confirmed} obrigatória(s) ·{" "}
          {optionalConfirmed} voluntária(s)
        </small>
      </div>
      <div>
        <span>CONFIRMAÇÃO POR VALOR</span>
        <strong
          className={
            assessment.confirmationAmountPercent >= assessment.minimumConfirmationAmountPercent
              ? "positive"
              : "warning-text"
          }
        >
          {Math.round(assessment.confirmationAmountPercent)}%
        </strong>
        <small>
          mínimo {assessment.minimumConfirmationAmountPercent}% · ação:{" "}
          {assessment.confirmationFailureAction.toLowerCase()}
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
        <strong>
          {!assessment.required
            ? "Lastro aprovado automaticamente"
            : assessment.ready
              ? `Parecer ${assessment.status.toLowerCase()} registrado`
              : "Registre o status do parecer"}
        </strong>
        <span>
          {!assessment.required
            ? "Pré-checagem dispensada no cadastro do cedente. O fluxo segue somente até a etapa de Preço."
            : assessment.ready
              ? "Use o botão de conclusão da etapa para avançar manualmente até Preço."
              : "Confirmações e documentos são opcionais; somente o status geral é necessário para concluir."}
        </span>
      </div>
    </div>
  );
}
