/**
 * Histórico mensal de demonstração (6 meses) de cedentes e sacados, para o índice de
 * qualidade, a rolagem e as safras. Em produção virá do fechamento mensal da carteira.
 *
 * Gerado de forma determinística a partir da posição atual de cada cliente: o último
 * trimestre bate com os números do cadastro e o trimestre anterior é reconstruído com
 * uma tendência (piorando, melhorando ou estável) e 2–3 componentes que a explicam.
 */
import { type Cedent, type Debtor } from "@/src/domain/core/types";
import { type QualityHistory, type QualityMonth } from "@/src/domain/risk/quality";
import { type QualityComponentId } from "@/src/domain/risk/quality-policy";

const MONTHS = 6;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Ruído determinístico entre −1 e 1. */
const noise = (seed: string) => ((hash(seed) % 2001) - 1000) / 1000;

export function lastMonths(today: string, count = MONTHS) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

type Latest = Record<QualityComponentId, number>;

// quanto cada componente pode ter andado em 6 meses e se "maior é melhor"
const drift: Record<QualityComponentId, { step: number; higherIsBetter: boolean; min: number; max: number }> = {
  onTimeRate: { step: 14, higherIsBetter: true, min: 40, max: 100 },
  averageDelay: { step: 8, higherIsBetter: false, min: 0, max: 60 },
  repurchaseRate: { step: 4, higherIsBetter: false, min: 0, max: 30 },
  extensionRate: { step: 5, higherIsBetter: false, min: 0, max: 40 },
  overdue30Rate: { step: 5, higherIsBetter: false, min: 0, max: 50 },
  topDebtorShare: { step: 12, higherIsBetter: false, min: 3, max: 90 },
  protests: { step: 3, higherIsBetter: false, min: 0, max: 20 },
  limitUse: { step: 22, higherIsBetter: false, min: 0, max: 120 },
  bureauScore: { step: 70, higherIsBetter: true, min: 300, max: 1000 },
};

const cedentDrivers: QualityComponentId[] = [
  "onTimeRate",
  "averageDelay",
  "repurchaseRate",
  "overdue30Rate",
  "topDebtorShare",
  "protests",
  "limitUse",
  "extensionRate",
  "bureauScore",
];
const debtorDrivers: QualityComponentId[] = [
  "onTimeRate",
  "averageDelay",
  "overdue30Rate",
  "protests",
  "extensionRate",
  "bureauScore",
];

function buildMonths(
  key: string,
  latest: Latest,
  trend: -1 | 0 | 1,
  drivers: QualityComponentId[],
  volume: number,
  openBalance: number,
  months: string[],
): QualityMonth[] {
  // componentes que explicam a tendência: só os que têm espaço para ter andado nessa direção
  const room = (id: QualityComponentId) => {
    const d = drift[id];
    const pastBetter = trend < 0; // piorando: no passado estava melhor
    const towardMax = d.higherIsBetter === pastBetter;
    return (towardMax ? d.max - latest[id] : latest[id] - d.min) / d.step;
  };
  const picked = new Set(
    drivers
      .filter(id => trend === 0 || room(id) >= 0.7)
      .sort((a, b) => hash(`${key}:${a}`) - hash(`${key}:${b}`))
      .slice(0, 2 + (hash(key) % 2)),
  );
  const value = (id: QualityComponentId, i: number) => {
    const d = drift[id];
    const back = (MONTHS - 1 - i) / (MONTHS - 1); // 1 no mês mais antigo, 0 no último
    const towardGood = d.higherIsBetter ? 1 : -1;
    // piorando: no passado estava melhor; melhorando: no passado estava pior
    const shift = picked.has(id) ? -trend * towardGood * d.step * back : 0;
    const jitter = d.step * 0.08 * noise(`${key}:${id}:${i}`);
    return Math.max(d.min, Math.min(d.max, latest[id] + shift + jitter));
  };
  return months.map((month, i) => {
    const onTime = value("onTimeRate", i);
    const overdue30Rate = value("overdue30Rate", i);
    const acquired = Math.max(0, volume * (1 + 0.15 * noise(`${key}:vol:${i}`)));
    const settled = acquired * 0.94;
    const balance = Math.max(0, openBalance * (1 + 0.1 * noise(`${key}:bal:${i}`)));
    const overdue30 = (balance * overdue30Rate) / 100;
    const lateShare = (balance * (100 - onTime)) / 100;
    const d1 = lateShare * 0.25,
      d31 = overdue30 * 0.45,
      d61 = overdue30 * 0.3,
      d90 = overdue30 * 0.25;
    return {
      month,
      acquired,
      settled,
      settledOnTime: (settled * onTime) / 100,
      averageDelay: value("averageDelay", i),
      repurchased: (acquired * value("repurchaseRate", i)) / 100,
      extended: (settled * value("extensionRate", i)) / 100,
      openBalance: balance,
      overdue30,
      buckets: [Math.max(0, balance - d1 - d31 - d61 - d90), d1, d31, d61, d90],
      topDebtorShare: value("topDebtorShare", i),
      protests: Math.round(value("protests", i) / 3),
      limitUse: value("limitUse", i),
      bureauScore: value("bureauScore", i),
    };
  });
}

/** Tendência de demonstração por posição: um terço piora, um terço melhora, o resto é estável. */
const trendAt = (i: number): -1 | 0 | 1 => (i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0);

export function demoCedentHistories(cedents: Cedent[], today: string): QualityHistory[] {
  const months = lastMonths(today);
  return [...cedents]
    .sort((a, b) => hash(a.document) - hash(b.document))
    .map((c, i) => {
      const pm = c.portfolioMetrics;
      const settledAmount = pm ? pm.settledOnTime.amount + pm.settledLate.amount : 0;
      const receivable = c.portfolioReceivable + c.portfolioOverdue;
      const latest: Latest = {
        onTimeRate: pm
          ? (pm.settledOnTime.amount / Math.max(1, settledAmount)) * 100
          : c.settlements
            ? ((c.settlements - c.lateSettlements) / c.settlements) * 100
            : 90,
        averageDelay: c.averageDelayDays,
        repurchaseRate: pm ? (pm.repurchased.amount / Math.max(1, settledAmount)) * 100 : c.repurchases * 0.8,
        extensionRate: pm ? (pm.extendedSettled.amount / Math.max(1, settledAmount)) * 100 : 3,
        overdue30Rate: receivable ? (c.portfolioOverdue / receivable) * 100 * 0.6 : 0,
        topDebtorShare: pm?.concentrationPercent ?? 20,
        protests: (pm?.protested.count ?? c.incidents) * 3,
        limitUse: c.creditLimit ? (c.usedLimit / c.creditLimit) * 100 : 0,
        bureauScore: c.score,
      };
      return {
        id: c.id,
        name: c.name,
        document: c.document,
        kind: "cedente" as const,
        exposure: c.portfolioReceivable + c.portfolioOverdue,
        months: buildMonths(
          c.document,
          latest,
          trendAt(i),
          cedentDrivers,
          Math.max(50_000, c.creditLimit * 0.3),
          Math.max(50_000, receivable),
          months,
        ),
      };
    });
}

export function demoDebtorHistories(
  debtors: { id: string; name: string; document: string; exposure: number; debtor?: Debtor }[],
  today: string,
): QualityHistory[] {
  const months = lastMonths(today);
  return [...debtors]
    .sort((a, b) => hash(a.document || a.name) - hash(b.document || b.name))
    .map((d, i) => {
      const key = d.document || d.name;
      const x = d.debtor;
      const latest: Latest = {
        onTimeRate: x?.settlements
          ? ((x.settlements - (x.lateSettlements ?? 0)) / x.settlements) * 100
          : 88 + 8 * noise(`${key}:ot`),
        averageDelay: x?.averageDelayDays ?? Math.max(0, 5 + 4 * noise(`${key}:ad`)),
        repurchaseRate: 0,
        extensionRate: 3 + 2 * noise(`${key}:ex`),
        overdue30Rate: x?.portfolioReceivable
          ? ((x.portfolioOverdue ?? 0) / x.portfolioReceivable) * 100
          : 2 + 2 * noise(`${key}:ov`),
        topDebtorShare: 0,
        protests: (x?.incidents ?? 0) * 3,
        limitUse: 0,
        bureauScore: x?.score ?? 700 + 60 * noise(`${key}:sc`),
      };
      return {
        id: d.id,
        name: d.name,
        document: d.document,
        kind: "sacado" as const,
        exposure: d.exposure,
        months: buildMonths(
          key,
          latest,
          trendAt(i + 1),
          debtorDrivers,
          Math.max(20_000, d.exposure * 0.5),
          d.exposure,
          months,
        ),
      };
    });
}
