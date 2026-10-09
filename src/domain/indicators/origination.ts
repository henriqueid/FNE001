/**
 * Indicadores de originação (operações do período): ticket médio, prazo médio ponderado dos
 * títulos comprados, taxa efetiva total (all-in) e spread sobre o custo de captação.
 * Taxa e custo vêm da mesma precificação da etapa Preço (parâmetros operacionais da
 * modalidade), para que a Visão geral, o Financeiro e a operação mostrem o mesmo número.
 */
import { type Operation } from "@/src/domain/core/types";
import { normalizedPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { daysFrom } from "./portfolio";

/** Face, taxa efetiva total e custo de captação de uma operação, pela precificação da etapa Preço. */
export function operationEconomics(op: Operation) {
  const pricing = normalizedPricing(op);
  const calc = pricingCalculation(op, pricing);
  const priced = calc.face > 0;
  return {
    face: priced ? calc.face : op.amount,
    rate: priced && calc.allInMonthly > 0 ? calc.allInMonthly : pricing.monthlyRate,
    funding: pricing.fundingCostMonthly,
  };
}

export function originationIndicators(ops: Operation[], dateOf: (op: Operation) => string) {
  const volume = ops.reduce((s, op) => s + op.amount, 0);
  const entries = ops.flatMap(op => (op.manualEntry?.entries ?? []).map(e => ({ e, start: dateOf(op) })));
  const entryFace = entries.reduce((s, x) => s + x.e.amount, 0);
  const term = entryFace
    ? entries.reduce((s, x) => s + Math.max(0, daysFrom(x.start, x.e.dueDate)) * x.e.amount, 0) / entryFace
    : 0;
  const econ = ops.map(operationEconomics);
  const face = econ.reduce((s, x) => s + x.face, 0);
  const rate = face ? econ.reduce((s, x) => s + x.rate * x.face, 0) / face : 0;
  const fundingCost = face ? econ.reduce((s, x) => s + x.funding * x.face, 0) / face : 0;
  return {
    count: ops.length,
    volume,
    ticket: ops.length ? volume / ops.length : 0,
    term,
    rate,
    fundingCost,
    spread: ops.length ? rate - fundingCost : 0,
  };
}
