import { compareEligibilityValues } from "./operators";
import {
  type EligibilityEvaluation,
  type EligibilityOutcome,
  type EligibilityRun,
  type EligibilitySubject,
  type EligibilityValue,
  type ResolvedRule,
} from "./model";

const outcomeWeight: Record<EligibilityOutcome, number> = {
  APROVADO: 0,
  NAO_AVALIADO: 1,
  ALERTA: 2,
  EXCECAO: 3,
  REPROVADO: 4,
};

const operatorSymbol = { EQ: "=", NE: "≠", GT: ">", GTE: "≥", LT: "<", LTE: "≤", IN: "∈", NOT_IN: "∉" };

export function formatEligibilityValue(value: EligibilityValue, variable?: string) {
  if (value == null) return "não disponível";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number" && variable?.toLocaleLowerCase().includes("percent"))
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return value;
}

function evaluate(subject: EligibilitySubject, resolved: ResolvedRule): EligibilityEvaluation {
  const { rule, binding, policy } = resolved;
  const operator = binding.operator ?? rule.defaultOperator;
  const observed = subject.facts[rule.variable] ?? null;
  const unavailable = observed == null;
  const passed = !unavailable && compareEligibilityValues(observed, operator, binding.parameter);
  const outcome: EligibilityOutcome = unavailable ? "NAO_AVALIADO" : passed ? "APROVADO" : binding.failureOutcome;
  const comparison = `${formatEligibilityValue(observed, rule.variable)} ${operatorSymbol[operator]} ${formatEligibilityValue(binding.parameter, rule.variable)}`;
  const explanation = unavailable
    ? `${subject.label}: regra não avaliada porque o dado necessário não está disponível.`
    : passed
      ? `${subject.label}: regra atendida (${comparison}).`
      : `${subject.label}: ${rule.friendlyMessage} Encontrado ${formatEligibilityValue(observed, rule.variable)}; parâmetro ${formatEligibilityValue(binding.parameter, rule.variable)}.`;
  return {
    id: `${subject.id}:${rule.id}`,
    ruleId: rule.id,
    ruleName: rule.name,
    variable: rule.variable,
    subjectId: subject.id,
    subjectLabel: subject.label,
    level: rule.level,
    outcome,
    action: passed ? "CONTINUAR" : binding.action,
    observed,
    parameter: binding.parameter,
    operator,
    policyName: policy.name,
    policyVersion: policy.version,
    overrideAllowed: binding.overrideAllowed,
    overrideAuthority: binding.overrideAuthority,
    technicalMessage: rule.technicalMessage,
    explanation,
    evidence: subject.evidence[rule.variable] ?? rule.dataSource,
  };
}

export function runEligibilityEngine({
  runId,
  evaluatedAt,
  subjects,
  rules,
}: {
  runId: string;
  evaluatedAt: string;
  subjects: EligibilitySubject[];
  rules: ResolvedRule[];
}): EligibilityRun {
  const evaluations = rules.flatMap(resolved =>
    subjects.filter(subject => subject.level === resolved.rule.level).map(subject => evaluate(subject, resolved)),
  );
  const counts: EligibilityRun["counts"] = {
    APROVADO: 0,
    ALERTA: 0,
    EXCECAO: 0,
    REPROVADO: 0,
    NAO_AVALIADO: 0,
  };
  evaluations.forEach(item => counts[item.outcome]++);
  const overallOutcome = evaluations.reduce<EligibilityOutcome>(
    (current, item) => (outcomeWeight[item.outcome] > outcomeWeight[current] ? item.outcome : current),
    "APROVADO",
  );
  const policyVersions = [
    ...new Map(
      rules.map(({ policy }) => [policy.id, { id: policy.id, name: policy.name, version: policy.version }]),
    ).values(),
  ];
  return { id: runId, evaluatedAt, overallOutcome, policyVersions, evaluations, counts };
}
