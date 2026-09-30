"use client";
/**
 * Modelo de apresentação da precificação: tipos derivados do domínio e funções
 * puras usadas pelos componentes do painel (formatação de taxas, piso da
 * política, regra tributária, linhas e filtros de recompra/compensação e a
 * memória da seleção). Nada aqui guarda estado.
 */
import { type Operation } from "@/src/domain/core/types";
import {
  type PricingDraft,
  type pricingCalculation,
  type repurchaseCalculation,
  type settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";

export type PricingCalculation = ReturnType<typeof pricingCalculation>;
export type RepurchaseResult = ReturnType<typeof repurchaseCalculation>;
export type SettlementAdjustmentResult = ReturnType<typeof settlementAdjustmentCalculation>;
export type RepurchaseRow = RepurchaseResult["rows"][number];
export type SettlementAdjustmentRow = SettlementAdjustmentResult["rows"][number];
export type RepurchaseTerms = NonNullable<PricingDraft["repurchaseTerms"]>[string];

/** Campos numéricos do rascunho editáveis por input `type="number"`. */
export type NumericPricingField = {
  [K in keyof PricingDraft]-?: NonNullable<PricingDraft[K]> extends number ? K : never;
}[keyof PricingDraft];

export type OffsetNatureFilter = "Todos" | "Débitos" | "Créditos";
export type OffsetSourceFilter = "Todos" | "Títulos" | "Pendências" | "Créditos";

export type OffsetFilters = {
  includeGroup: boolean;
  nature: OffsetNatureFilter;
  source: OffsetSourceFilter;
  search: string;
};

/** Formata percentuais no padrão brasileiro (vírgula decimal), sem símbolo. */
export function formatRate(value: number, digits = 2) {
  return value.toFixed(digits).replace(".", ",");
}

/** Piso de taxa mensal da política comercial conforme o risco da operação. */
export function policyMinimumFor(risk: Operation["risk"]) {
  return risk === "Alto" ? 2.4 : risk === "Médio" ? 1.8 : 1.4;
}

/** Texto da regra tributária aplicada, conforme o tipo de instituição. */
export function taxRuleFor(institution: Operation["institution"]) {
  return institution === "Factoring"
    ? "IOF estimado conforme configuração fiscal vigente da factoring"
    : institution === "FIDC"
      ? "Aquisição da carteira sem IOF operacional no veículo"
      : "Tributos conforme configuração da securitizadora";
}

/** Orientação exibida sob a face aprovada quando a origem está incompleta. */
export function sourceStatusHint(calculated: PricingCalculation, ready: boolean) {
  return ready
    ? "Base única usada em todos os cálculos"
    : !calculated.sourceTitleCount
      ? "Inclua os títulos na Entrada"
      : !calculated.hasDecisions
        ? "Conclua as decisões de Risco"
        : "A operação não possui títulos aprovados";
}

/** Une títulos em recompra e ajustes de liquidação numa única lista filtrável. */
export function buildOffsetRows(repurchase: RepurchaseResult, settlementAdjustments: SettlementAdjustmentResult) {
  return [
    ...repurchase.rows.map(row => ({
      kind: "Título" as const,
      nature: "Débito" as const,
      scope: row.scope,
      search: `${row.documentNumber} ${row.debtorName} ${row.portfolioOwnerName ?? ""} ${row.acquisitionReference}`,
      row,
    })),
    ...settlementAdjustments.rows.map(row => ({
      kind: row.kind,
      nature: row.kind === "Crédito" ? ("Crédito" as const) : ("Débito" as const),
      scope: row.scope,
      search: `${row.description} ${row.ownerName} ${row.reference}`,
      row,
    })),
  ];
}

export type OffsetRow = ReturnType<typeof buildOffsetRows>[number];

export function filterOffsetRows(rows: OffsetRow[], filters: OffsetFilters) {
  return rows.filter(item => {
    if (!filters.includeGroup && item.scope === "Grupo empresarial") return false;
    if (filters.nature === "Débitos" && item.nature !== "Débito") return false;
    if (filters.nature === "Créditos" && item.nature !== "Crédito") return false;
    if (filters.source === "Títulos" && item.kind !== "Título") return false;
    if (filters.source === "Pendências" && item.kind !== "Pendência") return false;
    if (filters.source === "Créditos" && item.kind !== "Crédito") return false;
    const query = filters.search.trim().toLocaleLowerCase("pt-BR");
    return !query || item.search.toLocaleLowerCase("pt-BR").includes(query);
  });
}

/** Ids dos títulos vencidos entre as linhas visíveis. */
export function overdueTitleIds(rows: OffsetRow[]) {
  return rows.filter(item => item.kind === "Título" && item.row.overdue).map(item => item.row.id);
}

function sumBy<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((sum, row) => sum + value(row), 0);
}

/** Total dos créditos selecionados que compensam o líquido. */
export function selectedCreditTotal(settlementAdjustments: SettlementAdjustmentResult) {
  return sumBy(
    settlementAdjustments.selected.filter(row => row.kind === "Crédito"),
    row => row.amount,
  );
}

/**
 * Agrupa os itens selecionados (títulos do cedente, do grupo, pendências e
 * créditos) com face, valor corrigido e efeito no líquido. Grupos vazios são
 * omitidos.
 */
export function buildSelectedOffsetMemory(
  repurchase: RepurchaseResult,
  settlementAdjustments: SettlementAdjustmentResult,
) {
  const cedentTitles = repurchase.selected.filter(row => row.scope === "Cedente");
  const groupTitles = repurchase.selected.filter(row => row.scope === "Grupo empresarial");
  const pendings = settlementAdjustments.selected.filter(row => row.kind === "Pendência");
  const credits = settlementAdjustments.selected.filter(row => row.kind === "Crédito");
  return [
    {
      label: "Títulos do cedente",
      rows: cedentTitles,
      face: sumBy(cedentTitles, row => row.faceAmount),
      corrected: sumBy(cedentTitles, row => row.presentValue),
      impact: -sumBy(cedentTitles, row => row.presentValue),
    },
    {
      label: "Títulos do grupo",
      rows: groupTitles,
      face: sumBy(groupTitles, row => row.faceAmount),
      corrected: sumBy(groupTitles, row => row.presentValue),
      impact: -sumBy(groupTitles, row => row.presentValue),
    },
    {
      label: "Pendências",
      rows: pendings,
      face: sumBy(pendings, row => row.amount),
      corrected: sumBy(pendings, row => row.amount),
      impact: -sumBy(pendings, row => row.amount),
    },
    {
      label: "Créditos",
      rows: credits,
      face: sumBy(credits, row => row.amount),
      corrected: sumBy(credits, row => row.amount),
      impact: sumBy(credits, row => row.amount),
    },
  ].filter(group => group.rows.length > 0);
}

export type OffsetMemoryGroup = ReturnType<typeof buildSelectedOffsetMemory>[number];
