/** Identifica respostas já persistidas sem tratar uma versão enviada pela interface como recibo. */
import type { Operation } from "@/src/domain/core/types";
import { roundPricing } from "@/src/domain/operations/pricing";

const savedOperations = new WeakSet<Operation>();
export function operationSavedByServer(operation: Operation) {
  savedOperations.add(operation);
  return operation;
}
export function consumeOperationServerResult(operation: Operation) {
  const saved = savedOperations.has(operation);
  savedOperations.delete(operation);
  return saved;
}

export function mergeOperationAcknowledgement(current: Operation, submitted: Operation, saved: Operation): Operation {
  if (current.id !== saved.id || (current.persistenceVersion ?? 0) > (saved.persistenceVersion ?? 0)) return current;
  if (current === submitted) return saved;
  return {
    ...current,
    persistenceVersion: saved.persistenceVersion,
    repurchaseContext: saved.repurchaseContext,
    repurchaseApplications: saved.repurchaseApplications,
  };
}

/** Mantém o lote e sua origem assistida; decisões são produzidas depois pelos fluxos autorizados. */
export function newOperationAtEntry(operation: Operation): Operation {
  const entries = operation.manualEntry?.entries ?? [];
  const amount = roundPricing(entries.reduce((sum, title) => sum + title.amount, 0));
  return {
    ...operation,
    stage: 1,
    status: "Em andamento",
    amount,
    titleCount: entries.length,
    netAmount: amount,
    blockers: 0,
    alerts: 0,
    nextAction: "Conferir os títulos na Entrada",
    persistenceVersion: undefined,
    stageCompletions: undefined,
    riskReview: undefined,
    eligibilityReview: undefined,
    enrichmentReview: undefined,
    lastroReview: undefined,
    pricingReview: undefined,
    approvalReview: undefined,
    releaseReview: undefined,
    cancellation: undefined,
    repurchaseApplications: undefined,
    repurchaseContext: undefined,
  };
}
