import type { Permission } from "@/src/domain/access/model";
import type { Operation } from "@/src/domain/core/types";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const riskFields: Array<keyof Operation> = ["riskReview", "eligibilityReview", "enrichmentReview"];
const operationsFields: Array<keyof Operation> = [
  "manualEntry",
  "lastroReview",
  "pricingReview",
  "cancellation",
  "financialObservation",
  "clientOperationalParameters",
];
const workflowFields = new Set<keyof Operation>([
  "stage",
  "status",
  "blockers",
  "nextAction",
  "stageCompletions",
  "persistenceVersion",
]);
const specializedFields = new Set<keyof Operation>([
  ...riskFields,
  ...operationsFields,
  "approvalReview",
  "releaseReview",
]);

function changed(current: Operation, requested: Operation, fields: Array<keyof Operation>) {
  return fields.some(field => !same(current[field], requested[field]));
}

function manualRiskReady(operation: Operation) {
  const entries = operation.manualEntry?.entries ?? [];
  if (!entries.length || operation.riskReview?.cedentDecision !== "Aprovado") return false;
  const debtorKeys = [...new Set(entries.map(entry => entry.debtorId || entry.debtorDocument))];
  return (
    debtorKeys.every(key => Boolean(operation.riskReview?.debtorDecisions?.[key])) &&
    entries.every(entry => Boolean(operation.riskReview?.titleDecisions?.[entry.id])) &&
    entries.some(entry => operation.riskReview?.titleDecisions?.[entry.id] === "Aprovado")
  );
}

/** Autoriza a alteração pelo domínio funcional, nunca por uma permissão genérica de outra área. */
export function operationMutationPermissionError(
  current: Operation | null,
  requested: Operation,
  permissions: Permission[],
): string | null {
  const has = (permission: Permission) => permissions.includes(permission);
  if (!current) return has("operations:edit") ? null : "Somente Operações pode cadastrar uma operação.";
  if (requested.stage > current.stage) {
    const permission: Permission =
      current.stage === 2 ? "risk:decide" : current.stage === 5 ? "controlleria:formalize" : "operations:edit";
    if (!has(permission)) return "Sem permissão da área responsável para concluir esta etapa da operação.";
  }

  const riskChanged = changed(current, requested, riskFields);
  const approvalChanged = !same(current.approvalReview, requested.approvalReview);
  const releaseChanged = !same(current.releaseReview, requested.releaseReview);
  const operationalChanged = changed(current, requested, operationsFields);
  const riskWorkflowAdvance =
    current.stage === 2 &&
    requested.stage > current.stage &&
    requested.stage <= 5 &&
    Boolean(
      (current.eligibilityReview && eligibilityRouteFor(current).canAdvance) ||
      (!current.eligibilityReview && manualRiskReady(current)),
    ) &&
    has("risk:decide");

  if (riskChanged && !has("risk:decide")) return "Somente Risco pode alterar decisões de risco e elegibilidade.";
  if (approvalChanged && !has("controlleria:formalize"))
    return "Somente Controladoria pode alterar aprovação e formalização.";
  if (releaseChanged) {
    if (current.releaseReview?.status === "Enviada ao financeiro" && !has("finance:release"))
      return "Somente o Financeiro pode registrar ou estornar pagamentos.";
    if (!has("operations:edit") && !has("finance:release"))
      return "Somente Operações ou o Financeiro pode preparar e enviar uma liberação.";
  }

  if (operationalChanged && !has("operations:edit"))
    return "Somente Operações pode alterar entrada, lastro, preço ou cancelamento.";

  const changedBusinessField = (Object.keys(requested) as Array<keyof Operation>).some(field => {
    if (workflowFields.has(field) || specializedFields.has(field)) return false;
    return !same(current[field], requested[field]);
  });
  if (changedBusinessField && !has("operations:edit"))
    return "Somente Operações pode alterar os dados cadastrais e financeiros da operação.";

  if (!riskChanged && !approvalChanged && !releaseChanged && !operationalChanged && !changedBusinessField) {
    const workflowChanged = [...workflowFields].some(field => !same(current[field], requested[field]));
    if (workflowChanged && !riskWorkflowAdvance && !has("operations:edit"))
      return "Somente Operações pode movimentar esta etapa da operação.";
  }
  return null;
}
