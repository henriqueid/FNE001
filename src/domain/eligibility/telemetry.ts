import { type Operation } from "@/src/domain/core/types";

export type EligibilityTelemetryEvent = {
  type: "RUN_COMPLETED" | "EXCEPTION_RAISED" | "OVERRIDE_RECORDED";
  operationId: string;
  at: string;
  ruleId?: string;
  evaluationId?: string;
  detail: string;
};

/** Eventos derivados do snapshot; prontos para envio a uma camada de telemetria quando houver backend. */
export function eligibilityTelemetry(operation: Operation): EligibilityTelemetryEvent[] {
  const review = operation.eligibilityReview;
  if (!review) return [];
  return [
    {
      type: "RUN_COMPLETED",
      operationId: operation.id,
      at: review.run.evaluatedAt,
      detail: `${review.run.evaluations.length} avaliações · resultado ${review.run.overallOutcome}`,
    },
    ...review.run.evaluations
      .filter(evaluation => evaluation.outcome === "EXCECAO")
      .map(evaluation => ({
        type: "EXCEPTION_RAISED" as const,
        operationId: operation.id,
        at: review.run.evaluatedAt,
        ruleId: evaluation.ruleId,
        evaluationId: evaluation.id,
        detail: evaluation.explanation,
      })),
    ...review.overrides.map(override => ({
      type: "OVERRIDE_RECORDED" as const,
      operationId: operation.id,
      at: override.decidedAt,
      ruleId: override.ruleId,
      evaluationId: override.evaluationId,
      detail: `${override.decision} · ${override.authority} · ${override.decidedBy}`,
    })),
  ];
}
