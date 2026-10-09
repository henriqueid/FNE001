/**
 * Regras puras da etapa de Risco e elegibilidade: agrupamento de títulos por sacado,
 * faixas de score, prazo da política, monitoramento de NF-e/CFOP, extrato do sacado,
 * recomendação assistida e a regra de "Aprovar elegíveis". Cortes vêm de `operational-parameters.ts`.
 */
import { type Debtor, type ManualEntry, type Operation, type PortfolioPosition } from "@/src/domain/core/types";
import {
  type OperationalParameters,
  operationalParametersFor,
  scoreBand,
  termDays,
} from "@/src/domain/eligibility/operational-parameters";
import { todayIso } from "@/src/domain/finance/ledger";

export type RiskDecision = "Aprovado" | "Reprovado";
export type RiskReview = NonNullable<Operation["riskReview"]>;
export type RiskAuditEntry = NonNullable<RiskReview["audit"]>[number];
export type RiskDetailKind = "cedent" | "debtor" | "group";

/** Sacado consolidado a partir dos títulos da operação. */
export type DebtorGroup = { id: string; name: string; document: string; amount: number; count: number };

export type LedgerRow = { label: string; data: PortfolioPosition; tone: string };

export type DebtorRecommendation = { tone: string; label: string; reason: string };

/** Parâmetros operacionais (faixas de score, prazo mínimo, CFOP) da modalidade da operação. */
export const riskParametersFor = (operation: Pick<Operation, "institution">) =>
  operationalParametersFor(operation.institution);

const digits = (value: string) => value.replace(/\D/g, "");

/** Chave de identificação do sacado usada em decisões, seleção e auditoria. */
export const groupKey = (group: DebtorGroup) => group.id || group.document;

export function groupEntriesByDebtor(entries: ManualEntry[]): DebtorGroup[] {
  return Object.values(
    entries.reduce<Record<string, DebtorGroup>>((result, entry) => {
      const key = entry.debtorId || entry.debtorDocument || entry.debtorName;
      const current = result[key] ?? {
        id: entry.debtorId,
        name: entry.debtorName || "Sacado não identificado",
        document: entry.debtorDocument,
        amount: 0,
        count: 0,
      };
      result[key] = { ...current, amount: current.amount + entry.amount, count: current.count + 1 };
      return result;
    }, {}),
  );
}

/** Perfil do sacado no cadastro correspondente ao grupo (por id ou documento). */
export const findDebtorProfile = (debtors: Debtor[], group?: DebtorGroup) =>
  debtors.find(item => item.id === group?.id || digits(item.document) === group?.document.replace(/\D/g, ""));

/** Títulos da operação pertencentes ao sacado informado. */
export const titlesOfGroup = (entries: ManualEntry[], group?: DebtorGroup) =>
  entries.filter(entry => (entry.debtorId || entry.debtorDocument) === (group?.id || group?.document));

/** Faixa de score (Novo, Crítico, Atenção, Positivo) pelas faixas configuradas. */
export const scoreLabel = (score?: number, bands?: OperationalParameters["scoreBands"]) => scoreBand(score, bands);

export const scoreTone = (score?: number, bands?: OperationalParameters["scoreBands"]) =>
  ({ Novo: "new", Positivo: "good", Atenção: "watch", Crítico: "bad" })[scoreBand(score, bands)];

/** Dias corridos de calendário entre hoje e o vencimento do título; `null` quando não há vencimento. */
export const termFor = (title: ManualEntry, today = todayIso()) => termDays(title.dueDate, today);

export const noteMonitoring = (title: ManualEntry) =>
  title.nfeKey ? "NF-e autorizada · monitoramento ativo" : "Sem chave NF-e · monitoramento pendente";

/** CFOP começa por um dos prefixos aceitos (ex.: saídas 5xxx/6xxx). */
export const isCirculationCfop = (cfop: string | undefined, prefixes: string[]) =>
  Boolean(cfop && prefixes.some(prefix => cfop.startsWith(prefix)));

export const cfopMonitoring = (title: ManualEntry, prefixes: string[]) =>
  title.cfop
    ? isCirculationCfop(title.cfop, prefixes)
      ? "CFOP compatível com circulação"
      : "CFOP exige revisão"
    : "CFOP não informado";

export const cfopDescription = (cfop?: string) =>
  ({
    "5102": "Venda de mercadoria adquirida ou recebida de terceiros, dentro do estado",
    "6102": "Venda de mercadoria adquirida ou recebida de terceiros, destinada a outro estado",
    "5949": "Outra saída de mercadoria ou prestação de serviço não especificada",
    "6949": "Outra saída interestadual não especificada",
  })[cfop ?? ""] ??
  (cfop ? "Descrição fiscal não cadastrada; validar com a política tributária" : "CFOP não informado");

/** Extrato da carteira do sacado (baixados e em aberto), com fallback para os campos resumidos. */
export function debtorLedger(debtor?: Debtor) {
  const settledOnTime = debtor?.portfolioMetrics?.settledOnTime ?? {
    count: Math.max(0, (debtor?.settlements ?? 0) - (debtor?.lateSettlements ?? 0)),
    amount: 0,
  };
  const settledLate = debtor?.portfolioMetrics?.settledLate ?? {
    count: debtor?.lateSettlements ?? 0,
    amount: 0,
  };
  const repurchased = debtor?.portfolioMetrics?.repurchased ?? {
    count: debtor?.repurchases ?? 0,
    amount: 0,
  };
  const protested = debtor?.portfolioMetrics?.protested ?? { count: 0, amount: 0 };
  const courtSettled = debtor?.portfolioMetrics?.courtSettled ?? { count: 0, amount: 0 };
  const extendedSettled = debtor?.portfolioMetrics?.extendedSettled ?? { count: 0, amount: 0 };
  const openDue = debtor?.portfolioMetrics?.openDue ?? {
    count: (debtor?.portfolioReceivable ?? 0) > 0 ? 1 : 0,
    amount: Math.max(0, (debtor?.portfolioReceivable ?? 0) - (debtor?.portfolioOverdue ?? 0)),
  };
  const openOverdue = debtor?.portfolioMetrics?.openOverdue ?? {
    count: (debtor?.portfolioOverdue ?? 0) > 0 ? 1 : 0,
    amount: debtor?.portfolioOverdue ?? 0,
  };
  const openExtended = debtor?.portfolioMetrics?.openExtended ?? { count: 0, amount: 0 };
  const openNegotiation = debtor?.portfolioMetrics?.openNegotiation ?? { count: 0, amount: 0 };
  const settledRows: LedgerRow[] = [
    { label: "Pagos no prazo", data: settledOnTime, tone: "positive" },
    { label: "Pagos com atraso", data: settledLate, tone: settledLate.count ? "attention" : "neutral" },
    { label: "Recomprados", data: repurchased, tone: repurchased.count ? "negative" : "neutral" },
    { label: "Protestados", data: protested, tone: protested.count ? "negative" : "neutral" },
    { label: "Liquidados em cartório", data: courtSettled, tone: "neutral" },
    { label: "Prorrogados liquidados", data: extendedSettled, tone: extendedSettled.count ? "attention" : "neutral" },
  ];
  const openRows: LedgerRow[] = [
    { label: "A vencer", data: openDue, tone: "neutral" },
    { label: "Vencidos", data: openOverdue, tone: openOverdue.count ? "negative" : "positive" },
    { label: "Prorrogados", data: openExtended, tone: openExtended.count ? "attention" : "neutral" },
    { label: "Em negociação", data: openNegotiation, tone: openNegotiation.count ? "attention" : "neutral" },
  ];
  return {
    settledRows,
    openRows,
    settledAmount: settledOnTime.amount + settledLate.amount + courtSettled.amount + extendedSettled.amount,
    openCount: openDue.count + openOverdue.count,
  };
}

export function debtorRecommendation(
  debtor?: Debtor,
  bands: OperationalParameters["scoreBands"] = operationalParametersFor().scoreBands,
): DebtorRecommendation {
  return debtor?.score == null
    ? {
        tone: "attention",
        label: "Análise manual necessária",
        reason: "Sacado novo: consulte cadastro, bureau e documentos antes da decisão.",
      }
    : debtor.score < bands.attention || (debtor.portfolioOverdue ?? 0) > 0
      ? {
          tone: "negative",
          label: "Recomendação: revisar ou reprovar",
          reason: debtor.scoreReasons?.[0] ?? "Há indicadores de risco que exigem decisão humana.",
        }
      : debtor.score < bands.positive
        ? {
            tone: "attention",
            label: "Recomendação: aprovar com atenção",
            reason: debtor.scoreReasons?.[0] ?? "O relacionamento está em faixa intermediária.",
          }
        : {
            tone: "positive",
            label: "Recomendação: elegível para aprovação",
            reason: debtor.scoreReasons?.[0] ?? "Histórico positivo e carteira saudável.",
          };
}

/**
 * Regra de "Aprovar elegíveis": respeita a política e as decisões manuais já registradas —
 * nada é aprovado às cegas. Aprova sacados com score na faixa mínima ainda sem decisão e, deles,
 * os títulos sem decisão com prazo ≥ mínimo. O cedente é aprovado se o score atinge a faixa mínima.
 */
export function eligibleApproval({
  review,
  grouped,
  entries,
  debtors,
  cedentScore,
  parameters = operationalParametersFor(),
  today = todayIso(),
}: {
  review: Operation["riskReview"];
  grouped: DebtorGroup[];
  entries: ManualEntry[];
  debtors: Debtor[];
  cedentScore?: number;
  parameters?: OperationalParameters;
  today?: string;
}): Pick<RiskReview, "cedentDecision" | "debtorDecisions" | "titleDecisions"> {
  const previousDebtors = review?.debtorDecisions ?? {};
  const previousTitles = review?.titleDecisions ?? {};
  const debtorScore = (key: string) =>
    debtors.find(item => item.id === key || digits(item.document) === digits(key))?.score ?? 0;
  const decisions: Record<string, RiskDecision> = { ...previousDebtors };
  grouped.forEach(item => {
    const key = groupKey(item);
    if (!decisions[key] && debtorScore(key) >= parameters.scoreBands.attention) decisions[key] = "Aprovado";
  });
  const titles: Record<string, RiskDecision> = { ...previousTitles };
  entries.forEach(item => {
    const key = item.debtorId || item.debtorDocument;
    const term = termFor(item, today);
    if (!titles[item.id] && decisions[key] === "Aprovado" && term !== null && term >= parameters.minimumTermDays)
      titles[item.id] = "Aprovado";
  });
  const cedentOk = (cedentScore ?? 0) >= parameters.scoreBands.attention;
  return {
    cedentDecision: review?.cedentDecision ?? (cedentOk ? "Aprovado" : undefined),
    debtorDecisions: decisions,
    titleDecisions: titles,
  };
}
