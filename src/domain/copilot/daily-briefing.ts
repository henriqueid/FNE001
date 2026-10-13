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
  /** Áreas em que a pessoa atua. O departamento permanece como área principal. */
  functionalAreas?: UserDepartment[];
  access: "admin" | "manager" | "operator";
  responsibilities: string[];
  operationOwner?: string;
  commercialRepId?: string;
  /** Vínculo do gerente responsável pela operação recorrente e pelo pós-venda. */
  accountManagerId?: string;
  /** Cedentes atribuídos diretamente ao usuário, quando houver uma carteira nominal. */
  cedentDocuments?: string[];
  /** Empresas e veículos liberados para este usuário. Vazio significa nenhum escopo. */
  companyScopes?: string[];
  revenueGoalShare?: number;
};

export type UserScopeContext = {
  referenceDate: string;
  repOfCedent?: (document: string, date: string) => string | undefined;
  managerOfCedent?: (document: string) => string | undefined;
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

const digits = (value: string) => value.replace(/\D/g, "");

export function userFunctionalAreas(user: AppUserProfile): UserDepartment[] {
  return [...new Set([user.department, ...(user.functionalAreas ?? [])])];
}

export function userHasFunctionalArea(user: AppUserProfile, area: UserDepartment) {
  return userFunctionalAreas(user).includes(area);
}

export function functionalAreasMatchQueue(functionalAreas: UserDepartment[], department: string) {
  if (department === "Carteira e cobrança")
    return functionalAreas.some(area => area === "Operações" || area === "Comercial" || area === "Financeiro");
  return functionalAreas.includes(department as UserDepartment);
}

function operationMatchesArea(
  operation: Operation,
  user: AppUserProfile,
  area: UserDepartment,
  scope?: UserScopeContext,
) {
  const repId = operation.commercialRepId ?? scope?.repOfCedent?.(operation.document, scope.referenceDate);
  const managerId = operation.accountManagerId ?? scope?.managerOfCedent?.(operation.document);
  if (area === "Comercial")
    return (
      (!!user.commercialRepId && repId === user.commercialRepId) ||
      (!!user.accountManagerId && managerId === user.accountManagerId)
    );
  if (area === "Operações") return user.access === "manager" || operation.owner === (user.operationOwner ?? user.name);
  if (area === "Risco e crédito") return operation.blockers > 0 || operation.alerts > 0 || operation.stage === 2;
  if (area === "Controladoria") return operation.stage >= 3 && operation.stage <= 5;
  if (area === "Financeiro")
    return operation.status === "Pronta para liberar" || operation.status === "Liberada ao financeiro";
  if (area === "Cadastro") return operation.stage === 1;
  return area === "Diretoria";
}

export function operationBelongsToUser(operation: Operation, user: AppUserProfile, scope?: UserScopeContext) {
  if (user.access === "admin" || userHasFunctionalArea(user, "Diretoria")) return true;
  if (user.companyScopes && !user.companyScopes.includes(operation.vehicle)) return false;
  const directDocuments = new Set((user.cedentDocuments ?? []).map(digits));
  if (directDocuments.has(digits(operation.document))) return true;
  return userFunctionalAreas(user).some(area => operationMatchesArea(operation, user, area, scope));
}

export function operationsForUser(operations: Operation[], user: AppUserProfile, scope?: UserScopeContext) {
  if (user.access === "admin" || userHasFunctionalArea(user, "Diretoria")) return operations;
  return operations.filter(operation => operationBelongsToUser(operation, user, scope));
}

export function buildDailyBriefing({
  user,
  operations,
  financials,
  titles,
  referenceDate,
  revenueTarget,
  scope,
}: {
  user: AppUserProfile;
  operations: Operation[];
  financials: Record<string, OpFinancial>;
  titles: PortfolioTitle[];
  referenceDate: string;
  revenueTarget: number;
  scope?: UserScopeContext;
}) {
  const scopedOperations = operationsForUser(operations, user, scope).filter(
    operation => operation.status !== "Cancelada",
  );
  const documents = new Set([
    ...scopedOperations.map(operation => digits(operation.document)),
    ...(user.cedentDocuments ?? []).map(digits),
  ]);
  const scopedTitles =
    user.access === "admin" || userHasFunctionalArea(user, "Diretoria")
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
      user.access === "admin"
        ? "Visão consolidada"
        : `${userFunctionalAreas(user).join(" + ")} · ${user.responsibilities.join(" · ")}`,
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
