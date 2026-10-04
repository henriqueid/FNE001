import {
  type EligibilityEvaluation,
  type EligibilityOutcome,
  type EligibilityOverride,
  type EligibilityReview,
  type EligibilityRun,
} from "./model";

const outcomeWeight: Record<EligibilityOutcome, number> = {
  APROVADO: 0,
  NAO_AVALIADO: 1,
  ALERTA: 2,
  EXCECAO: 3,
  REPROVADO: 4,
};

export function latestOverrideFor(evaluationId: string, overrides: EligibilityOverride[]) {
  return overrides.filter(item => item.evaluationId === evaluationId).at(-1);
}

export function effectiveEvaluationOutcome(
  evaluation: EligibilityEvaluation,
  overrides: EligibilityOverride[],
): EligibilityOutcome {
  const override = latestOverrideFor(evaluation.id, overrides);
  if (!override) return evaluation.outcome;
  return override.decision === "APROVAR_EXCECAO" ? "APROVADO" : "REPROVADO";
}

export function effectiveRunSummary(run: EligibilityRun, overrides: EligibilityOverride[]) {
  const counts: EligibilityRun["counts"] = {
    APROVADO: 0,
    ALERTA: 0,
    EXCECAO: 0,
    REPROVADO: 0,
    NAO_AVALIADO: 0,
  };
  run.evaluations.forEach(evaluation => counts[effectiveEvaluationOutcome(evaluation, overrides)]++);
  const overallOutcome = (Object.keys(counts) as EligibilityOutcome[]).reduce<EligibilityOutcome>(
    (current, outcome) => (counts[outcome] > 0 && outcomeWeight[outcome] > outcomeWeight[current] ? outcome : current),
    "APROVADO",
  );
  return { counts, overallOutcome };
}

/**
 * Substitui a execução corrente sem apagar o snapshot nem os overrides anteriores.
 * A reexecução é sempre explícita; o motor nunca recalcula histórico silenciosamente.
 */
export function replaceEligibilityRun(
  review: EligibilityReview,
  nextRun: EligibilityRun,
  audit: { at: string; by: string; reason: string },
): EligibilityReview {
  return {
    run: nextRun,
    overrides: [],
    history: [
      ...(review.history ?? []),
      {
        run: review.run,
        overrides: review.overrides,
        supersededAt: audit.at,
        supersededBy: audit.by,
        reason: audit.reason,
      },
    ],
  };
}
