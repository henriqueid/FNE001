import type { ManualEntry, ManualEntryData, Operation } from "@/src/domain/core/types";

export type ReceivableLifecycleStatus = "DRAFT" | "APPROVED" | "REJECTED" | "ASSIGNED" | "REMOVED";

export type ReceivableRecord = {
  id: string;
  operationId: string;
  sourceEntryId: string;
  canonicalKey: string;
  receivableType: ManualEntryData["receivableType"];
  lifecycleStatus: ReceivableLifecycleStatus;
  company: string;
  institution: string;
  proposal: string;
  aditivoNumber: string;
  borderoNumber: string;
  operationType?: string;
  ownerName: string;
  ownerDocument: string;
  entry: ManualEntry;
  persistenceVersion?: number;
};

const digits = (value?: string) => (value ?? "").replace(/\D/g, "");
const normalizedText = (value?: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();

export function canonicalReceivableKey(input: {
  receivableType: string;
  ownerDocument: string;
  debtorDocument: string;
  documentNumber: string;
}) {
  return [
    normalizedText(input.receivableType),
    digits(input.ownerDocument),
    digits(input.debtorDocument),
    normalizedText(input.documentNumber),
  ].join("|");
}

export const receivableIdFor = (operationId: string, sourceEntryId: string) =>
  `rcv:${operationId.trim()}:${sourceEntryId.trim()}`;

export function receivableLifecycleFor(operation: Operation, entry: ManualEntry): ReceivableLifecycleStatus {
  if (operation.status === "Cancelada") return "REMOVED";
  if (operation.riskReview?.titleDecisions?.[entry.id] === "Reprovado") return "REJECTED";
  if (operation.status === "Liberada ao financeiro") return "ASSIGNED";
  if (
    operation.riskReview?.titleDecisions?.[entry.id] === "Aprovado" ||
    operation.approvalReview?.status === "Aprovada" ||
    operation.approvalReview?.status === "Em formalização"
  )
    return "APPROVED";
  return "DRAFT";
}

export function receivableFromOperation(operation: Operation, entry: ManualEntry): ReceivableRecord {
  const receivableType = operation.manualEntry?.receivableType ?? "Duplicata";
  return {
    id: receivableIdFor(operation.id, entry.id),
    operationId: operation.id,
    sourceEntryId: entry.id,
    canonicalKey: canonicalReceivableKey({
      receivableType,
      ownerDocument: operation.document,
      debtorDocument: entry.debtorDocument,
      documentNumber: entry.documentNumber,
    }),
    receivableType,
    lifecycleStatus: receivableLifecycleFor(operation, entry),
    company: operation.vehicle,
    institution: operation.institution,
    proposal: operation.proposal,
    aditivoNumber: operation.aditivoNumber,
    borderoNumber: operation.borderoNumber,
    operationType: operation.operationType,
    ownerName: operation.cedent,
    ownerDocument: operation.document,
    entry,
  };
}

export function receivablesFromOperation(operation: Operation) {
  return (operation.manualEntry?.entries ?? []).map(entry => receivableFromOperation(operation, entry));
}

/** O payload persistido da operação mantém somente o envelope; os títulos vivem no agregado Receivable. */
export function stripReceivablesFromOperation(operation: Operation): Operation {
  if (!operation.manualEntry) return operation;
  return { ...operation, manualEntry: { ...operation.manualEntry, entries: [] } };
}

/** Reconstitui a leitura esperada pelas seis etapas sem duplicar títulos no armazenamento. */
export function hydrateOperationReceivables(operation: Operation, receivables: ReceivableRecord[]): Operation {
  const active = receivables
    .filter(receivable => receivable.operationId === operation.id && receivable.lifecycleStatus !== "REMOVED")
    .sort((left, right) => left.sourceEntryId.localeCompare(right.sourceEntryId));
  if (!operation.manualEntry && !active.length) return operation;
  return {
    ...operation,
    manualEntry: {
      receivableType: operation.manualEntry?.receivableType ?? active[0]?.receivableType ?? "Duplicata",
      mode: operation.manualEntry?.mode ?? "individual",
      entries: active.map(receivable => receivable.entry),
    },
  };
}

export function validateReceivable(receivable: ReceivableRecord): string | null {
  if (!receivable.id || !receivable.operationId || !receivable.sourceEntryId)
    return "Identificação do recebível incompleta.";
  if (!receivable.canonicalKey) return "Identidade canônica do recebível ausente.";
  if (!receivable.entry.documentNumber.trim()) return "Número do documento ausente.";
  if (![11, 14].includes(digits(receivable.entry.debtorDocument).length)) return "Documento do sacado inválido.";
  if (!Number.isFinite(receivable.entry.amount) || receivable.entry.amount <= 0) return "Valor de face inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivable.entry.dueDate)) return "Vencimento inválido.";
  return null;
}
