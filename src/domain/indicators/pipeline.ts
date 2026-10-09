/**
 * Indicadores da esteira de operações: funil por etapa e conversão, tempo de ciclo contra o
 * padrão do cliente, operações sem intervenção humana, regras do motor que mais param
 * operações e decisões humanas (exceções aprovadas e rejeitadas).
 */
import { type Operation } from "@/src/domain/core/types";

const stageNames = ["Entrada", "Risco", "Lastro", "Preço", "Aprovação", "Liberação"];

function timestamp(value: string | undefined) {
  if (!value) return undefined;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const [, day, month, rawYear, hour, minute] = match;
  const year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
  return new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
}

export function pipelineIndicators(ops: Operation[]) {
  const live = ops.filter(op => op.status !== "Cancelada");
  const released = live.filter(op => op.status === "Liberada ao financeiro");
  const active = live.filter(op => op.status !== "Liberada ao financeiro");
  const funnel = stageNames.map((name, i) => ({
    name,
    count: active.filter(op => op.stage === i + 1).length,
    amount: active.filter(op => op.stage === i + 1).reduce((s, op) => s + op.amount, 0),
  }));
  const withHistory = active.filter(op => op.historySample > 0 && op.clientAverageMinutes > 0);
  const cycle = withHistory.length ? withHistory.reduce((s, op) => s + op.elapsedMinutes, 0) / withHistory.length : 0;
  const standard = withHistory.length
    ? withHistory.reduce((s, op) => s + op.clientAverageMinutes, 0) / withHistory.length
    : 0;
  const untouched = active.filter(op => op.blockers === 0 && op.alerts <= 1);
  const evaluations = ops.flatMap(op => op.eligibilityReview?.run.evaluations ?? []);
  const evaluatedOperations = ops.filter(op => (op.eligibilityReview?.run.evaluations.length ?? 0) > 0);
  const exceptionOperations = evaluatedOperations.filter(op =>
    (op.eligibilityReview?.run.evaluations ?? []).some(
      evaluation => evaluation.outcome === "EXCECAO" || evaluation.outcome === "REPROVADO",
    ),
  );
  const stops = new Map<string, { rule: string; count: number; operations: Set<string> }>();
  ops.forEach(op =>
    (op.eligibilityReview?.run.evaluations ?? [])
      .filter(e => e.outcome === "EXCECAO" || e.outcome === "REPROVADO")
      .forEach(e => {
        const row = stops.get(e.ruleId) ?? { rule: e.ruleName, count: 0, operations: new Set<string>() };
        row.count += 1;
        row.operations.add(op.id);
        stops.set(e.ruleId, row);
      }),
  );
  const overrides = ops.flatMap(op => op.eligibilityReview?.overrides ?? []);
  const availabilityCycles = released.flatMap(op => {
    const start = timestamp(op.receivedAtIso);
    const end = timestamp(op.releaseReview?.releasedAt);
    return start !== undefined && end !== undefined && end >= start ? [(end - start) / 60_000] : [];
  });
  return {
    total: live.length,
    activeCount: active.length,
    releasedCount: released.length,
    cancelledCount: ops.length - live.length,
    conversion: live.length ? (released.length / live.length) * 100 : 0,
    funnel,
    cycleMinutes: cycle,
    standardMinutes: standard,
    cycleCoverage: active.length ? (withHistory.length / active.length) * 100 : 0,
    availabilityMinutes: availabilityCycles.length
      ? availabilityCycles.reduce((sum, minutes) => sum + minutes, 0) / availabilityCycles.length
      : 0,
    availabilitySamples: availabilityCycles.length,
    untouchedRate: active.length ? (untouched.length / active.length) * 100 : 0,
    evaluations: evaluations.length,
    evaluatedOperations: evaluatedOperations.length,
    exceptionOperations: exceptionOperations.length,
    exceptionRate: evaluatedOperations.length ? (exceptionOperations.length / evaluatedOperations.length) * 100 : 0,
    topStops: [...stops.values()]
      .map(s => ({ rule: s.rule, count: s.count, operations: s.operations.size }))
      .sort((a, b) => b.operations - a.operations || b.count - a.count)
      .slice(0, 5),
    approvedExceptions: overrides.filter(o => o.decision === "APROVAR_EXCECAO").length,
    rejectedExceptions: overrides.filter(o => o.decision === "REJEITAR_EXCECAO").length,
  };
}
