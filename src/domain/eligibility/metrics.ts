import { type Operation } from "@/src/domain/core/types";

export function eligibilityOperationalMetrics(operations: Operation[]) {
  const reviews = operations.flatMap(operation => (operation.eligibilityReview ? [operation.eligibilityReview] : []));
  const evaluations = reviews.flatMap(review => review.run.evaluations);
  const overrides = reviews.flatMap(review => review.overrides);
  return {
    operationsProcessed: reviews.length,
    evaluationsProcessed: evaluations.length,
    titlesProcessed: reviews.reduce(
      (total, review) =>
        total +
        new Set(review.run.evaluations.filter(item => item.level === "TITULO").map(item => item.subjectId)).size,
      0,
    ),
    operationsDirectlyEligible: reviews.filter(review => review.run.overallOutcome === "APROVADO").length,
    operationsWithAlert: reviews.filter(review => review.run.overallOutcome === "ALERTA").length,
    operationsWithException: reviews.filter(review => review.run.overallOutcome === "EXCECAO").length,
    operationsRejected: reviews.filter(review => review.run.overallOutcome === "REPROVADO").length,
    overridesPerformed: overrides.length,
    humanInterventions: overrides.length,
  };
}
