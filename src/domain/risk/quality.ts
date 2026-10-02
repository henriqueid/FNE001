/**
 * Índice de qualidade explicável de cedentes e sacados.
 *
 * Para cada cliente, compara a janela recente (ex.: últimos 3 meses) com a anterior:
 * cada componente da política vira uma nota de 0 a 1 entre os valores "ruim" e "bom",
 * o índice é a média ponderada (0–100) e os motivos são os componentes que mais
 * moveram o índice, escritos em linguagem direta ("atraso médio subiu de 4 para 11 dias").
 * Funções puras: recebem o histórico mensal e a política, devolvem números e textos.
 */
import { type QualityComponentId, type QualityComponentRule, type QualityPolicy } from "./quality-policy";

/** Um mês da vida de um cliente na carteira (valores em R$, salvo indicação). */
export type QualityMonth = {
  month: string; // AAAA-MM
  acquired: number;
  settled: number;
  settledOnTime: number;
  /** Atraso médio das liquidações do mês, em dias, ponderado pelo valor. */
  averageDelay: number;
  repurchased: number;
  extended: number;
  /** Saldo em aberto no fim do mês e quanto dele está vencido há mais de 30 dias. */
  openBalance: number;
  overdue30: number;
  /** Faixas de atraso do saldo no fim do mês: a vencer, 1–30, 31–60, 61–90, > 90. */
  buckets: [number, number, number, number, number];
  topDebtorShare: number;
  protests: number;
  limitUse: number;
  bureauScore: number;
};

export type QualityHistory = {
  id: string;
  name: string;
  document: string;
  kind: "cedente" | "sacado";
  exposure: number;
  months: QualityMonth[];
};

export type ComponentValues = Record<QualityComponentId, number>;

const sum = (rows: QualityMonth[], pick: (m: QualityMonth) => number) => rows.reduce((s, m) => s + pick(m), 0);
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/** Valores de cada componente numa janela de meses. */
export function windowValues(rows: QualityMonth[]): ComponentValues {
  const last = rows[rows.length - 1];
  const settled = sum(rows, m => m.settled);
  return {
    onTimeRate: settled
      ? ratio(
          sum(rows, m => m.settledOnTime),
          settled,
        )
      : 100,
    averageDelay: settled ? sum(rows, m => m.averageDelay * m.settled) / settled : 0,
    repurchaseRate: ratio(
      sum(rows, m => m.repurchased),
      sum(rows, m => m.acquired),
    ),
    extensionRate: ratio(
      sum(rows, m => m.extended),
      settled,
    ),
    overdue30Rate: last ? ratio(last.overdue30, last.openBalance) : 0,
    topDebtorShare: last?.topDebtorShare ?? 0,
    protests: sum(rows, m => m.protests),
    limitUse: last?.limitUse ?? 0,
    bureauScore: last?.bureauScore ?? 0,
  };
}

/** Nota de 0 a 1 do componente: 1 no valor "bom" ou melhor, 0 no "ruim" ou pior. */
export function componentScore(rule: QualityComponentRule, value: number) {
  if (rule.good === rule.bad) return value === rule.good ? 1 : 0;
  return Math.max(0, Math.min(1, (value - rule.bad) / (rule.good - rule.bad)));
}

export function activeRules(policy: QualityPolicy, kind: QualityHistory["kind"]) {
  return policy.components.filter(c => c.weight > 0 && (kind === "cedente" || c.appliesToDebtors));
}

/** Índice de 0 a 100 (pesos ativos normalizados). */
export function qualityIndex(values: ComponentValues, rules: QualityComponentRule[]) {
  const total = rules.reduce((s, r) => s + r.weight, 0);
  if (!total) return 0;
  return (rules.reduce((s, r) => s + r.weight * componentScore(r, values[r.id]), 0) / total) * 100;
}

export type QualityReason = {
  component: QualityComponentId;
  text: string;
  /** Quanto este componente moveu o índice, em pontos (negativo = piorou). */
  impact: number;
};

export type QualityTrend = {
  id: string;
  name: string;
  document: string;
  kind: QualityHistory["kind"];
  exposure: number;
  index: number;
  previousIndex: number;
  delta: number;
  /** Índice mês a mês, para o mini gráfico. */
  series: number[];
  reasons: QualityReason[];
  action: string;
};

const fmtValue = (rule: QualityComponentRule, v: number) => {
  if (rule.unit === "%") return `${v.toFixed(v < 10 ? 1 : 0).replace(".", ",")}%`;
  if (rule.unit === "dias") return `${Math.round(v)} dia${Math.round(v) === 1 ? "" : "s"}`;
  if (rule.unit === "pontos") return `${Math.round(v)}`;
  return `${Math.round(v)}`;
};

/** "Atraso médio subiu de 4 para 11 dias" / "Liquidez no prazo caiu de 96% para 81%". */
export function reasonText(rule: QualityComponentRule, before: number, after: number) {
  const verb = after > before ? "subiu" : "caiu";
  if (rule.unit === "qtde") {
    const diff = Math.round(after - before);
    return diff > 0
      ? `${diff} ${rule.label.toLowerCase()} a mais (${Math.round(after)} na janela)`
      : `${Math.abs(diff)} ${rule.label.toLowerCase()} a menos (${Math.round(after)} na janela)`;
  }
  return `${rule.label} ${verb} de ${fmtValue(rule, before)} para ${fmtValue(rule, after)}`;
}

const worseningActions: Partial<Record<QualityComponentId, string>> = {
  onTimeRate: "Acionar cobrança e rever o prazo aceito",
  averageDelay: "Acionar cobrança e rever o prazo aceito",
  overdue30Rate: "Avaliar recompra, provisão ou jurídico",
  repurchaseRate: "Reforçar checagem de lastro",
  extensionRate: "Restringir prorrogações",
  topDebtorShare: "Limitar exposição ao maior sacado",
  protests: "Atualizar consulta e cadastro",
  limitUse: "Levar limite ao comitê",
  bureauScore: "Atualizar consulta de bureau",
};

/** Compara a janela recente com a anterior e explica a variação. */
export function qualityTrend(history: QualityHistory, policy: QualityPolicy): QualityTrend {
  const rules = activeRules(policy, history.kind);
  const w = Math.max(1, policy.windowMonths);
  const recentRows = history.months.slice(-w);
  const previousRows = history.months.slice(-2 * w, -w);
  const recent = windowValues(recentRows);
  const previous = previousRows.length ? windowValues(previousRows) : recent;
  const index = qualityIndex(recent, rules);
  const previousIndex = qualityIndex(previous, rules);
  const total = rules.reduce((s, r) => s + r.weight, 0) || 1;
  const reasons = rules
    .map(r => ({
      component: r.id,
      text: reasonText(r, previous[r.id], recent[r.id]),
      impact: ((r.weight * (componentScore(r, recent[r.id]) - componentScore(r, previous[r.id]))) / total) * 100,
    }))
    .filter(r => Math.abs(r.impact) >= 0.3)
    .filter(r => {
      const rule = rules.find(x => x.id === r.component)!;
      return rule.unit === "qtde" || fmtValue(rule, previous[r.component]) !== fmtValue(rule, recent[r.component]);
    });
  const delta = index - previousIndex;
  const ordered = [...reasons].sort((a, b) => (delta < 0 ? a.impact - b.impact : b.impact - a.impact));
  const main = ordered.filter(r => (delta < 0 ? r.impact < 0 : r.impact > 0)).slice(0, 3);
  const action =
    delta < 0
      ? (worseningActions[main[0]?.component ?? "onTimeRate"] ?? "Revisar o cliente")
      : index >= policy.healthyIndex
        ? "Candidato a mais limite ou taxa melhor"
        : "Melhorando, mas abaixo do patamar saudável: acompanhar";
  const series = history.months.map((_, i) =>
    qualityIndex(windowValues(history.months.slice(Math.max(0, i - w + 1), i + 1)), rules),
  );
  return {
    id: history.id,
    name: history.name,
    document: history.document,
    kind: history.kind,
    exposure: history.exposure,
    index,
    previousIndex,
    delta,
    series,
    reasons: main,
    action,
  };
}

/** Rankings: os que mais pioraram e os que mais melhoraram (acima da variação mínima da política). */
export function qualityRankings(histories: QualityHistory[], policy: QualityPolicy) {
  const trends = histories.map(h => qualityTrend(h, policy));
  const worsening = trends
    .filter(t => t.delta <= -policy.minDelta)
    .sort((a, b) => a.delta - b.delta || b.exposure - a.exposure)
    .slice(0, policy.rankingSize);
  const improving = trends
    .filter(t => t.delta >= policy.minDelta)
    .sort((a, b) => b.delta - a.delta || b.exposure - a.exposure)
    .slice(0, policy.rankingSize);
  const exposureAt = (list: QualityTrend[]) => list.reduce((s, t) => s + t.exposure, 0);
  return {
    trends,
    worsening,
    improving,
    worseningExposure: exposureAt(worsening),
    improvingExposure: exposureAt(improving),
    stable: trends.length - worsening.length - improving.length,
  };
}
