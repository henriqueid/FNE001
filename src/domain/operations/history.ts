/** Projeta somente registros preservados no aditivo para consulta da linha do tempo. */
import type { Operation } from "@/src/domain/core/types";
import { stages } from "@/src/domain/core/stages";

export type OperationHistoryEvent = { at: string; by: string; action: string; detail: string };

export function operationHistory(operation: Operation): OperationHistoryEvent[] {
  const events: OperationHistoryEvent[] = [];
  if (operation.receivedAtIso)
    events.push({
      at: operation.receivedAtIso,
      by: "Autor da entrada não informado",
      action: "Operação recebida",
      detail: `${operation.source ?? "Origem não informada"} · ${operation.borderoNumber}`,
    });
  for (const item of operation.stageCompletions ?? [])
    events.push({
      at: item.completedAt,
      by: item.completedBy,
      action: `${stages[item.stageId - 1]?.short ?? "Etapa"} concluída`,
      detail: item.reason ?? "Conclusão registrada nesta operação",
    });
  for (const item of operation.riskReview?.audit ?? [])
    events.push({
      at: item.at,
      by: item.by,
      action: `Risco: ${item.decision}`,
      detail: `${item.entity} · ${item.policy}`,
    });
  const lastro = operation.lastroReview;
  if (lastro?.reviewedAt)
    events.push({
      at: lastro.reviewedAt,
      by: lastro.reviewedBy ?? "Autor não informado",
      action: `Lastro: ${lastro.status ?? "Parecer registrado"}`,
      detail: lastro.opinion ?? "",
    });
  for (const [id, item] of Object.entries(lastro?.items ?? {}))
    for (const attempt of item.attempts ?? [])
      events.push({
        at: attempt.at,
        by: attempt.by,
        action: `Contato: ${attempt.result}`,
        detail: `${id} · ${attempt.channel}`,
      });
  for (const item of operation.pricingReview?.audit ?? [])
    events.push({
      at: item.at,
      by: item.by,
      action: item.action,
      detail: `Versão ${item.version}${item.reason ? ` · ${item.reason}` : ""}`,
    });
  events.push(...(operation.approvalReview?.audit ?? []), ...(operation.releaseReview?.audit ?? []));
  if (operation.cancellation) {
    const item = operation.cancellation;
    events.push({
      at: item.cancelledAt,
      by: item.cancelledBy,
      action: "Operação cancelada",
      detail: `${item.category} · ${item.reason}`,
    });
  }
  return events;
}
