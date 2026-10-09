/**
 * Dinâmica da carteira a partir do histórico mensal dos clientes:
 * - rolagem (roll rate): quanto de cada faixa de atraso passou para a faixa seguinte no mês;
 * - safra (vintage): % do valor adquirido em cada mês que está vencido há mais de 30 dias,
 *   por meses desde a aquisição;
 * - concentração (participação dos maiores e índice HHI);
 * - cobrança do mês (liquidez no prazo, prorrogações, protestos).
 */
import { type QualityHistory, type QualityMonth } from "./quality";

export const bucketLabels = ["A vencer", "1–30 dias", "31–60 dias", "61–90 dias", "> 90 dias"] as const;

/** Soma as faixas de atraso de todos os clientes, mês a mês. */
export function portfolioBuckets(histories: QualityHistory[]) {
  const months = histories[0]?.months.map(m => m.month) ?? [];
  return months.map((month, i) => {
    const b: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    histories.forEach(h => h.months[i]?.buckets.forEach((v, k) => (b[k] += v)));
    return { month, buckets: b };
  });
}

/**
 * Rolagem: para cada mês, % do saldo de uma faixa no mês anterior que aparece na faixa
 * seguinte neste mês (a vencer → 1–30, 1–30 → 31–60, 31–60 → 61–90, 61–90 → > 90).
 */
export function rollRates(histories: QualityHistory[]) {
  const rows = portfolioBuckets(histories);
  return rows.slice(1).map((row, i) => {
    const prev = rows[i].buckets;
    return {
      month: row.month,
      rates: [0, 1, 2, 3].map(k => (prev[k] > 0 ? Math.min(100, (row.buckets[k + 1] / prev[k]) * 100) : 0)),
    };
  });
}

/**
 * Safras: para cada mês de aquisição, % do valor adquirido vencido há mais de 30 dias
 * em cada mês desde a aquisição. Cada cliente contribui com sua taxa de vencido > 30
 * no mês de referência, aplicada ao que adquiriu na safra (curva de maturação).
 */
export function vintages(histories: QualityHistory[]) {
  const months = histories[0]?.months.map(m => m.month) ?? [];
  return months.map((month, c) => {
    const face = histories.reduce((s, h) => s + (h.months[c]?.acquired ?? 0), 0);
    const curve = months.slice(c + 1).map((_, k) => {
      const ref = c + 1 + k;
      const overdue = histories.reduce((s, h) => {
        const m: QualityMonth | undefined = h.months[ref];
        if (!m || !m.openBalance) return s;
        const rate = m.overdue30 / m.openBalance;
        const maturity = 1 - Math.exp(-(k + 1) / 1.6);
        return s + (h.months[c]?.acquired ?? 0) * rate * maturity;
      }, 0);
      return face ? (overdue / face) * 100 : 0;
    });
    return { month, face, curve };
  });
}

/** Participação dos maiores e índice Herfindahl-Hirschman (0 a 10.000). */
export function concentration(exposures: { name: string; amount: number }[], top = 10) {
  const total = exposures.reduce((s, e) => s + e.amount, 0);
  const shares = exposures
    .map(e => ({ ...e, share: total ? (e.amount / total) * 100 : 0 }))
    .sort((a, b) => b.share - a.share);
  const hhi = shares.reduce((s, e) => s + e.share * e.share, 0);
  return {
    total,
    hhi,
    topShare: shares.slice(0, top).reduce((s, e) => s + e.share, 0),
    largest: shares[0],
    shares,
  };
}

/** Cobrança no último mês e no anterior, somando todos os clientes. */
export function collectionMonth(histories: QualityHistory[], offset = 0) {
  const pick = (h: QualityHistory) => h.months[h.months.length - 1 - offset];
  const rows = histories.map(pick).filter((m): m is QualityMonth => !!m);
  const settled = rows.reduce((s, m) => s + m.settled, 0);
  const onTime = rows.reduce((s, m) => s + m.settledOnTime, 0);
  // liquidado em até 5 dias: no prazo + a parte do atraso com atraso médio ≤ 5 dias
  const upTo5 = rows.reduce((s, m) => s + m.settledOnTime + (m.averageDelay <= 5 ? m.settled - m.settledOnTime : 0), 0);
  return {
    month: rows[0]?.month ?? "",
    settled,
    onTimeRate: settled ? (onTime / settled) * 100 : 0,
    upTo5Rate: settled ? (upTo5 / settled) * 100 : 0,
    extended: rows.reduce((s, m) => s + m.extended, 0),
    repurchased: rows.reduce((s, m) => s + m.repurchased, 0),
    protests: rows.reduce((s, m) => s + m.protests, 0),
    overdue30: rows.reduce((s, m) => s + m.overdue30, 0),
    openBalance: rows.reduce((s, m) => s + m.openBalance, 0),
  };
}
