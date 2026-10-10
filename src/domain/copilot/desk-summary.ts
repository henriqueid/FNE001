/**
 * Resumo da operação para a análise completa do Copiloto: composição financeira, sacados (participação na
 * operação e posição na carteira), prazos, posição do cedente (limite antes e depois) e checagem da política.
 * Funções puras sobre o cenário calculado pelo motor e a base do sistema; a tela só desenha.
 */
import { type Cedent } from "@/src/domain/core/types";
import { type PortfolioTitle } from "@/src/domain/home/metrics";
import { type DeskContext, type DeskScenario } from "./desk-engine";

const cents = (reais: number) => Math.round(reais * 100);

export type DeskDebtorPosition = {
  name: string;
  operationCents: number;
  operationShare: number;
  titles: number;
  flags: string[];
  /** Exposição que o sacado já tem na carteira (todos os cedentes). */
  portfolioCents: number;
  portfolioOverdueCents: number;
  portfolioTitles: number;
  /** Participação do sacado na carteira depois desta operação. */
  portfolioShareAfter: number;
};

export type DeskCheck = { label: string; observed: string; rule: string; ok: boolean };

export type DeskSummary = {
  waterfall: { label: string; cents: number; kind: "base" | "minus" | "result" }[];
  debtors: DeskDebtorPosition[];
  terms: { label: string; cents: number; titles: number }[];
  limit?: {
    limitCents: number;
    usedCents: number;
    operationCents: number;
    availableAfterCents: number;
    useAfter: number;
  };
  cedentPortfolio?: { openCents: number; overdueCents: number; titles: number; overdueTitles: number };
  quality?: { onTime: number; settlements: number; averageDelayDays: number; repurchases: number; incidents: number };
  checks: DeskCheck[];
};

export function buildDeskSummary(
  scenario: DeskScenario,
  context: DeskContext,
  cedent: Cedent | undefined,
  portfolio: PortfolioTitle[],
  today: string,
): DeskSummary {
  const { result } = scenario;
  const rows = context.titles.filter(title => scenario.included.includes(title.id));
  const portfolioTotal = portfolio.reduce((sum, title) => sum + cents(title.amount), 0);

  const byDebtor = new Map<string, typeof rows>();
  rows.forEach(title => byDebtor.set(title.debtor, [...(byDebtor.get(title.debtor) ?? []), title]));
  const debtors: DeskDebtorPosition[] = Array.from(byDebtor.entries())
    .map(([name, list]) => {
      const operationCents = list.reduce((sum, title) => sum + title.amountCents, 0);
      const inPortfolio = portfolio.filter(title => title.debtorName === name);
      const portfolioCents = inPortfolio.reduce((sum, title) => sum + cents(title.amount), 0);
      const flags: string[] = [];
      if (list.some(title => title.newDebtor)) flags.push("Sacado novo");
      if (list.some(title => title.duplicate)) flags.push("Título duplicado");
      if (!inPortfolio.length && !list.some(title => title.newDebtor)) flags.push("Sem histórico na carteira");
      return {
        name,
        operationCents,
        operationShare: result.faceCents ? (operationCents / result.faceCents) * 100 : 0,
        titles: list.length,
        flags,
        portfolioCents,
        portfolioOverdueCents: inPortfolio
          .filter(title => title.dueDate < today)
          .reduce((sum, title) => sum + cents(title.amount), 0),
        portfolioTitles: inPortfolio.length,
        portfolioShareAfter:
          portfolioTotal + result.faceCents
            ? ((portfolioCents + operationCents) / (portfolioTotal + result.faceCents)) * 100
            : 0,
      };
    })
    .sort((a, b) => b.operationCents - a.operationCents);

  const buckets = [
    { label: "Até 15 dias", max: 15 },
    { label: "16 a 30 dias", max: 30 },
    { label: "31 a 60 dias", max: 60 },
    { label: "Mais de 60 dias", max: Infinity },
  ];
  const terms = buckets.map((bucket, index) => {
    const min = index ? buckets[index - 1].max : -Infinity;
    const list = rows.filter(title => title.days > min && title.days <= bucket.max);
    return { label: bucket.label, cents: list.reduce((sum, title) => sum + title.amountCents, 0), titles: list.length };
  });

  const ownPortfolio = cedent
    ? portfolio.filter(title => title.ownerDocument.replace(/\D/g, "") === cedent.document.replace(/\D/g, ""))
    : [];
  const checks: DeskCheck[] = [
    {
      label: "Concentração por sacado",
      observed: `${result.top.share.toFixed(1).replace(".", ",")}% (${result.top.debtor})`,
      rule: `até ${context.policy.concentrationLimit}%`,
      ok: result.top.share <= context.policy.concentrationLimit,
    },
    {
      label: "Piso de taxa",
      observed: `${scenario.ratePercent.toFixed(2).replace(".", ",")}% a.m.`,
      rule: `mínimo ${context.policy.rateFloor.toFixed(2).replace(".", ",")}% a.m.`,
      ok: scenario.ratePercent >= context.policy.rateFloor,
    },
    {
      label: "Prazo mínimo",
      observed: `${Math.min(...rows.map(title => title.days))} dias no título mais curto`,
      rule: `${context.policy.minDays} dias (alerta)`,
      ok: rows.every(title => title.days >= context.policy.minDays),
    },
    {
      label: "Duplicidade na carteira",
      observed: rows.some(title => title.duplicate) ? "título já adquirido" : "nenhuma",
      rule: "bloqueia",
      ok: !rows.some(title => title.duplicate),
    },
    {
      label: "Consulta de sacado novo",
      observed: !rows.some(title => title.newDebtor)
        ? "não se aplica"
        : context.bureauChecked
          ? "consultado"
          : "pendente",
      rule: "obrigatória",
      ok: !rows.some(title => title.newDebtor) || context.bureauChecked,
    },
  ];

  return {
    waterfall: [
      { label: "Valor de face", cents: result.faceCents, kind: "base" },
      { label: "Deságio", cents: result.discountCents, kind: "minus" },
      { label: "Tarifas", cents: result.feesCents, kind: "minus" },
      { label: "IOF", cents: result.iofCents, kind: "minus" },
      { label: "Líquido ao cedente", cents: result.netCents, kind: "result" },
    ],
    debtors,
    terms,
    limit: cedent
      ? {
          limitCents: cents(cedent.creditLimit),
          usedCents: cents(cedent.usedLimit),
          operationCents: result.faceCents,
          availableAfterCents: cents(cedent.creditLimit) - cents(cedent.usedLimit) - result.faceCents,
          useAfter: cedent.creditLimit
            ? ((cents(cedent.usedLimit) + result.faceCents) / cents(cedent.creditLimit)) * 100
            : 0,
        }
      : undefined,
    cedentPortfolio: cedent
      ? {
          openCents: ownPortfolio.reduce((sum, title) => sum + cents(title.amount), 0),
          overdueCents: ownPortfolio
            .filter(title => title.dueDate < today)
            .reduce((sum, title) => sum + cents(title.amount), 0),
          titles: ownPortfolio.length,
          overdueTitles: ownPortfolio.filter(title => title.dueDate < today).length,
        }
      : undefined,
    quality: cedent
      ? {
          onTime: cedent.settlements ? ((cedent.settlements - cedent.lateSettlements) / cedent.settlements) * 100 : 0,
          settlements: cedent.settlements,
          averageDelayDays: cedent.averageDelayDays,
          repurchases: cedent.repurchases,
          incidents: cedent.incidents,
        }
      : undefined,
    checks,
  };
}
