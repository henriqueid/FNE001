import {
  type EligibilityEvaluation,
  type EligibilityOutcome,
  type EligibilityOverride,
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
