"use client";
/**
 * Modal de pré-checagem do lastro de um título: resumo, contato, dados do documento,
 * conferência documental, tentativas de contato, checklist e observação.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type LastroAssessmentRow, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { Badge } from "@/src/features/operations/components/status";
import { CloseIcon } from "@/src/ui/icons";
import { ContactAttemptForm } from "./contact-attempt-form";
import {
  type AttemptChannel,
  type AttemptResult,
  type ChecklistKey,
  type ConfirmationScope,
  type DivergenceReason,
  type EvidenceDecision,
} from "./lastro-model";
import { PrecheckChecklist } from "./precheck-checklist";
import { PrecheckContactCard } from "./precheck-contact-card";
import { PrecheckEvidenceCheck, PrecheckEvidenceData, PrecheckSummary } from "./precheck-evidence";

export type PrecheckModalProps = {
  selected: LastroAssessmentRow;
  review: LastroReviewItem | undefined;
  phoneRevealed: boolean;
  phone: string | undefined;
  whatsappPhone: string;
  divergenceReason: DivergenceReason;
  confirmationScope: ConfirmationScope;
  attemptChannel: AttemptChannel;
  attemptResult: AttemptResult;
  nextContactAt: string;
  precheckNote: string;
  formFeedback: string;
  onClose: () => void;
  onRevealPhone: () => void;
  onDivergenceReasonChange: (reason: DivergenceReason) => void;
  onEvidenceDecision: (decision: EvidenceDecision) => void;
  onConfirmationScopeChange: (scope: ConfirmationScope) => void;
  onAttemptChannelChange: (channel: AttemptChannel) => void;
  onAttemptResultChange: (result: AttemptResult) => void;
  onNextContactAtChange: (value: string) => void;
  onRegisterAttempt: () => void;
  onChecklistToggle: (key: ChecklistKey, checked: boolean) => void;
  onPrecheckNoteChange: (value: string) => void;
  onSave: () => void;
};

export function PrecheckModal(props: PrecheckModalProps) {
  const { selected, review, formFeedback, onClose } = props;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section className="risk-detail-modal lastro-detail-modal precheck-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <Badge
              tone={
                selected.evidenceStatus === "Validada"
                  ? "ready"
                  : selected.evidenceStatus === "Divergente"
                    ? "cancelled"
                    : "attention"
              }
            >
              PRÉ-CHECAGEM DO LASTRO
            </Badge>
            <h2>{selected.title.documentNumber}</h2>
            <p>
              {selected.title.debtorName} · {preciseMoney.format(selected.title.amount)}
            </p>
          </div>
          <button aria-label="Fechar pré-checagem" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <PrecheckSummary selected={selected} review={review} />
        <PrecheckContactCard
          selected={selected}
          revealed={props.phoneRevealed}
          phone={props.phone}
          whatsappPhone={props.whatsappPhone}
          onReveal={props.onRevealPhone}
        />
        <PrecheckEvidenceData selected={selected} />
        <PrecheckEvidenceCheck
          evidenceStatus={selected.evidenceStatus}
          divergenceReason={props.divergenceReason}
          onDivergenceReasonChange={props.onDivergenceReasonChange}
          onDecision={props.onEvidenceDecision}
        />
        <ContactAttemptForm
          review={review}
          confirmationScope={props.confirmationScope}
          attemptChannel={props.attemptChannel}
          attemptResult={props.attemptResult}
          nextContactAt={props.nextContactAt}
          whatsappEnabled={Boolean(props.whatsappPhone)}
          onConfirmationScopeChange={props.onConfirmationScopeChange}
          onAttemptChannelChange={props.onAttemptChannelChange}
          onAttemptResultChange={props.onAttemptResultChange}
          onNextContactAtChange={props.onNextContactAtChange}
          onRegister={props.onRegisterAttempt}
        />
        <PrecheckChecklist selected={selected} review={review} onToggle={props.onChecklistToggle} />
        <label className="precheck-notes single-note">
          <span>OBSERVAÇÃO DA PRÉ-CHECAGEM</span>
          <textarea
            value={props.precheckNote}
            placeholder="Registre quem atendeu, o que foi confirmado e qualquer informação sobre o documento ou anexo."
            onChange={event => props.onPrecheckNoteChange(event.target.value)}
          />
        </label>
        {formFeedback && (
          <div
            className={`precheck-feedback ${formFeedback.includes("registrad") || formFeedback.includes("conferido") ? "success" : "warning"}`}
          >
            {formFeedback}
          </div>
        )}
        <div className="modal-actions">
          <button className="primary-action" onClick={props.onSave}>
            Salvar pré-checagem
          </button>
        </div>
      </section>
    </div>
  );
}
