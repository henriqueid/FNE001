"use client";
/**
 * Hook que concentra o rascunho da precificação: estado da condição comercial,
 * mensagens de retorno, motivos de revisão, valores derivados (cálculo,
 * recompra, compensações, política) e todas as ações que alteram o rascunho
 * ou salvam a condição na operação.
 */
import { type Operation } from "@/src/domain/core/types";
import {
  baseRateForTargetFinal,
  normalizedPricing,
  pricingCalculation,
  type PricingDraft,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";
import { useEffect, useMemo, useState } from "react";
import {
  formatRate,
  type NumericPricingField,
  policyMinimumFor,
  type RepurchaseTerms,
  taxRuleFor,
} from "./pricing-model";

const DEFAULT_REPURCHASE_TERMS: RepurchaseTerms = {
  lateInterestMonthly: 1,
  penaltyPercent: 2,
  action: "Recompra",
};

/** Aplica alterações e devolve o rascunho ao estado de simulação (sem carimbo de salvamento). */
function asSimulation(current: PricingDraft, changes: Partial<PricingDraft>): PricingDraft {
  return { ...current, ...changes, status: "Simulação", savedAt: undefined, savedBy: undefined };
}

function toggleId(ids: string[] | undefined, id: string) {
  const current = new Set(ids ?? []);
  if (current.has(id)) current.delete(id);
  else current.add(id);
  return [...current];
}

export function usePricingDraft(operation: Operation, onChange: (operation: Operation) => void) {
  const [pricing, setPricing] = useState<PricingDraft>(normalizedPricing(operation));
  const [feedback, setFeedback] = useState("");
  const [feeDescription, setFeeDescription] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [versionReason, setVersionReason] = useState("");
  const [activeVersionReason, setActiveVersionReason] = useState("");

  const calculated = useMemo(() => pricingCalculation(operation, pricing), [operation, pricing]);
  const targetFinalRate = pricing.targetFinalRateMonthly ?? calculated.allInMonthly;
  const finalRateGap = calculated.allInMonthly - targetFinalRate;
  const repurchase = useMemo(() => repurchaseCalculation(operation, pricing), [operation, pricing]);
  const settlementAdjustments = useMemo(
    () => settlementAdjustmentCalculation(operation, pricing),
    [operation, pricing],
  );
  const totalOffsets = roundPricing(repurchase.total + settlementAdjustments.total);
  const netAfterRepurchase = roundPricing(calculated.net - totalOffsets);
  const policyMinimum = policyMinimumFor(operation.risk);
  const rateBelowPolicy = pricing.monthlyRate < policyMinimum;
  const positiveEconomics = netAfterRepurchase > 0 && calculated.spread > 0;
  const pricingSourceReady =
    calculated.sourceTitleCount > 0 && calculated.hasDecisions && calculated.approvedTitleCount > 0;
  const faceDifference = calculated.face - operation.amount;
  const taxRule = taxRuleFor(operation.institution);

  // Mantém a taxa base alinhada à taxa final desejada quando a composição muda.
  useEffect(() => {
    if ((pricing.targetFinalRateMonthly ?? 0) <= 0 || pricing.locked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebalanceia a taxa base quando a composição muda
    setPricing(current => {
      const balanced = balanceFinalRate(current);
      return Math.abs(balanced.monthlyRate - current.monthlyRate) > 0.00005 ? balanced : current;
    });
    // balanceFinalRate é recriada a cada render; as dependências abaixo são as entradas reais do cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pricing.targetFinalRateMonthly,
    pricing.method,
    pricing.vaEnabled,
    pricing.feeAllocation,
    pricing.manualFees,
    pricing.operationFee,
    pricing.feePerTitle,
    pricing.adValoremPercent,
    pricing.guaranteePercent,
    pricing.manualRetention,
    pricing.floatDays,
    pricing.minimumTermDays,
    pricing.locked,
  ]);

  function balanceFinalRate(next: PricingDraft) {
    const target = next.targetFinalRateMonthly ?? 0;
    return target > 0 ? { ...next, monthlyRate: baseRateForTargetFinal(operation, next, target) } : next;
  }

  function numberField(key: NumericPricingField, value: string) {
    setPricing(current => balanceFinalRate(asSimulation(current, { [key]: Math.max(0, Number(value) || 0) })));
    setFeedback("");
  }

  /** Alteração direta (selects/checkbox da condição financeira), sem rebalancear a taxa. */
  function updateDraft(changes: Partial<PricingDraft>) {
    setPricing(current => asSimulation(current, changes));
  }

  /** Alteração de regresso/coobrigação: só volta o status para simulação. */
  function updateResponsibility(changes: Partial<Pick<PricingDraft, "regress" | "coobligation">>) {
    setPricing(current => ({ ...current, ...changes, status: "Simulação" }));
  }

  function addManualFee() {
    const amount = Number(feeAmount.replace(",", "."));
    if (!feeDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFeedback("Informe a descrição e um valor positivo para adicionar a tarifa.");
      return;
    }
    const fee = { id: `fee-${Date.now()}`, description: feeDescription.trim(), amount, kind: "Esporádica" as const };
    setPricing(current =>
      balanceFinalRate(asSimulation(current, { manualFees: [...(current.manualFees ?? []), fee] })),
    );
    setFeeDescription("");
    setFeeAmount("");
    setFeedback("");
  }

  function removeManualFee(id: string) {
    setPricing(current =>
      balanceFinalRate(asSimulation(current, { manualFees: (current.manualFees ?? []).filter(fee => fee.id !== id) })),
    );
    setFeedback("");
  }

  function setRepurchaseSelection(ids: string[]) {
    setPricing(current => asSimulation(current, { repurchaseTitleIds: ids }));
    setFeedback("");
  }

  function toggleRepurchaseTitle(id: string) {
    setRepurchaseSelection(toggleId(pricing.repurchaseTitleIds, id));
  }

  function toggleSettlementAdjustment(id: string) {
    const settlementAdjustmentIds = toggleId(pricing.settlementAdjustmentIds, id);
    setPricing(value => asSimulation(value, { settlementAdjustmentIds }));
    setFeedback("");
  }

  function updateRepurchaseTerms(id: string, changes: Partial<RepurchaseTerms>) {
    setPricing(current => {
      const existing = current.repurchaseTerms?.[id] ?? DEFAULT_REPURCHASE_TERMS;
      return asSimulation(current, {
        repurchaseTerms: { ...(current.repurchaseTerms ?? {}), [id]: { ...existing, ...changes } },
      });
    });
    setFeedback("");
  }

  function restoreAcquisitionRate(id: string) {
    setPricing(current => {
      const withoutOverride = { ...(current.repurchaseTerms?.[id] ?? DEFAULT_REPURCHASE_TERMS) };
      delete withoutOverride.rateOverride;
      return asSimulation(current, {
        repurchaseTerms: { ...(current.repurchaseTerms ?? {}), [id]: withoutOverride },
      });
    });
    setFeedback("");
  }

  /** "Limpar recompra": remove títulos e compensações selecionados. */
  function clearOffsets() {
    setRepurchaseSelection([]);
    setPricing(current => ({ ...current, settlementAdjustmentIds: [], status: "Simulação" }));
  }

  /** Mensagem de bloqueio do salvamento, ou `undefined` quando a condição pode ser salva. */
  function saveBlocker() {
    if (!calculated.sourceTitleCount)
      return "A precificação está bloqueada: nenhum título foi recebido da etapa de entrada.";
    if (!calculated.hasDecisions)
      return "A precificação está bloqueada: os títulos ainda não foram deliberados na etapa de risco.";
    if (!calculated.approvedTitleCount)
      return "A precificação está bloqueada: não há títulos aprovados para formar o borderô.";
    if (totalOffsets > calculated.net)
      return "A recompra e as compensações selecionadas superam o valor líquido comercial do borderô.";
    if (!positiveEconomics) return "A condição precisa gerar líquido final e spread positivos.";
    if (rateBelowPolicy)
      return `A taxa está abaixo do piso de ${formatRate(policyMinimum)}% a.m. e exige alçada comercial.`;
    return undefined;
  }

  function auditSnapshot() {
    return {
      face: calculated.face,
      commercialNet: calculated.net,
      repurchaseAndCompensations: totalOffsets,
      borderoNet: netAfterRepurchase,
      monthlyRate: pricing.monthlyRate,
      method: pricing.method,
    };
  }

  function savePricing() {
    const blocker = saveBlocker();
    if (blocker) {
      setFeedback(blocker);
      return;
    }
    const version = (pricing.version ?? 0) + 1;
    const savedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const auditEntry = {
      version,
      at: savedAt,
      by: "Henrique",
      action: "Condição salva" as const,
      reason: activeVersionReason || undefined,
      ...auditSnapshot(),
    };
    const saved = {
      ...pricing,
      status: "Condição salva" as const,
      savedAt,
      savedBy: "Henrique",
      version,
      locked: true,
      audit: [...(pricing.audit ?? []), auditEntry],
    };
    setPricing(saved);
    onChange({
      ...operation,
      pricingReview: saved,
      amount: calculated.face,
      titleCount: calculated.titleRows.length,
      netAmount: netAfterRepurchase,
      nextAction: "Submeter condição comercial às alçadas",
    });
    setFeedback(
      "Condição comercial salva. Para alterar os valores, use Editar condição; o histórico anterior será preservado.",
    );
    setActiveVersionReason("");
  }

  function startNewPricingVersion() {
    if (!versionReason.trim()) {
      setFeedback("Informe por que a condição será alterada. Esse motivo ficará no histórico da operação.");
      return;
    }
    const nextVersion = (pricing.version ?? 0) + 1;
    const at = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const auditEntry = {
      version: nextVersion,
      at,
      by: "Henrique",
      action: "Nova versão iniciada" as const,
      reason: versionReason.trim(),
      ...auditSnapshot(),
    };
    setPricing(current => ({
      ...current,
      status: "Simulação",
      locked: false,
      savedAt: undefined,
      savedBy: undefined,
      audit: [...(current.audit ?? []), auditEntry],
    }));
    setActiveVersionReason(versionReason.trim());
    setVersionReason("");
    setFeedback(`Edição liberada. Ao salvar, a revisão ${nextVersion} será registrada sem apagar a condição anterior.`);
  }

  /** Se a condição estiver salva, libera a edição para compor a recompra (preservando o histórico). */
  function unlockForRepurchase() {
    if (!pricing.locked) return;
    setPricing(current => ({
      ...current,
      status: "Simulação",
      locked: false,
      savedAt: undefined,
      savedBy: undefined,
    }));
    setActiveVersionReason("Inclusão ou alteração de recompra");
    setFeedback("Recompra liberada para composição. A condição anterior continuará preservada no histórico.");
  }

  return {
    pricing,
    feedback,
    feeDescription,
    setFeeDescription,
    feeAmount,
    setFeeAmount,
    versionReason,
    setVersionReason,
    activeVersionReason,
    calculated,
    targetFinalRate,
    finalRateGap,
    repurchase,
    settlementAdjustments,
    totalOffsets,
    netAfterRepurchase,
    policyMinimum,
    rateBelowPolicy,
    positiveEconomics,
    pricingSourceReady,
    faceDifference,
    taxRule,
    numberField,
    updateDraft,
    updateResponsibility,
    addManualFee,
    removeManualFee,
    setRepurchaseSelection,
    toggleRepurchaseTitle,
    toggleSettlementAdjustment,
    updateRepurchaseTerms,
    restoreAcquisitionRate,
    clearOffsets,
    savePricing,
    startNewPricingVersion,
    unlockForRepurchase,
  };
}

export type PricingDraftState = ReturnType<typeof usePricingDraft>;
