/**
 * Consultas sobre a operação: se falta cedente e o texto pesquisável da busca.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";

export function operationNeedsCedent(operation: Operation) {
  return (
    !operation.document ||
    operation.document === "Cadastro pendente" ||
    !operation.cedent ||
    operation.cedent.toLowerCase().includes("sem cedente")
  );
}

/** Texto pesquisável da operação: só campos que o usuário vê (sem IDs internos nem nomes de campos). */
export function operationSearchText(op: Operation) {
  const titles = (op.manualEntry?.entries ?? []).flatMap(entry => [
    entry.documentNumber,
    entry.debtorName,
    entry.debtorDocument,
    entry.nfeKey ?? "",
  ]);
  return [
    op.aditivoNumber,
    op.borderoNumber,
    op.proposal,
    op.cedent,
    op.document,
    op.document.replace(/\D/g, ""),
    op.vehicle,
    op.institution,
    op.status,
    op.owner,
    op.source ?? "",
    op.operationType ?? "",
    op.nextAction,
    stages.find(stage => stage.id === op.stage)?.short ?? "",
    ...titles,
  ]
    .join(" ")
    .toLowerCase();
}
