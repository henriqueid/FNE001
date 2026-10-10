import { type Operation } from "@/src/domain/core/types";
import { isSlower, type OpFinancial, type PortfolioTitle } from "@/src/domain/home/metrics";
import { buildRevenuePace } from "@/src/domain/home/revenue-pace";

export type UserDepartment =
  "Diretoria" | "Operações" | "Risco e crédito" | "Controladoria" | "Financeiro" | "Comercial" | "Cadastro";

export type AppUserProfile = {
  id: string;
  name: string;
  role: string;
  department: UserDepartment;
  access: "admin" | "manager" | "operator";
  responsibilities: string[];
  operationOwner?: string;
  commercialRepId?: string;
  revenueGoalShare?: number;
};

export const demoAdminUser: AppUserProfile = {
  id: "user-henrique-admin",
  name: "Henrique",
  role: "Administrador",
  department: "Diretoria",
  access: "admin",
  responsibilities: ["Visão consolidada", "Alçadas", "Metas", "Risco", "Liquidez"],
};

export type DailyBriefingPriority = {
  id: string;
  title: string;
  detail: string;
  count: number;
  tone: "critical" | "warning" | "info" | "good";
  view: "operations" | "portfolio" | "finance";
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 2,
  });

export function operationsForUser(operations: Operation[], user: AppUserProfile) {
  if (user.access === "admin" || user.department === "Diretoria") return operations;
  switch (user.department) {
    case "Risco e crédito":
      return operations.filter(operation => operation.blockers > 0 || operation.alerts > 0 || operation.stage === 2);
    case "Controladoria":
      return operations.filter(operation => operation.stage >= 3 && operation.stage <= 5);
    case "Financeiro":
      return operations.filter(
        operation => operation.status === "Pronta para liberar" || operation.status === "Liberada ao financeiro",
      );
    case "Comercial":
      return operations.filter(operation => operation.commercialRepId === user.commercialRepId);
    case "Cadastro":
      return operations.filter(operation => operation.stage === 1);
    case "Operações":
    default:
      return operations.filter(operation => operation.owner === (user.operationOwner ?? user.name));
  }
}

export function buildDailyBriefing({
  user,
  operations,
  financials,
  titles,
  referenceDate,
  revenueTarget,
}: {
  user: AppUserProfile;
  operations: Operation[];
  financials: Record<string, OpFinancial>;
  titles: PortfolioTitle[];
  referenceDate: string;
  revenueTarget: number;
}) {
  const scopedOperations = operationsForUser(operations, user).filter(operation => operation.status !== "Cancelada");
  const documents = new Set(scopedOperations.map(operation => operation.document.replace(/\D/g, "")));
  const scopedTitles =
    user.access === "admin" || user.department === "Diretoria"
      ? titles
      : titles.filter(title => documents.has(title.ownerDocument.replace(/\D/g, "")));
  const blocked = scopedOperations.filter(operation => operation.blockers > 0);
  const ready = scopedOperations.filter(
    operation => operation.status === "Pronta para formalizar" || operation.status === "Pronta para liberar",
  );
  const delayed = scopedOperations.filter(isSlower);
  const overdue = scopedTitles.filter(title => title.dueDate < referenceDate);
  const portfolioTotal = scopedTitles.reduce((sum, title) => sum + title.amount, 0);
  const overdueTotal = overdue.reduce((sum, title) => sum + title.amount, 0);
  const target = revenueTarget * (user.access === "admin" ? 1 : (user.revenueGoalShare ?? 1));
  const pace = buildRevenuePace({
    operations: scopedOperations,
    financials,
    period: "mes",
    referenceDate,
    target,
  });
  const priorities: DailyBriefingPriority[] = [
    ...(blocked.length
      ? [
          {
            id: "decisions",
            title: blocked.length === 1 ? "1 operação aguarda decisão" : `${blocked.length} operações aguardam decisão`,
            detail: `${money(blocked.reduce((sum, operation) => sum + operation.amount, 0))} dependem de análise ou alçada.`,
            count: blocked.length,
            tone: "critical" as const,
            view: "operations" as const,
          },
        ]
      : []),
    ...(ready.length
      ? [
          {
            id: "ready",
            title:
              ready.length === 1 ? "1 operação pronta para avançar" : `${ready.length} operações prontas para avançar`,
            detail: "Formalização ou liberação podem ser concluídas agora.",
            count: ready.length,
            tone: "good" as const,
            view: "operations" as const,
          },
        ]
      : []),
    ...(overdue.length
      ? [
          {
            id: "overdue",
            title: overdue.length === 1 ? "1 título vencido" : `${overdue.length} títulos vencidos`,
            detail: `${money(overdueTotal)} pedem cobrança, negociação ou recompra.`,
            count: overdue.length,
            tone: "warning" as const,
            view: "portfolio" as const,
          },
        ]
      : []),
    ...(delayed.length
      ? [
          {
            id: "pace",
            title: delayed.length === 1 ? "1 operação fora do ritmo" : `${delayed.length} operações fora do ritmo`,
            detail: "O tempo atual ultrapassou o padrão histórico do cliente.",
            count: delayed.length,
            tone: "info" as const,
            view: "operations" as const,
          },
        ]
      : []),
  ];

  return {
    user,
    referenceDate,
    scopeLabel:
      user.access === "admin" ? "Visão consolidada" : `${user.department} · ${user.responsibilities.join(" · ")}`,
    taskCount: priorities.reduce((sum, priority) => sum + priority.count, 0),
    activeOperations: scopedOperations.filter(
      operation => operation.status !== "Liberada ao financeiro" && operation.status !== "Cancelada",
    ).length,
    portfolioTotal,
    overdueTotal,
    overdueCount: overdue.length,
    revenue: pace.revenue,
    revenueTarget: pace.target,
    revenueRemaining: pace.remaining,
    revenueAttainment: pace.attainment,
    revenueTrend: pace.trend,
    requiredDailyPace: pace.requiredDailyPace,
    priorities,
  };
}

export type DailyBriefingData = ReturnType<typeof buildDailyBriefing>;
