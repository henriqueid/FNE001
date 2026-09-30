/**
 * Funções puras da visão de carteira do cedente (ranking de sacados, histórico e posição).
 */
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Cedent, type PortfolioPosition } from "@/src/domain/core/types";

export type CedentDebtorRanking = {
  name: string;
  document: string;
  exposure: number;
  share: number;
  score: number;
  confirmation: number;
};

export type CedentRecentOperation = {
  aditivo: string;
  date: string;
  amount: number;
  titles: number;
  confirmation: number;
  status: string;
};

export type CedentLedgerRow = { label: string; value: PortfolioPosition; tone: string };

/** Formata percentual com uma casa decimal e vírgula (ex.: 12,3). */
export const percent = (value: number) => value.toFixed(1).replace(".", ",");

/** Classe de cor para índices de confirmação. */
export const confirmationTone = (value: number) =>
  value >= 90 ? "positive" : value >= 80 ? "warning-text" : "negative";

export function buildCedentPortfolio(cedent: Cedent) {
  const utilization = cedent.creditLimit > 0 ? (cedent.usedLimit / cedent.creditLimit) * 100 : 0;
  const available = Math.max(0, cedent.creditLimit - cedent.usedLimit);
  const metrics = cedent.portfolioMetrics;
  const onTime = metrics?.settledOnTime ?? {
    count: Math.max(0, cedent.settlements - cedent.lateSettlements),
    amount: 0,
  };
  const late = metrics?.settledLate ?? { count: cedent.lateSettlements, amount: 0 };
  const repurchased = metrics?.repurchased ?? { count: cedent.repurchases, amount: 0 };
  const protested = metrics?.protested ?? { count: 0, amount: 0 };
  const openDue = metrics?.openDue ?? {
    count: cedent.portfolioReceivable > 0 ? 1 : 0,
    amount: Math.max(0, cedent.portfolioReceivable - cedent.portfolioOverdue),
  };
  const openOverdue = metrics?.openOverdue ?? {
    count: cedent.portfolioOverdue > 0 ? 1 : 0,
    amount: cedent.portfolioOverdue,
  };
  const openExtended = metrics?.openExtended ?? { count: 0, amount: 0 };
  const openNegotiation = metrics?.openNegotiation ?? { count: 0, amount: 0 };
  const portfolioRows: CedentLedgerRow[] = [
    { label: "A vencer", value: openDue, tone: "neutral" },
    { label: "Vencidos", value: openOverdue, tone: openOverdue.count ? "negative" : "positive" },
    { label: "Prorrogados", value: openExtended, tone: openExtended.count ? "attention" : "neutral" },
    { label: "Em negociação", value: openNegotiation, tone: openNegotiation.count ? "attention" : "neutral" },
  ];
  const behaviorRows: CedentLedgerRow[] = [
    { label: "Liquidados no prazo", value: onTime, tone: "positive" },
    { label: "Liquidados com atraso", value: late, tone: late.count ? "attention" : "neutral" },
    { label: "Recomprados", value: repurchased, tone: repurchased.count ? "negative" : "neutral" },
    { label: "Protestados", value: protested, tone: protested.count ? "negative" : "neutral" },
  ];
  const healthyProfile = cedent.score >= 700;
  const criticalProfile = cedent.score < 600;
  const confirmationRate = criticalProfile ? 78.4 : healthyProfile ? 96.8 : 89.6;
  const repurchaseRate = cedent.settlements ? (cedent.repurchases / cedent.settlements) * 100 : 0;
  const frequencyDays = criticalProfile ? 14 : healthyProfile ? 7 : 11;
  const frequencyLabel = frequencyDays <= 8 ? "Semanal" : frequencyDays <= 16 ? "Quinzenal" : "Mensal";
  const names =
    cedent.id === "ced-1"
      ? [
          "L.V. Carvalho Gutierrez Ltda",
          "Carlos Marco Distribuidora Ltda",
          "Supermercado Haag Ltda",
          "Rede Sul Atacadista S.A.",
          "Comercial Oeste Paraná",
          "Mercado Boa Compra Ltda",
          "Distribuidora São Lucas",
          "Supermercado Village Paulista",
          "Alimentos Rota Norte",
          "Comercial Nova Safra",
        ]
      : cedent.id === "ced-6"
        ? [
            "Hospital Vida Plena S.A.",
            "Clínica Santa Aurora Ltda",
            "Laboratório Diagnosul",
            "Instituto Médico Central",
            "Hospital São Rafael",
            "Clínica Bem Estar",
            "Centro Diagnóstico Paraná",
            "Hospital Nossa Senhora",
            "Medservice Assistência",
            "Clínica Integrada Oeste",
          ]
        : [
            "Rede Alfa Comercial",
            "Distribuidora Horizonte",
            "Grupo Mercantil Sul",
            "Comercial Primavera",
            "Atacado Nova Era",
            "Rede Central de Compras",
            "Mercantil União",
            "Distribuidora Nacional",
            "Comercial Santa Fé",
            "Rede Bom Negócio",
          ];
  const shares = [18.4, 14.8, 12.2, 10.6, 9.1, 8.2, 7.4, 6.8, 5.7, 4.3];
  const topDebtors: CedentDebtorRanking[] = names.map((name, index) => {
    const score = Math.max(420, Math.min(880, cedent.score + 70 - index * 23 + (index % 2 ? -14 : 18)));
    return {
      name,
      document: `${String(11 + index).padStart(2, "0")}.***.***/0001-${String(18 + index).padStart(2, "0")}`,
      exposure: (cedent.portfolioReceivable * shares[index]) / 100,
      share: shares[index],
      score,
      confirmation: Math.max(61, Math.min(99.5, confirmationRate + 2.4 - index * 1.35)),
    };
  });
  const currentOperation = initialOperations.find(
    item => item.document.replace(/\D/g, "") === cedent.document.replace(/\D/g, ""),
  );
  const dates = criticalProfile
    ? ["25/09/2026", "10/09/2026", "27/08/2026", "12/08/2026", "30/07/2026"]
    : healthyProfile
      ? ["25/09/2026", "18/09/2026", "11/09/2026", "04/09/2026", "28/08/2026"]
      : ["25/09/2026", "15/09/2026", "03/09/2026", "22/08/2026", "09/08/2026"];
  const recentOperations: CedentRecentOperation[] = dates.map((date, index) => ({
    aditivo:
      index === 0 && currentOperation
        ? currentOperation.aditivoNumber
        : `2026${String(9 - Math.floor(index / 3)).padStart(2, "0")}${String(24 - index * 3).padStart(2, "0")}${String(index + 1).padStart(3, "0")}`,
    date,
    amount:
      index === 0 && currentOperation ? currentOperation.amount : cedent.portfolioReceivable * (0.19 - index * 0.018),
    titles:
      index === 0 && currentOperation
        ? currentOperation.titleCount
        : Math.max(4, Math.round(openDue.count * (0.24 - index * 0.025))),
    confirmation: Math.max(60, confirmationRate + (index === 0 ? -1.2 : 2.6 - index * 0.7)),
    status:
      index === 0 && currentOperation
        ? currentOperation.status
        : index === 1
          ? "Liquidada"
          : index === 2 && criticalProfile
            ? "Liquidada com ressalva"
            : "Liquidada",
  }));
  const positiveDebtors = topDebtors.filter(item => item.score >= 700).length;
  const attentionDebtors = topDebtors.filter(item => item.score >= 600 && item.score < 700).length;
  const criticalDebtors = topDebtors.length - positiveDebtors - attentionDebtors;

  return {
    utilization,
    available,
    metrics,
    onTime,
    late,
    repurchased,
    openDue,
    openOverdue,
    portfolioRows,
    behaviorRows,
    healthyProfile,
    criticalProfile,
    confirmationRate,
    repurchaseRate,
    frequencyDays,
    frequencyLabel,
    topDebtors,
    recentOperations,
    positiveDebtors,
    attentionDebtors,
    criticalDebtors,
  };
}
