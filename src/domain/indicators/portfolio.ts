/**
 * Indicadores de mercado da carteira de títulos: prazo médio, vencido por faixa, PDD pelas
 * faixas da política, liquidez no vencimento, recompras, prorrogações, cartório/protesto e
 * concentração nos 10 maiores sacados.
 */
import { type PortfolioTitleRecord, portfolioBalance } from "@/src/domain/portfolio/model";
import { type ProvisionBand, provisionRate } from "@/src/domain/risk/quality-policy";

const DAY = 86_400_000;
export const daysFrom = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / DAY);

export function portfolioIndicators(titles: PortfolioTitleRecord[], today: string, bands: ProvisionBand[]) {
  const open = titles
    .filter(t =>
      ["Em aberto", "Prorrogado", "Em cobrança", "Em cartório", "Protestado", "Liquidado parcial"].includes(t.status),
    )
    .map(t => ({ t, balance: portfolioBalance(t), late: daysFrom(t.dueDate, today) }))
    .filter(x => x.balance > 0);
  const total = open.reduce((s, x) => s + x.balance, 0);
  const sumWhere = (f: (x: (typeof open)[number]) => boolean) => open.filter(f).reduce((s, x) => s + x.balance, 0);
  const notDue = open.filter(x => x.late <= 0);
  const notDueTotal = notDue.reduce((s, x) => s + x.balance, 0);
  const remainingTerm = notDueTotal ? notDue.reduce((s, x) => s + -x.late * x.balance, 0) / notDueTotal : 0;
  const withIssue = titles.filter(t => t.issueDate);
  const faceWithIssue = withIssue.reduce((s, t) => s + t.originalAmount, 0);
  const originalTerm = faceWithIssue
    ? withIssue.reduce((s, t) => s + daysFrom(t.issueDate!, t.originalDueDate) * t.originalAmount, 0) / faceWithIssue
    : 0;
  const provision = open.reduce((s, x) => s + (x.balance * provisionRate(x.late, bands)) / 100, 0);
  // liquidez no vencimento: dos títulos pagos, quanto foi pago até o vencimento original
  const paid = titles.filter(t => t.payments.length);
  const paidTotal = paid.reduce((s, t) => s + t.paidAmount, 0);
  const paidOnTime = paid
    .filter(t => t.payments.every(p => p.date <= t.originalDueDate))
    .reduce((s, t) => s + t.paidAmount, 0);
  const byDebtor = new Map<string, number>();
  open.forEach(x => byDebtor.set(x.t.debtorName, (byDebtor.get(x.t.debtorName) ?? 0) + x.balance));
  const top10 = [...byDebtor.values()]
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((s, v) => s + v, 0);
  return {
    total,
    count: open.length,
    remainingTerm,
    originalTerm,
    overdue: sumWhere(x => x.late > 0),
    overdue30: sumWhere(x => x.late > 30),
    overdue60: sumWhere(x => x.late > 60),
    overdue90: sumWhere(x => x.late > 90),
    provision,
    onTimeRate: paidTotal ? (paidOnTime / paidTotal) * 100 : 0,
    repurchased: titles.reduce((s, t) => s + (t.repurchasedAmount ?? 0), 0),
    extended: titles.filter(t => t.status === "Prorrogado" || t.dueDate !== t.originalDueDate),
    inNotary: titles.filter(t => t.status === "Em cartório" || t.status === "Protestado"),
    top10DebtorShare: total ? (top10 / total) * 100 : 0,
  };
}
