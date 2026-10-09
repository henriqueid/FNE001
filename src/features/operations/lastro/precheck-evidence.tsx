"use client";
/**
 * Resumo do título na pré-checagem (evidência, contato e confirmação), dados do
 * documento e conferência documental individual com motivo de divergência.
 */
import { type LastroAssessmentRow, type LastroReviewItem } from "@/src/domain/operations/lastro";
import {
  confirmationClass,
  confirmationLabel,
  type DivergenceReason,
  type EvidenceDecision,
  evidenceClass,
} from "./lastro-model";

export function PrecheckSummary({
  selected,
  review,
}: {
  selected: LastroAssessmentRow;
  review: LastroReviewItem | undefined;
}) {
  return (
    <div className="lastro-detail-summary">
      <div>
        <span>EVIDÊNCIA DOCUMENTAL</span>
        <strong className={evidenceClass(selected.evidenceStatus)}>{selected.evidenceStatus}</strong>
        <small>
          {selected.title.nfeKey
            ? `NF-e ${selected.title.nfeKey}`
            : (selected.attachmentName ?? "Nenhum documento anexado")}
        </small>
      </div>
      <div>
        <span>CONTATO</span>
        <strong>{selected.sampled ? "Amostra obrigatória" : "Confirmação voluntária"}</strong>
        <small>
          {selected.sampled
            ? selected.reasons.join(" · ") || "Seleção estatística da política"
            : "Título fora da amostra, com contato disponível"}
        </small>
      </div>
      <div>
        <span>CONFIRMAÇÃO DO SACADO</span>
        <strong className={confirmationClass(selected.confirmation)}>{confirmationLabel(selected)}</strong>
        <small>
          {review?.contactAttempts ?? 0} tentativa(s) ·{" "}
          {review?.updatedAt ? `última em ${review.updatedAt}` : "sem contato registrado"}
        </small>
      </div>
    </div>
  );
}

export function PrecheckEvidenceData({ selected }: { selected: LastroAssessmentRow }) {
  return (
    <div className="lastro-evidence-data">
      <div>
        <span>Chave NF-e</span>
        <strong>{selected.title.nfeKey || "Não informada"}</strong>
      </div>
      <div>
        <span>CFOP</span>
        <strong>{selected.title.cfop || "Não informado"}</strong>
      </div>
      <div>
        <span>Emissão</span>
        <strong>{selected.title.issueDate || "Não informada"}</strong>
      </div>
      <div>
        <span>Vencimento</span>
        <strong>{selected.title.dueDate || "Não informado"}</strong>
      </div>
      <div>
        <span>Observação da entrada</span>
        <strong>{selected.title.observation || "Sem observação"}</strong>
      </div>
      <div>
        <span>Anexo complementar</span>
        <strong>{selected.attachmentName || "Nenhum anexo"}</strong>
      </div>
    </div>
  );
}

export function PrecheckEvidenceCheck({
  evidenceStatus,
  divergenceReason,
  onDivergenceReasonChange,
  onDecision,
}: {
  evidenceStatus: LastroAssessmentRow["evidenceStatus"];
  divergenceReason: DivergenceReason;
  onDivergenceReasonChange: (reason: DivergenceReason) => void;
  onDecision: (decision: EvidenceDecision) => void;
}) {
  return (
    <section className="evidence-check-card">
      <div>
        <span>CONFERÊNCIA DO DOCUMENTO</span>
        <strong>O arquivo ou a chave apresentada comprova este título?</strong>
        <small>A conferência é sempre individual por título, mesmo quando o contato for agrupado.</small>
      </div>
      <div className="evidence-actions">
        <label>
          <span>MOTIVO, SE HOUVER DIVERGÊNCIA</span>
          <select
            aria-label="Motivo da divergência"
            value={divergenceReason}
            onChange={event => onDivergenceReasonChange(event.target.value as DivergenceReason)}
          >
            <option value="">Selecione</option>
            <option>Documento ausente</option>
            <option>Valor divergente</option>
            <option>Vencimento divergente</option>
            <option>Mercadoria ou serviço não reconhecido</option>
            <option>Duplicidade</option>
            <option>Documento inválido</option>
            <option>Outro</option>
          </select>
        </label>
        <div>
          <button
            className={evidenceStatus === "Validada" ? "selected ok" : "ok"}
            onClick={() => onDecision("Validada")}
          >
            Documento confere
          </button>
          <button
            className={evidenceStatus === "Pendente" ? "selected pending" : "pending"}
            onClick={() => onDecision("Pendente")}
          >
            Falta documento
          </button>
          <button
            className={evidenceStatus === "Divergente" ? "selected fail" : "fail"}
            onClick={() => onDecision("Divergente")}
          >
            Há divergência
          </button>
        </div>
      </div>
    </section>
  );
}
