import type { Operation } from "@/src/domain/core/types";
import { stripReceivablesFromOperation } from "@/src/domain/receivables/model";

const institutions = new Set(["FIDC", "Securitizadora", "Factoring"]);
const statuses = new Set([
  "Em andamento",
  "Aguardando terceiro",
  "Em atenção",
  "Pronta para formalizar",
  "Pronta para liberar",
  "Liberada ao financeiro",
  "Cancelada",
]);

export type PersistOperationCommand = {
  operation: Operation;
  expectedVersion: number;
};

export function operationPayload(operation: Operation): Operation {
  const { persistenceVersion: _version, ...payload } = operation;
  void _version;
  return stripReceivablesFromOperation(payload as Operation);
}

export function validatePersistedOperation(operation: Operation): string | null {
  if (!operation || typeof operation !== "object") return "Operação ausente.";
  if (!operation.id?.trim()) return "Identificador da operação ausente.";
  if (!operation.vehicle?.trim()) return "Veículo da operação ausente.";
  if (!institutions.has(operation.institution)) return "Tipo de instituição inválido.";
  if (!operation.cedent?.trim() || !operation.document?.trim()) return "Cedente da operação incompleto.";
  if (!statuses.has(operation.status)) return "Status da operação inválido.";
  if (!Number.isInteger(operation.stage) || operation.stage < 1 || operation.stage > 6)
    return "Etapa da operação inválida.";
  if (!Number.isFinite(operation.amount) || operation.amount < 0) return "Valor da operação inválido.";
  if (!Number.isInteger(operation.titleCount) || operation.titleCount < 0) return "Quantidade de títulos inválida.";
  return null;
}

export function expectedOperationVersion(operation: Operation) {
  return operation.persistenceVersion ?? 0;
}
