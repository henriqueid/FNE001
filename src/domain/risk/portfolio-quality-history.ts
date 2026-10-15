/**
 * Converte a posição persistida da carteira em histórico consumível pelo motor de score.
 *
 * A carteira produtiva pode chegar como uma fotografia (sem fechamentos mensais anteriores).
 * Nesse caso ainda existe evidência comportamental suficiente para calcular a nota atual:
 * exposição, atraso, concentração, recompras, prorrogações e protestos. O motor trata a
 * fotografia como um único mês e passa a formar a série histórica conforme novas posições forem
 * persistidas.
 */
import type { Cedent, Debtor } from "@/src/domain/core/types";
import { portfolioBalance, type PortfolioState, type PortfolioTitleRecord } from "@/src/domain/portfolio/model";
import type { QualityHistory, QualityMonth } from "./quality";

const digits = (value: string) => value.replace(/\D/g, "");
const day = 86_400_000;
const neutralBureauScore = 650;

function daysLate(dueDate: string, asOfDate: string) {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const asOf = Date.parse(`${asOfDate}T00:00:00Z`);
  return Number.isFinite(due) && Number.isFinite(asOf) ? Math.max(0, Math.floor((asOf - due) / day)) : 0;
}

function bureauScore(profile?: Pick<Cedent | Debtor, "score" | "bureauScore">) {
  return profile?.bureauScore ?? (profile?.score != null && profile.score > 0 ? profile.score : neutralBureauScore);
}

function titleBuckets(titles: PortfolioTitleRecord[], asOfDate: string): QualityMonth["buckets"] {
  return titles.reduce<QualityMonth["buckets"]>(
    (buckets, title) => {
      const balance = portfolioBalance(title);
      const late = daysLate(title.dueDate, asOfDate);
      const index = late === 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
      buckets[index] += balance;
      return buckets;
    },
    [0, 0, 0, 0, 0],
  );
}

function paymentMetrics(titles: PortfolioTitleRecord[], asOfDate: string) {
  const payments = titles.flatMap(title =>
    title.payments.map(payment => ({ amount: payment.amount, date: payment.date, dueDate: title.dueDate })),
  );
  if (payments.length) {
    const settled = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const settledOnTime = payments
      .filter(payment => payment.date <= payment.dueDate)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const weightedDelay = payments.reduce(
      (sum, payment) => sum + payment.amount * daysLate(payment.dueDate, payment.date),
      0,
    );
    return { settled, settledOnTime, averageDelay: settled ? weightedDelay / settled : 0 };
  }

  // Posições importadas podem trazer o acumulado pago sem o detalhamento das baixas.
  const settled = titles.reduce((sum, title) => sum + title.paidAmount, 0);
  const settledOnTime = titles.reduce(
    (sum, title) => sum + (daysLate(title.dueDate, asOfDate) === 0 ? title.paidAmount : 0),
    0,
  );
  const weightedDelay = titles.reduce((sum, title) => sum + title.paidAmount * daysLate(title.dueDate, asOfDate), 0);
  return { settled, settledOnTime, averageDelay: settled ? weightedDelay / settled : 0 };
}

function qualityMonth(
  titles: PortfolioTitleRecord[],
  asOfDate: string,
  profile?: Cedent | Debtor,
  topDebtorShare = 0,
): QualityMonth {
  const buckets = titleBuckets(titles, asOfDate);
  const payments = paymentMetrics(titles, asOfDate);
  const openBalance = buckets.reduce((sum, amount) => sum + amount, 0);
  return {
    month: asOfDate.slice(0, 7),
    acquired: titles.reduce((sum, title) => sum + title.originalAmount, 0),
    ...payments,
    repurchased: titles.reduce((sum, title) => sum + title.repurchasedAmount, 0),
    extended: titles
      .filter(title => title.dueDate > title.originalDueDate)
      .reduce((sum, title) => sum + portfolioBalance(title), 0),
    openBalance,
    overdue30: buckets[2] + buckets[3] + buckets[4],
    buckets,
    topDebtorShare,
    protests: titles.filter(title => title.status === "Protestado" || title.status === "Em cartório").length,
    limitUse:
      profile && "creditLimit" in profile && profile.creditLimit > 0
        ? (Math.max(profile.usedLimit, openBalance) / profile.creditLimit) * 100
        : 0,
    bureauScore: bureauScore(profile),
  };
}

function groupedTitles(titles: PortfolioTitleRecord[], documentOf: (title: PortfolioTitleRecord) => string) {
  const groups = new Map<string, PortfolioTitleRecord[]>();
  for (const title of titles) {
    const document = digits(documentOf(title));
    if (!document) continue;
    groups.set(document, [...(groups.get(document) ?? []), title]);
  }
  return groups;
}

/** Gera as notas de cedentes e sacados que realmente possuem títulos na carteira. */
export function portfolioQualityHistories(
  portfolio: PortfolioState,
  cedents: Cedent[],
  debtors: Debtor[],
  today: string,
): { cedentHistories: QualityHistory[]; debtorHistories: QualityHistory[] } {
  const asOfDate = portfolio.positionDate ?? today;
  const cedentByDocument = new Map(cedents.map(profile => [digits(profile.document), profile]));
  const debtorByDocument = new Map(debtors.map(profile => [digits(profile.document), profile]));
  const byCedent = groupedTitles(portfolio.titles, title => title.ownerDocument);
  const byDebtor = groupedTitles(portfolio.titles, title => title.debtorDocument);

  const cedentHistories = [...byCedent].map(([document, titles]) => {
    const profile = cedentByDocument.get(document);
    const exposure = titles.reduce((sum, title) => sum + portfolioBalance(title), 0);
    const debtorExposure = new Map<string, number>();
    for (const title of titles) {
      const debtor = digits(title.debtorDocument) || title.debtorName;
      debtorExposure.set(debtor, (debtorExposure.get(debtor) ?? 0) + portfolioBalance(title));
    }
    const largest = Math.max(0, ...debtorExposure.values());
    return {
      id: profile?.id ?? `ced-${document}`,
      name: profile?.name ?? titles[0].ownerName,
      document,
      kind: "cedente" as const,
      exposure,
      months: [qualityMonth(titles, asOfDate, profile, exposure ? (largest / exposure) * 100 : 0)],
    };
  });

  const debtorHistories = [...byDebtor].map(([document, titles]) => {
    const profile = debtorByDocument.get(document);
    const exposure = titles.reduce((sum, title) => sum + portfolioBalance(title), 0);
    return {
      id: profile?.id ?? `sac-${document}`,
      name: profile?.name ?? titles[0].debtorName,
      document,
      kind: "sacado" as const,
      exposure,
      months: [qualityMonth(titles, asOfDate, profile)],
    };
  });

  return { cedentHistories, debtorHistories };
}
