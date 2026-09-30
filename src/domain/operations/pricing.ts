/**
 * Precificação da operação: deságio por método (nominal, efetiva, mista, composta), tarifas, IOF, recompra,
 * compensações e taxa all-in. Fonte única usada pelas etapas Preço e Aprovação, pela Visão geral e pelo Comercial.
 */
import { cedentPortfolioTitles, cedentSettlementAdjustments } from "@/src/domain/core/demo/portfolio";
import { type Operation } from "@/src/domain/core/types";

export type PricingDraft = NonNullable<Operation["pricingReview"]>;

export function defaultPricing(operation: Operation): PricingDraft {
  const factoring = operation.institution === "Factoring";
  return {
    method: "Composta Mista",
    vaEnabled: false,
    monthlyRate: factoring ? 2.8 : 2.1,
    targetFinalRateMonthly: 0,
    fundingCostMonthly: factoring ? 1.45 : 1.2,
    floatDays: 1,
    minimumTermDays: 5,
    operationFee: factoring ? 150 : 0,
    feePerTitle: 12,
    adValoremPercent: factoring ? 0.5 : 0,
    guaranteePercent: operation.risk === "Alto" ? 5 : operation.risk === "Médio" ? 2 : 0,
    manualRetention: 0,
    manualFees: [],
    repurchaseTitleIds: [],
    settlementAdjustmentIds: [],
    repurchaseTerms: {},
    feeAllocation: "Por valor × prazo",
    regress: factoring ? "Com regresso" : "Sem regresso",
    regressDays: factoring ? 5 : 0,
    coobligation: factoring,
    status: "Simulação",
    version: 0,
    locked: false,
    audit: [],
  };
}

export function normalizedPricing(operation: Operation): PricingDraft {
  const fallback = defaultPricing(operation);
  if (!operation.pricingReview) return fallback;
  const current = operation.pricingReview;
  const legacyMethod = String(current.method);
  const methodMap: Record<string, PricingDraft["method"]> = {
    Simples: "Nominal",
    Composto: "Composta Mista",
    "Simples VA": "Nominal",
    "Composto VA": "Composta Mista",
  };
  return {
    ...fallback,
    ...current,
    method: methodMap[legacyMethod] ?? current.method,
    vaEnabled: current.vaEnabled ?? legacyMethod.endsWith("VA"),
    manualFees: (current.manualFees ?? []).map(fee => ({ ...fee, kind: "Esporádica" as const })),
    repurchaseTitleIds: current.repurchaseTitleIds ?? [],
    settlementAdjustmentIds: current.settlementAdjustmentIds ?? [],
    repurchaseTerms: current.repurchaseTerms ?? {},
    version: current.version ?? 0,
    locked: current.locked ?? current.status === "Condição salva",
    audit: current.audit ?? [],
  };
}

export const roundPricing = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function pricingAdjustment(face: number, days: number, ratePercent: number, method: PricingDraft["method"]) {
  const safeRate = Math.min(99.9999, Math.max(0, ratePercent));
  const rate = safeRate / 100;
  const nominal = () => roundPricing(roundPricing((face * safeRate) / 3000) * days);
  const simple = () => roundPricing((face * days * safeRate) / 100 / 30);
  const effective = () => roundPricing(face - face / Math.pow(100 / (100 - safeRate), days / 30));
  const compound = () => roundPricing(roundPricing(face * Math.pow(1 + rate, days / 30)) - face);
  if (method === "Nominal") return nominal();
  if (method === "Efetiva") return effective();
  if (method === "Mista") return days >= 30 ? simple() : effective();
  return days > 29 ? compound() : effective();
}

export function repurchaseCalculation(operation: Operation, pricing: PricingDraft) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cedentDocument = operation.document.replace(/\D/g, "");
  const selectedIds = new Set(pricing.repurchaseTitleIds ?? []);
  const rows = cedentPortfolioTitles
    .filter(
      title =>
        title.cedentDocument.replace(/\D/g, "") === cedentDocument ||
        title.groupOwnerDocument?.replace(/\D/g, "") === cedentDocument,
    )
    .map(title => {
      const due = new Date(`${title.dueDate}T12:00:00`);
      const signedDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      const overdue = signedDays < 0;
      const days = Math.max(1, Math.abs(signedDays));
      const terms = pricing.repurchaseTerms?.[title.id] ?? {
        lateInterestMonthly: 1,
        penaltyPercent: 2,
        action: "Recompra" as const,
      };
      const appliedRate = terms.rateOverride ?? title.acquisitionMonthlyRate;
      const adjustment = pricingAdjustment(title.faceAmount, days, appliedRate, title.acquisitionMethod);
      const lateInterest = overdue
        ? roundPricing((((title.faceAmount * Math.max(0, terms.lateInterestMonthly)) / 100) * days) / 30)
        : 0;
      const penalty = overdue ? roundPricing((title.faceAmount * Math.max(0, terms.penaltyPercent)) / 100) : 0;
      const fullRegressValue = roundPricing(
        overdue ? title.faceAmount + adjustment + lateInterest + penalty : Math.max(0, title.faceAmount - adjustment),
      );
      const presentValue =
        terms.action === "Recompra parcial"
          ? roundPricing(Math.min(fullRegressValue, Math.max(0, terms.partialAmount ?? 0)))
          : fullRegressValue;
      return {
        ...title,
        scope: title.groupOwnerDocument ? ("Grupo empresarial" as const) : ("Cedente" as const),
        overdue,
        days,
        adjustment,
        lateInterest,
        penalty,
        fullRegressValue,
        presentValue,
        appliedRate,
        terms,
        selected: selectedIds.has(title.id),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const selected = rows.filter(row => row.selected);
  return {
    rows,
    selected,
    overdueCount: rows.filter(row => row.overdue).length,
    total: roundPricing(selected.reduce((sum, row) => sum + row.presentValue, 0)),
  };
}

export function settlementAdjustmentCalculation(operation: Operation, pricing: PricingDraft) {
  const cedentDocument = operation.document.replace(/\D/g, "");
  const selectedIds = new Set(pricing.settlementAdjustmentIds ?? []);
  const rows = cedentSettlementAdjustments
    .filter(
      item =>
        item.cedentDocument.replace(/\D/g, "") === cedentDocument ||
        item.groupOwnerDocument?.replace(/\D/g, "") === cedentDocument,
    )
    .map(item => ({
      ...item,
      scope: item.groupOwnerDocument ? ("Grupo empresarial" as const) : ("Cedente" as const),
      selected: selectedIds.has(item.id),
    }));
  const selected = rows.filter(row => row.selected);
  const debitTotal = roundPricing(
    selected.filter(row => row.kind === "Pendência").reduce((sum, row) => sum + row.amount, 0),
  );
  const creditTotal = roundPricing(
    selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0),
  );
  return { rows, selected, debitTotal, creditTotal, total: roundPricing(debitTotal - creditTotal) };
}

export function pricingCalculation(operation: Operation, pricing: PricingDraft) {
  const sourceTitles = operation.manualEntry?.entries ?? [];
  const titleDecisions = operation.riskReview?.titleDecisions ?? {};
  const hasDecisions = Object.keys(titleDecisions).length > 0;
  const titles = hasDecisions ? sourceTitles.filter(title => titleDecisions[title.id] === "Aprovado") : sourceTitles;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const round2 = roundPricing;
  const baseRows = titles.map(title => {
    const due = title.dueDate ? new Date(`${title.dueDate}T12:00:00`) : now;
    const calendarDays = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000));
    const days = Math.max(pricing.minimumTermDays, calendarDays + pricing.floatDays);
    return { title, days, baseDiscount: pricingAdjustment(title.amount, days, pricing.monthlyRate, pricing.method) };
  });
  const face = baseRows.reduce((sum, row) => sum + row.title.amount, 0);
  const originalDiscount = baseRows.reduce((sum, row) => sum + row.baseDiscount, 0);
  const weightedTerm = face ? baseRows.reduce((sum, row) => sum + row.days * row.title.amount, 0) / face : 0;
  const configuredFees =
    pricing.operationFee + pricing.feePerTitle * baseRows.length + (face * pricing.adValoremPercent) / 100;
  const manualFees = (pricing.manualFees ?? []).reduce((sum, fee) => sum + Math.max(0, fee.amount), 0);
  const fees = round2(configuredFees + manualFees);
  const weights = baseRows.map(row =>
    pricing.feeAllocation === "Por valor" ? row.title.amount : row.title.amount * row.days,
  );
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const allocatedFeeValues = baseRows.map((_, index) => (weightTotal ? (fees * weights[index]) / weightTotal : 0));
  const adjustedRate =
    pricing.vaEnabled && weightedTerm > 0 && face > 0
      ? ((((originalDiscount + fees) / face) * 100) / weightedTerm) * 30
      : pricing.monthlyRate;
  const vaCalculated = baseRows.map(row => pricingAdjustment(row.title.amount, row.days, adjustedRate, pricing.method));
  const vaCalculatedTotal = vaCalculated.reduce((sum, value) => sum + value, 0);
  const vaTargetDiscount = round2(originalDiscount + fees);
  const vaClosingDifference = round2(vaTargetDiscount - vaCalculatedTotal);
  let allocatedClosing = 0;
  const rows = baseRows.map((row, index) => {
    if (!pricing.vaEnabled) return { ...row, discount: row.baseDiscount, vaAdjustment: 0 };
    const vaAdjustment =
      index === baseRows.length - 1
        ? round2(vaClosingDifference - allocatedClosing)
        : round2(weightTotal ? (vaClosingDifference * weights[index]) / weightTotal : 0);
    allocatedClosing = round2(allocatedClosing + vaAdjustment);
    return { ...row, discount: round2(vaCalculated[index] + vaAdjustment), vaAdjustment };
  });
  const discount = rows.reduce((sum, row) => sum + row.discount, 0);
  const displayedFees = pricing.vaEnabled ? 0 : fees;
  const iof =
    operation.institution === "Factoring"
      ? baseRows.reduce(
          (sum, row, index) =>
            sum +
            Math.max(0, row.title.amount - row.baseDiscount - allocatedFeeValues[index]) *
              (0.000041 * Math.min(row.days, 365) + 0.0038),
          0,
        )
      : 0;
  const guaranteeBase = Math.max(0, face - originalDiscount - fees);
  const guarantee = (guaranteeBase * pricing.guaranteePercent) / 100;
  const net = Math.max(0, face - originalDiscount - fees - iof - guarantee - pricing.manualRetention);
  const allInMonthly = net > 0 && weightedTerm > 0 ? (Math.pow(face / net, 30 / weightedTerm) - 1) * 100 : 0;
  const spread = allInMonthly - pricing.fundingCostMonthly;
  const titleRows = rows.map((row, index) => {
    const allocatedFees = allocatedFeeValues[index];
    const chargedFees = pricing.vaEnabled ? 0 : allocatedFees;
    const allocatedGuarantee = face ? (guarantee * row.title.amount) / face : 0;
    return {
      ...row,
      displayedDiscount: row.discount,
      allocatedFees,
      displayedFees: chargedFees,
      allocatedGuarantee,
      net: Math.max(0, row.title.amount - row.baseDiscount - allocatedFees - allocatedGuarantee),
    };
  });
  return {
    face,
    discount,
    originalDiscount,
    fees,
    displayedFees,
    manualFees,
    vaEnabled: pricing.vaEnabled,
    adjustedRate,
    vaVariance: vaClosingDifference,
    iof,
    guarantee,
    net,
    weightedTerm,
    allInMonthly,
    spread,
    titleRows,
    sourceTitleCount: sourceTitles.length,
    approvedTitleCount: titles.length,
    excludedTitleCount: sourceTitles.length - titles.length,
    hasDecisions,
  };
}

export function baseRateForTargetFinal(operation: Operation, pricing: PricingDraft, targetFinalRate: number) {
  if (targetFinalRate <= 0 || !operation.manualEntry?.entries.length) return pricing.monthlyRate;
  let low = 0;
  let high = 25;
  const target = Math.max(0, targetFinalRate);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const middle = (low + high) / 2;
    const result = pricingCalculation(operation, { ...pricing, monthlyRate: middle });
    if (result.allInMonthly < target) low = middle;
    else high = middle;
  }
  return Math.round(((low + high) / 2) * 10000) / 10000;
}
