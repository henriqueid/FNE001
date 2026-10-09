/**
 * Fila de exceções por alçada: lê o snapshot do motor e os overrides já registrados e devolve,
 * para cada operação, as decisões que ainda aguardam alguém. Nada é recalculado aqui.
 */
import { type Operation } from "@/src/domain/core/types";
import { effectiveEvaluationOutcome } from "./decision";

/** Alçada usada quando a regra não define quem decide (ex.: dado ausente). */
export const DEFAULT_AUTHORITY = "Mesa de operações";

export type PendingDecision = {
  evaluationId: string;
  ruleId: string;
  ruleName: string;
  subjectLabel: string;
  authority: string;
  explanation: string;
  outcome: "EXCECAO" | "NAO_AVALIADO";
};

const isActive = (operation: Operation) =>
  operation.status !== "Cancelada" && operation.status !== "Liberada ao financeiro";

export function pendingDecisionsFor(operation: Operation): PendingDecision[] {
  const review = operation.eligibilityReview;
  if (!review || !isActive(operation)) return [];
  return review.run.evaluations.flatMap(evaluation => {
    const outcome = effectiveEvaluationOutcome(evaluation, review.overrides);
    if (outcome !== "EXCECAO" && outcome !== "NAO_AVALIADO") return [];
    return [
      {
        evaluationId: evaluation.id,
        ruleId: evaluation.ruleId,
        ruleName: evaluation.ruleName,
        subjectLabel: evaluation.subjectLabel,
        authority: evaluation.overrideAuthority ?? DEFAULT_AUTHORITY,
        explanation: evaluation.explanation,
        outcome,
      },
    ];
  });
}

/** Alçadas com decisão pendente na operação, sem repetição, em ordem alfabética. */
export const pendingAuthoritiesFor = (operation: Operation) =>
  [...new Set(pendingDecisionsFor(operation).map(item => item.authority))].sort((a, b) => a.localeCompare(b, "pt-BR"));

export type AuthorityQueueEntry = { authority: string; operations: number; decisions: number };

/** Resumo da fila: quantas operações e decisões aguardam cada alçada. */
export function authorityQueue(operations: Operation[]): AuthorityQueueEntry[] {
  const map = new Map<string, { operations: Set<string>; decisions: number }>();
  operations.forEach(operation =>
    pendingDecisionsFor(operation).forEach(item => {
      const entry = map.get(item.authority) ?? { operations: new Set<string>(), decisions: 0 };
      entry.operations.add(operation.id);
      entry.decisions += 1;
      map.set(item.authority, entry);
    }),
  );
  return [...map.entries()]
    .map(([authority, entry]) => ({ authority, operations: entry.operations.size, decisions: entry.decisions }))
    .sort((a, b) => b.decisions - a.decisions || a.authority.localeCompare(b.authority, "pt-BR"));
}
