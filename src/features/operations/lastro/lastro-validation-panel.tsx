"use client";
/**
 * Painel da etapa de lastro: validação documental, amostra obrigatória e confirmação
 * do sacado por título. O estado vive em `useLastroValidation`; aqui só há composição.
 */
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { LastroHeader, LastroKpis, LastroResult } from "./lastro-overview";
import { LastroSampleGrid, LastroSampleToolbar } from "./lastro-sample-grid";
import { PrecheckModal } from "./precheck-modal";
import { useLastroValidation } from "./use-lastro-validation";

export function LastroValidationPanel({
  operation,
  debtors,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  onChange: (operation: Operation) => void;
}) {
  const lastro = useLastroValidation({ operation, debtors, onChange });
  const { assessment, selected } = lastro;

  return (
    <section className="lastro-workbench">
      <LastroHeader assessment={assessment} />
      <LastroKpis assessment={assessment} indicators={lastro.indicators} risk={operation.risk} />
      <LastroSampleToolbar
        filter={lastro.filter}
        totalCount={assessment.rows.length}
        sampleSize={assessment.sampleSize}
        interventionCount={lastro.indicators.interventionCount}
        onFilterChange={lastro.setFilter}
      />
      <LastroSampleGrid
        rows={lastro.visibleRows}
        reviewItems={operation.lastroReview?.items}
        onSelect={lastro.setSelectedId}
        onUpdateItem={lastro.updateItem}
      />
      <LastroResult assessment={assessment} />
      {selected && (
        <PrecheckModal
          selected={selected}
          review={lastro.selectedReview}
          phoneRevealed={Boolean(lastro.revealedPhones[selected.title.id])}
          phone={lastro.selectedPhone}
          whatsappPhone={lastro.whatsappPhone}
          divergenceReason={lastro.divergenceReason}
          confirmationScope={lastro.confirmationScope}
          attemptChannel={lastro.attemptChannel}
          attemptResult={lastro.attemptResult}
          nextContactAt={lastro.nextContactAt}
          precheckNote={lastro.precheckNote}
          formFeedback={lastro.formFeedback}
          onClose={() => lastro.setSelectedId(null)}
          onRevealPhone={() => lastro.revealPhone(selected.title.id)}
          onDivergenceReasonChange={lastro.setDivergenceReason}
          onEvidenceDecision={lastro.setEvidenceDecision}
          onConfirmationScopeChange={lastro.setConfirmationScope}
          onAttemptChannelChange={lastro.setAttemptChannel}
          onAttemptResultChange={lastro.setAttemptResult}
          onNextContactAtChange={lastro.setNextContactAt}
          onRegisterAttempt={() => lastro.registerAttempt(selected.title.id)}
          onChecklistToggle={(key, checked) => lastro.updateChecklist(selected.title.id, key, checked)}
          onPrecheckNoteChange={lastro.setPrecheckNote}
          onSave={() => lastro.savePrecheck(selected.title.id)}
        />
      )}
    </section>
  );
}
