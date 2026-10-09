"use client";
/**
 * Painel da etapa Preço: orquestra o rascunho da condição comercial
 * (`usePricingDraft`) e compõe as seções do simulador — cabeçalho, resultado,
 * recompra, formulário de condição/tarifas/responsabilidade, memória lateral,
 * cálculo por título, auditoria e o modal de recompra e compensações.
 */
import { type Operation } from "@/src/domain/core/types";
import { useState } from "react";
import { PricingAuditTrail, PricingTitleMemory } from "./pricing-audit";
import { PricingConditionSection, PricingResponsibilitySection } from "./pricing-condition-form";
import { PricingCustomFees, PricingFeesSection } from "./pricing-fees";
import { PricingHero, PricingQuickNav, PricingSourceStrip, PricingVersionBar } from "./pricing-header";
import {
  buildOffsetRows,
  buildSelectedOffsetMemory,
  filterOffsetRows,
  type OffsetFilters,
  overdueTitleIds,
} from "./pricing-model";
import { PricingReconciliation, PricingResultCard } from "./pricing-result";
import { PricingWaterfall } from "./pricing-waterfall";
import { RepurchaseModal } from "./repurchase-modal";
import { RepurchaseLauncher, RepurchaseOverview } from "./repurchase-summary";
import { usePricingDraft } from "./use-pricing-draft";

const INITIAL_OFFSET_FILTERS: OffsetFilters = {
  includeGroup: false,
  nature: "Todos",
  source: "Todos",
  search: "",
};

export function PricingPanel({
  operation,
  onChange,
  showGuidance,
}: {
  operation: Operation;
  onChange: (operation: Operation) => void;
  showGuidance: boolean;
}) {
  const draft = usePricingDraft(operation, onChange);
  const { pricing, calculated, repurchase, settlementAdjustments, totalOffsets, netAfterRepurchase } = draft;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [repurchaseOpen, setRepurchaseOpen] = useState(false);
  // Filtros ficam aqui (e não no modal) para sobreviver ao fechar/reabrir o modal.
  const [offsetFilters, setOffsetFilters] = useState<OffsetFilters>(INITIAL_OFFSET_FILTERS);

  const offsetRows = buildOffsetRows(repurchase, settlementAdjustments);
  const filteredOffsetRows = filterOffsetRows(offsetRows, offsetFilters);
  const selectedOffsetMemory = buildSelectedOffsetMemory(repurchase, settlementAdjustments);
  const selectedOffsetCount = repurchase.selected.length + settlementAdjustments.selected.length;

  function startRepurchaseComposition() {
    draft.unlockForRepurchase();
    setRepurchaseOpen(true);
  }

  function selectVisibleOverdue() {
    const ids = overdueTitleIds(filteredOffsetRows);
    draft.setRepurchaseSelection([...new Set([...(pricing.repurchaseTitleIds ?? []), ...ids])]);
  }

  return (
    <section
      className={`pricing-workbench ${showGuidance ? "guidance-visible" : "guidance-hidden"} ${pricing.locked ? "pricing-locked" : ""}`}
    >
      <PricingHero status={pricing.status} />
      <PricingQuickNav />
      <PricingSourceStrip calculated={calculated} ready={draft.pricingSourceReady} />
      <PricingVersionBar
        pricing={pricing}
        activeVersionReason={draft.activeVersionReason}
        versionReason={draft.versionReason}
        onVersionReasonChange={draft.setVersionReason}
        onStartNewVersion={draft.startNewPricingVersion}
      />
      <PricingResultCard
        pricing={pricing}
        calculated={calculated}
        totalOffsets={totalOffsets}
        netAfterRepurchase={netAfterRepurchase}
        targetFinalRate={draft.targetFinalRate}
        finalRateGap={draft.finalRateGap}
      />
      {Math.abs(draft.faceDifference) > 0.01 && (
        <PricingReconciliation registeredAmount={operation.amount} titlesFace={calculated.face} />
      )}
      <RepurchaseOverview
        totalOffsets={totalOffsets}
        netAfterRepurchase={netAfterRepurchase}
        selectedCount={selectedOffsetCount}
        hasAvailableItems={Boolean(repurchase.rows.length || settlementAdjustments.rows.length)}
        onOpen={startRepurchaseComposition}
      />
      <div className="pricing-body">
        <fieldset className="pricing-editor pricing-editor-fieldset" disabled={pricing.locked}>
          <PricingConditionSection
            pricing={pricing}
            calculated={calculated}
            policyMinimum={draft.policyMinimum}
            finalRateGap={draft.finalRateGap}
            rateBelowPolicy={draft.rateBelowPolicy}
            onNumberChange={draft.numberField}
            onDraftChange={draft.updateDraft}
          />
          <PricingFeesSection
            pricing={pricing}
            calculated={calculated}
            taxRule={draft.taxRule}
            adValoremEnabled={operation.institution === "Factoring"}
            onNumberChange={draft.numberField}
          />
          <PricingCustomFees
            manualFees={pricing.manualFees}
            manualFeesTotal={calculated.manualFees}
            feeDescription={draft.feeDescription}
            feeAmount={draft.feeAmount}
            onFeeDescriptionChange={draft.setFeeDescription}
            onFeeAmountChange={draft.setFeeAmount}
            onAddFee={draft.addManualFee}
            onRemoveFee={draft.removeManualFee}
          />
          <RepurchaseLauncher
            totalOffsets={totalOffsets}
            selectedTitleCount={repurchase.selected.length}
            selectedAdjustmentCount={settlementAdjustments.selected.length}
            onOpen={() => setRepurchaseOpen(true)}
          />
          <PricingResponsibilitySection
            pricing={pricing}
            onNumberChange={draft.numberField}
            onResponsibilityChange={draft.updateResponsibility}
          />
        </fieldset>
        <PricingWaterfall
          pricing={pricing}
          calculated={calculated}
          totalOffsets={totalOffsets}
          netAfterRepurchase={netAfterRepurchase}
          positiveEconomics={draft.positiveEconomics}
          rateBelowPolicy={draft.rateBelowPolicy}
          feedback={draft.feedback}
          onSave={draft.savePricing}
        />
      </div>
      <PricingTitleMemory
        calculated={calculated}
        feeAllocation={pricing.feeAllocation}
        open={detailsOpen}
        onToggle={() => setDetailsOpen(value => !value)}
      />
      {pricing.audit?.length ? <PricingAuditTrail audit={pricing.audit} /> : null}
      {repurchaseOpen && (
        <RepurchaseModal
          locked={Boolean(pricing.locked)}
          cedent={operation.cedent}
          commercialNet={calculated.net}
          totalOffsets={totalOffsets}
          netAfterRepurchase={netAfterRepurchase}
          repurchase={repurchase}
          settlementAdjustments={settlementAdjustments}
          selectedCount={selectedOffsetCount}
          selectedOffsetMemory={selectedOffsetMemory}
          availableCount={offsetRows.length}
          filteredRows={filteredOffsetRows}
          filters={offsetFilters}
          onFiltersChange={changes => setOffsetFilters(current => ({ ...current, ...changes }))}
          onToggleTitle={draft.toggleRepurchaseTitle}
          onToggleAdjustment={draft.toggleSettlementAdjustment}
          onUpdateTerms={draft.updateRepurchaseTerms}
          onRestoreRate={draft.restoreAcquisitionRate}
          onSelectVisibleOverdue={selectVisibleOverdue}
          onClear={draft.clearOffsets}
          onClose={() => setRepurchaseOpen(false)}
        />
      )}
    </section>
  );
}
