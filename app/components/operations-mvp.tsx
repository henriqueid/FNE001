"use client";

import { useEffect, useMemo, useState } from "react";
import { cedentPortfolioTitles, cedentSettlementAdjustments, destinations, initialCedents, initialDebtors, initialOperations, money, preciseMoney, stages, type Cedent, type Debtor, type Destination, type ManualEntry, type ManualEntryData, type Operation, type OperationSource, type OperationStatus } from "@/app/lib/mvp-data";
import { ActivityIcon, AlertIcon, ArrowIcon, BackIcon, BellIcon, CheckIcon, ClockIcon, CloseIcon, GridIcon, PlusIcon, PlugIcon, SearchIcon, ShieldIcon, SlidersIcon, SparkIcon, UsersIcon, WalletIcon } from "./icons";

const statusClass: Record<OperationStatus, string> = {
  "Em andamento": "neutral",
  "Aguardando terceiro": "waiting",
  "Em atenção": "attention",
  "Pronta para formalizar": "formalization",
  "Pronta para liberar": "ready",
  "Cancelada": "cancelled",
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function formatBrazilianDate(value?: string) {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatFlowMoney(value: number) {
  if (Math.abs(value) < .005) return preciseMoney.format(0);
  return `${value > 0 ? "+" : "−"} ${preciseMoney.format(Math.abs(value))}`;
}

function paceFor(operation: Operation) {
  if (operation.historySample < 5 || operation.clientAverageMinutes <= 0) {
    return { tone: "learning", label: "criando padrão", detail: "histórico ainda insuficiente" };
  }
  const difference = operation.elapsedMinutes - operation.clientAverageMinutes;
  const ratio = operation.elapsedMinutes / operation.clientAverageMinutes;
  if (ratio > 1.15) return { tone: "slower", label: `${formatDuration(difference)} mais lenta`, detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações` };
  if (ratio < .85) return { tone: "faster", label: `${formatDuration(Math.abs(difference))} mais rápida`, detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações` };
  return { tone: "standard", label: "dentro do padrão", detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações` };
}

function needsIntervention(operation: Operation) {
  if (operation.status === "Cancelada") return false;
  return operation.blockers > 0 || operation.alerts > 1 || paceFor(operation).tone === "slower" || (operation.stage <= 3 && operation.automation < 80);
}

type AutomationBreakdown = { score: number; items: { label: string; points: number; maximum: number; detail: string }[] };

function manualAutomation(data?: ManualEntryData): AutomationBreakdown {
  const entries = data?.entries ?? [];
  if (!entries.length) return { score: 0, items: [
    { label: "Dados essenciais", points: 0, maximum: 30, detail: "Nenhum título salvo" },
    { label: "Sacados identificados", points: 0, maximum: 20, detail: "Nenhum sacado vinculado" },
    { label: "Evidências do recebível", points: 0, maximum: 20, detail: "Nenhuma evidência disponível" },
    { label: "Consistência", points: 0, maximum: 15, detail: "Aguardando títulos" },
    { label: "Origem dos dados", points: 5, maximum: 15, detail: "Digitação manual assistida" },
  ] };
  const requiredFilled = entries.reduce((sum, entry) => sum + [entry.documentNumber, entry.amount > 0, entry.issueDate, entry.dueDate].filter(Boolean).length, 0);
  const essential = Math.round(30 * requiredFilled / (entries.length * 4));
  const identifiedCount = entries.filter(entry => entry.debtorId && entry.debtorDocument).length;
  const identified = Math.round(20 * identifiedCount / entries.length);
  const evidenceCount = entries.filter(entry => data?.receivableType === "Duplicata" ? Boolean(entry.nfeKey) : data?.receivableType === "Cheque" ? Boolean(entry.cmc7 && entry.bank && entry.account) : Boolean(entry.documentNumber)).length;
  const evidence = Math.round(20 * evidenceCount / entries.length);
  const signatures = entries.map(entry => `${entry.debtorDocument.replace(/\D/g, "")}|${entry.documentNumber.trim().toLowerCase()}`);
  const duplicateCount = signatures.length - new Set(signatures).size;
  const consistency = Math.round(15 * (1 - duplicateCount / entries.length));
  const items = [
    { label: "Dados essenciais", points: essential, maximum: 30, detail: `${requiredFilled} de ${entries.length * 4} campos obrigatórios preenchidos` },
    { label: "Sacados identificados", points: identified, maximum: 20, detail: `${identifiedCount} de ${entries.length} títulos vinculados` },
    { label: "Evidências do recebível", points: evidence, maximum: 20, detail: `${evidenceCount} de ${entries.length} com evidência principal` },
    { label: "Consistência", points: consistency, maximum: 15, detail: duplicateCount ? `${duplicateCount} possível duplicidade` : "Nenhuma duplicidade encontrada" },
    { label: "Origem dos dados", points: 5, maximum: 15, detail: "Digitação manual assistida" },
  ];
  return { score: items.reduce((sum, item) => sum + item.points, 0), items };
}

type LastroAssessmentRow = {
  title: ManualEntry;
  debtor?: Debtor;
  sampled: boolean;
  automaticEvidence: boolean;
  evidenceStatus: "Validada" | "Pendente" | "Divergente";
  confirmation?: "Pendente" | "Contato iniciado" | "Sem contato" | "Confirmado" | "Confirmado com ressalva" | "Recusado" | "Telefone inválido";
  attachmentName?: string;
  reasons: string[];
};

type LastroReviewItem = NonNullable<NonNullable<Operation["lastroReview"]>["items"]>[string];

type PricingDraft = NonNullable<Operation["pricingReview"]>;

function defaultPricing(operation: Operation): PricingDraft {
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
    adValoremPercent: factoring ? .5 : 0,
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

function normalizedPricing(operation: Operation): PricingDraft {
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

const roundPricing = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function pricingAdjustment(face: number, days: number, ratePercent: number, method: PricingDraft["method"]) {
  const safeRate = Math.min(99.9999, Math.max(0, ratePercent));
  const rate = safeRate / 100;
  const nominal = () => roundPricing(roundPricing(face * safeRate / 3000) * days);
  const simple = () => roundPricing(face * days * safeRate / 100 / 30);
  const effective = () => roundPricing(face - face / Math.pow(100 / (100 - safeRate), days / 30));
  const compound = () => roundPricing(roundPricing(face * Math.pow(1 + rate, days / 30)) - face);
  if (method === "Nominal") return nominal();
  if (method === "Efetiva") return effective();
  if (method === "Mista") return days >= 30 ? simple() : effective();
  return days > 29 ? compound() : effective();
}

function repurchaseCalculation(operation: Operation, pricing: PricingDraft) {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const cedentDocument = operation.document.replace(/\D/g, "");
  const selectedIds = new Set(pricing.repurchaseTitleIds ?? []);
  const rows = cedentPortfolioTitles.filter(title => title.cedentDocument.replace(/\D/g, "") === cedentDocument || title.groupOwnerDocument?.replace(/\D/g, "") === cedentDocument).map(title => {
    const due = new Date(`${title.dueDate}T12:00:00`);
    const signedDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    const overdue = signedDays < 0;
    const days = Math.max(1, Math.abs(signedDays));
    const terms = pricing.repurchaseTerms?.[title.id] ?? { lateInterestMonthly: 1, penaltyPercent: 2, action: "Recompra" as const };
    const appliedRate = terms.rateOverride ?? title.acquisitionMonthlyRate;
    const adjustment = pricingAdjustment(title.faceAmount, days, appliedRate, title.acquisitionMethod);
    const lateInterest = overdue ? roundPricing(title.faceAmount * Math.max(0, terms.lateInterestMonthly) / 100 * days / 30) : 0;
    const penalty = overdue ? roundPricing(title.faceAmount * Math.max(0, terms.penaltyPercent) / 100) : 0;
    const fullRegressValue = roundPricing(overdue ? title.faceAmount + adjustment + lateInterest + penalty : Math.max(0, title.faceAmount - adjustment));
    const presentValue = terms.action === "Recompra parcial" ? roundPricing(Math.min(fullRegressValue, Math.max(0, terms.partialAmount ?? 0))) : fullRegressValue;
    return { ...title, scope: title.groupOwnerDocument ? "Grupo empresarial" as const : "Cedente" as const, overdue, days, adjustment, lateInterest, penalty, fullRegressValue, presentValue, appliedRate, terms, selected: selectedIds.has(title.id) };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const selected = rows.filter(row => row.selected);
  return {
    rows,
    selected,
    overdueCount: rows.filter(row => row.overdue).length,
    total: roundPricing(selected.reduce((sum, row) => sum + row.presentValue, 0)),
  };
}

function settlementAdjustmentCalculation(operation: Operation, pricing: PricingDraft) {
  const cedentDocument = operation.document.replace(/\D/g, "");
  const selectedIds = new Set(pricing.settlementAdjustmentIds ?? []);
  const rows = cedentSettlementAdjustments.filter(item => item.cedentDocument.replace(/\D/g, "") === cedentDocument || item.groupOwnerDocument?.replace(/\D/g, "") === cedentDocument).map(item => ({ ...item, scope: item.groupOwnerDocument ? "Grupo empresarial" as const : "Cedente" as const, selected: selectedIds.has(item.id) }));
  const selected = rows.filter(row => row.selected);
  const debitTotal = roundPricing(selected.filter(row => row.kind === "Pendência").reduce((sum, row) => sum + row.amount, 0));
  const creditTotal = roundPricing(selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0));
  return { rows, selected, debitTotal, creditTotal, total: roundPricing(debitTotal - creditTotal) };
}

function pricingCalculation(operation: Operation, pricing: PricingDraft) {
  const sourceTitles = operation.manualEntry?.entries ?? [];
  const titleDecisions = operation.riskReview?.titleDecisions ?? {};
  const hasDecisions = Object.keys(titleDecisions).length > 0;
  const titles = hasDecisions ? sourceTitles.filter(title => titleDecisions[title.id] === "Aprovado") : sourceTitles;
  const now = new Date(); now.setHours(12, 0, 0, 0);
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
  const configuredFees = pricing.operationFee + pricing.feePerTitle * baseRows.length + face * pricing.adValoremPercent / 100;
  const manualFees = (pricing.manualFees ?? []).reduce((sum, fee) => sum + Math.max(0, fee.amount), 0);
  const fees = round2(configuredFees + manualFees);
  const weights = baseRows.map(row => pricing.feeAllocation === "Por valor" ? row.title.amount : row.title.amount * row.days);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const allocatedFeeValues = baseRows.map((_, index) => weightTotal ? fees * weights[index] / weightTotal : 0);
  const adjustedRate = pricing.vaEnabled && weightedTerm > 0 && face > 0 ? ((originalDiscount + fees) / face * 100 / weightedTerm) * 30 : pricing.monthlyRate;
  const vaCalculated = baseRows.map(row => pricingAdjustment(row.title.amount, row.days, adjustedRate, pricing.method));
  const vaCalculatedTotal = vaCalculated.reduce((sum, value) => sum + value, 0);
  const vaTargetDiscount = round2(originalDiscount + fees);
  const vaClosingDifference = round2(vaTargetDiscount - vaCalculatedTotal);
  let allocatedClosing = 0;
  const rows = baseRows.map((row, index) => {
    if (!pricing.vaEnabled) return { ...row, discount: row.baseDiscount, vaAdjustment: 0 };
    const vaAdjustment = index === baseRows.length - 1 ? round2(vaClosingDifference - allocatedClosing) : round2(weightTotal ? vaClosingDifference * weights[index] / weightTotal : 0);
    allocatedClosing = round2(allocatedClosing + vaAdjustment);
    return { ...row, discount: round2(vaCalculated[index] + vaAdjustment), vaAdjustment };
  });
  const discount = rows.reduce((sum, row) => sum + row.discount, 0);
  const displayedFees = pricing.vaEnabled ? 0 : fees;
  const iof = operation.institution === "Factoring" ? baseRows.reduce((sum, row, index) => sum + Math.max(0, row.title.amount - row.baseDiscount - allocatedFeeValues[index]) * (.000041 * Math.min(row.days, 365) + .0038), 0) : 0;
  const guaranteeBase = Math.max(0, face - originalDiscount - fees);
  const guarantee = guaranteeBase * pricing.guaranteePercent / 100;
  const net = Math.max(0, face - originalDiscount - fees - iof - guarantee - pricing.manualRetention);
  const allInMonthly = net > 0 && weightedTerm > 0 ? (Math.pow(face / net, 30 / weightedTerm) - 1) * 100 : 0;
  const spread = allInMonthly - pricing.fundingCostMonthly;
  const titleRows = rows.map((row, index) => { const allocatedFees = allocatedFeeValues[index]; const chargedFees = pricing.vaEnabled ? 0 : allocatedFees; const allocatedGuarantee = face ? guarantee * row.title.amount / face : 0; return { ...row, displayedDiscount: row.discount, allocatedFees, displayedFees: chargedFees, allocatedGuarantee, net: Math.max(0, row.title.amount - row.baseDiscount - allocatedFees - allocatedGuarantee) }; });
  return { face, discount, originalDiscount, fees, displayedFees, manualFees, vaEnabled: pricing.vaEnabled, adjustedRate, vaVariance: vaClosingDifference, iof, guarantee, net, weightedTerm, allInMonthly, spread, titleRows, sourceTitleCount: sourceTitles.length, approvedTitleCount: titles.length, excludedTitleCount: sourceTitles.length - titles.length, hasDecisions };
}

function baseRateForTargetFinal(operation: Operation, pricing: PricingDraft, targetFinalRate: number) {
  if (targetFinalRate <= 0 || !(operation.manualEntry?.entries.length)) return pricing.monthlyRate;
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

function lastroAssessmentFor(operation: Operation, debtorCatalog: Debtor[] = initialDebtors) {
  const entries = operation.manualEntry?.entries ?? [];
  const ratio = operation.risk === "Alto" ? 1 : operation.risk === "Médio" ? .5 : .25;
  const sampleSize = entries.length ? Math.max(1, Math.ceil(entries.length * ratio)) : 0;
  const ranked = entries.map((title, index) => {
    const debtor = debtorCatalog.find(item => item.id === title.debtorId || item.document.replace(/\D/g, "") === title.debtorDocument.replace(/\D/g, ""));
    const automaticEvidence = operation.manualEntry?.receivableType === "Cheque" ? Boolean(title.cmc7 && title.bank && title.account) : operation.manualEntry?.receivableType === "Duplicata" ? Boolean(title.nfeKey && title.cfop && /^[56]/.test(title.cfop)) : Boolean(title.documentNumber);
    const reasons = [
      !automaticEvidence ? "Evidência documental incompleta" : "",
      (debtor?.score ?? 700) < 600 ? "Sacado em faixa crítica" : "",
      operation.amount > 0 && title.amount / operation.amount >= .25 ? "Concentração relevante na operação" : "",
      title.cfop && !/^[56]/.test(title.cfop) ? "CFOP exige revisão" : "",
    ].filter(Boolean);
    return { title, debtor, automaticEvidence, reasons, priority: (automaticEvidence ? 0 : 100) + ((debtor?.score ?? 700) < 600 ? 60 : 0) + (title.amount / Math.max(1, operation.amount) >= .25 ? 30 : 0) + index / 100 };
  }).sort((a, b) => b.priority - a.priority);
  const sampledIds = new Set(ranked.slice(0, sampleSize).map(item => item.title.id));
  const rows: LastroAssessmentRow[] = entries.map(title => {
    const base = ranked.find(item => item.title.id === title.id)!;
    const review = operation.lastroReview?.items?.[title.id];
    return { title, debtor: base.debtor, automaticEvidence: base.automaticEvidence, sampled: sampledIds.has(title.id), evidenceStatus: review?.evidenceDecision ?? (base.automaticEvidence ? "Validada" : "Pendente"), confirmation: review?.confirmation, attachmentName: review?.attachmentName, reasons: base.reasons };
  });
  const evidenceValid = rows.filter(row => row.evidenceStatus === "Validada").length;
  const sampled = rows.filter(row => row.sampled);
  const confirmed = sampled.filter(row => row.confirmation === "Confirmado").length;
  const divergences = rows.filter(row => row.evidenceStatus === "Divergente" || row.confirmation === "Recusado" || row.confirmation === "Telefone inválido").length;
  return { rows, sampleSize, evidenceValid, confirmed, divergences, ready: rows.length > 0 && evidenceValid === rows.length && divergences === 0 && sampled.every(row => row.confirmation === "Confirmado") };
}

function stageInsightFor(operation: Operation, stageId: number, automation: AutomationBreakdown) {
  const entries = operation.manualEntry?.entries ?? [];
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const discount = entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
  const debtorTotals = entries.reduce<Record<string, number>>((totals, entry) => { const key = entry.debtorName || "Sem sacado"; totals[key] = (totals[key] ?? 0) + entry.amount; return totals; }, {});
  const largestDebtor = Object.entries(debtorTotals).sort((a, b) => b[1] - a[1])[0];
  const concentration = total > 0 && largestDebtor ? largestDebtor[1] / total * 100 : 0;
  const evidenceCount = entries.filter(entry => operation.manualEntry?.receivableType === "Duplicata" ? Boolean(entry.nfeKey) : operation.manualEntry?.receivableType === "Cheque" ? Boolean(entry.cmc7) : Boolean(entry.documentNumber)).length;
  const averageTerm = entries.length ? Math.round(entries.reduce((sum, entry) => { const start = entry.issueDate ? new Date(`${entry.issueDate}T12:00:00`) : new Date(); const end = entry.dueDate ? new Date(`${entry.dueDate}T12:00:00`) : start; return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000)); }, 0) / entries.length) : 0;
  const stageState = stageId < operation.stage ? "Concluída" : stageId === operation.stage ? "Etapa atual" : "Prévia calculada";
  const common = { state: stageState, source: entries.length ? `Calculado sobre ${entries.length} título${entries.length === 1 ? "" : "s"} da entrada` : "Aguardando títulos na entrada" };
  if (stageId === 2) return { ...common, title: "Risco calculado com a carteira digitada", description: "Concentração, quantidade de sacados e prazo são recalculados sempre que um título muda.", metrics: [
    { label: "MAIOR CONCENTRAÇÃO", value: entries.length ? `${concentration.toFixed(1).replace(".", ",")}%` : "—", detail: largestDebtor?.[0] ?? "Sem sacado" },
    { label: "SACADOS", value: String(Object.keys(debtorTotals).length), detail: `${entries.length} recebíveis analisados` },
    { label: "PRAZO MÉDIO", value: entries.length ? `${averageTerm} dias` : "—", detail: "Emissão até vencimento" },
  ], result: concentration > 20 ? "Intervenção: concentração acima da referência de 20%." : entries.length ? "Sem alerta de concentração pela referência atual." : "Inclua títulos para calcular o risco.", tone: concentration > 20 ? "warning" : "positive" };
  if (stageId === 3) { const lastro = lastroAssessmentFor(operation); return { ...common, state: !lastro.ready && stageId < operation.stage ? "Revisão necessária" : common.state, title: "Lastro, evidências e confirmação", description: "A cobertura documental e a amostra de confirmação são recalculadas conforme o risco da operação.", metrics: [
    { label: "COBERTURA", value: entries.length ? `${Math.round(lastro.evidenceValid / entries.length * 100)}%` : "—", detail: `${lastro.evidenceValid} de ${entries.length} evidências validadas` },
    { label: "AMOSTRA", value: String(lastro.sampleSize), detail: `${lastro.confirmed} confirmações positivas` },
    { label: "DIVERGÊNCIAS", value: String(lastro.divergences), detail: lastro.divergences ? "Exigem intervenção" : "Nenhuma divergência registrada" },
  ], result: lastro.ready ? "Lastro concluído e amostra confirmada." : "Existem títulos aguardando evidência ou confirmação.", tone: lastro.ready ? "positive" : "warning" }; }
  if (stageId === 4) { const pricing = normalizedPricing(operation); const calculated = pricingCalculation(operation, pricing); const repurchase = repurchaseCalculation(operation, pricing); const adjustments = settlementAdjustmentCalculation(operation, pricing); const offsets = repurchase.total + adjustments.total; const finalNet = roundPricing(calculated.net - offsets); return { ...common, state: operation.pricingReview?.status === "Condição salva" ? stageState : "Simulação", title: "Preço e estrutura financeira", description: "Deságio, tarifas, retenções, recompras, compensações e custo de capital calculados sobre o fluxo dos títulos.", metrics: [
    { label: "VALOR LÍQUIDO", value: preciseMoney.format(finalNet), detail: offsets ? `${formatFlowMoney(-offsets)} de efeito da recompra e compensações` : `${entries.length} títulos · ${Math.round(calculated.weightedTerm)} dias médios` },
    { label: "TAXA EFETIVA FINAL", value: `${calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.`, detail: `Taxa base ${pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.` },
    { label: "SPREAD PROJETADO", value: `${calculated.spread.toFixed(2).replace(".", ",")}% a.m.`, detail: `Custo de capital ${pricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.` },
  ], result: operation.pricingReview?.status === "Condição salva" ? "Condição comercial salva e disponível para aprovação." : "Simulação ainda não salva como condição da operação.", tone: operation.pricingReview?.status === "Condição salva" ? "positive" : "warning" }; }
  if (stageId === 5) { const ready = [entries.length > 0, operation.blockers === 0, evidenceCount === entries.length, automation.score >= 70]; const done = ready.filter(Boolean).length; return { ...common, title: "Prontidão para aprovação e formalização", description: "A etapa consolida carteira, risco, lastro e automação antes das alçadas.", metrics: [
    { label: "REQUISITOS", value: `${done}/4`, detail: "Carteira, bloqueios, lastro e automação" },
    { label: "BLOQUEIOS", value: String(operation.blockers), detail: operation.blockers ? "Exigem decisão" : "Nenhum bloqueio aberto" },
    { label: "AUTOMAÇÃO ASSISTIDA", value: `${automation.score}%`, detail: "Não representa avanço da esteira" },
  ], result: done === 4 ? "Pacote apto para seguir às alçadas e assinaturas." : "Ainda há requisitos anteriores a concluir.", tone: done === 4 ? "positive" : "warning" }; }
  if (stageId === 6) return { ...common, title: "Liquidação baseada na estrutura aprovada", description: "Registro, conta favorecida e conciliação só são liberados após a formalização.", metrics: [
    { label: "VALOR PROJETADO", value: preciseMoney.format(Math.max(0, total - discount)), detail: "Antes de tarifas e impostos" },
    { label: "RECEBÍVEIS", value: String(entries.length), detail: "Ativos a registrar" },
    { label: "STATUS", value: operation.stage >= 6 ? "Liberada" : "Aguardando", detail: operation.stage >= 6 ? "Formalização concluída" : "Depende das etapas anteriores" },
  ], result: operation.stage >= 6 ? "Pronta para registro, pagamento e conciliação." : "Esta etapa permanece bloqueada até a aprovação e formalização.", tone: operation.stage >= 6 ? "positive" : "neutral" };
  return { ...common, title: "Entrada consolidada", description: "Os dados digitados alimentam automaticamente as etapas seguintes.", metrics: [
    { label: "TÍTULOS", value: String(entries.length), detail: operation.manualEntry?.receivableType ?? "Tipo não definido" },
    { label: "VALOR DE FACE", value: preciseMoney.format(total), detail: `${Object.keys(debtorTotals).length} sacados` },
    { label: "AUTOMAÇÃO ASSISTIDA", value: `${automation.score}%`, detail: "Calculada pela qualidade dos dados" },
  ], result: entries.length ? "Entrada disponível para as análises seguintes." : "Inclua títulos para iniciar as análises.", tone: entries.length ? "positive" : "neutral" };
}

function datePrefix(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}`;
}

function localDateISO(date = new Date()) {
  const prefix = datePrefix(date);
  return `${prefix.slice(0, 4)}-${prefix.slice(4, 6)}-${prefix.slice(6, 8)}`;
}

function operationDateISO(operation: Operation) {
  const digits = operation.aditivoNumber.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return localDateISO();
}

function stageCompletionFor(operation: Operation, stageId: number) {
  const recorded = operation.stageCompletions?.find(item => item.stageId === stageId);
  if (recorded) return recorded;
  if (stageId >= operation.stage) return undefined;
  const date = new Date(`${operationDateISO(operation)}T${String(Math.min(17, 8 + stageId)).padStart(2, "0")}:${String((stageId * 11) % 60).padStart(2, "0")}:00`);
  return {
    stageId,
    completedBy: operation.owner,
    completedAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date),
  };
}

function Logo() {
  return <div className="brand"><img className="brand-logo" src="/brand/strato-logo-horizontal-negative.png" alt="STRATO" /><img className="brand-symbol" src="/brand/strato-symbol-32.png" alt="" aria-hidden="true" /></div>;
}

function Shell({ children, active = "Operações", operationCount = 6, companyScope = "Consolidado", onOpenSettings }: { children: React.ReactNode; active?: string; operationCount?: number; companyScope?: string; onOpenSettings: () => void }) {
  const nav = [
    ["Visão geral", <GridIcon key="a" />], ["Operações", <ActivityIcon key="b" />], ["Carteira", <WalletIcon key="c" />],
    ["Cadastros", <UsersIcon key="d" />], ["Políticas", <ShieldIcon key="e" />], ["Integrações", <PlugIcon key="f" />], ["Configurações", <SlidersIcon key="g" />],
  ] as const;
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Navegação principal">
        <span className="nav-label">ESPAÇO DE TRABALHO</span>
        {nav.map(([label, icon]) => <button className={active === label ? "active" : ""} key={label} onClick={label === "Configurações" ? onOpenSettings : undefined}>{icon}<span>{label}</span>{label === "Operações" && <b>{operationCount}</b>}</button>)}
      </nav>
      <div className="sidebar-foot">
        <div className="tenant"><span>{companyScope === "Consolidado" ? "CO" : companyScope.slice(0, 2).toUpperCase()}</span><div><strong>{companyScope === "Consolidado" ? "Visão consolidada" : companyScope}</strong><small>{companyScope === "Consolidado" ? `${destinations.length} empresas e veículos` : "Empresa ativa"}</small></div></div>
        <button className="profile"><span>HF</span><div><strong>Henrique</strong><small>Administrador</small></div><span className="more">•••</span></button>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="global-search"><SearchIcon /><span>Buscar operação, CNPJ, título...</span><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button aria-label="Notificações"><BellIcon /><i /></button><div className="separator"/><span className="environment"><i /> Ambiente seguro</span></div>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function InfoTip({ text }: { text: string }) {
  return <span className="info-tip" tabIndex={0} aria-label={`Ajuda: ${text}`} data-tooltip={text}>i</span>;
}

function operationNeedsCedent(operation: Operation) {
  return !operation.document || operation.document === "Cadastro pendente" || !operation.cedent || operation.cedent.toLowerCase().includes("sem cedente");
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return <div className="metric-card"><span className="metric-label">{label}</span><strong className={tone || ""}>{value}</strong><small>{hint}</small></div>;
}

function StatusBadge({ status }: { status: OperationStatus }) {
  return <Badge tone={statusClass[status]}><i />{status}</Badge>;
}

function StagePipeline({ operations }: { operations: Operation[] }) {
  const total = operations.reduce((sum, operation) => sum + operation.amount, 0);
  return <section className="pipeline-card" aria-label="Operações por etapa">
    <div className="pipeline-intro"><span>FLUXO ATUAL</span><strong>{operations.length} operações</strong><small>{money.format(total)} em processamento</small></div>
    <div className="pipeline-stages">{stages.map((stage, index) => {
      const count = operations.filter(op => op.stage === stage.id).length;
      return <div className="pipeline-stage" key={stage.id}><div className="stage-count"><strong>{count}</strong><span>{stage.short}</span></div>{index < stages.length - 1 && <ArrowIcon />}</div>;
    })}</div>
  </section>;
}

function OperationsList({ operations, companyScope, onCompanyScopeChange, onOpen, onNew, onReset, onOpenSettings }: { operations: Operation[]; companyScope: string; onCompanyScopeChange: (scope: string) => void; onOpen: (op: Operation) => void; onNew: () => void; onReset: () => void; onOpenSettings: () => void }) {
  const [scope, setScope] = useState<"active" | "intervention" | "formalization" | "cancelled">("active");
  const [displayMode, setDisplayMode] = useState<"list" | "kanban">("list");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sourceFilter, setSourceFilter] = useState("Todas");
  const today = localDateISO();
  const [datePreset, setDatePreset] = useState<"today" | "custom" | "all">("today");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const companyOperations = useMemo(() => companyScope === "Consolidado" ? operations : operations.filter(op => op.vehicle === companyScope), [operations, companyScope]);
  const scopedOperations = useMemo(() => companyOperations.filter(op => {
    if (datePreset === "all") return true;
    const operationDate = operationDateISO(op);
    return operationDate >= dateFrom && operationDate <= dateTo;
  }), [companyOperations, datePreset, dateFrom, dateTo]);
  const filtered = useMemo(() => scopedOperations.filter(op => {
    const scopeOk = scope === "active" ? op.status !== "Cancelada"
      : scope === "intervention" ? needsIntervention(op)
      : scope === "formalization" ? (op.status !== "Cancelada" && op.blockers === 0 && op.stage === 4 && op.automation >= 80) : op.status === "Cancelada";
    const q = query.trim().toLowerCase();
    const searchable = JSON.stringify(op).toLowerCase();
    return scopeOk
      && (stageFilter === "Todas" || String(op.stage) === stageFilter)
      && (statusFilter === "Todos" || op.status === statusFilter)
      && (sourceFilter === "Todas" || op.source === sourceFilter)
      && (!q || searchable.includes(q));
  }), [scopedOperations, scope, query, stageFilter, statusFilter, sourceFilter]);

  const activeOperations = scopedOperations.filter(op => op.status !== "Cancelada");
  const total = activeOperations.reduce((sum, op) => sum + op.amount, 0);
  const readyValue = activeOperations.filter(op => op.status === "Pronta para liberar").reduce((sum, op) => sum + op.amount, 0);
  const exceptionCount = activeOperations.filter(op => op.blockers > 0 || op.alerts > 1).length;
  const decisionCount = activeOperations.filter(op => op.blockers > 0).length;
  const interventionCount = scopedOperations.filter(needsIntervention).length;
  const formalizationCount = scopedOperations.filter(op => op.status !== "Cancelada" && op.blockers === 0 && op.stage === 4 && op.automation >= 80).length;
  const cancellationCount = scopedOperations.filter(op => op.status === "Cancelada").length;
  const averageAutomation = Math.round(activeOperations.reduce((sum, op) => sum + op.automation, 0) / Math.max(1, activeOperations.length));
  const kanbanColumns = [
    { id: "processing", title: "Entrada e processamento", description: "Fluxo automático em execução", tone: "processing", operations: activeOperations.filter(op => !needsIntervention(op) && op.stage <= 3) },
    { id: "intervention", title: "Intervenção humana", description: "Exigem análise ou decisão", tone: "intervention", operations: activeOperations.filter(needsIntervention) },
    { id: "automatic", title: "Processada automaticamente", description: "Condição sendo consolidada", tone: "automatic", operations: activeOperations.filter(op => !needsIntervention(op) && op.stage === 4 && !(op.blockers === 0 && op.automation >= 80)) },
    { id: "formalization", title: "Pronta para formalizar", description: "Pacote pronto para conferência", tone: "formalization", operations: activeOperations.filter(op => !needsIntervention(op) && ((op.stage === 4 && op.blockers === 0 && op.automation >= 80) || op.stage === 5)) },
    { id: "release", title: "Pronta para liberar", description: "Aprovação e assinatura concluídas", tone: "release", operations: activeOperations.filter(op => !needsIntervention(op) && op.stage === 6) },
  ];
  const selectQueue = (next: typeof scope) => { setScope(next); if (next !== "active") setDisplayMode("list"); };
  return <Shell operationCount={scopedOperations.length} companyScope={companyScope} onOpenSettings={onOpenSettings}>
    <div className="page-wrap">
      <div className="page-heading"><div><Badge tone="eyebrow"><SparkIcon /> CENTRAL OPERACIONAL</Badge><h1>Operações em andamento</h1><p>Tudo o que exige atenção, decisão ou acompanhamento — em um só lugar.</p></div><div className="heading-actions"><label className="company-scope"><span>VISÃO</span><select aria-label="Selecionar empresa ou visão consolidada" value={companyScope} onChange={e => onCompanyScopeChange(e.target.value)}><option value="Consolidado">Consolidado · todas as empresas</option>{destinations.map(destination => <option value={destination.name} key={destination.name}>{destination.name}</option>)}</select></label><button className="primary-action" onClick={onNew}><PlusIcon /> Nova operação</button></div></div>
      <div className="metrics-row">
        <Metric label="VOLUME EM PROCESSAMENTO" value={money.format(total)} hint={`${activeOperations.length} operações ativas`} />
        <Metric label="PRONTAS PARA LIBERAR" value={money.format(readyValue)} hint={`${scopedOperations.filter(op => op.status === "Pronta para liberar").length} operação sem pendências`} tone="positive" />
        <Metric label="INTERVENÇÕES ABERTAS" value={String(exceptionCount)} hint={`${decisionCount} precisam da sua decisão`} tone="warning-text" />
        <Metric label="AUTOMAÇÃO ASSISTIDA MÉDIA" value={`${averageAutomation}%`} hint="qualidade e validação automática · não é progresso" tone="accent-text" />
      </div>
      <StagePipeline operations={activeOperations} />
      <section className="operations-card">
        <div className="queue-tabs">
          <button className={`queue-tab active-queue ${scope === "active" ? "active" : ""}`} onClick={() => selectQueue("active")}>
            <span className="queue-icon"><ActivityIcon /></span><span className="queue-copy"><strong>Todas em andamento</strong><small>Nenhuma operação ativa fica fora da fila</small></span><b>{activeOperations.length}</b>
          </button>
          <button className={`queue-tab intervention ${scope === "intervention" ? "active" : ""}`} onClick={() => selectQueue("intervention")}>
            <span className="queue-icon"><AlertIcon /></span><span className="queue-copy"><strong>Intervenção necessária</strong><small>Bloqueios, decisões ou ritmo fora do padrão</small></span><b>{interventionCount}</b>
          </button>
          <button className={`queue-tab formalization ${scope === "formalization" ? "active" : ""}`} onClick={() => selectQueue("formalization")}>
            <span className="queue-icon"><CheckIcon /></span><span className="queue-copy"><strong>Prontas para formalização</strong><small>Processadas automaticamente e dentro da política</small></span><b>{formalizationCount}</b>
          </button>
          <button className={`queue-tab cancelled ${scope === "cancelled" ? "active" : ""}`} onClick={() => selectQueue("cancelled")}>
            <span className="queue-icon"><CloseIcon /></span><span className="queue-copy"><strong>Canceladas</strong><small>Memória preservada para novas importações</small></span><b>{cancellationCount}</b>
          </button>
        </div>
        <div className="list-top"><div className="queue-heading"><strong>{displayMode === "kanban" ? "Fluxo operacional" : scope === "active" ? "Todas as operações ativas" : scope === "intervention" ? "Operações que precisam de ação" : scope === "formalization" ? "Operações prontas para envio" : "Operações canceladas"}</strong><span>{datePreset === "today" ? "Operações de hoje · altere o período nos filtros para consultar o histórico" : datePreset === "all" ? "Todo o histórico operacional" : `Período de ${new Date(`${dateFrom}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${dateTo}T12:00:00`).toLocaleDateString("pt-BR")}`}</span></div><div className="list-actions"><div className="date-quick-filter"><button className={datePreset === "today" ? "active" : ""} onClick={() => { setDatePreset("today"); setDateFrom(today); setDateTo(today); }}>Hoje</button><button className={datePreset === "all" ? "active" : ""} onClick={() => setDatePreset("all")}>Histórico</button></div>{scope === "active" && <div className="view-switch" aria-label="Alternar visualização"><button className={displayMode === "list" ? "active" : ""} onClick={() => setDisplayMode("list")}><ActivityIcon /> Lista</button><button className={displayMode === "kanban" ? "active" : ""} onClick={() => setDisplayMode("kanban")}><GridIcon /> Kanban</button></div>}<label className="compact-search"><SearchIcon /><input aria-label="Buscar em todos os dados da operação" value={query} onChange={e => setQuery(e.target.value)} placeholder="Aditivo, borderô, cedente, CNPJ..." /></label><button className={`icon-button ${showFilters ? "active" : ""}`} aria-label="Filtros operacionais" onClick={() => setShowFilters(value => !value)}><SlidersIcon /></button></div></div>
        {showFilters && <div className="operational-filters">
          <label><span>DATA INICIAL</span><input type="date" value={dateFrom} onChange={e => { const next = e.target.value; setDateFrom(next); if (next > dateTo) setDateTo(next); setDatePreset("custom"); }} /></label>
          <label><span>DATA FINAL</span><input type="date" value={dateTo} min={dateFrom} onChange={e => { setDateTo(e.target.value); setDatePreset("custom"); }} /></label>
          <label><span>ETAPA</span><select value={stageFilter} onChange={e => setStageFilter(e.target.value)}><option>Todas</option>{stages.map(stage => <option value={String(stage.id)} key={stage.id}>{stage.id}. {stage.title}</option>)}</select></label>
          <label><span>STATUS</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>Todos</option>{Object.keys(statusClass).map(status => <option key={status}>{status}</option>)}</select></label>
          <label><span>ORIGEM</span><select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}><option>Todas</option>{sourceOptions.map(option => <option value={option.source} key={option.source}>{option.label}</option>)}</select></label>
          <button onClick={() => { setDatePreset("today"); setDateFrom(today); setDateTo(today); setStageFilter("Todas"); setStatusFilter("Todos"); setSourceFilter("Todas"); setQuery(""); }}>Limpar filtros</button>
        </div>}
        {displayMode === "list" && <><div className="table-head"><span>OPERAÇÃO / CEDENTE</span><span>VEÍCULO</span><span>ETAPA ATUAL</span><span>VALOR</span><span>RESPONSÁVEL</span><span>RITMO</span><span /></div>
        <div className="operation-rows">{filtered.map(op => { const pace = paceFor(op); return <button className="operation-row" key={op.id} onClick={() => onOpen(op)}>
          <span className="operation-identity"><span className="proposal-line"><strong>Aditivo {op.aditivoNumber}</strong><StatusBadge status={op.status} /></span><b>{op.cedent}</b><small>Borderô {op.borderoNumber} · {op.document} · {op.titleCount} títulos</small></span>
          <span className="vehicle-cell"><Badge tone={op.institution.toLowerCase()}>{op.institution}</Badge><b>{op.vehicle}</b>{op.fundClass && <small>{op.fundClass}</small>}</span>
          <span className="stage-cell"><small>{op.stage} de 6</small><b>{stages[op.stage - 1].short}</b><span className="mini-progress"><i style={{ width: `${op.stage / 6 * 100}%` }} /></span></span>
          <span className="amount-cell"><b>{money.format(op.amount)}</b><small>{op.titleCount} recebíveis</small></span>
          <span className="owner-cell"><i>{op.ownerInitials}</i><span><b>{op.owner}</b><small>{op.nextAction}</small></span></span>
          <span className={`sla-cell pace-${pace.tone}`}><ClockIcon /><span><b>{op.waitingFor}</b><small>{pace.label}</small><em>{pace.detail}</em></span></span>
          <span className="row-arrow"><ArrowIcon /></span>
        </button>})}</div></>}
        {displayMode === "kanban" && <div className="operations-kanban">{kanbanColumns.map(column => {
          const visible = column.operations.filter(op => { const q = query.trim().toLowerCase(); return (!q || JSON.stringify(op).toLowerCase().includes(q)) && (stageFilter === "Todas" || String(op.stage) === stageFilter) && (statusFilter === "Todos" || op.status === statusFilter) && (sourceFilter === "Todas" || op.source === sourceFilter); });
          const columnValue = visible.reduce((sum, op) => sum + op.amount, 0);
          return <section className={`kanban-column ${column.tone}`} key={column.id}><header><div><span>{column.title}</span><small>{column.description}</small></div><b>{visible.length}</b><strong>{money.format(columnValue)}</strong></header><div className="kanban-stack">{visible.map(op => { const pace = paceFor(op); return <button className="kanban-card" key={op.id} onClick={() => onOpen(op)}><div className="kanban-card-top"><span>Aditivo {op.aditivoNumber}</span><StatusBadge status={op.status} /></div><strong>{op.cedent}</strong><small>Borderô {op.borderoNumber} · {op.titleCount} títulos</small><div className="kanban-card-stage"><span>{stages[op.stage - 1].short} · {op.stage}/6</span><b>{money.format(op.amount)}</b></div><div className="mini-progress"><i style={{ width: `${op.stage / 6 * 100}%` }} /></div><div className="kanban-card-action"><span><i>{op.ownerInitials}</i><b>{op.owner}</b></span><small>{op.nextAction}</small></div><div className={`kanban-card-sla pace-${pace.tone}`}><ClockIcon /><span><b>{op.waitingFor}</b><small>{pace.label}</small></span></div></button>})}{visible.length === 0 && <div className="kanban-empty"><span>Nenhuma operação</span><small>Nesta fila e com os filtros atuais</small></div>}</div></section>;
        })}</div>}
        {displayMode === "list" && filtered.length === 0 && <div className="empty-state"><SearchIcon /><strong>Nenhuma operação encontrada</strong><span>Ajuste os filtros para ver outros resultados.</span></div>}
        <div className="list-footer"><span>{displayMode === "kanban" ? `${activeOperations.length} operações distribuídas no fluxo` : `Mostrando ${filtered.length} de ${scopedOperations.length} operações no período`}</span><button onClick={onReset}>Restaurar dados de demonstração</button><span>{datePreset === "today" ? "Hoje" : datePreset === "all" ? "Todo o histórico" : "Período personalizado"} · atualizado agora</span></div>
      </section>
    </div>
  </Shell>;
}

function StepState({ id, current }: { id: number; current: number }) {
  if (id < current) return <span className="step-state done"><CheckIcon /></span>;
  if (id === current) return <span className="step-state current">{id}</span>;
  return <span className="step-state">{id}</span>;
}

function ManualEntryPanel({ operation, debtors, onRegisterDebtor, onSave }: { operation: Operation; debtors: Debtor[]; onRegisterDebtor: (debtor: Debtor) => void; onSave: (data: ManualEntryData) => void }) {
  const normalizeDocument = (value: string) => value.replace(/\D/g, "");
  const formatTaxId = (value: string) => { const digits = normalizeDocument(value).slice(0, 14); if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2"); };
  const formatZip = (value: string) => normalizeDocument(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  const formatPhone = (value: string) => { const digits = normalizeDocument(value).slice(0, 11); return digits.length > 10 ? digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3"); };
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  const parseCurrency = (value: string) => Number(value.replace(/\D/g, "")) / 100;
  const legacyType = operation.manualEntry?.receivableType as string | undefined;
  const storedType: ManualEntryData["receivableType"] | undefined = legacyType === "Duplicata / nota fiscal" || legacyType === "Pedido" ? "Duplicata" : legacyType === "Desconto Trustee/Garantia" ? "Garantia" : operation.manualEntry?.receivableType;
  const [receivableType, setReceivableType] = useState<ManualEntryData["receivableType"] | "">(storedType ?? "");
  const [entries, setEntries] = useState(operation.manualEntry?.entries ?? []);
  const initialDebtor = operation.manualEntry?.entries[0] ? debtors.find(debtor => debtor.id === operation.manualEntry?.entries[0].debtorId) ?? null : null;
  const [debtorQuery, setDebtorQuery] = useState(formatTaxId(initialDebtor?.document ?? ""));
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(initialDebtor);
  const [debtorSearched, setDebtorSearched] = useState(Boolean(initialDebtor));
  const [showDebtorForm, setShowDebtorForm] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(!operation.manualEntry?.entries.length);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const emptyEntry = { id: `manual-${Date.now()}`, documentNumber: "", amount: 0, dueDate: "", debtorId: "", debtorName: "", debtorDocument: "", discount: 0, issueDate: "", nfeKey: "", ourNumber: "", cfop: "", observation: "", cmc7: "", bank: "", agency: "", account: "", compensation: "", country: "Brasil", state: "", city: "" };
  const [draft, setDraft] = useState(emptyEntry);
  const [debtorDraft, setDebtorDraft] = useState({ document: "", name: "", tradeName: "", address: "", number: "", district: "", city: "", state: "", zipCode: "", email: "", phone: "" });
  const hasSavedEntries = entries.length > 0;
  const debtorFormValid = [debtorDraft.document, debtorDraft.name, debtorDraft.address, debtorDraft.number, debtorDraft.district, debtorDraft.city, debtorDraft.state, debtorDraft.zipCode].every(value => value.trim()) && (!requireEmail || Boolean(debtorDraft.email.trim())) && (!requirePhone || Boolean(debtorDraft.phone.trim()));
  const setField = (field: keyof typeof draft, value: string | number) => setDraft(current => ({ ...current, [field]: value }));

  function searchDebtor() {
    const found = debtors.find(debtor => normalizeDocument(debtor.document) === normalizeDocument(debtorQuery)) ?? null;
    setSelectedDebtor(found); setDebtorSearched(true); setShowDebtorForm(false);
    if (!found) setDebtorDraft(current => ({ ...current, document: debtorQuery }));
  }
  function registerDebtor() {
    if (!debtorFormValid) return;
    const debtor: Debtor = { id: `sacado-${Date.now()}`, ...debtorDraft, source: "Cadastro manual" };
    onRegisterDebtor(debtor); setSelectedDebtor(debtor); setDebtorQuery(formatTaxId(debtor.document)); setShowDebtorForm(false);
  }
  function chooseType(type: ManualEntryData["receivableType"]) {
    if (hasSavedEntries && type !== receivableType) return;
    setReceivableType(type); setDraft({ ...emptyEntry, id: `manual-${Date.now()}` }); setEditorOpen(true);
  }
  function completeDraft() {
    if (!selectedDebtor) return null;
    const document = receivableType === "Cheque" ? draft.documentNumber || draft.cmc7 : draft.documentNumber;
    if (!document.trim() || draft.amount <= 0 || !draft.dueDate) return null;
    return { ...draft, documentNumber: document, debtorId: selectedDebtor.id, debtorName: selectedDebtor.name, debtorDocument: selectedDebtor.document };
  }
  function saveSingle() {
    const completed = completeDraft(); if (!completed || !receivableType) return;
    const next = editingId ? entries.map(entry => entry.id === editingId ? { ...completed, id: editingId } : entry) : [...entries, completed];
    setEntries(next); onSave({ receivableType, mode: "individual", entries: next });
    if (editingId) setEditorOpen(false);
    setEditingId(null);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}`, issueDate: draft.issueDate, dueDate: draft.dueDate });
  }
  function generateInstallments() {
    const completed = completeDraft(); if (!completed || !receivableType || installments < 2) return;
    const totalCents = Math.round(completed.amount * 100); const base = Math.floor(totalCents / installments);
    const generated = Array.from({ length: installments }, (_, index) => { const date = new Date(`${completed.dueDate}T12:00:00`); date.setMonth(date.getMonth() + index); return { ...completed, id: `manual-${Date.now()}-${index}`, documentNumber: `${completed.documentNumber}/${String(index + 1).padStart(3, "0")}`, amount: (index === installments - 1 ? totalCents - base * (installments - 1) : base) / 100, dueDate: date.toISOString().slice(0, 10) }; });
    const next = [...entries, ...generated]; setEntries(next); onSave({ receivableType, mode: "parcelado", entries: next });
  }
  function copyPrevious() {
    const previous = entries[entries.length - 1]; if (!previous) return;
    setDraft({ ...previous, id: `manual-${Date.now()}` }); setEditingId(null); setSelectedDebtor(debtors.find(debtor => debtor.id === previous.debtorId) ?? selectedDebtor); setDebtorQuery(formatTaxId(previous.debtorDocument)); setEditorOpen(true);
  }
  function editEntry(entry: ManualEntryData["entries"][number]) {
    setDraft(entry); setEditingId(entry.id); setSelectedDebtor(debtors.find(debtor => debtor.id === entry.debtorId) ?? null); setDebtorQuery(formatTaxId(entry.debtorDocument)); setDebtorSearched(true); setEditorOpen(true);
  }
  function deleteEntry(id: string) {
    if (!receivableType) return;
    const next = entries.filter(entry => entry.id !== id); setEntries(next); onSave({ receivableType, mode: operation.manualEntry?.mode ?? "individual", entries: next });
    if (editingId === id) { setEditingId(null); setDraft({ ...emptyEntry, id: `manual-${Date.now()}` }); }
  }
  function deleteAllEntries() {
    if (!receivableType) return;
    setEntries([]);
    onSave({ receivableType, mode: operation.manualEntry?.mode ?? "individual", entries: [] });
    setEditingId(null);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}` });
    setSelectedDebtor(null);
    setDebtorQuery("");
    setDebtorSearched(false);
    setInstallments(1);
    setEditorOpen(true);
    setShowDeleteAll(false);
  }

  const field = (label: string, key: keyof typeof draft, type = "text", className = "") => {
    const isCurrency = key === "amount" || key === "discount";
    const numericLimits: Partial<Record<keyof typeof draft, number>> = { cmc7: 30, bank: 3, agency: 5, account: 14, compensation: 3, nfeKey: 44 };
    const numericLimit = numericLimits[key];
    const value = isCurrency ? formatCurrency(Number(draft[key])) : String(draft[key] ?? "");
    return <label className={className}><span>{label}</span><input type={isCurrency ? "text" : type} inputMode={isCurrency ? "decimal" : numericLimit ? "numeric" : undefined} maxLength={numericLimit} value={value} onChange={event => setField(key, isCurrency ? parseCurrency(event.target.value) : numericLimit ? event.target.value.replace(/\D/g, "").slice(0, numericLimit) : event.target.value)} /></label>;
  };
  const types: { value: ManualEntryData["receivableType"]; label: string }[] = [{ value: "Duplicata", label: "Duplicatas" }, { value: "Cheque", label: "Cheques" }, { value: "Nota promissória", label: "Promissórias" }, { value: "Transferibilidade", label: "Transferibilidade" }, { value: "Garantia", label: "Garantia" }];

  return <div className="manual-entry-card compact-entry">
    <div className="manual-tabs">{types.map(type => <button key={type.value} className={receivableType === type.value ? "active" : ""} disabled={hasSavedEntries && receivableType !== type.value} onClick={() => chooseType(type.value)}>{type.label}</button>)}</div>
    {!receivableType ? <div className="compact-empty"><strong>Escolha o tipo do recebível para iniciar.</strong><span>O tipo será exclusivo desta operação; cheques nunca serão misturados com papel.</span></div> : <div className="entry-sheet">
      <div className={`entry-editor-bar ${editorOpen ? "open" : ""}`}><div><span>{editingId ? "EDITANDO TÍTULO" : "DIGITAÇÃO"}</span><strong>{editingId ? `Documento ${draft.documentNumber || "sem número"}` : editorOpen ? "Novo título" : "Formulário recolhido"}</strong><small>{editorOpen ? "Todos os dados do título ficam disponíveis abaixo." : "Abra quando precisar incluir ou alterar um título."}</small></div><button onClick={() => setEditorOpen(open => !open)}>{editorOpen ? "Fechar formulário" : editingId ? "Continuar edição" : "+ Novo título"}</button></div>

      {editorOpen && <div className="entry-editor-body">
        <div className="sacado-line"><span>Sacado *</span><div className="debtor-search-control"><input aria-label="CPF ou CNPJ do sacado" value={debtorQuery} onChange={event => { setDebtorQuery(formatTaxId(event.target.value)); setSelectedDebtor(null); setDebtorSearched(false); }} placeholder="CPF ou CNPJ" /><button className="lookup-button" onClick={searchDebtor}><SearchIcon /></button></div>{selectedDebtor ? <div className="debtor-selection-card"><CheckIcon /><div><strong>{selectedDebtor.name}</strong><small>{formatTaxId(selectedDebtor.document)}</small></div></div> : <span className="debtor-inline-empty">Localize o sacado</span>}<button className="inline-new" onClick={() => { setDebtorDraft(current => ({ ...current, document: debtorQuery })); setShowDebtorForm(true); }}>+ Cadastrar sacado</button></div>
        {debtorSearched && !selectedDebtor && <div className="inline-debtor-result missing"><AlertIcon /><span>Sacado não existente.</span><button onClick={() => setShowDebtorForm(true)}>Cadastrar agora</button></div>}
        {showDebtorForm && <div className="debtor-form compact-register"><div className="debtor-form-head"><div><strong>Novo sacado</strong><small>Dados da pessoa/empresa e endereço são obrigatórios.</small></div><div className="contact-policy"><label><input type="checkbox" checked={requireEmail} onChange={event => setRequireEmail(event.target.checked)} /> Exigir e-mail</label><label><input type="checkbox" checked={requirePhone} onChange={event => setRequirePhone(event.target.checked)} /> Exigir telefone</label></div></div><div className="debtor-form-grid">
          <label><span>CPF / CNPJ *</span><input value={debtorDraft.document} onChange={event => setDebtorDraft({ ...debtorDraft, document: formatTaxId(event.target.value) })} /></label><label className="wide"><span>NOME / RAZÃO SOCIAL *</span><input value={debtorDraft.name} onChange={event => setDebtorDraft({ ...debtorDraft, name: event.target.value })} /></label><label><span>NOME FANTASIA</span><input value={debtorDraft.tradeName} onChange={event => setDebtorDraft({ ...debtorDraft, tradeName: event.target.value })} /></label><label className="wide"><span>ENDEREÇO *</span><input value={debtorDraft.address} onChange={event => setDebtorDraft({ ...debtorDraft, address: event.target.value })} /></label><label><span>NÚMERO *</span><input value={debtorDraft.number} onChange={event => setDebtorDraft({ ...debtorDraft, number: event.target.value })} /></label><label><span>BAIRRO *</span><input value={debtorDraft.district} onChange={event => setDebtorDraft({ ...debtorDraft, district: event.target.value })} /></label><label><span>CIDADE *</span><input value={debtorDraft.city} onChange={event => setDebtorDraft({ ...debtorDraft, city: event.target.value })} /></label><label><span>UF *</span><input maxLength={2} value={debtorDraft.state} onChange={event => setDebtorDraft({ ...debtorDraft, state: event.target.value.toUpperCase() })} /></label><label><span>CEP *</span><input value={debtorDraft.zipCode} onChange={event => setDebtorDraft({ ...debtorDraft, zipCode: formatZip(event.target.value) })} /></label><label><span>E-MAIL {requireEmail ? "*" : ""}</span><input type="email" value={debtorDraft.email} onChange={event => setDebtorDraft({ ...debtorDraft, email: event.target.value })} /></label><label><span>TELEFONE {requirePhone ? "*" : ""}</span><input value={debtorDraft.phone} onChange={event => setDebtorDraft({ ...debtorDraft, phone: formatPhone(event.target.value) })} /></label>
        </div><div className="debtor-form-actions"><button onClick={() => setShowDebtorForm(false)}>Fechar</button><button className="primary-action" disabled={!debtorFormValid} onClick={registerDebtor}>Salvar e usar</button></div></div>}

        <div className={`compact-document-fields ${receivableType === "Cheque" ? "cheque" : ""}`}>
          {receivableType === "Cheque" && <>{field("CMC7", "cmc7", "text", "span-2")}{field("Banco", "bank")}{field("Agência", "agency")}{field("Conta", "account")}{field("Comp.", "compensation")}{field("Nº cheque", "documentNumber")}{field("Valor cheque", "amount", "number")}{field("Data emissão", "issueDate", "date")}{field("Bom para", "dueDate", "date")}{field("País", "country")}{field("UF", "state")}{field("Localidade", "city")}{field("Observação", "observation", "text", "span-2")}</>}
          {receivableType !== "Cheque" && <>{field("Documento", "documentNumber")}{field("Valor de face", "amount")}{field("Valor desconto", "discount")}{field("Data de emissão", "issueDate", "date")}{field("Data de vencimento", "dueDate", "date")}{field("Nosso número", "ourNumber")}{receivableType === "Duplicata" && field("Chave NF-e", "nfeKey", "text", "span-2")}{receivableType === "Duplicata" && field("CFOPs", "cfop")}{field("Observação", "observation", "text", "span-2")}</>}
        </div>
        <div className="compact-entry-actions">{editingId && <button className="secondary-action" onClick={() => { setEditingId(null); setDraft({ ...emptyEntry, id: `manual-${Date.now()}` }); }}>Cancelar edição</button>}<button className="secondary-action" disabled={!entries.length} onClick={copyPrevious}>Copiar anterior</button>{receivableType !== "Cheque" && <label><span>Parcelas</span><input type="number" min="1" max="120" value={installments} onChange={event => setInstallments(Number(event.target.value))} /></label>}{receivableType !== "Cheque" && installments > 1 && <button className="secondary-action" onClick={generateInstallments}>Gerar {installments} parcelas</button>}<button className="primary-action" disabled={!selectedDebtor} onClick={saveSingle}>{editingId ? "Salvar alteração" : "Adicionar título"}</button></div>
      </div>}

      {entries.length > 0 && <div className="compact-saved-list"><div className="saved-list-summary"><div><strong>{entries.length} títulos digitados</strong><small>{editorOpen ? "Formulário aberto" : "Visualização da carteira digitada"}</small></div><div className="saved-list-summary-actions"><span>{preciseMoney.format(entries.reduce((sum, entry) => sum + entry.amount, 0))}</span><button onClick={() => setShowDeleteAll(true)}>Excluir todos</button></div></div><div className="saved-list-scroll">{receivableType === "Cheque" ? <><div className="saved-list-head cheque-grid"><span>CHEQUE / CMC7</span><span>SACADO / DOCUMENTO</span><span>VALOR</span><span>BANCO / AGÊNCIA</span><span>CONTA / COMP.</span><span>EMISSÃO</span><span>BOM PARA</span><span>PRAÇA</span><span>OBSERVAÇÃO</span><span>AÇÕES</span></div>{entries.map(entry => <p className={`cheque-grid ${editingId === entry.id ? "editing" : ""}`} key={entry.id}><span><b>{entry.documentNumber}</b><small>{entry.cmc7 || "CMC7 não informado"}</small></span><span><b>{entry.debtorName || "Sacado pendente"}</b><small>{formatTaxId(entry.debtorDocument)}</small></span><b>{preciseMoney.format(entry.amount)}</b><span><b>{entry.bank || "—"}</b><small>Ag. {entry.agency || "—"}</small></span><span><b>{entry.account || "—"}</b><small>Comp. {entry.compensation || "—"}</small></span><span>{entry.issueDate || "—"}</span><span>{entry.dueDate || "—"}</span><span>{[entry.city, entry.state].filter(Boolean).join(" / ") || "—"}</span><span title={entry.observation}>{entry.observation || "—"}</span><span className="title-row-actions"><button onClick={() => editEntry(entry)}>Editar</button><button onClick={() => deleteEntry(entry.id)}>Excluir</button></span></p>)}</> : <><div className="saved-list-head paper-grid"><span>DOCUMENTO</span><span>SACADO / CPF-CNPJ</span><span>VALOR</span><span>DESCONTO</span><span>EMISSÃO</span><span>VENCIMENTO</span><span>NOSSO Nº</span><span>NF-e / CFOP</span><span>OBSERVAÇÃO</span><span>AÇÕES</span></div>{entries.map(entry => <p className={`paper-grid ${editingId === entry.id ? "editing" : ""}`} key={entry.id}><span><b>{entry.documentNumber}</b></span><span><b>{entry.debtorName || "Sacado pendente"}</b><small>{formatTaxId(entry.debtorDocument)}</small></span><b>{preciseMoney.format(entry.amount)}</b><span>{preciseMoney.format(entry.discount || 0)}</span><span>{entry.issueDate || "—"}</span><span>{entry.dueDate || "—"}</span><span>{entry.ourNumber || "—"}</span><span><b>{entry.nfeKey || "—"}</b><small>{entry.cfop ? `CFOP ${entry.cfop}` : "CFOP não informado"}</small></span><span title={entry.observation}>{entry.observation || "—"}</span><span className="title-row-actions"><button onClick={() => editEntry(entry)}>Editar</button><button onClick={() => deleteEntry(entry.id)}>Excluir</button></span></p>)}</>}</div></div>}
    </div>}
    {showDeleteAll && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setShowDeleteAll(false)}><section className="cancel-modal delete-titles-modal" role="dialog" aria-modal="true" aria-label="Excluir todos os títulos"><div className="modal-head"><div><Badge tone="cancelled">AÇÃO IRREVERSÍVEL</Badge><h2>Excluir todos os títulos?</h2><p>Os títulos serão retirados deste aditivo e os valores da operação serão recalculados.</p></div><button onClick={() => setShowDeleteAll(false)}><CloseIcon /></button></div><div className="delete-titles-summary"><AlertIcon /><div><strong>{entries.length} títulos serão excluídos</strong><span>Total atual: {preciseMoney.format(entries.reduce((sum, entry) => sum + entry.amount, 0))}</span><small>O cadastro dos sacados não será apagado.</small></div></div><div className="modal-actions"><button className="secondary-action" onClick={() => setShowDeleteAll(false)}>Voltar</button><button className="danger-action" onClick={deleteAllEntries}>Confirmar exclusão</button></div></section></div>}
  </div>;
}

function EntryRecordPanel({ operation }: { operation: Operation }) {
  const entries = operation.manualEntry?.entries ?? [];
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const discounts = entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
  const debtors = new Set(entries.map(entry => entry.debtorId || entry.debtorDocument || entry.debtorName).filter(Boolean));
  const withEvidence = entries.filter(entry => entry.nfeKey || entry.cmc7).length;
  const issueDates = entries.map(entry => entry.issueDate).filter(Boolean).sort();
  const dueDates = entries.map(entry => entry.dueDate).filter(Boolean).sort();

  return <section className="entry-record">
    <div className="entry-record-head"><div><Badge tone="ready"><CheckIcon /> REGISTRO PRESERVADO</Badge><h3>Dados recebidos na Entrada</h3><p>A carteira original permanece vinculada ao aditivo e alimenta Risco, Lastro e Preço. Esta visualização não altera os dados concluídos.</p></div><div><span>ORIGEM</span><strong>{operation.source ?? "Não informada"}</strong><small>{operation.operationType ?? operation.manualEntry?.receivableType ?? "Tipo não definido"}</small></div></div>
    <div className="entry-record-kpis"><div><span>TÍTULOS</span><strong>{entries.length}</strong><small>{debtors.size} sacado(s)</small></div><div><span>VALOR DE FACE</span><strong>{preciseMoney.format(total)}</strong><small>Desconto informado: {preciseMoney.format(discounts)}</small></div><div><span>EVIDÊNCIAS NA ORIGEM</span><strong>{withEvidence}/{entries.length}</strong><small>Chave NF-e ou CMC7</small></div><div><span>PERÍODO DA CARTEIRA</span><strong>{dueDates.length ? formatBrazilianDate(dueDates[0]) : "—"}</strong><small>até {dueDates.length ? formatBrazilianDate(dueDates[dueDates.length - 1]) : "—"}</small></div></div>
    <div className="entry-record-context"><div><span>CEDENTE</span><strong>{operation.cedent}</strong><small>{operation.document}</small></div><div><span>VEÍCULO</span><strong>{operation.vehicle}</strong><small>{operation.institution}{operation.fundClass ? ` · ${operation.fundClass}` : ""}</small></div><div><span>ENTRADA DA OPERAÇÃO</span><strong>{operation.enteredAt}</strong><small>{issueDates.length ? `Emissões a partir de ${formatBrazilianDate(issueDates[0])}` : "Data de emissão não informada"}</small></div></div>
    {entries.length ? <div className="entry-record-scroll"><div className="entry-record-grid entry-record-grid-head"><span>DOCUMENTO</span><span>SACADO / CPF-CNPJ</span><span>EMISSÃO</span><span>VENCIMENTO</span><span>VALOR DE FACE</span><span>DESCONTO</span><span>LASTRO DE ORIGEM</span><span>REFERÊNCIAS</span><span>OBSERVAÇÃO</span></div>{entries.map(entry => <div className="entry-record-grid entry-record-row" key={entry.id}><span><strong>{entry.documentNumber}</strong><small>{operation.manualEntry?.receivableType}</small></span><span><strong>{entry.debtorName || "Sacado não identificado"}</strong><small>{entry.debtorDocument || "Documento não informado"}</small></span><span>{formatBrazilianDate(entry.issueDate)}</span><span><strong>{formatBrazilianDate(entry.dueDate)}</strong></span><strong>{preciseMoney.format(entry.amount)}</strong><span>{preciseMoney.format(entry.discount ?? 0)}</span><span><strong>{entry.nfeKey ? `NF-e ${entry.nfeKey}` : entry.cmc7 ? `CMC7 ${entry.cmc7}` : "Não informado"}</strong><small>{entry.cfop ? `CFOP ${entry.cfop}` : entry.bank ? `Banco ${entry.bank} · Ag. ${entry.agency || "—"}` : "Sem complemento"}</small></span><span><strong>{entry.ourNumber || entry.account || "—"}</strong><small>{entry.compensation ? `Comp. ${entry.compensation}` : entry.city ? `${entry.city}/${entry.state}` : "—"}</small></span><span title={entry.observation}>{entry.observation || "—"}</span></div>)}</div> : <div className="entry-record-empty"><AlertIcon /><strong>Nenhum título registrado na Entrada</strong><span>A operação não poderá avançar sem recuperar ou incluir a carteira de origem.</span></div>}
  </section>;
}

type CedentDebtorRanking = { name: string; document: string; exposure: number; share: number; score: number; confirmation: number };
type CedentRecentOperation = { aditivo: string; date: string; amount: number; titles: number; confirmation: number; status: string };

function CedentPortfolioOverview({ cedent }: { cedent?: Cedent }) {
  const [selectedHistoricOperation, setSelectedHistoricOperation] = useState<CedentRecentOperation | null>(null);
  const [selectedRankedDebtor, setSelectedRankedDebtor] = useState<CedentDebtorRanking | null>(null);
  if (!cedent) return <div className="risk-empty"><AlertIcon /><strong>Cadastro do cedente não localizado</strong><span>Vincule o cedente para consultar sua posição na carteira.</span></div>;
  const utilization = cedent.creditLimit > 0 ? cedent.usedLimit / cedent.creditLimit * 100 : 0;
  const available = Math.max(0, cedent.creditLimit - cedent.usedLimit);
  const metrics = cedent.portfolioMetrics;
  const onTime = metrics?.settledOnTime ?? { count: Math.max(0, cedent.settlements - cedent.lateSettlements), amount: 0 };
  const late = metrics?.settledLate ?? { count: cedent.lateSettlements, amount: 0 };
  const repurchased = metrics?.repurchased ?? { count: cedent.repurchases, amount: 0 };
  const protested = metrics?.protested ?? { count: 0, amount: 0 };
  const openDue = metrics?.openDue ?? { count: cedent.portfolioReceivable > 0 ? 1 : 0, amount: Math.max(0, cedent.portfolioReceivable - cedent.portfolioOverdue) };
  const openOverdue = metrics?.openOverdue ?? { count: cedent.portfolioOverdue > 0 ? 1 : 0, amount: cedent.portfolioOverdue };
  const openExtended = metrics?.openExtended ?? { count: 0, amount: 0 };
  const openNegotiation = metrics?.openNegotiation ?? { count: 0, amount: 0 };
  const portfolioRows = [{ label: "A vencer", value: openDue, tone: "neutral" }, { label: "Vencidos", value: openOverdue, tone: openOverdue.count ? "negative" : "positive" }, { label: "Prorrogados", value: openExtended, tone: openExtended.count ? "attention" : "neutral" }, { label: "Em negociação", value: openNegotiation, tone: openNegotiation.count ? "attention" : "neutral" }];
  const behaviorRows = [{ label: "Liquidados no prazo", value: onTime, tone: "positive" }, { label: "Liquidados com atraso", value: late, tone: late.count ? "attention" : "neutral" }, { label: "Recomprados", value: repurchased, tone: repurchased.count ? "negative" : "neutral" }, { label: "Protestados", value: protested, tone: protested.count ? "negative" : "neutral" }];
  const healthyProfile = cedent.score >= 700;
  const criticalProfile = cedent.score < 600;
  const confirmationRate = criticalProfile ? 78.4 : healthyProfile ? 96.8 : 89.6;
  const repurchaseRate = cedent.settlements ? cedent.repurchases / cedent.settlements * 100 : 0;
  const frequencyDays = criticalProfile ? 14 : healthyProfile ? 7 : 11;
  const frequencyLabel = frequencyDays <= 8 ? "Semanal" : frequencyDays <= 16 ? "Quinzenal" : "Mensal";
  const names = cedent.id === "ced-1"
    ? ["L.V. Carvalho Gutierrez Ltda", "Carlos Marco Distribuidora Ltda", "Supermercado Haag Ltda", "Rede Sul Atacadista S.A.", "Comercial Oeste Paraná", "Mercado Boa Compra Ltda", "Distribuidora São Lucas", "Supermercado Village Paulista", "Alimentos Rota Norte", "Comercial Nova Safra"]
    : cedent.id === "ced-6"
      ? ["Hospital Vida Plena S.A.", "Clínica Santa Aurora Ltda", "Laboratório Diagnosul", "Instituto Médico Central", "Hospital São Rafael", "Clínica Bem Estar", "Centro Diagnóstico Paraná", "Hospital Nossa Senhora", "Medservice Assistência", "Clínica Integrada Oeste"]
      : ["Rede Alfa Comercial", "Distribuidora Horizonte", "Grupo Mercantil Sul", "Comercial Primavera", "Atacado Nova Era", "Rede Central de Compras", "Mercantil União", "Distribuidora Nacional", "Comercial Santa Fé", "Rede Bom Negócio"];
  const shares = [18.4, 14.8, 12.2, 10.6, 9.1, 8.2, 7.4, 6.8, 5.7, 4.3];
  const topDebtors: CedentDebtorRanking[] = names.map((name, index) => {
    const score = Math.max(420, Math.min(880, cedent.score + 70 - index * 23 + (index % 2 ? -14 : 18)));
    return { name, document: `${String(11 + index).padStart(2, "0")}.***.***/0001-${String(18 + index).padStart(2, "0")}`, exposure: cedent.portfolioReceivable * shares[index] / 100, share: shares[index], score, confirmation: Math.max(61, Math.min(99.5, confirmationRate + 2.4 - index * 1.35)) };
  });
  const currentOperation = initialOperations.find(item => item.document.replace(/\D/g, "") === cedent.document.replace(/\D/g, ""));
  const dates = criticalProfile ? ["25/09/2026", "10/09/2026", "27/08/2026", "12/08/2026", "30/07/2026"] : healthyProfile ? ["25/09/2026", "18/09/2026", "11/09/2026", "04/09/2026", "28/08/2026"] : ["25/09/2026", "15/09/2026", "03/09/2026", "22/08/2026", "09/08/2026"];
  const recentOperations: CedentRecentOperation[] = dates.map((date, index) => ({
    aditivo: index === 0 && currentOperation ? currentOperation.aditivoNumber : `2026${String(9 - Math.floor(index / 3)).padStart(2, "0")}${String(24 - index * 3).padStart(2, "0")}${String(index + 1).padStart(3, "0")}`,
    date,
    amount: index === 0 && currentOperation ? currentOperation.amount : cedent.portfolioReceivable * (.19 - index * .018),
    titles: index === 0 && currentOperation ? currentOperation.titleCount : Math.max(4, Math.round(openDue.count * (.24 - index * .025))),
    confirmation: Math.max(60, confirmationRate + (index === 0 ? -1.2 : 2.6 - index * .7)),
    status: index === 0 && currentOperation ? currentOperation.status : index === 1 ? "Liquidada" : index === 2 && criticalProfile ? "Liquidada com ressalva" : "Liquidada",
  }));
  const positiveDebtors = topDebtors.filter(item => item.score >= 700).length;
  const attentionDebtors = topDebtors.filter(item => item.score >= 600 && item.score < 700).length;
  const criticalDebtors = topDebtors.length - positiveDebtors - attentionDebtors;

  return <div className="cedent-overview">
    <div className="cedent-overview-kpis"><div><span>SCORE INTERNO</span><strong className={criticalProfile ? "negative" : healthyProfile ? "positive" : "warning-text"}>{cedent.score}</strong><small>{cedent.publicStatus}</small></div><div><span>LIMITE APROVADO</span><strong>{preciseMoney.format(cedent.creditLimit)}</strong><small>Política vigente do cedente</small></div><div><span>LIMITE UTILIZADO</span><strong>{preciseMoney.format(cedent.usedLimit)}</strong><small>{utilization.toFixed(1).replace(".", ",")}% comprometido</small></div><div><span>DISPONÍVEL</span><strong className={available > 0 ? "positive" : "negative"}>{preciseMoney.format(available)}</strong><small>Antes da nova operação</small></div></div>
    <div className="cedent-utilization"><div><span>UTILIZAÇÃO DO LIMITE</span><strong>{utilization.toFixed(1).replace(".", ",")}%</strong></div><div className="cedent-utilization-track"><i className={utilization >= 80 ? "danger" : utilization >= 65 ? "attention" : "healthy"} style={{ width: `${Math.min(100, utilization)}%` }} /></div><small>{preciseMoney.format(cedent.usedLimit)} utilizados de {preciseMoney.format(cedent.creditLimit)}</small></div>
    <div className="cedent-relationship-kpis">
      <div><span>PERIODICIDADE</span><strong>{frequencyLabel}</strong><small>Uma operação a cada {frequencyDays} dias</small></div>
      <div><span>ÍNDICE DE CONFIRMAÇÃO</span><strong className={confirmationRate >= 90 ? "positive" : confirmationRate >= 80 ? "warning-text" : "negative"}>{confirmationRate.toFixed(1).replace(".", ",")}%</strong><small>Confirmações positivas sobre a amostra</small></div>
      <div><span>QUALIDADE DOS SACADOS</span><strong>{positiveDebtors * 10}% positiva</strong><small>{positiveDebtors} positivos · {attentionDebtors} atenção · {criticalDebtors} críticos</small></div>
      <div><span>ÍNDICE DE RECOMPRA</span><strong className={repurchaseRate > 3 ? "negative" : repurchaseRate > 1 ? "warning-text" : "positive"}>{repurchaseRate.toFixed(1).replace(".", ",")}%</strong><small>{cedent.repurchases} recompras · {preciseMoney.format(repurchased.amount)}</small></div>
    </div>
    <div className="cedent-overview-columns"><section><div className="cedent-section-title"><span>POSIÇÃO NA CARTEIRA</span><small>Exposição anterior no ambiente</small></div><div className="cedent-ledger-head"><span>Situação</span><span>Qtd.</span><span>Valor</span></div>{portfolioRows.map(row => <div className={`cedent-ledger-row ${row.tone}`} key={row.label}><span>{row.label}</span><b>{row.value.count}</b><strong>{preciseMoney.format(row.value.amount)}</strong></div>)}<div className="cedent-ledger-total"><span>Total em aberto</span><b>{openDue.count + openOverdue.count}</b><strong>{preciseMoney.format(cedent.portfolioReceivable)}</strong></div><div className="cedent-highlight-row"><span>Maior concentração por sacado</span><strong>{(metrics?.concentrationPercent ?? 0).toFixed(1).replace(".", ",")}%</strong></div></section><section><div className="cedent-section-title"><span>COMPORTAMENTO HISTÓRICO</span><small>Liquidações e eventos de risco</small></div><div className="cedent-ledger-head"><span>Situação</span><span>Qtd.</span><span>Valor</span></div>{behaviorRows.map(row => <div className={`cedent-ledger-row ${row.tone}`} key={row.label}><span>{row.label}</span><b>{row.value.count}</b><strong>{preciseMoney.format(row.value.amount)}</strong></div>)}<div className="cedent-ledger-total"><span>Total de liquidações</span><b>{cedent.settlements}</b><strong>{preciseMoney.format(onTime.amount + late.amount)}</strong></div><div className="cedent-highlight-row"><span>Atraso médio histórico</span><strong className={cedent.averageDelayDays > 7 ? "negative" : "positive"}>{cedent.averageDelayDays} dias</strong></div></section></div>
    <section className="cedent-history-section"><div className="cedent-section-title"><span>ÚLTIMAS 5 OPERAÇÕES</span><small>Clique em uma operação para abrir os detalhes</small></div><div className="cedent-history-head"><span>ADITIVO</span><span>DATA</span><span>VALOR</span><span>TÍTULOS</span><span>CONFIRMAÇÃO</span><span>STATUS</span></div>{recentOperations.map(item => <button className={`cedent-history-row ${selectedHistoricOperation?.aditivo === item.aditivo ? "selected" : ""}`} key={item.aditivo} onClick={() => setSelectedHistoricOperation(current => current?.aditivo === item.aditivo ? null : item)}><strong>{item.aditivo}</strong><span>{item.date}</span><b>{preciseMoney.format(item.amount)}</b><span>{item.titles}</span><span className={item.confirmation >= 90 ? "positive" : item.confirmation >= 80 ? "warning-text" : "negative"}>{item.confirmation.toFixed(1).replace(".", ",")}%</span><em>{item.status}</em></button>)}{selectedHistoricOperation && <div className="cedent-selection-detail"><div><span>OPERAÇÃO SELECIONADA</span><strong>Aditivo {selectedHistoricOperation.aditivo}</strong><small>{selectedHistoricOperation.date} · {selectedHistoricOperation.status}</small></div><div><span>VOLUME</span><strong>{preciseMoney.format(selectedHistoricOperation.amount)}</strong><small>{selectedHistoricOperation.titles} títulos processados</small></div><div><span>CONFIRMAÇÃO</span><strong className={selectedHistoricOperation.confirmation >= 90 ? "positive" : "warning-text"}>{selectedHistoricOperation.confirmation.toFixed(1).replace(".", ",")}%</strong><small>Amostra confirmada na operação</small></div></div>}</section>
    <section className="cedent-ranking-section"><div className="cedent-section-title"><span>TOP 10 SACADOS</span><small>Clique em um sacado para abrir os detalhes</small></div><div className="cedent-ranking-head"><span>#</span><span>SACADO</span><span>EXPOSIÇÃO</span><span>CONCENTRAÇÃO</span><span>SCORE</span><span>CONFIRMAÇÃO</span></div>{topDebtors.map((item, index) => <button className={`cedent-ranking-row ${selectedRankedDebtor?.name === item.name ? "selected" : ""}`} key={item.name} onClick={() => setSelectedRankedDebtor(current => current?.name === item.name ? null : item)}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.document}</small></span><strong>{preciseMoney.format(item.exposure)}</strong><span><i style={{ width: `${Math.min(100, item.share * 3.2)}%` }} />{item.share.toFixed(1).replace(".", ",")}%</span><em className={item.score >= 700 ? "good" : item.score >= 600 ? "watch" : "bad"}>{item.score}</em><strong className={item.confirmation >= 90 ? "positive" : item.confirmation >= 80 ? "warning-text" : "negative"}>{item.confirmation.toFixed(1).replace(".", ",")}%</strong></button>)}{selectedRankedDebtor && <div className="cedent-selection-detail debtor-detail"><div><span>SACADO SELECIONADO</span><strong>{selectedRankedDebtor.name}</strong><small>{selectedRankedDebtor.document}</small></div><div><span>EXPOSIÇÃO / CONCENTRAÇÃO</span><strong>{preciseMoney.format(selectedRankedDebtor.exposure)}</strong><small>{selectedRankedDebtor.share.toFixed(1).replace(".", ",")}% da carteira do cedente</small></div><div><span>SCORE / CONFIRMAÇÃO</span><strong>{selectedRankedDebtor.score} · {selectedRankedDebtor.confirmation.toFixed(1).replace(".", ",")}%</strong><small>{selectedRankedDebtor.score >= 700 ? "Relacionamento positivo" : selectedRankedDebtor.score >= 600 ? "Relacionamento em atenção" : "Relacionamento crítico"}</small></div></div>}</section>
    <div className={`cedent-incidents-summary ${cedent.incidents ? "has-incidents" : "clear"}`}><div><span>APONTAMENTOS CADASTRAIS</span><strong>{cedent.incidents}</strong></div>{cedent.incidentDetails?.length ? cedent.incidentDetails.map(item => <p key={item}><b>!</b>{item}</p>) : <p><CheckIcon />Nenhum apontamento cadastral ativo.</p>}</div>
  </div>;
}

function RiskEligibilityPanel({ operation, debtors, onChange }: { operation: Operation; debtors: Debtor[]; onChange: (operation: Operation) => void }) {
  const entries = operation.manualEntry?.entries ?? [];
  const cedent = initialCedents.find(item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""));
  const grouped = Object.values(entries.reduce<Record<string, { id: string; name: string; document: string; amount: number; count: number }>>((result, entry) => {
    const key = entry.debtorId || entry.debtorDocument || entry.debtorName;
    const current = result[key] ?? { id: entry.debtorId, name: entry.debtorName || "Sacado não identificado", document: entry.debtorDocument, amount: 0, count: 0 };
    result[key] = { ...current, amount: current.amount + entry.amount, count: current.count + 1 };
    return result;
  }, {}));
  const [selectedKey, setSelectedKey] = useState(grouped[0]?.id || grouped[0]?.document || "");
  const [detail, setDetail] = useState<"cedent" | "debtor" | "group" | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<ManualEntry | null>(null);
  const [consulted, setConsulted] = useState<string[]>([]);
  const selectedGroup = grouped.find(item => (item.id || item.document) === selectedKey) ?? grouped[0];
  const selectedDebtor = debtors.find(item => item.id === selectedGroup?.id || item.document.replace(/\D/g, "") === selectedGroup?.document.replace(/\D/g, ""));
  const selectedTitles = entries.filter(entry => (entry.debtorId || entry.debtorDocument) === (selectedGroup?.id || selectedGroup?.document));
  const debtorDecisions = operation.riskReview?.debtorDecisions ?? {};
  const titleDecisions = operation.riskReview?.titleDecisions ?? {};
  const scoreLabel = (score?: number) => score == null ? "Novo" : score >= 700 ? "Positivo" : score >= 600 ? "Atenção" : "Crítico";
  const scoreTone = (score?: number) => score == null ? "new" : score >= 700 ? "good" : score >= 600 ? "watch" : "bad";
  const scoreExplanation = (score?: number, reasons: string[] = []) => <div className="score-explain" tabIndex={0} aria-label={`Score ${score ?? "novo"}, ${scoreLabel(score)}. Passe o mouse ou pressione Tab para entender a nota.`}>
    <div className={`score-ring ${scoreTone(score)}`}><strong>{score ?? "—"}</strong><span>{scoreLabel(score)}</span></div>
    <div className="score-tooltip" role="tooltip"><b>Por que esta nota?</b>{reasons.length ? reasons.map(reason => <small key={reason}>{reason}</small>) : <small>Histórico insuficiente para detalhar os fatores da nota.</small>}</div>
  </div>;
  const updateReview = (change: NonNullable<Operation["riskReview"]>) => onChange({ ...operation, riskReview: { ...operation.riskReview, ...change } });
  const auditDecision = (entity: string, decision: "Aprovado" | "Reprovado") => [...(operation.riskReview?.audit ?? []).filter(item => item.entity !== entity), { entity, decision, by: "Henrique", at: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }), policy: operation.policy }];
  const decideDebtor = (key: string, decision: "Aprovado" | "Reprovado") => {
    const review: NonNullable<Operation["riskReview"]> = { debtorDecisions: { ...debtorDecisions, [key]: decision }, audit: auditDecision(`sacado:${key}`, decision) };
    if (decision === "Aprovado") {
      const group = grouped.find(item => (item.id || item.document) === key);
      const approvedTitles = entries.filter(entry => (entry.debtorId || entry.debtorDocument) === (group?.id || group?.document)).reduce((decisions, title) => ({ ...decisions, [title.id]: "Aprovado" as const }), { ...titleDecisions });
      review.titleDecisions = approvedTitles;
    }
    updateReview(review);
  };
  const decideTitle = (id: string, decision: "Aprovado" | "Reprovado") => updateReview({ titleDecisions: { ...titleDecisions, [id]: decision }, audit: auditDecision(`titulo:${id}`, decision) });
  const approvedDebtors = grouped.filter(item => debtorDecisions[item.id || item.document] === "Aprovado").length;
  const rejectedDebtors = grouped.filter(item => debtorDecisions[item.id || item.document] === "Reprovado").length;
  const minimumTermDays = 15;
  const termFor = (title: ManualEntry) => title.dueDate ? Math.ceil((new Date(`${title.dueDate}T12:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  const noteMonitoring = (title: ManualEntry) => title.nfeKey ? "NF-e autorizada · monitoramento ativo" : "Sem chave NF-e · monitoramento pendente";
  const cfopMonitoring = (title: ManualEntry) => title.cfop ? (/^[56]/.test(title.cfop) ? "CFOP compatível com circulação" : "CFOP exige revisão") : "CFOP não informado";
  const cfopDescription = (cfop?: string) => ({
    "5102": "Venda de mercadoria adquirida ou recebida de terceiros, dentro do estado",
    "6102": "Venda de mercadoria adquirida ou recebida de terceiros, destinada a outro estado",
    "5949": "Outra saída de mercadoria ou prestação de serviço não especificada",
    "6949": "Outra saída interestadual não especificada",
  }[cfop ?? ""] ?? (cfop ? "Descrição fiscal não cadastrada; validar com a política tributária" : "CFOP não informado"));
  const settledOnTime = selectedDebtor?.portfolioMetrics?.settledOnTime ?? { count: Math.max(0, (selectedDebtor?.settlements ?? 0) - (selectedDebtor?.lateSettlements ?? 0)), amount: 0 };
  const settledLate = selectedDebtor?.portfolioMetrics?.settledLate ?? { count: selectedDebtor?.lateSettlements ?? 0, amount: 0 };
  const repurchased = selectedDebtor?.portfolioMetrics?.repurchased ?? { count: selectedDebtor?.repurchases ?? 0, amount: 0 };
  const protested = selectedDebtor?.portfolioMetrics?.protested ?? { count: 0, amount: 0 };
  const courtSettled = selectedDebtor?.portfolioMetrics?.courtSettled ?? { count: 0, amount: 0 };
  const extendedSettled = selectedDebtor?.portfolioMetrics?.extendedSettled ?? { count: 0, amount: 0 };
  const openDue = selectedDebtor?.portfolioMetrics?.openDue ?? { count: (selectedDebtor?.portfolioReceivable ?? 0) > 0 ? 1 : 0, amount: Math.max(0, (selectedDebtor?.portfolioReceivable ?? 0) - (selectedDebtor?.portfolioOverdue ?? 0)) };
  const openOverdue = selectedDebtor?.portfolioMetrics?.openOverdue ?? { count: (selectedDebtor?.portfolioOverdue ?? 0) > 0 ? 1 : 0, amount: selectedDebtor?.portfolioOverdue ?? 0 };
  const openExtended = selectedDebtor?.portfolioMetrics?.openExtended ?? { count: 0, amount: 0 };
  const openNegotiation = selectedDebtor?.portfolioMetrics?.openNegotiation ?? { count: 0, amount: 0 };
  const settledRows = [{ label: "Pagos no prazo", data: settledOnTime, tone: "positive" }, { label: "Pagos com atraso", data: settledLate, tone: settledLate.count ? "attention" : "neutral" }, { label: "Recomprados", data: repurchased, tone: repurchased.count ? "negative" : "neutral" }, { label: "Protestados", data: protested, tone: protested.count ? "negative" : "neutral" }, { label: "Liquidados em cartório", data: courtSettled, tone: "neutral" }, { label: "Prorrogados liquidados", data: extendedSettled, tone: extendedSettled.count ? "attention" : "neutral" }];
  const openRows = [{ label: "A vencer", data: openDue, tone: "neutral" }, { label: "Vencidos", data: openOverdue, tone: openOverdue.count ? "negative" : "positive" }, { label: "Prorrogados", data: openExtended, tone: openExtended.count ? "attention" : "neutral" }, { label: "Em negociação", data: openNegotiation, tone: openNegotiation.count ? "attention" : "neutral" }];
  const recommendation = selectedDebtor?.score == null
    ? { tone: "attention", label: "Análise manual necessária", reason: "Sacado novo: consulte cadastro, bureau e documentos antes da decisão." }
    : selectedDebtor.score < 600 || (selectedDebtor.portfolioOverdue ?? 0) > 0
      ? { tone: "negative", label: "Recomendação: revisar ou reprovar", reason: selectedDebtor.scoreReasons?.[0] ?? "Há indicadores de risco que exigem decisão humana." }
      : selectedDebtor.score < 700
        ? { tone: "attention", label: "Recomendação: aprovar com atenção", reason: selectedDebtor.scoreReasons?.[0] ?? "O relacionamento está em faixa intermediária." }
        : { tone: "positive", label: "Recomendação: elegível para aprovação", reason: selectedDebtor.scoreReasons?.[0] ?? "Histórico positivo e carteira saudável." };
  const selectedDecisionAudit = operation.riskReview?.audit?.find(item => item.entity === `sacado:${selectedGroup?.id || selectedGroup?.document}`);

  return <section className="risk-review">
    <div className="risk-review-head"><div><span>RISCO E ELEGIBILIDADE</span><h3>Decisão baseada no relacionamento e na carteira histórica</h3><p>A nova operação é o pedido de crédito. O risco vem do cedente, dos sacados e do comportamento já observado no seu ambiente.</p></div><div className="risk-review-counts"><Badge tone="ready">{approvedDebtors} aprovados</Badge><Badge tone={rejectedDebtors ? "cancelled" : "neutral"}>{rejectedDebtors} reprovados</Badge><Badge tone="waiting">{Math.max(0, grouped.length - approvedDebtors - rejectedDebtors)} pendentes</Badge></div></div>

    <article className="cedent-risk-card">
      <div className="risk-entity-main"><span>ANÁLISE DO CEDENTE</span><h4>{operation.cedent}</h4><small>{operation.document} · {cedent?.publicStatus ?? "Cadastro ainda não consultado"}</small></div>
      {scoreExplanation(cedent?.score, cedent?.scoreReasons)}
      <div className="cedent-limit"><span>LIMITE APROVADO</span><strong>{preciseMoney.format(cedent?.creditLimit ?? 0)}</strong><small>{preciseMoney.format(cedent?.usedLimit ?? 0)} utilizado · {preciseMoney.format(Math.max(0, (cedent?.creditLimit ?? 0) - (cedent?.usedLimit ?? 0)))} disponível</small></div>
      <div className="cedent-flags incident-explain" tabIndex={0} aria-label={`${cedent?.incidents ?? 0} apontamentos. Passe o mouse ou pressione Tab para ver os detalhes.`}><span>APONTAMENTOS</span><strong className={cedent?.incidents ? "negative" : "positive"}>{cedent?.incidents ?? 0}</strong><small>{cedent?.averageDelayDays ?? 0} dias de atraso médio</small><div className="incident-tooltip" role="tooltip"><b>Apontamentos encontrados</b>{cedent?.incidentDetails?.length ? cedent.incidentDetails.map(item => <small key={item}>{item}</small>) : <small>Nenhum apontamento cadastral ativo.</small>}</div></div>
      <button className="secondary-action" onClick={() => setDetail("cedent")}>Abrir análise completa</button>
    </article>

    <div className="risk-workbench">
      <section className="debtor-panel"><div className="risk-panel-title"><div><span>SACADOS DA OPERAÇÃO</span><strong>Selecione para analisar e decidir</strong></div><small>{grouped.length} sacado(s)</small></div>
        {grouped.length ? <div className="debtor-risk-list">{grouped.map(group => { const profile = debtors.find(item => item.id === group.id || item.document.replace(/\D/g, "") === group.document.replace(/\D/g, "")); const key = group.id || group.document; const decision = debtorDecisions[key]; return <button className={`debtor-risk-row ${selectedGroup && key === (selectedGroup.id || selectedGroup.document) ? "selected" : ""}`} key={key} onClick={() => setSelectedKey(key)}><span className={`score-pill ${scoreTone(profile?.score)}`} title={profile?.scoreReasons?.join(" • ")}><b>{profile?.score ?? "NOVO"}</b><small>{scoreLabel(profile?.score)}</small></span><span className="debtor-risk-name"><strong>{group.name}</strong><small>{group.document} · {group.count} título(s) nesta operação</small></span><span className="historic-position"><b>{preciseMoney.format(profile?.portfolioReceivable ?? 0)}</b><small>{profile?.score == null ? "Sem carteira anterior" : `${preciseMoney.format(profile.portfolioOverdue ?? 0)} vencido no ambiente`}</small></span>{decision ? <Badge tone={decision === "Aprovado" ? "ready" : "cancelled"}>{decision}</Badge> : <Badge tone="waiting">Pendente</Badge>}</button>; })}</div> : <div className="risk-empty"><UsersIcon /><strong>Nenhum sacado disponível</strong><span>Volte à entrada e vincule os títulos aos sacados.</span></div>}
      </section>

      <section className="debtor-analysis"><div className="risk-panel-title"><div><span>ANÁLISE DO SACADO</span><strong>{selectedGroup?.name ?? "Selecione um sacado"}</strong></div>{selectedGroup && <div className="analysis-links"><button onClick={() => setDetail("debtor")}>Ver histórico completo</button><button onClick={() => setDetail("group")}>Grupo econômico</button></div>}</div>
        {selectedGroup ? <><div className="debtor-profile-top">{scoreExplanation(selectedDebtor?.score, selectedDebtor?.scoreReasons)}<div><b>{selectedDebtor?.score == null ? "Sacado novo no ambiente" : "Score comportamental interno"}</b><small>{selectedDebtor?.score == null ? "Sem carteira e sem liquidações anteriores. Avaliar cadastro público e documentos." : `${selectedDebtor.settlements ?? 0} liquidações · ${selectedDebtor.lateSettlements ?? 0} após o vencimento`}</small></div></div>
          <div className={`debtor-recommendation ${recommendation.tone}`}><span>{recommendation.label}</span><strong>{recommendation.reason}</strong><small>Recomendação assistida; a decisão e a justificativa permanecem sob responsabilidade do analista.</small></div>
          <div className="debtor-portfolio-ledger"><div className="portfolio-kpis"><div><span>EXPOSIÇÃO EM ABERTO</span><strong>{preciseMoney.format(selectedDebtor?.portfolioReceivable ?? 0)}</strong><small>Carteira anterior no ambiente</small></div><div><span>ATRASO MÉDIO</span><strong className={(selectedDebtor?.averageDelayDays ?? 0) > 7 ? "negative" : "positive"}>{selectedDebtor?.averageDelayDays ?? 0} dias</strong><small>{selectedDebtor?.lateSettlements ?? 0} liquidações após o vencimento</small></div><div><span>CONCENTRAÇÃO</span><strong>{(selectedDebtor?.portfolioMetrics?.concentrationPercent ?? 0).toFixed(1)}%</strong><small>Participação na carteira do cedente</small></div></div><div className="portfolio-ledger-columns"><details><summary><span><b>BAIXADOS</b><small>Histórico liquidado</small></span><strong>{selectedDebtor?.settlements ?? 0} · {preciseMoney.format(settledOnTime.amount + settledLate.amount + courtSettled.amount + extendedSettled.amount)}</strong></summary><div className="portfolio-ledger-head"><span>Situação</span><span>Qtd.</span><span>Valor</span></div>{settledRows.map(row => <div className={`portfolio-ledger-row ${row.tone}`} key={row.label}><span>{row.label}</span><b>{row.data.count}</b><strong>{preciseMoney.format(row.data.amount)}</strong></div>)}<div className="portfolio-ledger-total"><span>Total liquidado</span><b>{selectedDebtor?.settlements ?? 0}</b><strong>{preciseMoney.format(settledOnTime.amount + settledLate.amount + courtSettled.amount + extendedSettled.amount)}</strong></div></details><details><summary><span><b>EM ABERTO</b><small>Posição atual no ambiente</small></span><strong>{openDue.count + openOverdue.count} · {preciseMoney.format(selectedDebtor?.portfolioReceivable ?? 0)}</strong></summary><div className="portfolio-ledger-head"><span>Situação</span><span>Qtd.</span><span>Valor</span></div>{openRows.map(row => <div className={`portfolio-ledger-row ${row.tone}`} key={row.label}><span>{row.label}</span><b>{row.data.count}</b><strong>{preciseMoney.format(row.data.amount)}</strong></div>)}<div className="portfolio-ledger-total"><span>Total em aberto</span><b>{openDue.count + openOverdue.count}</b><strong>{preciseMoney.format(selectedDebtor?.portfolioReceivable ?? 0)}</strong></div><div className="portfolio-ledger-concentration"><span>+ Concentração do sacado</span><strong>{(selectedDebtor?.portfolioMetrics?.concentrationPercent ?? 0).toFixed(1)}%</strong></div></details></div></div>
          <div className="public-check"><ShieldIcon /><span><strong>{selectedDebtor?.publicStatus ?? "Consulta pública pendente"}</strong><small>Receita/CPF-CNPJ · demonstração; integração oficial ainda não conectada</small></span><button onClick={() => setConsulted(current => [...new Set([...current, selectedGroup.id || selectedGroup.document])])}>{consulted.includes(selectedGroup.id || selectedGroup.document) ? "Consulta atualizada" : "Consultar cadastro"}</button><button className="bureau-button" onClick={() => setConsulted(current => [...new Set([...current, `bureau-${selectedGroup.id || selectedGroup.document}`])])}>{consulted.includes(`bureau-${selectedGroup.id || selectedGroup.document}`) ? "Serasa consultado" : "Consultar Serasa"}</button></div>
          <div className="decision-buttons"><button className={debtorDecisions[selectedGroup.id || selectedGroup.document] === "Reprovado" ? "selected reject" : "reject"} onClick={() => decideDebtor(selectedGroup.id || selectedGroup.document, "Reprovado")}>Reprovar sacado</button><button className={debtorDecisions[selectedGroup.id || selectedGroup.document] === "Aprovado" ? "selected approve" : "approve"} onClick={() => decideDebtor(selectedGroup.id || selectedGroup.document, "Aprovado")} title="Aprova também todos os títulos deste sacado">Aprovar sacado e títulos</button></div>
          {selectedDecisionAudit && <div className="decision-audit"><CheckIcon /><span><b>Decisão registrada: {selectedDecisionAudit.decision}</b><small>{selectedDecisionAudit.by} · {selectedDecisionAudit.at} · Política {selectedDecisionAudit.policy}</small></span></div>}
        </> : <div className="risk-empty"><SearchIcon /><span>Selecione um sacado para abrir a análise.</span></div>}
      </section>
    </div>

    {selectedGroup && <section className="risk-title-section"><div className="risk-panel-title"><div><span>TÍTULOS DO SACADO SELECIONADO</span><strong>Prazo, documento fiscal, monitoramento e decisão</strong></div><small>Prazo mínimo configurado: {minimumTermDays} dias</small></div><div className="risk-title-scroll"><div className="risk-title-head"><span>DOCUMENTO</span><span>VALOR</span><span>VENCIMENTO / PRAZO</span><span>CHAVE NF-e</span><span>CFOP</span><span>MONITORAMENTO</span><span>DECISÃO</span></div>{selectedTitles.map(title => { const term = termFor(title); const withinTerm = term != null && term >= minimumTermDays; return <div className="risk-title-row" key={title.id}><strong>{title.documentNumber}</strong><span>{preciseMoney.format(title.amount)}</span><span><b>{title.dueDate || "Não informado"}</b><small className={withinTerm ? "positive" : "negative"}>{term == null ? "Sem prazo calculado" : withinTerm ? `${term} dias · dentro da política` : `${term} dias · mínimo ${minimumTermDays}`}</small></span><span className="tax-key" title={title.nfeKey}>{title.nfeKey || "Não informada"}</span><span className="cfop-cell compact"><b>{title.cfop || "—"}</b><em className={title.cfop && /^[56]/.test(title.cfop) ? "positive" : "warning-text"}>{cfopMonitoring(title)}</em></span><span><b className={title.nfeKey ? "positive" : "warning-text"}>{title.nfeKey ? "Monitorada" : "Pendente"}</b><small>{noteMonitoring(title)}</small></span><span className="title-evaluation-actions"><button onClick={() => setSelectedTitle(title)}>Analisar</button><span className="mini-decisions"><button className={titleDecisions[title.id] === "Reprovado" ? "active reject" : "reject"} onClick={() => decideTitle(title.id, "Reprovado")}>Rejeitar</button><button className={titleDecisions[title.id] === "Aprovado" ? "active approve" : "approve"} onClick={() => decideTitle(title.id, "Aprovado")}>Aprovar</button></span></span></div>; })}</div></section>}

    <div className="risk-final-actions"><div><strong>Decisão da operação</strong><span>{operation.riskReview?.cedentDecision ? `${operation.riskReview.cedentDecision} por Henrique · Política ${operation.policy}` : "A operação só avança quando cedente, sacados e títulos tiverem decisão registrada."}</span></div><button className="danger-secondary" onClick={() => updateReview({ cedentDecision: "Reprovado", audit: auditDecision("operacao", "Reprovado") })}>Reprovar operação</button><button className="primary-action" onClick={() => { const decisions = Object.fromEntries(grouped.map(item => [item.id || item.document, "Aprovado"])); const titles = Object.fromEntries(entries.map(item => [item.id, "Aprovado"])); updateReview({ cedentDecision: "Aprovado", debtorDecisions: decisions, titleDecisions: titles, audit: auditDecision("operacao", "Aprovado") }); }}>Aprovar elegíveis</button></div>

    {detail && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setDetail(null)}><section className={`risk-detail-modal ${detail === "cedent" ? "cedent-analysis-modal" : ""}`} role="dialog" aria-modal="true"><div className="modal-head"><div><Badge tone="eyebrow">{detail === "cedent" ? "ANÁLISE DO CEDENTE" : detail === "group" ? "GRUPO ECONÔMICO DO SACADO" : "ANÁLISE DO SACADO"}</Badge><h2>{detail === "cedent" ? operation.cedent : detail === "group" ? selectedDebtor?.groupName ?? "Sem grupo econômico identificado" : selectedGroup?.name}</h2><p>{detail === "group" ? "Exposição consolidada das empresas relacionadas ao sacado selecionado." : "Cadastro, carteira e comportamento histórico disponíveis no ambiente."}</p></div><button onClick={() => setDetail(null)}><CloseIcon /></button></div>{detail === "cedent" ? <CedentPortfolioOverview cedent={cedent} /> : detail === "group" ? <div className="detail-stat-grid"><div><span>Empresas relacionadas</span><strong>{selectedDebtor?.groupCompanies ?? 1}</strong></div><div><span>Score do grupo</span><strong>{selectedDebtor?.groupScore ?? "Sem histórico"}</strong></div><div><span>Exposição consolidada</span><strong>{preciseMoney.format(selectedDebtor?.groupExposure ?? selectedDebtor?.portfolioReceivable ?? 0)}</strong></div><div><span>Vencidos do grupo</span><strong className={(selectedDebtor?.groupOverdue ?? 0) > 0 ? "negative" : "positive"}>{preciseMoney.format(selectedDebtor?.groupOverdue ?? 0)}</strong></div><div><span>Sacado selecionado</span><strong>{selectedGroup?.name}</strong></div><div><span>Participação na exposição</span><strong>{selectedDebtor?.groupExposure ? `${Math.round((selectedDebtor.portfolioReceivable ?? 0) / selectedDebtor.groupExposure * 100)}%` : "100%"}</strong></div></div> : <div className="detail-stat-grid"><div><span>Score</span><strong>{selectedDebtor?.score ?? "Sacado novo"}</strong></div><div><span>Carteira a receber</span><strong>{preciseMoney.format(selectedDebtor?.portfolioReceivable ?? 0)}</strong></div><div><span>Carteira vencida</span><strong>{preciseMoney.format(selectedDebtor?.portfolioOverdue ?? 0)}</strong></div><div><span>Liquidações</span><strong>{selectedDebtor?.settlements ?? 0}</strong></div><div><span>Após vencimento</span><strong>{selectedDebtor?.lateSettlements ?? 0}</strong></div><div><span>Recompras</span><strong>{selectedDebtor?.repurchases ?? 0}</strong></div></div>}<div className="modal-actions"><button className="primary-action" onClick={() => setDetail(null)}>Fechar análise</button></div></section></div>}
    {selectedTitle && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setSelectedTitle(null)}><section className="risk-detail-modal title-analysis-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><Badge tone="eyebrow">ANÁLISE DO TÍTULO</Badge><h2>{selectedTitle.documentNumber}</h2><p>{selectedGroup?.name} · {preciseMoney.format(selectedTitle.amount)}</p></div><button onClick={() => setSelectedTitle(null)}><CloseIcon /></button></div><div className="title-monitor-summary"><div className={termFor(selectedTitle) != null && termFor(selectedTitle)! >= minimumTermDays ? "ok" : "fail"}><span>PRAZO DA POLÍTICA</span><strong>{termFor(selectedTitle) == null ? "Não calculado" : `${termFor(selectedTitle)} dias`}</strong><small>Mínimo configurado: {minimumTermDays} dias</small></div><div className={selectedTitle.nfeKey ? "ok" : "fail"}><span>MONITORAMENTO NF-e</span><strong>{selectedTitle.nfeKey ? "Ativo" : "Pendente"}</strong><small>{noteMonitoring(selectedTitle)}</small></div><div className={selectedTitle.cfop && /^[56]/.test(selectedTitle.cfop) ? "ok" : "fail"}><span>CFOP {selectedTitle.cfop || "não informado"}</span><strong>{cfopDescription(selectedTitle.cfop)}</strong><small>{cfopMonitoring(selectedTitle)}</small></div></div><div className="title-detail-list"><div><span>Chave da nota</span><strong className="tax-key-full">{selectedTitle.nfeKey || "Não informada"}</strong></div><div><span>Emissão</span><strong>{selectedTitle.issueDate || "Não informada"}</strong></div><div><span>Vencimento</span><strong>{selectedTitle.dueDate || "Não informado"}</strong></div><div><span>Nosso número</span><strong>{selectedTitle.ourNumber || "Não informado"}</strong></div><div><span>Descrição do CFOP</span><strong>{cfopDescription(selectedTitle.cfop)}</strong></div><div><span>Observação</span><strong>{selectedTitle.observation || "Sem observações"}</strong></div></div><div className="modal-actions title-modal-actions"><button className="danger-secondary" onClick={() => { decideTitle(selectedTitle.id, "Reprovado"); setSelectedTitle(null); }}>Rejeitar título</button><button className="primary-action" onClick={() => { decideTitle(selectedTitle.id, "Aprovado"); setSelectedTitle(null); }}>Aprovar título</button></div></section></div>}
  </section>;
}

function LastroValidationPanel({ operation, debtors, onChange }: { operation: Operation; debtors: Debtor[]; onChange: (operation: Operation) => void }) {
  const [filter, setFilter] = useState<"all" | "sample" | "intervention">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});
  const [attemptChannel, setAttemptChannel] = useState<"Ligação" | "WhatsApp">("Ligação");
  const [attemptResult, setAttemptResult] = useState<"Contato iniciado" | "Sem contato" | "Confirmado" | "Confirmado com ressalva" | "Recusado" | "Telefone inválido">("Sem contato");
  const [confirmationScope, setConfirmationScope] = useState<"Nota" | "Sacado">("Nota");
  const [nextContactAt, setNextContactAt] = useState("");
  const [precheckNote, setPrecheckNote] = useState("");
  const [divergenceReason, setDivergenceReason] = useState<"" | "Documento ausente" | "Valor divergente" | "Vencimento divergente" | "Mercadoria ou serviço não reconhecido" | "Duplicidade" | "Documento inválido" | "Outro">("");
  const [formFeedback, setFormFeedback] = useState("");
  const assessment = lastroAssessmentFor(operation, debtors);
  const selected = assessment.rows.find(row => row.title.id === selectedId);
  const selectedReview = selected ? operation.lastroReview?.items?.[selected.title.id] : undefined;
  const selectedPhone = selected?.debtor?.mobile ?? selected?.debtor?.phone;
  const whatsappContact = selected?.debtor?.whatsapp ?? selected?.debtor?.mobile ?? (selected?.debtor?.phone?.replace(/\D/g, "").length === 11 ? selected.debtor.phone : undefined);
  const whatsappPhone = whatsappContact ? (whatsappContact.replace(/\D/g, "").startsWith("55") ? whatsappContact.replace(/\D/g, "") : `55${whatsappContact.replace(/\D/g, "")}`) : "";
  const visibleRows = assessment.rows.filter(row => filter === "sample" ? row.sampled : filter === "intervention" ? row.evidenceStatus !== "Validada" || (row.sampled && row.confirmation !== "Confirmado") || row.confirmation === "Recusado" || row.confirmation === "Telefone inválido" : true);
  const coverage = assessment.rows.length ? Math.round(assessment.evidenceValid / assessment.rows.length * 100) : 0;
  const sampledDebtors = [...new Set(assessment.rows.filter(row => row.sampled).map(row => row.title.debtorId || row.title.debtorDocument))];
  const confirmedDebtors = sampledDebtors.filter(key => assessment.rows.filter(row => row.sampled && (row.title.debtorId || row.title.debtorDocument) === key).every(row => row.confirmation === "Confirmado")).length;
  const sampledNotes = [...new Set(assessment.rows.filter(row => row.sampled).map(row => `${row.title.debtorId || row.title.debtorDocument}:${row.title.nfeKey || row.title.documentNumber.split("/")[0]}`))];
  const optionalConfirmed = assessment.rows.filter(row => !row.sampled && row.confirmation === "Confirmado").length;

  useEffect(() => {
    if (!selectedId) return;
    const review = operation.lastroReview?.items?.[selectedId];
    setConfirmationScope(review?.confirmationScope ?? "Nota");
    setNextContactAt(review?.nextContactAt ?? "");
    setPrecheckNote(review?.confirmationNotes ?? review?.attachmentNotes ?? "");
    setDivergenceReason(review?.divergenceReason ?? "");
    setFormFeedback("");
  }, [selectedId]);

  function updateItem(id: string, change: Partial<LastroReviewItem>) {
    const current = operation.lastroReview?.items?.[id] ?? {};
    onChange({ ...operation, lastroReview: { items: { ...operation.lastroReview?.items, [id]: { ...current, ...change, updatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }), updatedBy: "Henrique" } } } });
  }

  function updateChecklist(id: string, key: "identityConfirmed" | "deliveryConfirmed" | "amountAndDueDateConfirmed" | "noDisputeReported", checked: boolean) {
    const current = operation.lastroReview?.items?.[id];
    updateItem(id, { checklist: { ...current?.checklist, [key]: checked } });
  }

  function registerAttempt(id: string) {
    const current = operation.lastroReview?.items?.[id];
    const checklist = current?.checklist;
    if (attemptResult === "Confirmado" && ![checklist?.identityConfirmed, checklist?.deliveryConfirmed, checklist?.amountAndDueDateConfirmed, checklist?.noDisputeReported].every(Boolean)) {
      setFormFeedback("Para confirmar, conclua os quatro itens do checklist.");
      return;
    }
    if (["Confirmado com ressalva", "Recusado", "Telefone inválido"].includes(attemptResult) && !precheckNote.trim()) {
      setFormFeedback("Descreva a ressalva ou o motivo na observação da pré-checagem.");
      return;
    }
    if (attemptResult === "Sem contato" && !nextContactAt) {
      setFormFeedback("Informe quando será a próxima tentativa de contato.");
      return;
    }
    const at = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const baseTitle = assessment.rows.find(row => row.title.id === id)?.title;
    if (!baseTitle) return;
    const targetIds = assessment.rows.filter(row => confirmationScope === "Sacado"
      ? (row.title.debtorId || row.title.debtorDocument) === (baseTitle.debtorId || baseTitle.debtorDocument)
      : (row.title.debtorId || row.title.debtorDocument) === (baseTitle.debtorId || baseTitle.debtorDocument) && (row.title.nfeKey || row.title.documentNumber.split("/")[0]) === (baseTitle.nfeKey || baseTitle.documentNumber.split("/")[0]))
      .map(row => row.title.id);
    const attempt = { channel: attemptChannel, result: attemptResult, at, by: "Henrique", nextContactAt: nextContactAt || undefined };
    const items = { ...operation.lastroReview?.items };
    targetIds.forEach(targetId => {
      const target = items[targetId] ?? {};
      items[targetId] = { ...target, confirmation: attemptResult, confirmationScope, confirmationNotes: precheckNote, nextContactAt: nextContactAt || undefined, checklist: current?.checklist, contactAttempts: (target.contactAttempts ?? 0) + 1, attempts: [...(target.attempts ?? []), attempt], updatedAt: at, updatedBy: "Henrique" };
    });
    onChange({ ...operation, lastroReview: { items } });
    setFormFeedback(`Tentativa registrada para ${targetIds.length} título(s) por ${confirmationScope.toLowerCase()}.`);
  }

  function setEvidenceDecision(decision: "Validada" | "Pendente" | "Divergente") {
    if (!selected) return;
    if (decision === "Divergente" && !divergenceReason) { setFormFeedback("Selecione o motivo da divergência documental."); return; }
    updateItem(selected.title.id, { evidenceDecision: decision, divergenceReason: decision === "Divergente" ? divergenceReason || undefined : undefined });
    setFormFeedback(decision === "Validada" ? "Documento conferido." : decision === "Pendente" ? "Pendência documental registrada." : "Divergência documental registrada.");
  }

  return <section className="lastro-workbench">
    <div className="lastro-head"><div><span>LASTRO E CONFIRMAÇÃO</span><h3>Validação documental e confirmação por título</h3><p>A amostra é priorizada automaticamente por risco, concentração, qualidade do sacado e ausência de evidência.</p></div><Badge tone={assessment.ready ? "ready" : assessment.divergences ? "cancelled" : "attention"}>{assessment.ready ? "Pronto para avançar" : assessment.divergences ? `${assessment.divergences} divergência(s)` : "Intervenção necessária"}</Badge></div>
    <div className="lastro-kpis"><div><span>COBERTURA DOCUMENTAL</span><strong className={coverage === 100 ? "positive" : "warning-text"}>{coverage}%</strong><small>{assessment.evidenceValid} de {assessment.rows.length} evidências validadas</small></div><div><span>AMOSTRA OBRIGATÓRIA</span><strong>{assessment.sampleSize}</strong><small>{sampledNotes.length} nota(s) · risco {operation.risk.toLowerCase()}</small></div><div><span>CONFIRMAÇÕES DA AMOSTRA</span><strong className={confirmedDebtors === sampledDebtors.length && sampledDebtors.length ? "positive" : "warning-text"}>{confirmedDebtors}/{sampledDebtors.length}</strong><small>{assessment.confirmed} obrigatória(s) · {optionalConfirmed} voluntária(s)</small></div><div><span>DIVERGÊNCIAS</span><strong className={assessment.divergences ? "negative" : "positive"}>{assessment.divergences}</strong><small>{assessment.divergences ? "Bloqueiam o avanço" : "Nenhuma divergência registrada"}</small></div></div>
    <div className="lastro-toolbar"><div><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <b>{assessment.rows.length}</b></button><button className={filter === "sample" ? "active" : ""} onClick={() => setFilter("sample")}>Amostra obrigatória <b>{assessment.sampleSize}</b></button><button className={filter === "intervention" ? "active" : ""} onClick={() => setFilter("intervention")}>Intervenção <b>{assessment.rows.filter(row => row.evidenceStatus !== "Validada" || (row.sampled && row.confirmation !== "Confirmado") || row.confirmation === "Recusado" || row.confirmation === "Telefone inválido").length}</b></button></div><small>Fora da amostra, o contato continua disponível como confirmação voluntária.</small></div>
    <div className="lastro-grid-scroll"><div className="lastro-grid-head"><span>TÍTULO / SACADO</span><span>EVIDÊNCIA</span><span>CRITÉRIO DE CONTATO</span><span>CONFIRMAÇÃO</span><span>RESPONSÁVEL</span><span>AÇÕES</span></div>{visibleRows.map(row => <div className={`lastro-grid-row ${row.evidenceStatus.toLowerCase()} ${row.confirmation === "Recusado" ? "rejected" : ""}`} key={row.title.id}><span><strong>{row.title.documentNumber}</strong><small>{row.title.debtorName} · {preciseMoney.format(row.title.amount)}</small></span><span><b className={row.evidenceStatus === "Validada" ? "positive" : row.evidenceStatus === "Divergente" ? "negative" : "warning-text"}>{row.evidenceStatus}</b><small>{row.automaticEvidence ? "Documento validado na origem" : row.attachmentName ? row.attachmentName : "Evidência principal ausente"}</small></span><span>{row.sampled ? <><b>Amostra obrigatória</b><small>{row.reasons.join(" · ") || "Seleção estatística"}</small></> : <><b>Fora da amostra obrigatória</b><small>Contato voluntário disponível</small></>}</span><span><b className={row.confirmation === "Confirmado" ? "positive" : row.confirmation === "Recusado" || row.confirmation === "Telefone inválido" ? "negative" : "warning-text"}>{row.confirmation ?? (row.sampled ? "Pendente" : "Não realizada")}</b><small>{row.sampled ? "Confirmação obrigatória" : row.confirmation ? "Confirmação voluntária" : "Pode ser confirmado"}</small></span><span><b>{operation.lastroReview?.items?.[row.title.id]?.updatedBy ?? "Motor de regras"}</b><small>{operation.lastroReview?.items?.[row.title.id]?.updatedAt ?? "Agora"}</small></span><span className="lastro-row-actions"><button onClick={() => setSelectedId(row.title.id)}>{row.sampled ? "Analisar" : "Confirmar"}</button>{!row.automaticEvidence && row.evidenceStatus !== "Validada" && <label>Anexar<input type="file" onChange={event => { const file = event.target.files?.[0]; if (file) updateItem(row.title.id, { attachmentName: file.name, evidenceDecision: "Pendente" }); }} /></label>}</span></div>)}</div>
    {!visibleRows.length && <div className="lastro-empty"><CheckIcon /><strong>Nenhuma intervenção neste filtro</strong><span>Todos os títulos exibidos atendem aos critérios atuais.</span></div>}
    <div className={`lastro-result ${assessment.ready ? "ready" : "pending"}`}>{assessment.ready ? <CheckIcon /> : <AlertIcon />}<div><strong>{assessment.ready ? "Lastro concluído" : "A operação ainda não pode avançar"}</strong><span>{assessment.ready ? "Evidências validadas e sacados da amostra confirmados." : `${assessment.rows.length - assessment.evidenceValid} evidência(s) e ${assessment.sampleSize - assessment.confirmed} confirmação(ões) ainda pendentes.`}</span></div></div>
    {selected && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setSelectedId(null)}>
      <section className="risk-detail-modal lastro-detail-modal precheck-modal" role="dialog" aria-modal="true">
        <div className="modal-head"><div><Badge tone={selected.evidenceStatus === "Validada" ? "ready" : selected.evidenceStatus === "Divergente" ? "cancelled" : "attention"}>PRÉ-CHECAGEM DO LASTRO</Badge><h2>{selected.title.documentNumber}</h2><p>{selected.title.debtorName} · {preciseMoney.format(selected.title.amount)}</p></div><button onClick={() => setSelectedId(null)}><CloseIcon /></button></div>
        <div className="lastro-detail-summary"><div><span>EVIDÊNCIA DOCUMENTAL</span><strong className={selected.evidenceStatus === "Validada" ? "positive" : selected.evidenceStatus === "Divergente" ? "negative" : "warning-text"}>{selected.evidenceStatus}</strong><small>{selected.title.nfeKey ? `NF-e ${selected.title.nfeKey}` : selected.attachmentName ?? "Nenhum documento anexado"}</small></div><div><span>CONTATO</span><strong>{selected.sampled ? "Amostra obrigatória" : "Confirmação voluntária"}</strong><small>{selected.sampled ? selected.reasons.join(" · ") || "Seleção estatística da política" : "Título fora da amostra, com contato disponível"}</small></div><div><span>CONFIRMAÇÃO DO SACADO</span><strong className={selected.confirmation === "Confirmado" ? "positive" : selected.confirmation === "Recusado" || selected.confirmation === "Telefone inválido" ? "negative" : "warning-text"}>{selected.confirmation ?? (selected.sampled ? "Pendente" : "Não realizada")}</strong><small>{selectedReview?.contactAttempts ?? 0} tentativa(s) · {selectedReview?.updatedAt ? `última em ${selectedReview.updatedAt}` : "sem contato registrado"}</small></div></div>
        <section className="precheck-contact-card"><div><span>CONTATO DO SACADO</span><strong>{selected.debtor?.name ?? selected.title.debtorName}</strong><small>{selected.debtor?.document ?? selected.title.debtorDocument}</small></div><div className="precheck-phone">{revealedPhones[selected.title.id] ? <><strong>{selectedPhone ?? "Telefone não cadastrado"}</strong>{selectedPhone && <div className="contact-links"><a href={`tel:${selectedPhone.replace(/\D/g, "")}`}>Ligar</a>{whatsappPhone && <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">Enviar mensagem</a>}</div>}</> : <button onClick={() => setRevealedPhones(current => ({ ...current, [selected.title.id]: true }))}>Ver contato</button>}<small>{whatsappPhone ? "Celular habilitado para abrir no WhatsApp Web" : selectedPhone ? "Telefone disponível para ligação; WhatsApp não cadastrado" : "Cadastre um telefone para habilitar o contato"}</small></div></section>
        <div className="lastro-evidence-data"><div><span>Chave NF-e</span><strong>{selected.title.nfeKey || "Não informada"}</strong></div><div><span>CFOP</span><strong>{selected.title.cfop || "Não informado"}</strong></div><div><span>Emissão</span><strong>{selected.title.issueDate || "Não informada"}</strong></div><div><span>Vencimento</span><strong>{selected.title.dueDate || "Não informado"}</strong></div><div><span>Observação da entrada</span><strong>{selected.title.observation || "Sem observação"}</strong></div><div><span>Anexo complementar</span><strong>{selected.attachmentName || "Nenhum anexo"}</strong></div></div>
        <section className="evidence-check-card"><div><span>CONFERÊNCIA DO DOCUMENTO</span><strong>O arquivo ou a chave apresentada comprova este título?</strong><small>A conferência é sempre individual por título, mesmo quando o contato for agrupado.</small></div><div className="evidence-actions"><label><span>MOTIVO, SE HOUVER DIVERGÊNCIA</span><select aria-label="Motivo da divergência" value={divergenceReason} onChange={event => setDivergenceReason(event.target.value as typeof divergenceReason)}><option value="">Selecione</option><option>Documento ausente</option><option>Valor divergente</option><option>Vencimento divergente</option><option>Mercadoria ou serviço não reconhecido</option><option>Duplicidade</option><option>Documento inválido</option><option>Outro</option></select></label><div><button className={selected.evidenceStatus === "Validada" ? "selected ok" : "ok"} onClick={() => setEvidenceDecision("Validada")}>Documento confere</button><button className={selected.evidenceStatus === "Pendente" ? "selected pending" : "pending"} onClick={() => setEvidenceDecision("Pendente")}>Falta documento</button><button className={selected.evidenceStatus === "Divergente" ? "selected fail" : "fail"} onClick={() => setEvidenceDecision("Divergente")}>Há divergência</button></div></div></section>
        <section className="precheck-attempt"><div className="precheck-section-title"><div><span>NOVA TENTATIVA DE CONTATO</span><strong>Escolha o agrupamento, o canal e o resultado</strong></div><small>{selectedReview?.attempts?.length ?? 0} tentativa(s) no histórico</small></div><div className="attempt-form"><label><span>APLICAR A</span><select aria-label="Escopo da confirmação" value={confirmationScope} onChange={event => setConfirmationScope(event.target.value as "Nota" | "Sacado")}><option>Nota</option><option>Sacado</option></select></label><label><span>CANAL</span><select aria-label="Canal da tentativa" value={attemptChannel} onChange={event => setAttemptChannel(event.target.value as "Ligação" | "WhatsApp")}><option>Ligação</option><option disabled={!whatsappPhone}>WhatsApp</option></select></label><label><span>RESULTADO</span><select aria-label="Resultado da tentativa" value={attemptResult} onChange={event => setAttemptResult(event.target.value as typeof attemptResult)}><option>Contato iniciado</option><option>Sem contato</option><option>Confirmado</option><option>Confirmado com ressalva</option><option>Recusado</option><option>Telefone inválido</option></select></label><label><span>PRÓXIMA TENTATIVA</span><input aria-label="Próxima tentativa" type="datetime-local" value={nextContactAt} onChange={event => setNextContactAt(event.target.value)} /></label><button onClick={() => registerAttempt(selected.title.id)}>Adicionar tentativa</button></div><small className="scope-helper">Por nota aplica o retorno às parcelas da mesma NF-e. Por sacado aplica a todos os títulos desse sacado na operação. Fora da amostra, o contato é voluntário.</small>{Boolean(selectedReview?.attempts?.length) && <div className="attempt-history">{selectedReview?.attempts?.slice(-3).reverse().map((attempt, index) => <div key={`${attempt.at}-${index}`}><strong>{attempt.channel} · {attempt.result}</strong><small>{attempt.at} · {attempt.by}{attempt.nextContactAt ? ` · próxima: ${new Date(attempt.nextContactAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}</small></div>)}</div>}</section>
        <section className="precheck-confirmation"><div className="precheck-section-title"><div><span>CONFIRMAÇÃO OBTIDA</span><strong>Checklist objetivo da pré-checagem</strong></div><Badge tone={selected.confirmation === "Confirmado" ? "ready" : selected.confirmation === "Recusado" ? "cancelled" : "attention"}>{selected.confirmation ?? (selected.sampled ? "Pendente" : "Não realizada")}</Badge></div><div className="precheck-checklist"><label><input type="checkbox" checked={Boolean(selectedReview?.checklist?.identityConfirmed)} onChange={event => updateChecklist(selected.title.id, "identityConfirmed", event.target.checked)} /> Identidade do sacado confirmada</label><label><input type="checkbox" checked={Boolean(selectedReview?.checklist?.deliveryConfirmed)} onChange={event => updateChecklist(selected.title.id, "deliveryConfirmed", event.target.checked)} /> Entrega ou serviço reconhecido</label><label><input type="checkbox" checked={Boolean(selectedReview?.checklist?.amountAndDueDateConfirmed)} onChange={event => updateChecklist(selected.title.id, "amountAndDueDateConfirmed", event.target.checked)} /> Valor e vencimento conferidos</label><label><input type="checkbox" checked={Boolean(selectedReview?.checklist?.noDisputeReported)} onChange={event => updateChecklist(selected.title.id, "noDisputeReported", event.target.checked)} /> Sem devolução, disputa ou compensação</label></div></section>
        <label className="precheck-notes single-note"><span>OBSERVAÇÃO DA PRÉ-CHECAGEM</span><textarea value={precheckNote} placeholder="Registre quem atendeu, o que foi confirmado e qualquer informação sobre o documento ou anexo." onChange={event => setPrecheckNote(event.target.value)} /></label>
        {formFeedback && <div className={`precheck-feedback ${formFeedback.includes("registrad") || formFeedback.includes("conferido") ? "success" : "warning"}`}>{formFeedback}</div>}
        <div className="modal-actions"><button className="primary-action" onClick={() => { updateItem(selected.title.id, { confirmationNotes: precheckNote, nextContactAt: nextContactAt || undefined, confirmationScope }); setSelectedId(null); }}>Salvar pré-checagem</button></div>
      </section>
    </div>}
  </section>;
}

function PricingPanel({ operation, onChange, showGuidance }: { operation: Operation; onChange: (operation: Operation) => void; showGuidance: boolean }) {
  const [pricing, setPricing] = useState<PricingDraft>(normalizedPricing(operation));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feeDescription, setFeeDescription] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [repurchaseOpen, setRepurchaseOpen] = useState(false);
  const [versionReason, setVersionReason] = useState("");
  const [activeVersionReason, setActiveVersionReason] = useState("");
  const [offsetNatureFilter, setOffsetNatureFilter] = useState<"Todos" | "Débitos" | "Créditos">("Todos");
  const [offsetSourceFilter, setOffsetSourceFilter] = useState<"Todos" | "Títulos" | "Pendências" | "Créditos">("Todos");
  const [includeGroupOffsets, setIncludeGroupOffsets] = useState(false);
  const [offsetSearch, setOffsetSearch] = useState("");
  const calculated = useMemo(() => pricingCalculation(operation, pricing), [operation, pricing]);
  const targetFinalRate = pricing.targetFinalRateMonthly ?? calculated.allInMonthly;
  const finalRateGap = calculated.allInMonthly - targetFinalRate;
  const repurchase = useMemo(() => repurchaseCalculation(operation, pricing), [operation, pricing]);
  const settlementAdjustments = useMemo(() => settlementAdjustmentCalculation(operation, pricing), [operation, pricing]);
  const totalOffsets = roundPricing(repurchase.total + settlementAdjustments.total);
  const netAfterRepurchase = roundPricing(calculated.net - totalOffsets);
  const policyMinimum = operation.risk === "Alto" ? 2.4 : operation.risk === "Médio" ? 1.8 : 1.4;
  const rateBelowPolicy = pricing.monthlyRate < policyMinimum;
  const positiveEconomics = netAfterRepurchase > 0 && calculated.spread > 0;
  const pricingSourceReady = calculated.sourceTitleCount > 0 && calculated.hasDecisions && calculated.approvedTitleCount > 0;
  const faceDifference = calculated.face - operation.amount;
  const taxRule = operation.institution === "Factoring" ? "IOF estimado conforme configuração fiscal vigente da factoring" : operation.institution === "FIDC" ? "Aquisição da carteira sem IOF operacional no veículo" : "Tributos conforme configuração da securitizadora";
  const offsetRows = [
    ...repurchase.rows.map(row => ({ kind: "Título" as const, nature: "Débito" as const, scope: row.scope, search: `${row.documentNumber} ${row.debtorName} ${row.portfolioOwnerName ?? ""} ${row.acquisitionReference}`, row })),
    ...settlementAdjustments.rows.map(row => ({ kind: row.kind, nature: row.kind === "Crédito" ? "Crédito" as const : "Débito" as const, scope: row.scope, search: `${row.description} ${row.ownerName} ${row.reference}`, row })),
  ];
  const filteredOffsetRows = offsetRows.filter(item => {
    if (!includeGroupOffsets && item.scope === "Grupo empresarial") return false;
    if (offsetNatureFilter === "Débitos" && item.nature !== "Débito") return false;
    if (offsetNatureFilter === "Créditos" && item.nature !== "Crédito") return false;
    if (offsetSourceFilter === "Títulos" && item.kind !== "Título") return false;
    if (offsetSourceFilter === "Pendências" && item.kind !== "Pendência") return false;
    if (offsetSourceFilter === "Créditos" && item.kind !== "Crédito") return false;
    const query = offsetSearch.trim().toLocaleLowerCase("pt-BR");
    return !query || item.search.toLocaleLowerCase("pt-BR").includes(query);
  });
  const selectedOffsetMemory = [
    { label: "Títulos do cedente", rows: repurchase.selected.filter(row => row.scope === "Cedente"), face: repurchase.selected.filter(row => row.scope === "Cedente").reduce((sum, row) => sum + row.faceAmount, 0), corrected: repurchase.selected.filter(row => row.scope === "Cedente").reduce((sum, row) => sum + row.presentValue, 0), impact: -repurchase.selected.filter(row => row.scope === "Cedente").reduce((sum, row) => sum + row.presentValue, 0) },
    { label: "Títulos do grupo", rows: repurchase.selected.filter(row => row.scope === "Grupo empresarial"), face: repurchase.selected.filter(row => row.scope === "Grupo empresarial").reduce((sum, row) => sum + row.faceAmount, 0), corrected: repurchase.selected.filter(row => row.scope === "Grupo empresarial").reduce((sum, row) => sum + row.presentValue, 0), impact: -repurchase.selected.filter(row => row.scope === "Grupo empresarial").reduce((sum, row) => sum + row.presentValue, 0) },
    { label: "Pendências", rows: settlementAdjustments.selected.filter(row => row.kind === "Pendência"), face: settlementAdjustments.selected.filter(row => row.kind === "Pendência").reduce((sum, row) => sum + row.amount, 0), corrected: settlementAdjustments.selected.filter(row => row.kind === "Pendência").reduce((sum, row) => sum + row.amount, 0), impact: -settlementAdjustments.selected.filter(row => row.kind === "Pendência").reduce((sum, row) => sum + row.amount, 0) },
    { label: "Créditos", rows: settlementAdjustments.selected.filter(row => row.kind === "Crédito"), face: settlementAdjustments.selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0), corrected: settlementAdjustments.selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0), impact: settlementAdjustments.selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0) },
  ].filter(group => group.rows.length > 0);

  useEffect(() => {
    if ((pricing.targetFinalRateMonthly ?? 0) <= 0 || pricing.locked) return;
    setPricing(current => {
      const balanced = balanceFinalRate(current);
      return Math.abs(balanced.monthlyRate - current.monthlyRate) > .00005 ? balanced : current;
    });
  }, [pricing.targetFinalRateMonthly, pricing.method, pricing.vaEnabled, pricing.feeAllocation, pricing.manualFees, pricing.operationFee, pricing.feePerTitle, pricing.adValoremPercent, pricing.guaranteePercent, pricing.manualRetention, pricing.floatDays, pricing.minimumTermDays, pricing.locked]);

  function balanceFinalRate(next: PricingDraft) {
    const target = next.targetFinalRateMonthly ?? 0;
    return target > 0 ? { ...next, monthlyRate: baseRateForTargetFinal(operation, next, target) } : next;
  }

  function numberField(key: keyof PricingDraft, value: string) {
    setPricing(current => balanceFinalRate({ ...current, [key]: Math.max(0, Number(value) || 0), status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeedback("");
  }

  function setTargetFinalRate(value: string) {
    const targetFinalRateMonthly = Math.max(0, Number(value) || 0);
    setPricing(current => balanceFinalRate({ ...current, targetFinalRateMonthly, status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeedback(targetFinalRateMonthly > 0 ? "Taxa base recalculada para atingir a taxa final desejada, considerando a composição atual da operação." : "Meta removida. A taxa base voltou a ser editável.");
  }

  function scrollToPricingSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addManualFee() {
    const amount = Number(feeAmount.replace(",", "."));
    if (!feeDescription.trim() || !Number.isFinite(amount) || amount <= 0) { setFeedback("Informe a descrição e um valor positivo para adicionar a tarifa."); return; }
    const fee = { id: `fee-${Date.now()}`, description: feeDescription.trim(), amount, kind: "Esporádica" as const };
    setPricing(current => balanceFinalRate({ ...current, manualFees: [...(current.manualFees ?? []), fee], status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeeDescription(""); setFeeAmount(""); setFeedback("");
  }

  function removeManualFee(id: string) {
    setPricing(current => balanceFinalRate({ ...current, manualFees: (current.manualFees ?? []).filter(fee => fee.id !== id), status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeedback("");
  }

  function setRepurchaseSelection(ids: string[]) {
    setPricing(current => ({ ...current, repurchaseTitleIds: ids, status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeedback("");
  }

  function toggleRepurchaseTitle(id: string) {
    const current = new Set(pricing.repurchaseTitleIds ?? []);
    if (current.has(id)) current.delete(id); else current.add(id);
    setRepurchaseSelection([...current]);
  }

  function toggleSettlementAdjustment(id: string) {
    const current = new Set(pricing.settlementAdjustmentIds ?? []);
    if (current.has(id)) current.delete(id); else current.add(id);
    setPricing(value => ({ ...value, settlementAdjustmentIds: [...current], status: "Simulação", savedAt: undefined, savedBy: undefined }));
    setFeedback("");
  }

  function updateRepurchaseTerms(id: string, changes: Partial<NonNullable<PricingDraft["repurchaseTerms"]>[string]>) {
    setPricing(current => {
      const existing = current.repurchaseTerms?.[id] ?? { lateInterestMonthly: 1, penaltyPercent: 2, action: "Recompra" as const };
      return { ...current, repurchaseTerms: { ...(current.repurchaseTerms ?? {}), [id]: { ...existing, ...changes } }, status: "Simulação", savedAt: undefined, savedBy: undefined };
    });
    setFeedback("");
  }

  function restoreAcquisitionRate(id: string) {
    setPricing(current => {
      const existing = current.repurchaseTerms?.[id] ?? { lateInterestMonthly: 1, penaltyPercent: 2, action: "Recompra" as const };
      const { rateOverride: _ignored, ...withoutOverride } = existing;
      return { ...current, repurchaseTerms: { ...(current.repurchaseTerms ?? {}), [id]: withoutOverride }, status: "Simulação", savedAt: undefined, savedBy: undefined };
    });
    setFeedback("");
  }

  function savePricing() {
    if (!calculated.sourceTitleCount) { setFeedback("A precificação está bloqueada: nenhum título foi recebido da etapa de entrada."); return; }
    if (!calculated.hasDecisions) { setFeedback("A precificação está bloqueada: os títulos ainda não foram deliberados na etapa de risco."); return; }
    if (!calculated.approvedTitleCount) { setFeedback("A precificação está bloqueada: não há títulos aprovados para formar o borderô."); return; }
    if (totalOffsets > calculated.net) { setFeedback("A recompra e as compensações selecionadas superam o valor líquido comercial do borderô."); return; }
    if (!positiveEconomics) { setFeedback("A condição precisa gerar líquido final e spread positivos."); return; }
    if (rateBelowPolicy) { setFeedback(`A taxa está abaixo do piso de ${policyMinimum.toFixed(2).replace(".", ",")}% a.m. e exige alçada comercial.`); return; }
    const version = (pricing.version ?? 0) + 1;
    const savedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const auditEntry = { version, at: savedAt, by: "Henrique", action: "Condição salva" as const, reason: activeVersionReason || undefined, face: calculated.face, commercialNet: calculated.net, repurchaseAndCompensations: totalOffsets, borderoNet: netAfterRepurchase, monthlyRate: pricing.monthlyRate, method: pricing.method };
    const saved = { ...pricing, status: "Condição salva" as const, savedAt, savedBy: "Henrique", version, locked: true, audit: [...(pricing.audit ?? []), auditEntry] };
    setPricing(saved);
    onChange({ ...operation, pricingReview: saved, amount: calculated.face, titleCount: calculated.titleRows.length, netAmount: netAfterRepurchase, nextAction: "Submeter condição comercial às alçadas" });
    setFeedback("Condição comercial salva. Para alterar os valores, use Editar condição; o histórico anterior será preservado.");
    setActiveVersionReason("");
  }

  function startNewPricingVersion() {
    if (!versionReason.trim()) { setFeedback("Informe por que a condição será alterada. Esse motivo ficará no histórico da operação."); return; }
    const nextVersion = (pricing.version ?? 0) + 1;
    const at = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const auditEntry = { version: nextVersion, at, by: "Henrique", action: "Nova versão iniciada" as const, reason: versionReason.trim(), face: calculated.face, commercialNet: calculated.net, repurchaseAndCompensations: totalOffsets, borderoNet: netAfterRepurchase, monthlyRate: pricing.monthlyRate, method: pricing.method };
    setPricing(current => ({ ...current, status: "Simulação", locked: false, savedAt: undefined, savedBy: undefined, audit: [...(current.audit ?? []), auditEntry] }));
    setActiveVersionReason(versionReason.trim());
    setVersionReason("");
    setFeedback(`Edição liberada. Ao salvar, a revisão ${nextVersion} será registrada sem apagar a condição anterior.`);
  }

  function startRepurchaseComposition() {
    if (pricing.locked) {
      const reason = "Inclusão ou alteração de recompra";
      setPricing(current => ({ ...current, status: "Simulação", locked: false, savedAt: undefined, savedBy: undefined }));
      setActiveVersionReason(reason);
      setFeedback("Recompra liberada para composição. A condição anterior continuará preservada no histórico.");
    }
    setRepurchaseOpen(true);
  }

  return <section className={`pricing-workbench ${showGuidance ? "guidance-visible" : "guidance-hidden"} ${pricing.locked ? "pricing-locked" : ""}`}>
    <div className="pricing-hero"><div><Badge tone="eyebrow">PREÇO E ESTRUTURA</Badge><h3>Simulador da condição comercial</h3><p>Transforme o fluxo aprovado em taxa, valor líquido e retorno. O detalhamento por título fica disponível sem poluir a decisão.</p></div><Badge tone={pricing.status === "Condição salva" ? "ready" : "attention"}>{pricing.status}</Badge></div>
    <div className="pricing-help-strip"><span>AJUDA CONTEXTUAL</span><div><b>Condição financeira</b><InfoTip text="Define método de cálculo, taxa, custo de capital, float, prazo mínimo e forma de rateio das tarifas." /></div><div><b>Tarifas e retenções</b><InfoTip text="Configura os componentes descontados do valor liberado, incluindo tarifas, tributos, garantia e retenções." /></div><div><b>Tarifas esporádicas</b><InfoTip text="Inclui cobranças específicas e auditáveis que se aplicam somente a esta operação." /></div><div><b>Regresso</b><InfoTip text="Define a responsabilidade do cedente e o prazo para recomprar ou regularizar recebíveis inadimplidos." /></div></div>
    <nav className="pricing-quick-nav" aria-label="Atalhos da precificação"><span>IR PARA</span><button type="button" onClick={() => scrollToPricingSection("pricing-condition")}>Condição</button><button type="button" onClick={() => scrollToPricingSection("pricing-fees")}>Tarifas</button><button type="button" className="repurchase-nav-action" onClick={() => scrollToPricingSection("pricing-repurchase-overview")}>Recompra</button><button type="button" onClick={() => scrollToPricingSection("pricing-responsibility")}>Responsabilidade</button><button type="button" onClick={() => scrollToPricingSection("pricing-memory")}>Memória e auditoria</button></nav>
    <section className={`pricing-source-strip ${pricingSourceReady ? "ready" : "blocked"}`}><div><span>CARTEIRA DE ORIGEM</span><strong>{pricingSourceReady ? "Pronta para precificar" : "Origem incompleta"}</strong><small>{calculated.sourceTitleCount} título(s) recebidos da Entrada · {calculated.approvedTitleCount} aprovado(s) em Risco · {calculated.excludedTitleCount} excluído(s)</small></div><div><span>FACE APROVADA</span><strong>{preciseMoney.format(calculated.face)}</strong><small>{pricingSourceReady ? "Base única usada em todos os cálculos" : !calculated.sourceTitleCount ? "Inclua os títulos na Entrada" : !calculated.hasDecisions ? "Conclua as decisões de Risco" : "A operação não possui títulos aprovados"}</small></div></section>
    <section className={`pricing-version-bar ${pricing.locked ? "locked" : "editing"}`}><div><span>{pricing.locked ? "CONDIÇÃO COMERCIAL SALVA" : "REVISÃO EM ANDAMENTO"}</span><strong>{pricing.locked ? `Condição v${pricing.version ?? 0} protegida` : "Valores liberados para edição"}</strong><small>{pricing.locked ? `Salva por ${pricing.savedBy ?? "Usuário"} em ${pricing.savedAt ?? "data não informada"}. Para alterar taxa ou tarifas, informe o motivo e libere a edição. A condição atual continuará no histórico.` : activeVersionReason ? `Motivo da revisão: ${activeVersionReason}` : "Ao salvar, esta revisão será registrada sem apagar a condição anterior."}</small></div>{pricing.locked && <div className="pricing-version-action"><label><span>MOTIVO DA REVISÃO</span><input aria-label="Motivo da revisão da condição" value={versionReason} placeholder="Ex.: renegociação da taxa" onChange={event => setVersionReason(event.target.value)} /></label><button type="button" className="pricing-edit-action" onClick={startNewPricingVersion}>Editar taxa e tarifas</button></div>}</section>
    <div className="pricing-result-card"><div className="pricing-main-result"><span>{totalOffsets !== 0 ? "LÍQUIDO APÓS RECOMPRA" : "VALOR LÍQUIDO AO CEDENTE"}</span><strong>{preciseMoney.format(netAfterRepurchase)}</strong><small>{totalOffsets !== 0 ? `${preciseMoney.format(calculated.net)} comercial ${totalOffsets > 0 ? "−" : "+"} ${preciseMoney.format(Math.abs(totalOffsets))} em recompra e compensações` : `${((calculated.net / Math.max(1, calculated.face)) * 100).toFixed(2).replace(".", ",")}% do valor de face`}</small></div><div><span>TAXA BASE</span><strong>{pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.</strong><small>{pricing.method} · {Math.round(calculated.weightedTerm)} dias médios</small></div><div><span>TAXA EFETIVA FINAL</span><strong>{calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.</strong><small>Meta {targetFinalRate.toFixed(2).replace(".", ",")}% · diferença {finalRateGap >= 0 ? "+" : ""}{finalRateGap.toFixed(2).replace(".", ",")} p.p.</small></div><div><span>SPREAD PROJETADO</span><strong className={calculated.spread > 0 ? "positive" : "negative"}>{calculated.spread.toFixed(2).replace(".", ",")}% a.m.</strong><small>Custo de capital: {pricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.</small></div></div>
    {Math.abs(faceDifference) > .01 && <div className="pricing-reconciliation"><AlertIcon /><div><strong>Valor de face recalculado pelos títulos</strong><span>O resumo registra {preciseMoney.format(operation.amount)}, mas os títulos totalizam {preciseMoney.format(calculated.face)}. Ao salvar, os totais da operação serão sincronizados.</span></div></div>}
    <section id="pricing-repurchase-overview" className={`repurchase-overview pricing-anchor ${totalOffsets !== 0 ? "applied" : "empty"}`}><div className="repurchase-overview-main"><span>RECOMPRA</span><strong>{totalOffsets !== 0 ? "Resumo da recompra" : "Nenhuma recompra adicionada"}</strong>{totalOffsets !== 0 && <small>{repurchase.selected.length + settlementAdjustments.selected.length} item(ns) compondo este borderô</small>}</div>{totalOffsets !== 0 && <div className="repurchase-overview-summary"><div><span>VALOR DA RECOMPRA</span><strong>{preciseMoney.format(totalOffsets)}</strong></div><div><span>EFEITO NO LÍQUIDO</span><strong className={totalOffsets > 0 ? "negative" : "positive"}>{formatFlowMoney(-totalOffsets)}</strong></div><div><span>LÍQUIDO FINAL</span><strong>{preciseMoney.format(netAfterRepurchase)}</strong></div></div>}<button type="button" data-testid="open-repurchase" disabled={!repurchase.rows.length && !settlementAdjustments.rows.length} onClick={startRepurchaseComposition}>{totalOffsets !== 0 ? "Revisar recompra" : "Fazer recompra"}<ArrowIcon /></button></section>
    <div className="pricing-body"><fieldset className="pricing-editor pricing-editor-fieldset" disabled={pricing.locked}>
      <section id="pricing-condition" className="pricing-section pricing-anchor"><div className="pricing-section-head"><div><span>CONDIÇÃO FINANCEIRA</span><strong>Taxa e método de cálculo</strong></div><small>Piso da política: {policyMinimum.toFixed(2).replace(".", ",")}% a.m.</small></div><div className="pricing-fields"><label><span>MÉTODO DE DESÁGIO</span><select value={pricing.method} onChange={event => setPricing(current => ({ ...current, method: event.target.value as PricingDraft["method"], status: "Simulação", savedAt: undefined, savedBy: undefined }))}><option>Nominal</option><option>Efetiva</option><option>Mista</option><option>Composta Mista</option></select></label><label><span>TAXA MENSAL</span><div className="input-suffix"><input type="number" step="0.01" value={pricing.monthlyRate} onChange={event => numberField("monthlyRate", event.target.value)} /><b>% a.m.</b></div></label><label><span>TAXA FINAL DESEJADA</span><div className="input-suffix"><input type="number" step="0.01" value={pricing.targetFinalRateMonthly ?? 0} onChange={event => numberField("targetFinalRateMonthly", event.target.value)} /><b>% a.m.</b></div></label><label><span>CUSTO DE CAPITAL</span><div className="input-suffix"><input type="number" step="0.01" value={pricing.fundingCostMonthly} onChange={event => numberField("fundingCostMonthly", event.target.value)} /><b>% a.m.</b></div></label><label><span>FLOAT</span><div className="input-suffix"><input type="number" value={pricing.floatDays} onChange={event => numberField("floatDays", event.target.value)} /><b>dias</b></div></label><label><span>PRAZO MÍNIMO</span><div className="input-suffix"><input type="number" value={pricing.minimumTermDays} onChange={event => numberField("minimumTermDays", event.target.value)} /><b>dias</b></div></label><label><span>RATEIO DAS TARIFAS</span><select value={pricing.feeAllocation} onChange={event => setPricing(current => ({ ...current, feeAllocation: event.target.value as PricingDraft["feeAllocation"], status: "Simulação", savedAt: undefined, savedBy: undefined }))}><option>Por valor</option><option>Por valor × prazo</option></select></label><label className="pricing-check pricing-va-flag"><input type="checkbox" checked={pricing.vaEnabled} onChange={event => setPricing(current => ({ ...current, vaEnabled: event.target.checked, status: "Simulação", savedAt: undefined, savedBy: undefined }))} /><span>VA — EMBUTIR TARIFAS NO DESÁGIO</span></label></div>{pricing.vaEnabled && <div className="pricing-va-notice"><strong>VA ativo</strong><span>Fator ajustado de {calculated.adjustedRate.toFixed(4).replace(".", ",")}% a.m. As tarifas passam a compor o deságio sem alterar o valor líquido, o all-in ou o spread da operação.</span></div>}{Math.abs(finalRateGap) > .05 && <div className={`pricing-inline-alert ${finalRateGap < 0 ? "positive" : ""}`}><AlertIcon /> Taxa calculada {finalRateGap > 0 ? "acima" : "abaixo"} da meta em {Math.abs(finalRateGap).toFixed(2).replace(".", ",")} p.p.</div>}{rateBelowPolicy && <div className="pricing-inline-alert"><AlertIcon /> Taxa abaixo do piso da política. Será necessária alçada comercial.</div>}</section>
      <section id="pricing-fees" className="pricing-section pricing-anchor"><div className="pricing-section-head"><div><span>TARIFAS E RETENÇÕES</span><strong>Componentes da liberação</strong></div><small>{taxRule}</small></div><div className="pricing-fields"><label><span>TARIFA POR OPERAÇÃO</span><div className="input-prefix"><b>R$</b><input type="number" step="0.01" value={pricing.operationFee} onChange={event => numberField("operationFee", event.target.value)} /></div></label><label><span>TARIFA POR TÍTULO</span><div className="input-prefix"><b>R$</b><input type="number" step="0.01" value={pricing.feePerTitle} onChange={event => numberField("feePerTitle", event.target.value)} /></div></label><label><span>AD VALOREM</span><div className="input-suffix"><input type="number" step="0.01" value={pricing.adValoremPercent} disabled={operation.institution !== "Factoring"} onChange={event => numberField("adValoremPercent", event.target.value)} /><b>%</b></div></label><label><span>GARANTIA / RESERVA</span><div className="input-suffix"><input type="number" step="0.01" value={pricing.guaranteePercent} onChange={event => numberField("guaranteePercent", event.target.value)} /><b>%</b></div></label><label><span>RETENÇÃO MANUAL</span><div className="input-prefix"><b>R$</b><input type="number" step="0.01" value={pricing.manualRetention} onChange={event => numberField("manualRetention", event.target.value)} /></div></label><label><span>IOF DA OPERAÇÃO</span><input value={preciseMoney.format(calculated.iof)} disabled /></label></div></section>
      <section className="pricing-section pricing-custom-fees"><div className="pricing-section-head"><div><span>TARIFAS ESPORÁDICAS</span><strong>Itens específicos desta operação</strong></div><small>Tarifas nomeadas, auditáveis e aplicadas somente nesta condição</small></div><div className="pricing-fee-composer"><label className="fee-description"><span>DESCRIÇÃO</span><input aria-label="Descrição da tarifa esporádica" value={feeDescription} placeholder="Ex.: consulta extraordinária" onChange={event => setFeeDescription(event.target.value)} /></label><label><span>VALOR</span><div className="input-prefix"><b>R$</b><input aria-label="Valor da tarifa esporádica" inputMode="decimal" value={feeAmount} placeholder="0,00" onChange={event => setFeeAmount(event.target.value.replace(/[^0-9,.]/g, ""))} /></div></label><button type="button" onClick={addManualFee}><PlusIcon /> Adicionar tarifa</button></div>{Boolean(pricing.manualFees?.length) ? <div className="pricing-fee-list">{pricing.manualFees?.map(fee => <div key={fee.id}><span>{fee.description}</span><strong>{preciseMoney.format(fee.amount)}</strong><button type="button" aria-label={`Excluir tarifa ${fee.description}`} onClick={() => removeManualFee(fee.id)}><CloseIcon /></button></div>)}<div className="pricing-fee-total"><span>Total esporádico</span><strong>{preciseMoney.format(calculated.manualFees)}</strong></div></div> : <div className="pricing-fee-empty">Nenhuma tarifa esporádica adicionada.</div>}</section>
      <section id="pricing-repurchase" className="pricing-section pricing-offset-launcher pricing-anchor"><div><Badge tone={totalOffsets > 0 ? "ready" : "eyebrow"}>RECOMPRA E COMPENSAÇÕES</Badge><strong>Compor recompra no borderô</strong><span>Títulos do cedente ou do grupo, pendências e créditos disponíveis.</span>{totalOffsets > 0 && <small>{repurchase.selected.length} título(s) em recompra · {settlementAdjustments.selected.length} compensação(ões) · total {preciseMoney.format(totalOffsets)}</small>}</div><button type="button" onClick={() => setRepurchaseOpen(true)}>{totalOffsets > 0 ? "Revisar recompra" : "Adicionar recompra"}<ArrowIcon /></button></section>
      <section id="pricing-responsibility" className="pricing-section pricing-anchor"><div className="pricing-section-head"><div><span>ESTRUTURA DE RESPONSABILIDADE</span><strong>Regresso e coobrigação</strong></div><small>Condição vinculada ao termo da operação</small></div><div className="pricing-fields regress-fields"><label><span>REGRESSO</span><select value={pricing.regress} onChange={event => setPricing(current => ({ ...current, regress: event.target.value as PricingDraft["regress"], status: "Simulação" }))}><option>Com regresso</option><option>Sem regresso</option></select></label><label><span>PRAZO PARA REGRESSO</span><div className="input-suffix"><input type="number" value={pricing.regressDays} disabled={pricing.regress === "Sem regresso"} onChange={event => numberField("regressDays", event.target.value)} /><b>D+</b></div></label><label className="pricing-check"><input type="checkbox" checked={pricing.coobligation} onChange={event => setPricing(current => ({ ...current, coobligation: event.target.checked, status: "Simulação" }))} /><span>CEDENTE COOBRIGADO</span></label></div></section>
    </fieldset><aside className="pricing-waterfall"><div className="pricing-section-head"><div><span>MEMÓRIA DA OPERAÇÃO</span><strong>Formação do líquido</strong></div></div><div className="waterfall-lines"><div><span>Valor de face</span><strong>{preciseMoney.format(calculated.face)}</strong></div><div><span>(–) {calculated.vaEnabled ? "Deságio com VA" : "Deságio"}</span><strong>{preciseMoney.format(calculated.discount)}</strong></div>{!calculated.vaEnabled && <div><span>(–) Tarifas</span><strong>{preciseMoney.format(calculated.displayedFees)}</strong></div>}<div><span>(–) Tributos configurados</span><strong>{preciseMoney.format(calculated.iof)}</strong></div><div><span>(–) Garantia / reserva</span><strong>{preciseMoney.format(calculated.guarantee)}</strong></div><div><span>(–) Retenção manual</span><strong>{preciseMoney.format(pricing.manualRetention)}</strong></div><div className="waterfall-subtotal"><span>Líquido comercial</span><strong>{preciseMoney.format(calculated.net)}</strong></div>{totalOffsets !== 0 && <div className={`waterfall-repurchase ${totalOffsets < 0 ? "credit" : ""}`}><span>({totalOffsets > 0 ? "–" : "+"}) Recompra e compensações</span><strong>{preciseMoney.format(Math.abs(totalOffsets))}</strong></div>}<div className="waterfall-total"><span>Líquido do borderô</span><strong>{preciseMoney.format(netAfterRepurchase)}</strong></div></div>{calculated.vaEnabled && <div className="pricing-va-audit"><span>COMPOSIÇÃO INTERNA DO VA</span><small>Deságio original {preciseMoney.format(calculated.originalDiscount)} + tarifas {preciseMoney.format(calculated.fees)}</small><small>Fator ajustado {calculated.adjustedRate.toFixed(4).replace(".", ",")}% a.m. · ajuste de fechamento {preciseMoney.format(calculated.vaVariance)}</small></div>}<div className="pricing-policy"><span>LEITURA DA CONDIÇÃO</span><strong className={positiveEconomics && !rateBelowPolicy ? "positive" : "warning-text"}>{positiveEconomics && !rateBelowPolicy ? "Dentro da política" : "Exige atenção"}</strong><small>{rateBelowPolicy ? "Taxa abaixo do piso comercial." : calculated.spread <= 0 ? "Spread não remunera o custo de capital." : netAfterRepurchase <= 0 ? "A recompra e as compensações consomem todo o líquido do borderô." : "Spread positivo e líquido final calculado."}</small></div><button className="pricing-save" disabled={pricing.locked} onClick={savePricing}>{pricing.locked ? `Condição v${pricing.version ?? 0} salva` : "Salvar condição comercial"}</button>{feedback && <div className={`pricing-feedback ${feedback.startsWith("Condição comercial salva") ? "success" : "warning"}`}>{feedback}</div>}</aside></div>
    <section id="pricing-memory" className="pricing-details pricing-anchor"><button onClick={() => setDetailsOpen(value => !value)}><span><b>Memória título a título</b><small>{calculated.titleRows.length} recebíveis · tarifas rateadas {pricing.feeAllocation.toLowerCase()}{calculated.vaEnabled ? " · incorporadas ao VA" : ""}</small></span><strong>{detailsOpen ? "Recolher" : "Ver cálculo"}</strong></button>{detailsOpen && <div className="pricing-table-scroll"><div className="pricing-table-head"><span>TÍTULO</span><span>SACADO</span><span>VENCIMENTO</span><span>DIAS</span><span>FACE</span><span>DESÁGIO</span><span>TARIFAS</span><span>RETENÇÃO</span><span>LÍQUIDO</span></div>{calculated.titleRows.map(row => <div className="pricing-table-row" key={row.title.id}><span>{row.title.documentNumber}</span><span>{row.title.debtorName}</span><span>{row.title.dueDate || "—"}</span><span>{row.days}</span><span>{preciseMoney.format(row.title.amount)}</span><span>{preciseMoney.format(row.displayedDiscount)}</span><span>{calculated.vaEnabled ? "Inclusa no VA" : preciseMoney.format(row.displayedFees)}</span><span>{preciseMoney.format(row.allocatedGuarantee)}</span><strong>{preciseMoney.format(row.net)}</strong></div>)}</div>}</section>
    {Boolean(pricing.audit?.length) && <section className="pricing-audit"><div className="pricing-section-head"><div><span>TRILHA DE AUDITORIA</span><strong>Histórico da condição comercial</strong></div><small>{pricing.audit?.length} evento(s) registrado(s)</small></div><div className="pricing-audit-list">{pricing.audit?.slice().reverse().map((event, index) => <div key={`${event.at}-${event.action}-${index}`}><span className={event.action === "Condição salva" ? "saved" : "editing"}>v{event.version} · {event.action}</span><strong>{event.by} · {event.at}</strong><small>{event.reason ? `Motivo: ${event.reason} · ` : ""}{event.method} a {event.monthlyRate.toFixed(2).replace(".", ",")}% a.m. · face {preciseMoney.format(event.face)} · líquido final {preciseMoney.format(event.borderoNet)}</small></div>)}</div></section>}
    {repurchaseOpen && <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setRepurchaseOpen(false)}><section className={`offset-modal ${pricing.locked ? "readonly" : ""}`} role="dialog" aria-modal="true" aria-label="Recompra e compensações"><div className="modal-head"><div><Badge tone="eyebrow">RECOMPRA E COMPENSAÇÕES</Badge><h2>{pricing.locked ? "Consultar recompra do borderô" : "Compor recompra do borderô"}</h2><p>{operation.cedent} · {pricing.locked ? "condição salva em modo de consulta. Use Editar condição para fazer alterações." : "selecione os títulos da recompra e demais compensações financeiras."}</p></div><button aria-label="Fechar recompra e compensações" onClick={() => setRepurchaseOpen(false)}><CloseIcon /></button></div>
      <div className="offset-modal-summary"><div><span>LÍQUIDO COMERCIAL</span><strong>{preciseMoney.format(calculated.net)}</strong></div><div><span>EFEITO NO LÍQUIDO</span><strong className={totalOffsets > 0 ? "negative" : totalOffsets < 0 ? "positive" : ""}>{formatFlowMoney(-totalOffsets)}</strong><small>{totalOffsets > 0 ? "Recompra e débitos superam os créditos" : totalOffsets < 0 ? "Créditos superam a recompra e os débitos" : "Sem impacto financeiro selecionado"}</small></div><div><span>LÍQUIDO DO BORDERÔ</span><strong className={netAfterRepurchase > 0 ? "positive" : "negative"}>{preciseMoney.format(netAfterRepurchase)}</strong></div></div>
      <section className="offset-insights"><div><span>INSIGHTS DA COMPOSIÇÃO</span><strong>{repurchase.selected.length + settlementAdjustments.selected.length ? "Leitura automática da seleção" : "Selecione itens para receber insights"}</strong></div>{repurchase.selected.length + settlementAdjustments.selected.length ? <div className="offset-insight-list"><span><b>{repurchase.selected.filter(row => row.overdue).length}</b> recompra(s) vencida(s) na seleção</span><span><b>{repurchase.selected.filter(row => row.scope === "Grupo").length + settlementAdjustments.selected.filter(row => row.scope === "Grupo").length}</b> item(ns) originado(s) do grupo empresarial</span><span><b>{preciseMoney.format(settlementAdjustments.selected.filter(row => row.kind === "Crédito").reduce((sum, row) => sum + row.amount, 0))}</b> em créditos compensando o líquido</span></div> : <small>Ao selecionar recompras, pendências ou créditos, o sistema destacará vencidos, itens do grupo e compensações.</small>}</section>
      <fieldset className="offset-modal-controls" disabled={pricing.locked}><section className="offset-filter-panel"><div className="offset-nature-filter"><span>NATUREZA</span>{(["Todos", "Débitos", "Créditos"] as const).map(nature => <button type="button" className={offsetNatureFilter === nature ? "selected" : ""} key={nature} onClick={() => setOffsetNatureFilter(nature)}>{nature === "Todos" ? "Débitos e créditos" : nature}</button>)}</div><label><span>ORIGEM</span><select aria-label="Filtrar origem da compensação" value={offsetSourceFilter} onChange={event => setOffsetSourceFilter(event.target.value as typeof offsetSourceFilter)}><option>Todos</option><option>Títulos</option><option>Pendências</option><option>Créditos</option></select></label><label className="offset-group-toggle"><input type="checkbox" checked={includeGroupOffsets} onChange={event => setIncludeGroupOffsets(event.target.checked)} /><span><b>Incluir grupo empresarial</b><small>Buscar também posições das empresas relacionadas</small></span></label><label className="offset-search"><span>BUSCAR</span><div><SearchIcon /><input aria-label="Buscar itens para compensação" value={offsetSearch} placeholder="Título, sacado, referência ou descrição" onChange={event => setOffsetSearch(event.target.value)} /></div></label></section>
      <section className="offset-selection-memory"><div className="offset-memory-head"><div><span>MEMÓRIA DA SELEÇÃO</span><strong>{repurchase.selected.length + settlementAdjustments.selected.length} item(ns) reservado(s)</strong></div><small>A seleção permanece salva ao alterar os filtros.</small></div>{selectedOffsetMemory.length ? <div className="offset-memory-groups">{selectedOffsetMemory.map(group => <div key={group.label}><span>{group.label}</span><strong>{group.rows.length}</strong><small>Face/original <b>{preciseMoney.format(group.face)}</b></small><small>Efeito no líquido <b className={group.impact >= 0 ? "positive" : "negative"}>{formatFlowMoney(group.impact)}</b></small></div>)}</div> : <div className="offset-memory-empty">Nenhum item selecionado.</div>}<div className="offset-memory-total"><span>EFEITO TOTAL NO LÍQUIDO</span><b>{repurchase.selected.length + settlementAdjustments.selected.length} item(ns)</b><strong className={totalOffsets > 0 ? "negative" : totalOffsets < 0 ? "positive" : ""}>{formatFlowMoney(-totalOffsets)}</strong></div></section>
      <div className="offset-modal-body"><div className="offset-list-toolbar"><div><strong>Itens disponíveis para composição</strong><span>{filteredOffsetRows.length} resultado(s) exibido(s) · {offsetRows.length} disponível(is) considerando o grupo</span></div><button type="button" onClick={() => { const ids = filteredOffsetRows.filter(item => item.kind === "Título" && item.row.overdue).map(item => item.row.id); setRepurchaseSelection([...new Set([...(pricing.repurchaseTitleIds ?? []), ...ids])]); }}>Selecionar vencidos visíveis</button></div>{filteredOffsetRows.length ? <div className="offset-title-grid-scroll"><div className="offset-title-grid-head"><span></span><span>ITEM / ORIGEM</span><span>VENCIMENTO</span><span>VALOR ORIGINAL</span><span>TAXA VP</span><span>CORREÇÃO / MORA</span><span>MULTA</span><span>TRATAMENTO</span><span>VALOR PARCIAL</span><span>VALOR CORRIGIDO</span></div>{filteredOffsetRows.map(item => { if (item.kind === "Título") { const row = item.row; return <div className={`offset-title-grid-row${row.selected ? " selected" : ""}`} key={row.id}><input aria-label={`Selecionar ${row.documentNumber}`} type="checkbox" checked={row.selected} onChange={() => toggleRepurchaseTitle(row.id)} /><div className="offset-title-id"><span className={`repurchase-status ${row.overdue ? "overdue" : "due"}`}>{row.overdue ? `Vencido há ${row.days}d` : `A vencer em ${row.days}d`}</span><strong>{row.documentNumber}</strong><small>{row.portfolioOwnerName ?? row.debtorName}</small><em>{row.scope} · {row.acquisitionReference}</em></div><span className={`offset-due-date ${row.overdue ? "overdue" : "due"}`}><strong>{formatBrazilianDate(row.dueDate)}</strong><small>{row.overdue ? "Vencido" : "A vencer"}</small></span><span className="offset-face">{preciseMoney.format(row.faceAmount)}</span><label className="offset-rate"><input aria-label={`Taxa VP ${row.documentNumber}`} type="number" step="0.01" value={row.appliedRate} disabled={!row.selected} onChange={event => updateRepurchaseTerms(row.id, { rateOverride: Math.max(0, Number(event.target.value) || 0) })} /><b>%</b><button type="button" disabled={!row.selected || row.terms.rateOverride === undefined} onClick={() => restoreAcquisitionRate(row.id)}>Original {row.acquisitionMonthlyRate.toFixed(2).replace(".", ",")}%</button></label><label className="offset-percent"><input aria-label={`Correção ou mora ${row.documentNumber}`} type="number" step="0.01" value={row.terms.lateInterestMonthly} disabled={!row.selected || !row.overdue} onChange={event => updateRepurchaseTerms(row.id, { lateInterestMonthly: Math.max(0, Number(event.target.value) || 0) })} /><b>% a.m.</b></label><label className="offset-percent"><input aria-label={`Multa ${row.documentNumber}`} type="number" step="0.01" value={row.terms.penaltyPercent} disabled={!row.selected || !row.overdue} onChange={event => updateRepurchaseTerms(row.id, { penaltyPercent: Math.max(0, Number(event.target.value) || 0) })} /><b>%</b></label><select aria-label={`Tratamento ${row.documentNumber}`} value={row.terms.action ?? "Recompra"} disabled={!row.selected} onChange={event => { const action = event.target.value as NonNullable<typeof row.terms.action>; updateRepurchaseTerms(row.id, { action, partialAmount: action === "Recompra parcial" ? (row.terms.partialAmount ?? Math.min(row.faceAmount, row.fullRegressValue)) : row.terms.partialAmount }); }}><option>Recompra</option><option>Baixar do banco</option><option>Baixar somente do sistema</option><option>Recompra parcial</option></select><label className="offset-partial"><span>R$</span><input aria-label={`Valor parcial ${row.documentNumber}`} type="number" step="0.01" value={row.terms.partialAmount ?? 0} disabled={!row.selected || row.terms.action !== "Recompra parcial"} onChange={event => updateRepurchaseTerms(row.id, { partialAmount: Math.min(row.fullRegressValue, Math.max(0, Number(event.target.value) || 0)) })} /></label><div className="offset-total"><strong className="negative">{formatFlowMoney(-row.presentValue)}</strong><small>{row.overdue ? `Reduz o líquido · correção ${preciseMoney.format(row.adjustment)} · mora ${preciseMoney.format(row.lateInterest)} · multa ${preciseMoney.format(row.penalty)}` : `Reduz o líquido · deságio ${preciseMoney.format(row.adjustment)}`}</small></div></div>; } const row = item.row; return <div className={`offset-title-grid-row offset-adjustment-row${row.selected ? " selected" : ""}`} key={row.id}><input aria-label={`Selecionar ${row.description}`} type="checkbox" checked={row.selected} onChange={() => toggleSettlementAdjustment(row.id)} /><div className="offset-title-id"><span className={`offset-kind-badge ${row.kind === "Crédito" ? "credit" : "debit"}`}>{row.kind}</span><strong>{row.description}</strong><small>{row.ownerName}</small><em>{row.scope} · {row.reference}</em></div><span className="offset-placeholder">—</span><span className="offset-face">{preciseMoney.format(row.amount)}</span><span className="offset-placeholder">—</span><span className="offset-placeholder">—</span><span className="offset-placeholder">—</span><span className="offset-treatment-static">Compensação</span><span className="offset-placeholder">—</span><div className="offset-total"><strong className={row.kind === "Crédito" ? "positive" : "negative"}>{formatFlowMoney(row.kind === "Crédito" ? row.amount : -row.amount)}</strong><small>{row.kind === "Crédito" ? "Crédito que compensa a recompra" : "Pendência que reduz o líquido"}</small></div></div>; })}</div> : <div className="offset-empty">Nenhum item encontrado para os filtros informados.</div>}</div>
      </fieldset><div className="offset-modal-note"><AlertIcon /><span>{pricing.locked ? "Esta condição está salva e protegida. Você pode consultar a composição; para alterar a recompra, feche esta janela e use Editar condição." : "A taxa VP parte da aquisição original e pode ser ajustada. Correção/mora e multa incidem nos vencidos. O tratamento define se haverá recompra integral, recompra parcial, baixa bancária ou baixa somente no sistema. Créditos selecionados compensam a recompra e aumentam o líquido final."}</span></div><div className="modal-actions offset-modal-actions">{!pricing.locked && <button type="button" className="secondary-action" onClick={() => { setRepurchaseSelection([]); setPricing(current => ({ ...current, settlementAdjustmentIds: [], status: "Simulação" })); }}>Limpar recompra</button>}<button type="button" className="primary-action" onClick={() => setRepurchaseOpen(false)}>{pricing.locked ? "Fechar consulta" : `Aplicar ao borderô · ${formatFlowMoney(-totalOffsets)} no líquido`}</button></div></section></div>}
  </section>;
}

function ApprovalPanel({ operation, onChange }: { operation: Operation; onChange: (operation: Operation) => void }) {
  const pricing = normalizedPricing(operation);
  const calculated = pricingCalculation(operation, pricing);
  const repurchase = repurchaseCalculation(operation, pricing);
  const adjustments = settlementAdjustmentCalculation(operation, pricing);
  const totalOffsets = repurchase.total + adjustments.total;
  const finalNet = roundPricing(calculated.net - totalOffsets);
  const lastro = lastroAssessmentFor(operation);
  const riskApproved = operation.riskReview?.cedentDecision === "Aprovado" && (operation.manualEntry?.entries ?? []).every(title => operation.riskReview?.titleDecisions?.[title.id] === "Aprovado");
  const checklist = [
    { label: "Risco e elegibilidade", ok: riskApproved, detail: riskApproved ? "Cedente, sacados e títulos aprovados" : "Existem decisões de risco pendentes" },
    { label: "Lastro e confirmação", ok: lastro.ready, detail: lastro.ready ? "Evidências e confirmações concluídas" : `${lastro.divergences} divergência(s) ou confirmação pendente` },
    { label: "Condição comercial", ok: operation.pricingReview?.status === "Condição salva", detail: operation.pricingReview?.status === "Condição salva" ? `Condição v${operation.pricingReview.version ?? 1} protegida` : "A condição ainda não foi salva" },
    { label: "Bloqueios operacionais", ok: operation.blockers === 0, detail: operation.blockers ? `${operation.blockers} bloqueio(s) exigem deliberação` : "Nenhum bloqueio aberto" },
  ];
  const prerequisitesReady = checklist.every(item => item.ok);
  const now = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const defaultApprovals: NonNullable<Operation["approvalReview"]>["approvals"] = [
    { id: "originacao", role: "Responsável pela operação", approver: operation.owner, status: "Aprovado", decidedAt: "Agora", note: "Pacote preparado e conferido" },
    { id: "credito", role: "Alçada de crédito", approver: operation.risk === "Baixo" ? "Motor de alçada" : "Comitê de Crédito", status: operation.risk === "Baixo" && prerequisitesReady ? "Aprovado" : "Pendente", decidedAt: operation.risk === "Baixo" && prerequisitesReady ? "Agora" : undefined, note: operation.risk === "Baixo" ? "Dentro da política vigente" : "Requer deliberação humana" },
    { id: "diretoria", role: "Alçada final", approver: operation.institution === "FIDC" ? "Diretoria / Gestora" : "Diretoria Comercial", status: "Pendente" },
  ];
  const defaultDocuments: NonNullable<Operation["approvalReview"]>["documents"] = [
    { id: "bordero", name: "Borderô da operação", required: true, status: "Pronto", source: "Gerado pelo sistema" },
    { id: "cessao", name: operation.institution === "FIDC" ? "Termo de cessão" : "Instrumento de cessão", required: true, status: "Pronto", source: "Modelo do veículo" },
    { id: "memoria", name: "Memória da condição comercial", required: true, status: operation.pricingReview?.status === "Condição salva" ? "Pronto" : "Pendente", source: "Etapa Preço" },
    { id: "lastro", name: "Dossiê de lastro e confirmações", required: true, status: lastro.ready ? "Pronto" : "Pendente", source: "Etapa Lastro" },
    { id: "nfe", name: "Documentos fiscais e recebíveis", required: true, status: (operation.manualEntry?.entries ?? []).every(item => Boolean(item.nfeKey) || operation.operationType === "Cheque") ? "Pronto" : "Pendente", source: "Entrada da operação" },
    { id: "compliance", name: "Cadastro e compliance do cedente", required: true, status: operation.document !== "Cadastro pendente" ? "Pronto" : "Pendente", source: "Cadastro do cedente" },
  ];
  const defaultSignatures: NonNullable<Operation["approvalReview"]>["signatures"] = [
    { id: "cedente", party: operation.cedent, signer: "Representante autorizado do cedente", status: "Não enviado" },
    { id: "cessionaria", party: operation.vehicle, signer: operation.institution === "FIDC" ? "Representante da gestora" : "Representante autorizado", status: "Não enviado" },
  ];
  const review = operation.approvalReview ?? { status: "Preparação" as const, approvals: defaultApprovals, documents: defaultDocuments, signatures: defaultSignatures, audit: [] };
  const approvals = review.approvals?.length ? review.approvals : defaultApprovals;
  const documents = review.documents?.length ? review.documents : defaultDocuments;
  const signatures = review.signatures?.length ? review.signatures : defaultSignatures;
  const approvedCount = approvals.filter(item => item.status === "Aprovado").length;
  const readyDocuments = documents.filter(item => item.status === "Pronto" || item.status === "Dispensado").length;
  const signedCount = signatures.filter(item => item.status === "Assinado").length;
  const cedent = initialCedents.find(item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""));
  const availableLimit = cedent ? Math.max(0, cedent.creditLimit - cedent.usedLimit) : 0;
  const projectedLimit = Math.max(0, availableLimit - calculated.face);
  const retainedTotal = roundPricing(calculated.guarantee + pricing.manualRetention);
  const targetFinalRate = pricing.targetFinalRateMonthly ?? 0;
  const operationFeeTotal = roundPricing(pricing.operationFee);
  const titleFeeTotal = roundPricing(pricing.feePerTitle * calculated.titleRows.length);
  const adValoremTotal = roundPricing(calculated.face * pricing.adValoremPercent / 100);
  const averageTerm = Math.round(calculated.weightedTerm);
  const averageFloat = pricing.floatDays;
  const averageNetTerm = Math.max(0, averageTerm - averageFloat);
  const periodFactor = averageTerm > 0 ? calculated.originalDiscount / Math.max(1, calculated.face) * 100 : 0;
  const realMonthlyFactor = calculated.allInMonthly;
  const suggestedMonthlyFactor = targetFinalRate || Math.max(pricing.monthlyRate, pricing.fundingCostMonthly);
  const projectedRoa = calculated.face > 0 ? (calculated.spread * 12) : 0;
  const repurchaseByAction = (action: "Recompra" | "Baixar do banco" | "Baixar somente do sistema" | "Recompra parcial") => roundPricing(repurchase.selected.filter(item => (item.terms.action ?? "Recompra") === action).reduce((sum, item) => sum + item.presentValue, 0));
  const approvalTimeline = [
    ...(operation.stageCompletions ?? []).map(item => ({ at: item.completedAt, by: item.completedBy, action: `${stages[item.stageId - 1]?.short ?? "Etapa"} concluída`, detail: "Dados preservados para a decisão" })),
    ...(review.audit ?? []),
  ].reverse();
  const [observation, setObservation] = useState(review.observation ?? "");
  const [feedback, setFeedback] = useState("");
  const [reportType, setReportType] = useState<"Borderô" | "Termo de cessão" | "Memória financeira" | "Dossiê da operação" | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  function toggleSection(section: string) {
    setCollapsedSections(current => ({ ...current, [section]: !current[section] }));
  }

  function collapseButton(section: string, label: string) {
    const collapsed = Boolean(collapsedSections[section]);
    return <button type="button" className={`approval-collapse${collapsed ? " collapsed" : ""}`} aria-expanded={!collapsed} aria-label={`${collapsed ? "Abrir" : "Fechar"} ${label}`} onClick={() => toggleSection(section)}><span>{collapsed ? "Abrir" : "Fechar"}</span><i>⌃</i></button>;
  }

  function saveReview(change: Partial<NonNullable<Operation["approvalReview"]>>, action: string, detail: string) {
    const next = { ...review, ...change, approvals: change.approvals ?? approvals, documents: change.documents ?? documents, signatures: change.signatures ?? signatures, audit: [...(review.audit ?? []), { at: now(), by: "Henrique", action, detail }] };
    onChange({ ...operation, approvalReview: next });
  }

  function submitForApproval() {
    if (!prerequisitesReady || readyDocuments < documents.filter(item => item.required).length) { setFeedback("Conclua os requisitos e documentos obrigatórios antes de enviar para as alçadas."); return; }
    saveReview({ status: "Em aprovação", submittedAt: now(), submittedBy: "Henrique", observation }, "Enviada para aprovação", `${approvals.length} alçada(s) configurada(s)`);
    setFeedback("Pacote enviado para as alçadas. As decisões ficam registradas individualmente.");
  }

  function decideApproval(id: string, decision: "Aprovado" | "Reprovado") {
    const nextApprovals = approvals.map(item => item.id === id ? { ...item, status: decision, decidedAt: now(), note: observation.trim() || item.note } : item);
    saveReview({ status: decision === "Reprovado" ? "Reprovada" : review.status === "Preparação" ? "Em aprovação" : review.status, approvals: nextApprovals, observation }, decision === "Aprovado" ? "Alçada aprovada" : "Alçada reprovada", nextApprovals.find(item => item.id === id)?.role ?? id);
    setFeedback(decision === "Aprovado" ? "Aprovação registrada na trilha da operação." : "Reprovação registrada. A operação permanece bloqueada para formalização.");
  }

  function approveOperation() {
    if (approvals.some(item => item.status !== "Aprovado")) { setFeedback("Ainda existem alçadas pendentes ou reprovadas."); return; }
    saveReview({ status: "Aprovada", observation }, "Operação aprovada", `Líquido aprovado: ${preciseMoney.format(finalNet)}`);
    setFeedback("Operação aprovada. O pacote está pronto para envio às assinaturas.");
  }

  function sendForSignatures() {
    if (review.status !== "Aprovada" && review.status !== "Em formalização") { setFeedback("A operação precisa estar aprovada antes do envio para assinatura."); return; }
    const sent = signatures.map(item => item.status === "Não enviado" ? { ...item, status: "Enviado" as const, sentAt: now() } : item);
    saveReview({ status: "Em formalização", signatures: sent }, "Formalização iniciada", `${sent.length} assinatura(s) solicitada(s)`);
    setFeedback("Documentos preparados e enviados para assinatura na simulação.");
  }

  function registerSignature(id: string) {
    const nextSignatures = signatures.map(item => item.id === id ? { ...item, status: "Assinado" as const, signedAt: now(), sentAt: item.sentAt ?? now() } : item);
    saveReview({ status: "Em formalização", signatures: nextSignatures }, "Assinatura registrada", nextSignatures.find(item => item.id === id)?.party ?? id);
    setFeedback(nextSignatures.every(item => item.status === "Assinado") ? "Todas as partes assinaram. A operação está pronta para seguir à liquidação." : "Assinatura registrada. Ainda existem partes aguardando assinatura.");
  }

  function toggleDocument(id: string) {
    const nextDocuments = documents.map(item => item.id === id ? { ...item, status: item.status === "Pronto" ? "Pendente" as const : "Pronto" as const } : item);
    saveReview({ documents: nextDocuments }, "Documento atualizado", nextDocuments.find(item => item.id === id)?.name ?? id);
  }

  return <section className="approval-workbench">
    <div className="approval-hero"><div><Badge tone="eyebrow">APROVAÇÃO E FORMALIZAÇÃO</Badge><h3>Pacote decisório da operação</h3><p>Uma leitura única das condições aprovadas, requisitos, alçadas, documentos e assinaturas.</p></div><Badge tone={review.status === "Aprovada" || review.status === "Em formalização" ? "ready" : review.status === "Reprovada" ? "cancelled" : "attention"}>{review.status}</Badge></div>
    <section className={`approval-financial-decision${collapsedSections.financial ? " is-collapsed" : ""}`}>
          <div className="approval-financial-head"><div><span>RESUMO FINANCEIRO PARA DECISÃO</span><strong>{collapsedSections.financial ? `Líquido do borderô · ${preciseMoney.format(finalNet)}` : "O que será efetivamente aprovado"}</strong><small>{collapsedSections.financial ? `${calculated.titleRows.length} títulos · taxa final ${calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.` : "Condição comercial, impacto no caixa, risco e limite em uma única leitura."}</small></div><div className="approval-head-actions"><Badge tone={prerequisitesReady ? "ready" : "attention"}>{prerequisitesReady ? "PRONTA PARA ALÇADA" : "COM PENDÊNCIAS"}</Badge>{collapseButton("financial", "resumo financeiro")}</div></div>
          {!collapsedSections.financial && <>
          <div className="approval-money-hero"><div><span>VALOR DE FACE</span><strong>{preciseMoney.format(calculated.face)}</strong><small>{calculated.titleRows.length} recebíveis · prazo médio {Math.round(calculated.weightedTerm)} dias</small></div><i>→</i><div className="net"><span>LÍQUIDO DO BORDERÔ</span><strong>{preciseMoney.format(finalNet)}</strong><small>{calculated.face ? ((finalNet / calculated.face) * 100).toFixed(2).replace(".", ",") : "0,00"}% da face</small></div></div>
          <div className="approval-financial-grid"><div><span>TAXA BASE</span><strong>{pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.</strong><small>{pricing.method}</small></div><div><span>TAXA FINAL CALCULADA</span><strong>{calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.</strong><small>{targetFinalRate > 0 ? `Meta ${targetFinalRate.toFixed(2).replace(".", ",")}% a.m.` : "Sem meta definida"}</small></div><div><span>SPREAD PROJETADO</span><strong className={calculated.spread >= 0 ? "positive" : "negative"}>{calculated.spread.toFixed(2).replace(".", ",")}% a.m.</strong><small>Custo {pricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.</small></div><div><span>LIMITE DISPONÍVEL</span><strong>{preciseMoney.format(availableLimit)}</strong><small>Após operação: {preciseMoney.format(projectedLimit)}</small></div><div><span>DESÁGIO</span><strong>{preciseMoney.format(calculated.originalDiscount)}</strong><small>{calculated.face ? (calculated.originalDiscount / calculated.face * 100).toFixed(2).replace(".", ",") : "0,00"}% da face</small></div><div><span>TARIFAS</span><strong>{preciseMoney.format(calculated.fees)}</strong><small>{pricing.manualFees?.length ?? 0} esporádica(s)</small></div><div><span>IMPOSTOS</span><strong>{preciseMoney.format(calculated.iof)}</strong><small>Regra do veículo</small></div><div><span>GARANTIAS / RETENÇÕES</span><strong>{preciseMoney.format(retainedTotal)}</strong><small>Reserva e retenção manual</small></div><div><span>RECOMPRA</span><strong className={totalOffsets > 0 ? "negative" : ""}>{preciseMoney.format(totalOffsets)}</strong><small>{repurchase.selected.length + adjustments.selected.length} item(ns)</small></div><div><span>RISCO</span><strong>{operation.risk}</strong><small>{operation.policy}</small></div><div><span>REGRESSO</span><strong>{pricing.regress}</strong><small>{pricing.coobligation ? "Cedente coobrigado" : "Sem coobrigação"}</small></div><div><span>CEDENTE</span><strong>{cedent?.score ?? "—"}</strong><small>Score · {cedent?.incidents ?? 0} apontamento(s)</small></div></div>
          <div className="approval-waterfall"><span><b>Face</b><strong>{preciseMoney.format(calculated.face)}</strong></span><span><b>− Deságio</b><strong>{preciseMoney.format(calculated.originalDiscount)}</strong></span><span><b>− Tarifas e impostos</b><strong>{preciseMoney.format(calculated.fees + calculated.iof)}</strong></span><span><b>− Retenções</b><strong>{preciseMoney.format(retainedTotal)}</strong></span><span><b>− Recompra</b><strong>{preciseMoney.format(totalOffsets)}</strong></span><span className="total"><b>= Líquido</b><strong>{preciseMoney.format(finalNet)}</strong></span></div>
          <div className="approval-financial-ledger">
            <section className="approval-ledger-card"><header><span>NEGÓCIO</span><strong>Formação do valor a pagar</strong></header><div><span>Total de face</span><strong>{preciseMoney.format(calculated.face)}</strong></div><div><span>(−) Deságio</span><em>{calculated.face ? (calculated.originalDiscount / calculated.face * 100).toFixed(4).replace(".", ",") : "0,0000"}%</em><strong>{preciseMoney.format(calculated.originalDiscount)}</strong></div><div><span>(−) Ad valorem</span><em>{pricing.adValoremPercent.toFixed(4).replace(".", ",")}%</em><strong>{preciseMoney.format(adValoremTotal)}</strong></div><div><span>(−) Tarifas</span><strong>{preciseMoney.format(calculated.fees)}</strong></div><div><span>(−) Impostos diversos</span><strong>{preciseMoney.format(calculated.iof)}</strong></div><div><span>(−) Retenções</span><strong>{preciseMoney.format(retainedTotal)}</strong></div><div><span>(−) Recompra líquida</span><strong>{preciseMoney.format(totalOffsets)}</strong></div><div className="ledger-total"><span>Total a pagar</span><strong>{preciseMoney.format(finalNet)}</strong></div></section>
            <section className="approval-ledger-card"><header><span>ESTATÍSTICAS</span><strong>Indicadores da condição</strong></header><div><span>Quantidade de títulos</span><strong>{calculated.titleRows.length}</strong></div><div><span>Prazo médio</span><strong>{averageTerm} dias</strong></div><div><span>D+ operacional</span><strong>{averageFloat} dias</strong></div><div><span>Prazo médio líquido</span><strong>{averageNetTerm} dias</strong></div><div><span>Fator do período</span><strong>{periodFactor.toFixed(6).replace(".", ",")}%</strong></div><div><span>Fator equivalente a.m.</span><strong>{pricing.monthlyRate.toFixed(6).replace(".", ",")}%</strong></div><div><span>Fator real a.m.</span><strong>{realMonthlyFactor.toFixed(6).replace(".", ",")}%</strong></div><div><span>Fator sugerido a.m.</span><strong>{suggestedMonthlyFactor.toFixed(6).replace(".", ",")}%</strong></div><div><span>Forma de cálculo</span><strong>{pricing.method}{pricing.vaEnabled ? " · VA" : ""}</strong></div><div><span>Taxa efetiva final</span><strong>{calculated.allInMonthly.toFixed(6).replace(".", ",")}%</strong></div><div className="ledger-total"><span>ROA projetado</span><strong>{projectedRoa.toFixed(4).replace(".", ",")}% a.a.</strong></div></section>
            <section className="approval-ledger-card"><header><span>TARIFAS</span><strong>Composição detalhada</strong></header><div><span>Tarifa por operação</span><strong>{preciseMoney.format(operationFeeTotal)}</strong></div><div><span>Tarifa por título</span><em>{calculated.titleRows.length} × {preciseMoney.format(pricing.feePerTitle)}</em><strong>{preciseMoney.format(titleFeeTotal)}</strong></div><div><span>Ad valorem</span><em>{pricing.adValoremPercent.toFixed(4).replace(".", ",")}%</em><strong>{preciseMoney.format(adValoremTotal)}</strong></div>{pricing.manualFees?.map(fee => <div key={fee.id}><span>{fee.description}</span><em>Esporádica</em><strong>{preciseMoney.format(fee.amount)}</strong></div>)}<div className="ledger-total"><span>Total de tarifas</span><strong>{preciseMoney.format(calculated.fees)}</strong></div></section>
            <section className="approval-ledger-card"><header><span>IMPOSTOS</span><strong>Tributos da operação</strong></header><div><span>IOF</span><em>{operation.institution === "Factoring" ? "Conforme prazo" : "Não aplicável"}</em><strong>{preciseMoney.format(calculated.iof)}</strong></div><div><span>IOF adicional</span><em>0,000000%</em><strong>{preciseMoney.format(0)}</strong></div><div className="ledger-total"><span>Total de impostos</span><strong>{preciseMoney.format(calculated.iof)}</strong></div></section>
            <section className="approval-ledger-card"><header><span>RECOMPRAS E COMPENSAÇÕES</span><strong>Impactos no líquido do borderô</strong></header><div><span>Recompra de títulos</span><strong>{preciseMoney.format(repurchaseByAction("Recompra"))}</strong></div><div><span>Recompra parcial</span><strong>{preciseMoney.format(repurchaseByAction("Recompra parcial"))}</strong></div><div><span>Baixa bancária</span><strong>{preciseMoney.format(repurchaseByAction("Baixar do banco"))}</strong></div><div><span>Baixa somente no sistema</span><strong>{preciseMoney.format(repurchaseByAction("Baixar somente do sistema"))}</strong></div><div><span>Pendências financeiras</span><strong>{preciseMoney.format(adjustments.debitTotal)}</strong></div><div><span>(−) Créditos compensados</span><strong>{preciseMoney.format(adjustments.creditTotal)}</strong></div><div className="ledger-total"><span>Total líquido de recompra</span><strong>{preciseMoney.format(totalOffsets)}</strong></div></section>
            <section className="approval-ledger-card"><header><span>PAGAMENTO DA OPERAÇÃO</span><strong>Destino previsto da liberação</strong></header><div><span>Crédito por negociação</span><strong>{preciseMoney.format(0)}</strong></div><div><span>DOC / TED</span><strong>{preciseMoney.format(0)}</strong></div><div><span>Cheque</span><strong>{preciseMoney.format(0)}</strong></div><div><span>Conta-corrente do cedente</span><strong>{preciseMoney.format(0)}</strong></div><div><span>Dinheiro</span><strong>{preciseMoney.format(0)}</strong></div><div><span>Documento caucionado</span><strong>{preciseMoney.format(0)}</strong></div><div><span>Transferência / PIX a definir</span><strong>{preciseMoney.format(finalNet)}</strong></div><div className="ledger-total"><span>Total previsto</span><strong>{preciseMoney.format(finalNet)}</strong></div></section>
            <section className="approval-ledger-card approval-ledger-favored"><header><span>FAVORECIDOS</span><strong>Destinatários da liberação</strong></header><div className="ledger-empty"><span>Nenhuma conta favorecida vinculada à operação.</span><small>O destino financeiro será definido na formalização ou na liquidação.</small></div></section>
          </div>
          </>}
    </section>
    <div className="approval-kpis approval-status-strip"><div><span>PRONTIDÃO</span><strong>{checklist.filter(item => item.ok).length}/{checklist.length}</strong><small>requisitos concluídos</small></div><div><span>ALÇADAS</span><strong>{approvedCount}/{approvals.length}</strong><small>{approvals.length - approvedCount} aguardando decisão</small></div><div><span>DOCUMENTOS</span><strong>{readyDocuments}/{documents.length}</strong><small>pacote de formalização</small></div><div><span>ASSINATURAS</span><strong>{signedCount}/{signatures.length}</strong><small>{signatures.filter(item => item.status === "Enviado").length} enviada(s)</small></div></div>
    <div className="approval-layout">
      <div className="approval-main-column">
        <section className={`approval-card${collapsedSections.readiness ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>PRONTIDÃO</span><strong>Requisitos anteriores</strong></div><div className="approval-head-actions"><small>{checklist.filter(item => item.ok).length}/{checklist.length} concluídos</small>{collapseButton("readiness", "prontidão")}</div></div>{!collapsedSections.readiness && <div className="approval-readiness-list">{checklist.map(item => <div className={item.ok ? "ready" : "pending"} key={item.label}>{item.ok ? <CheckIcon /> : <AlertIcon />}<span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.ok ? "Concluído" : "Pendente"}</b></div>)}</div>}</section>
        <section className={`approval-card${collapsedSections.approvals ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>ALÇADAS</span><strong>Decisões e responsáveis</strong></div><div className="approval-head-actions"><small>{approvedCount}/{approvals.length} aprovadas</small>{collapseButton("approvals", "alçadas")}</div></div>{!collapsedSections.approvals && <><div className="approval-chain">{approvals.map((item, index) => <div className={`approval-row ${item.status.toLowerCase()}`} key={item.id}><i>{index + 1}</i><span><strong>{item.role}</strong><small>{item.approver}{item.decidedAt ? ` · ${item.decidedAt}` : ""}</small>{item.note && <em>{item.note}</em>}</span><Badge tone={item.status === "Aprovado" ? "ready" : item.status === "Reprovado" ? "cancelled" : "attention"}>{item.status}</Badge>{item.status === "Pendente" && <div className="approval-row-actions"><button onClick={() => decideApproval(item.id, "Reprovado")}>Reprovar</button><button className="approve" onClick={() => decideApproval(item.id, "Aprovado")}>Aprovar</button></div>}</div>)}</div><label className="approval-observation inline"><span>OBSERVAÇÃO OU JUSTIFICATIVA DA DECISÃO</span><textarea value={observation} placeholder="Registre condicionantes, ressalvas ou a justificativa da aprovação/reprovação." onChange={event => setObservation(event.target.value)} /></label></>}</section>
      </div>
      <aside className="approval-side-column">
        <section className={`approval-card${collapsedSections.documents ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>DOCUMENTOS</span><strong>Pacote de formalização</strong></div><div className="approval-head-actions"><small>{readyDocuments}/{documents.length}</small>{collapseButton("documents", "documentos")}</div></div>{!collapsedSections.documents && <div className="approval-doc-list">{documents.map(item => <button key={item.id} onClick={() => toggleDocument(item.id)}><span className={item.status === "Pronto" ? "ready" : "pending"}>{item.status === "Pronto" ? <CheckIcon /> : <ClockIcon />}</span><span><strong>{item.name}</strong><small>{item.source}{item.required ? " · obrigatório" : " · opcional"}</small></span><b>{item.status}</b></button>)}</div>}</section>
        <section className={`approval-card signature-panel${collapsedSections.signatures ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>ASSINATURAS ELETRÔNICAS</span><strong>Partes e andamento</strong></div><div className="approval-head-actions"><small>{signedCount}/{signatures.length} assinadas</small>{collapseButton("signatures", "assinaturas")}</div></div>{!collapsedSections.signatures && <><div className="signature-provider"><span><AlertIcon /></span><div><strong>Integração aguardando configuração</strong><small>O envio será habilitado após conectar o provedor de assinatura da empresa.</small></div><button onClick={() => setFeedback("A configuração do provedor de assinatura ficará disponível nas integrações da empresa.")}>Configurar</button></div><div className="signature-list">{signatures.map(item => <div key={item.id}><span><strong>{item.party}</strong><small>{item.signer}</small></span><Badge tone={item.status === "Assinado" ? "ready" : item.status === "Recusado" ? "cancelled" : "default"}>{item.status}</Badge>{item.sentAt && <small>Enviado em {item.sentAt}</small>}{item.status === "Enviado" && <button onClick={() => registerSignature(item.id)}>Registrar assinatura</button>}</div>)}</div><button className="approval-send-signature" onClick={sendForSignatures}>Enviar para assinaturas <ArrowIcon /></button></>}</section>
      </aside>
    </div>
    <section className={`approval-card approval-report-panel${collapsedSections.reports ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>RELATÓRIOS E IMPRESSÃO</span><strong>Documentos da decisão e da formalização</strong></div><div className="approval-head-actions"><small>4 documentos</small>{collapseButton("reports", "relatórios")}</div></div>{!collapsedSections.reports && <div className="approval-report-options">{(["Borderô", "Termo de cessão", "Memória financeira", "Dossiê da operação"] as const).map(report => <button key={report} onClick={() => setReportType(report)}><span>{report === "Borderô" ? "BO" : report === "Termo de cessão" ? "TC" : report === "Memória financeira" ? "MF" : "DO"}</span><b>{report}</b><small>Abrir prévia</small><ArrowIcon /></button>)}</div>}</section>
    <section className={`approval-timeline${collapsedSections.timeline ? " is-collapsed" : ""}`}><div className="approval-card-head"><div><span>TRILHA DA DECISÃO</span><strong>Quem fez o quê e quando</strong></div><div className="approval-head-actions"><small>Mais recente primeiro</small>{collapseButton("timeline", "trilha da decisão")}</div></div>{!collapsedSections.timeline && (approvalTimeline.length ? <div className="approval-timeline-list">{approvalTimeline.map((event, index) => <div key={`${event.at}-${event.action}-${index}`}><i>{index + 1}</i><span><strong>{event.action}</strong><small>{event.at} · {event.by}</small><em>{event.detail}</em></span></div>)}</div> : <div className="approval-audit-empty">A trilha será iniciada quando a operação for enviada para as alçadas.</div>)}</section>
    {feedback && <div className={`approval-feedback ${feedback.includes("pendente") || feedback.includes("precisa") || feedback.includes("Conclua") ? "warning" : "success"}`}>{feedback}<button onClick={() => setFeedback("")}><CloseIcon /></button></div>}
    <div className="approval-footer"><div><strong>{review.status === "Preparação" ? "Pacote em preparação" : review.status}</strong><span>{prerequisitesReady ? "Requisitos anteriores concluídos." : "Existem requisitos anteriores pendentes."}</span></div><button className="secondary-action" onClick={submitForApproval}>Enviar para alçadas</button><button className="primary-action" onClick={approveOperation}>Aprovar operação <ArrowIcon /></button></div>
    {reportType && <div className="modal-backdrop report-backdrop" onMouseDown={event => event.currentTarget === event.target && setReportType(null)}><section className="report-preview" role="dialog" aria-modal="true" aria-label={`Prévia de ${reportType}`}><header><div><span>STRATO · OPERAÇÃO {operation.aditivoNumber}</span><h2>{reportType}</h2><p>{operation.cedent} · {operation.document}</p></div><button aria-label="Fechar relatório" onClick={() => setReportType(null)}><CloseIcon /></button></header><div className="report-identifiers"><div><span>ADITIVO</span><strong>{operation.aditivoNumber}</strong></div><div><span>BORDERÔ</span><strong>{operation.borderoNumber}</strong></div><div><span>VEÍCULO</span><strong>{operation.vehicle}</strong></div><div><span>EMISSÃO</span><strong>{new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</strong></div></div>{reportType === "Termo de cessão" ? <div className="report-contract"><h3>Partes e objeto da cessão</h3><p><b>Cedente:</b> {operation.cedent}, inscrito sob {operation.document}.</p><p><b>Cessionário:</b> {operation.vehicle}.</p><p>O presente instrumento referencia a cessão dos {calculated.titleRows.length} recebíveis vinculados ao borderô {operation.borderoNumber}, pelo valor de face de {preciseMoney.format(calculated.face)} e líquido de {preciseMoney.format(finalNet)}, sujeito às condições e aprovações registradas na operação.</p><div><span>CEDENTE</span><span>CESSIONÁRIO</span></div></div> : <><div className="report-financial-grid"><div><span>VALOR DE FACE</span><strong>{preciseMoney.format(calculated.face)}</strong></div><div><span>VALOR LÍQUIDO</span><strong>{preciseMoney.format(finalNet)}</strong></div><div><span>TAXA BASE</span><strong>{pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.</strong></div><div><span>TAXA FINAL</span><strong>{calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.</strong></div><div><span>DESÁGIO</span><strong>{preciseMoney.format(calculated.originalDiscount)}</strong></div><div><span>TARIFAS</span><strong>{preciseMoney.format(calculated.fees)}</strong></div><div><span>IMPOSTOS</span><strong>{preciseMoney.format(calculated.iof)}</strong></div><div><span>RECOMPRA</span><strong>{preciseMoney.format(totalOffsets)}</strong></div></div><div className="report-table"><div><span>Documento</span><span>Sacado</span><span>Vencimento</span><span>Valor</span></div>{calculated.titleRows.map(row => <div key={row.title.id}><strong>{row.title.documentNumber}</strong><span>{row.title.debtorName}</span><span>{row.title.dueDate}</span><strong>{preciseMoney.format(row.title.amount)}</strong></div>)}</div></>}<footer><span>Documento gerado a partir da condição comercial e da trilha da operação.</span><strong>STRATO · Receivables OS</strong></footer><div className="report-actions"><button onClick={() => setReportType(null)}>Fechar</button><button className="primary-action" onClick={() => window.print()}>Imprimir / salvar em PDF</button></div></section></div>}
  </section>;
}

function OperationWorkspace({ operation: initialOperation, operationCount, debtors, onRegisterDebtor, onBack, onUpdate, showGuidance, onOpenSettings }: { operation: Operation; operationCount: number; debtors: Debtor[]; onRegisterDebtor: (debtor: Debtor) => void; onBack: () => void; onUpdate: (operation: Operation) => void; showGuidance: boolean; onOpenSettings: () => void }) {
  const [operation, setOperation] = useState(initialOperation);
  const [active, setActive] = useState(initialOperation.stage);
  const [feedback, setFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(null);
  const [showCancellation, setShowCancellation] = useState(false);
  const [showCedentAssignment, setShowCedentAssignment] = useState(operationNeedsCedent(initialOperation));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDensity, setSummaryDensity] = useState<"compact" | "expanded">("expanded");
  const [summaryPinned, setSummaryPinned] = useState(true);
  const [financialObservation, setFinancialObservation] = useState(initialOperation.financialObservation ?? "");
  const activeStage = stages[active - 1];
  const pace = paceFor(operation);
  const automation = operation.source === "Digitação manual" ? manualAutomation(operation.manualEntry) : { score: operation.automation, items: [{ label: "Automação registrada", points: operation.automation, maximum: 100, detail: "Calculada na origem e nas integrações desta operação" }] };
  const stageInsight = stageInsightFor(operation, active, automation);
  const summaryPricing = normalizedPricing(operation);
  const summaryCalculation = pricingCalculation(operation, summaryPricing);
  const summaryRepurchase = repurchaseCalculation(operation, summaryPricing);
  const summaryAdjustments = settlementAdjustmentCalculation(operation, summaryPricing);
  const summaryOffsets = roundPricing(summaryRepurchase.total + summaryAdjustments.total);
  const summaryFace = summaryCalculation.face || operation.amount;
  const summaryNet = operation.pricingReview ? roundPricing(summaryCalculation.net - summaryOffsets) : operation.netAmount;
  const summaryCedent = initialCedents.find(item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""));
  const availableLimit = summaryCedent ? Math.max(0, summaryCedent.creditLimit - summaryCedent.usedLimit) : 0;
  const limitAfterOperation = Math.max(0, availableLimit - summaryFace);
  const approvals = operation.approvalReview?.approvals ?? [];
  const approvedCount = approvals.filter(item => item.status === "Aprovado").length;

  function commit(next: Operation) {
    setOperation(next);
    onUpdate(next);
  }

  function advance() {
    if (operationNeedsCedent(operation)) {
      setShowCedentAssignment(true);
      setFeedback({ tone: "warning", message: "Defina o cedente da operação antes de continuar." });
      return;
    }
    if (operation.stage === 1 && operation.source === "Digitação manual" && (!operation.manualEntry?.entries.length || operation.manualEntry.entries.some(entry => !entry.debtorId))) {
      setFeedback({ tone: "warning", message: "Defina o tipo, vincule um sacado válido e salve os títulos antes de concluir a entrada." });
      return;
    }
    const currentAssessment = stageInsightFor(operation, operation.stage, automation);
    if (operation.stage === 2 && operation.manualEntry?.entries.length) {
      const debtorKeys = [...new Set(operation.manualEntry.entries.map(entry => entry.debtorId || entry.debtorDocument))];
      const cedentApproved = operation.riskReview?.cedentDecision === "Aprovado";
      const debtorsApproved = debtorKeys.every(key => operation.riskReview?.debtorDecisions?.[key] === "Aprovado");
      const titlesApproved = operation.manualEntry.entries.every(entry => operation.riskReview?.titleDecisions?.[entry.id] === "Aprovado");
      if (!cedentApproved || !debtorsApproved || !titlesApproved) {
        setFeedback({ tone: "warning", message: "Registre a decisão do cedente, de todos os sacados e dos títulos antes de concluir risco e elegibilidade." });
        return;
      }
    } else if (operation.stage === 2 && operation.blockers > 0) {
      setFeedback({ tone: "warning", message: "Existem bloqueios de risco que precisam de decisão antes do avanço." });
      return;
    }
    if (operation.stage === 3 && !lastroAssessmentFor(operation).ready) {
      setFeedback({ tone: "warning", message: "Valide todas as evidências e confirme os sacados selecionados na amostra antes de concluir o lastro." });
      return;
    }
    if (operation.stage === 4 && operation.pricingReview?.status !== "Condição salva") {
      setFeedback({ tone: "warning", message: "Salve a condição comercial antes de concluir preço e estrutura." });
      return;
    }
    if (operation.stage === 5) {
      const review = operation.approvalReview;
      const allApprovals = Boolean(review?.approvals?.length) && review!.approvals!.every(item => item.status === "Aprovado");
      const requiredDocumentsReady = Boolean(review?.documents?.length) && review!.documents!.filter(item => item.required).every(item => item.status === "Pronto" || item.status === "Dispensado");
      const allSignaturesCompleted = Boolean(review?.signatures?.length) && review!.signatures!.every(item => item.status === "Assinado");
      if (!allApprovals || !requiredDocumentsReady || !allSignaturesCompleted) {
        setFeedback({ tone: "warning", message: "Conclua todas as alçadas, documentos obrigatórios e assinaturas antes de seguir para a liquidação." });
        return;
      }
    }
    if (operation.source === "Digitação manual" && operation.stage === 5 && currentAssessment.tone === "warning") {
      setFeedback({ tone: "warning", message: currentAssessment.result });
      return;
    }
    if (operation.stage < 6) {
      const next = operation.stage + 1;
      const completion = { stageId: operation.stage, completedBy: "Henrique", completedAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date()) };
      const stageCompletions = [...(operation.stageCompletions ?? []).filter(item => item.stageId !== operation.stage), completion];
      commit({ ...operation, stage: next, stageCompletions, status: next === 6 ? "Pronta para liberar" : "Em andamento", blockers: 0, nextAction: stages[next - 1].description });
      setActive(next); setFeedback({ tone: "success", message: `Etapa concluída. A operação avançou para ${stages[next - 1].title}.` });
    } else setFeedback({ tone: "success", message: "Liberação autorizada e registrada na linha do tempo da operação." });
  }

  function applyRecommendation() {
    const removedFace = Math.min(10400, operation.amount);
    const ratio = operation.amount > 0 ? operation.netAmount / operation.amount : 0;
    const next = {
      ...operation,
      amount: operation.amount - removedFace,
      netAmount: operation.netAmount - removedFace * ratio,
      titleCount: Math.max(0, operation.titleCount - 1),
      blockers: 0,
      alerts: Math.max(0, operation.alerts - 1),
      automation: Math.min(100, operation.automation + 4),
      nextAction: "Concluir análise de risco e elegibilidade",
      status: "Em andamento" as OperationStatus,
    };
    commit(next);
    setFeedback({ tone: "success", message: "Recomendação aplicada: 1 título removido e concentração recalculada para 19,9%." });
  }

  function cancelOperation(category: string, reason: string) {
    const cancellation = {
      category,
      reason,
      cancelledAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date()),
      cancelledBy: "Henrique",
      stage: operation.stage,
      stageName: stages[operation.stage - 1].title,
      operationSignature: `${operation.document}|${operation.amount.toFixed(2)}|${operation.titleCount}|${operation.source ?? "sem-origem"}`,
    };
    commit({ ...operation, status: "Cancelada", cancellation, nextAction: "Operação encerrada — memória preservada" });
    setShowCancellation(false);
    setFeedback({ tone: "warning", message: "A operação foi cancelada sem excluir seu histórico. Uma nova importação poderá consultar esta memória." });
  }

  function saveManualEntry(data: ManualEntryData) {
    const amount = data.entries.reduce((sum, entry) => sum + entry.amount, 0);
    const discounts = data.entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
    const calculatedAutomation = manualAutomation(data).score;
    commit({ ...operation, manualEntry: data, operationType: data.receivableType, titleCount: data.entries.length, amount, netAmount: Math.max(0, amount - discounts), nextAction: "Conferir títulos digitados e concluir a entrada", automation: calculatedAutomation });
    setFeedback({ tone: "success", message: `${data.entries.length} títulos digitados. A operação foi travada como ${data.receivableType.toLowerCase()} para evitar mistura com outros recebíveis.` });
  }

  function assignCedent(cedent: Cedent) {
    const next = { ...operation, cedent: cedent.name, document: cedent.document, risk: (cedent.score >= 700 ? "Baixo" : cedent.score >= 600 ? "Médio" : "Alto") as Operation["risk"], alerts: Math.max(operation.alerts, cedent.incidents), nextAction: operation.stage === 1 ? operation.nextAction : "Revisar risco com o cedente vinculado" };
    commit(next);
    setShowCedentAssignment(false);
    setFeedback({ tone: "success", message: `${cedent.name} foi vinculado à operação. Limite, score e histórico já estão disponíveis para análise.` });
  }

  return <Shell operationCount={operationCount} companyScope={operation.vehicle} onOpenSettings={onOpenSettings}>
    <div className="workspace-wrap">
      <button className="back-link" onClick={onBack}><BackIcon /> Operações em andamento</button>
      <div className="workspace-heading">
        <div><div className="workspace-title-line"><h1>Aditivo {operation.aditivoNumber}</h1><Badge tone={operation.institution.toLowerCase()}>{operation.institution}</Badge><StatusBadge status={operation.status} /></div><p>Borderô {operation.borderoNumber} <span>•</span> {operation.cedent} <span>•</span> {operation.document}</p></div>
        <div className="workspace-actions">{operation.status !== "Cancelada" && <button className="danger-secondary" onClick={() => setShowCancellation(true)}>Cancelar operação</button>}<button className="secondary-action">•••</button>{operation.status !== "Cancelada" && <button className="primary-action" onClick={advance}>{operation.stage === 6 ? "Autorizar liberação" : "Concluir etapa e avançar"}<ArrowIcon /></button>}</div>
      </div>
      {operation.cancellation && <div className="cancellation-banner"><CloseIcon /><div><strong>Operação cancelada — {operation.cancellation.category}</strong><span>{operation.cancellation.reason}</span><small>Na etapa {operation.cancellation.stage}: {operation.cancellation.stageName} · {operation.cancellation.cancelledAt} por {operation.cancellation.cancelledBy}</small></div></div>}
      {feedback && <div className={`success-banner ${feedback.tone}`} >{feedback.tone === "success" ? <CheckIcon /> : <AlertIcon />}<span><strong>{feedback.tone === "success" ? "Ação registrada." : "Ação necessária."}</strong> {feedback.message}</span><button onClick={() => setFeedback(null)}><CloseIcon /></button></div>}
      <section className="workspace-progress">{stages.map((stage, idx) => { const completion = stageCompletionFor(operation, stage.id); return <button key={stage.id} className={`${stage.id === active ? "active" : ""} ${stage.id === operation.stage ? "current" : ""} ${stage.id < operation.stage ? "done" : ""}`} onClick={() => setActive(stage.id)}><StepState id={stage.id} current={operation.stage}/><span className="stage-progress-copy"><small>{stage.id < operation.stage ? "CONCLUÍDA" : stage.id === operation.stage ? "ETAPA ATUAL" : `ETAPA ${stage.id}`}</small><b>{stage.short}</b>{completion && <em><strong>{completion.completedBy}</strong><time>{completion.completedAt}</time></em>}</span>{idx < stages.length - 1 && <i className="connector" />}</button>; })}</section>
      <div className={`workspace-grid ${active === 5 ? "approval-focus" : ""}`}>
        <div className="workspace-main">
          <div className="stage-heading"><div><span>ETAPA {active} DE 6</span><h2>{activeStage.title}</h2><p>{activeStage.description}</p></div><Badge tone={stageInsight.tone === "warning" ? "attention" : active === operation.stage ? "current" : active < operation.stage ? "live" : "default"}><i /> {stageInsight.state}</Badge></div>
          {active < operation.stage && <div className="historical-stage-banner"><CheckIcon /><div><strong>Etapa concluída e preservada</strong><span>Os dados registrados continuam vinculados a este aditivo para consulta, auditoria e cálculo das etapas seguintes.</span></div><Badge tone="live">DADOS PRESERVADOS</Badge></div>}
          {active === 1 && operation.stage === 1 && operation.source === "Digitação manual" && <ManualEntryPanel operation={operation} debtors={debtors} onRegisterDebtor={onRegisterDebtor} onSave={saveManualEntry} />}
          {active === 1 && !(operation.stage === 1 && operation.source === "Digitação manual") && <EntryRecordPanel operation={operation} />}
          {active === 2 && <RiskEligibilityPanel operation={operation} debtors={debtors} onChange={commit} />}
          {active === 3 && <LastroValidationPanel operation={operation} debtors={debtors} onChange={commit} />}
          {active === 4 && <PricingPanel operation={operation} onChange={commit} showGuidance={showGuidance} />}
          {active === 5 && <ApprovalPanel operation={operation} onChange={commit} />}
          {active !== 1 && active !== 2 && active !== 3 && active !== 4 && active !== 5 && <section className={`stage-insight-card ${stageInsight.tone}`}><div className="stage-insight-head"><div><span>{stageInsight.state}</span><h3>{stageInsight.title}</h3><p>{stageInsight.description}</p></div><small>{stageInsight.source}</small></div><div className="stage-insight-metrics">{stageInsight.metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}</div><div className="stage-insight-result">{stageInsight.tone === "warning" ? <AlertIcon /> : <CheckIcon />}<span>{stageInsight.result}</span></div></section>}
        </div>
        {active !== 5 && <button className="summary-mobile-toggle" onClick={() => setSummaryOpen(value => !value)}><span>Resumo da operação</span><strong>{summaryOpen ? "Recolher" : "Abrir resumo"}</strong></button>}
        {active !== 5 && <aside className={`operation-summary ${summaryOpen ? "open" : ""} ${summaryDensity} ${summaryPinned ? "pinned" : ""}`}>
          <div className="summary-title"><span>RESUMO FINANCEIRO</span><div className="summary-display-actions"><button aria-label={summaryPinned ? "Desafixar resumo" : "Fixar resumo"} title={summaryPinned ? "Desafixar painel" : "Fixar painel"} onClick={() => setSummaryPinned(value => !value)}>{summaryPinned ? "Fixado" : "Fixar"}</button><button aria-label="Resumo compacto" title="Diminuir painel" className={summaryDensity === "compact" ? "active" : ""} onClick={() => setSummaryDensity("compact")}>−</button><button aria-label="Resumo detalhado" title="Aumentar painel" className={summaryDensity === "expanded" ? "active" : ""} onClick={() => setSummaryDensity("expanded")}>+</button></div></div>
          <div className="summary-identifiers"><div><span>ADITIVO</span><strong>{operation.aditivoNumber}</strong></div><div><span>BORDERÔ</span><strong>{operation.borderoNumber}</strong></div></div>
          <div className="summary-financial-hero"><span>LÍQUIDO DO BORDERÔ</span><strong>{preciseMoney.format(summaryNet)}</strong><small>Face {preciseMoney.format(summaryFace)} · {operation.titleCount} recebíveis</small><div><b>{summaryPricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.<small>taxa base</small></b><b>{summaryCalculation.allInMonthly.toFixed(2).replace(".", ",")}% a.m.<small>taxa final calculada</small></b></div></div>
          <div className="summary-analytics"><div><span>LIMITE DISPONÍVEL</span><strong>{preciseMoney.format(availableLimit)}</strong><small>Após operação: {preciseMoney.format(limitAfterOperation)}</small></div><div><span>SPREAD</span><strong className={summaryCalculation.spread >= 0 ? "positive" : "negative"}>{summaryCalculation.spread.toFixed(2).replace(".", ",")}%</strong><small>Custo {summaryPricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.</small></div><div><span>PRAZO MÉDIO</span><strong>{Math.round(summaryCalculation.weightedTerm)} dias</strong><small>Float {summaryPricing.floatDays} dia(s)</small></div><div><span>ALÇADAS</span><strong>{approvedCount}/{approvals.length || 2}</strong><small>{approvals.length ? `${approvals.length - approvedCount} pendente(s)` : "Aguardando configuração"}</small></div></div>
          <details className="summary-breakdown" open><summary>COMPOSIÇÃO DO LÍQUIDO <b>{preciseMoney.format(summaryNet)}</b></summary><div><span>Valor de face</span><strong>{preciseMoney.format(summaryFace)}</strong></div><div><span>(−) Deságio</span><strong>{preciseMoney.format(summaryCalculation.originalDiscount)}</strong></div><div><span>(−) Tarifas</span><strong>{preciseMoney.format(summaryCalculation.fees)}</strong></div><div><span>(−) IOF / impostos</span><strong>{preciseMoney.format(summaryCalculation.iof)}</strong></div><div><span>(−) Garantia / retenções</span><strong>{preciseMoney.format(summaryCalculation.guarantee + summaryPricing.manualRetention)}</strong></div><div><span>(−) Recompra e compensações</span><strong>{preciseMoney.format(summaryOffsets)}</strong></div><div className="total"><span>Total líquido</span><strong>{preciseMoney.format(summaryNet)}</strong></div></details>
          <details className="summary-breakdown expanded-only"><summary>ESTATÍSTICAS E CONDIÇÃO <b>{summaryPricing.method}</b></summary><div><span>Taxa final desejada</span><strong>{(summaryPricing.targetFinalRateMonthly ?? summaryCalculation.allInMonthly).toFixed(2).replace(".", ",")}% a.m.</strong></div><div><span>Taxa final calculada</span><strong>{summaryCalculation.allInMonthly.toFixed(2).replace(".", ",")}% a.m.</strong></div><div><span>Taxa VA ajustada</span><strong>{summaryCalculation.adjustedRate.toFixed(4).replace(".", ",")}% a.m.</strong></div><div><span>Prazo mínimo</span><strong>{summaryPricing.minimumTermDays} dias</strong></div><div><span>Regresso</span><strong>{summaryPricing.regress}</strong></div><div><span>Coobrigação</span><strong>{summaryPricing.coobligation ? "Sim" : "Não"}</strong></div></details>
          <div className="summary-note"><label><span>OBSERVAÇÃO DA OPERAÇÃO</span><textarea value={financialObservation} onChange={event => setFinancialObservation(event.target.value)} onBlur={() => commit({ ...operation, financialObservation })} placeholder="Registre uma orientação, ressalva ou informação para as alçadas..." /></label><small>Visível para crédito, aprovação e financeiro.</small></div>
          <div className="automation-explainer expanded-only"><div><span>AUTOMAÇÃO ASSISTIDA</span><strong>{automation.score}%</strong></div><p>É o quanto o sistema conseguiu preencher ou validar sem decisão humana. Não é o progresso da operação.</p>{automation.items.map(item => <div className="automation-line" key={item.label}><span><b>{item.label}</b><small>{item.detail}</small></span><strong>{item.points}/{item.maximum}</strong></div>)}</div>
          {operation.source && <div className="summary-section"><span>ORIGEM E TIPO</span><Badge tone="current">{operation.source}</Badge><strong>{operation.operationType}</strong><small>Classificação definida na entrada da operação</small></div>}
          {operation.cancellation && <div className="summary-section cancellation-memory"><span>MEMÓRIA DO CANCELAMENTO</span><Badge tone="cancelled">{operation.cancellation.category}</Badge><strong>{operation.cancellation.reason}</strong><small>Assinatura preservada: {operation.cancellation.operationSignature}</small></div>}
          <div className="summary-section"><span>VEÍCULO</span><Badge tone={operation.institution.toLowerCase()}>{operation.institution}</Badge><strong>{operation.vehicle}</strong>{operation.fundClass && <small>{operation.fundClass}</small>}<button>Ver estrutura do veículo <ArrowIcon /></button></div>
          {operation.participants && <div className="summary-section expanded-only"><span>PARTICIPANTES</span>{operation.participants.map((p, i) => <div className="participant" key={p}><i>{["GE", "AF", "CU"][i]}</i><b>{p}</b><CheckIcon /></div>)}</div>}
          <div className="summary-section"><span>PRÓXIMA AÇÃO</span><div className="next-action"><AlertIcon /><div><strong>{operation.nextAction}</strong><small>Responsável: {operation.owner}</small></div></div></div>
          <div className="summary-section"><span>RITMO DA OPERAÇÃO</span><div className={`pace-summary ${pace.tone}`}><ClockIcon /><div><strong>{pace.label}</strong><small>{operation.waitingFor} nesta operação · {pace.detail}</small></div></div></div>
          <div className="summary-section timeline-mini expanded-only"><span>ATIVIDADE RECENTE</span><div><i /><p><strong>Política reavaliada</strong><small>Agora · pelo motor de regras</small></p></div><div><i /><p><strong>Dados do sacado atualizados</strong><small>Há 3 min · Serasa API</small></p></div><button>Ver linha do tempo completa <ArrowIcon /></button></div>
        </aside>}
      </div>
    </div>
    {showCancellation && <CancellationModal operation={operation} onClose={() => setShowCancellation(false)} onConfirm={cancelOperation} />}
    {showCedentAssignment && <AssignCedentModal operation={operation} onBack={onBack} onAssign={assignCedent} />}
  </Shell>;
}

function AssignCedentModal({ operation, onBack, onAssign }: { operation: Operation; onBack: () => void; onAssign: (cedent: Cedent) => void }) {
  const [cedentId, setCedentId] = useState("");
  const cedent = initialCedents.find(item => item.id === cedentId);
  return <div className="modal-backdrop mandatory-backdrop"><section className="assign-cedent-modal" role="dialog" aria-modal="true" aria-label="Definir cedente obrigatório">
    <div className="mandatory-icon"><UsersIcon /></div>
    <Badge tone="attention">VÍNCULO OBRIGATÓRIO</Badge>
    <h2>Defina o cedente para continuar</h2>
    <p>O aditivo {operation.aditivoNumber} foi criado sem cedente. A operação não poderá avançar até que o responsável pelos recebíveis esteja identificado.</p>
    <label className="modal-field"><span>CEDENTE DA OPERAÇÃO</span><select aria-label="Selecionar cedente obrigatório" value={cedentId} onChange={event => setCedentId(event.target.value)}><option value="">Selecione o cedente</option>{initialCedents.map(item => <option value={item.id} key={item.id}>{item.name} · {item.document}</option>)}</select></label>
    {cedent && <div className="assignment-preview"><div><span>SCORE</span><strong>{cedent.score}</strong><small>{cedent.score >= 700 ? "Faixa positiva" : cedent.score >= 600 ? "Faixa de atenção" : "Faixa crítica"}</small></div><div><span>LIMITE DISPONÍVEL</span><strong>{preciseMoney.format(Math.max(0, cedent.creditLimit - cedent.usedLimit))}</strong><small>{preciseMoney.format(cedent.usedLimit)} utilizado</small></div><div><span>APONTAMENTOS</span><strong className={cedent.incidents ? "negative" : "positive"}>{cedent.incidents}</strong><small>{cedent.publicStatus}</small></div></div>}
    <div className="assignment-note"><ShieldIcon /><span>Ao confirmar, score, limite e histórico do cedente passam a compor a análise de risco desta operação.</span></div>
    <div className="modal-actions"><button className="secondary-action" onClick={onBack}>Voltar para operações</button><button className="primary-action" disabled={!cedent} onClick={() => cedent && onAssign(cedent)}>Vincular cedente e continuar</button></div>
  </section></div>;
}

function CancellationModal({ operation, onClose, onConfirm }: { operation: Operation; onClose: () => void; onConfirm: (category: string, reason: string) => void }) {
  const [category, setCategory] = useState("Desistência do cliente");
  const [reason, setReason] = useState("");
  const categories = ["Desistência do cliente", "Desistência da financeira", "Risco fora da política", "Documentação inconsistente", "Duplicidade de operação", "Erro de importação", "Outro motivo"];
  return <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && onClose()}><section className="cancel-modal" role="dialog" aria-modal="true" aria-label="Cancelar operação">
    <div className="modal-head"><div><Badge tone="cancelled">ENCERRAMENTO DO NEGÓCIO</Badge><h2>Cancelar operação?</h2><p>A operação não será apagada. O histórico será usado para reconhecer futuras reimportações.</p></div><button onClick={onClose}><CloseIcon /></button></div>
    <div className="cancel-operation-ref"><span>ADITIVO {operation.aditivoNumber}</span><strong>{operation.cedent}</strong><small>Borderô {operation.borderoNumber} · Etapa {operation.stage}: {stages[operation.stage - 1].title}</small></div>
    <label className="modal-field"><span>Origem do cancelamento</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
    <label className="modal-field cancellation-reason"><span>Motivo detalhado</span><textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Descreva o que levou ao encerramento. Esta informação ficará na memória da operação." /></label>
    <div className="memory-notice"><ShieldIcon /><span><strong>Memória de reimportação ativa</strong><small>Aditivo, borderô, títulos, valores, etapa e justificativa permanecerão pesquisáveis.</small></span></div>
    <div className="modal-actions"><button className="secondary-action" onClick={onClose}>Voltar</button><button className="danger-action" disabled={reason.trim().length < 5} onClick={() => onConfirm(category, reason.trim())}>Confirmar cancelamento</button></div>
  </section></div>;
}

type NewOperationInput = { source: OperationSource; operationType: string; destination: Destination; cedent: Cedent };

const sourceOptions: { source: OperationSource; label: string; description: string; tag: string }[] = [
  { source: "XML NF-e", label: "Importar XML", description: "Notas fiscais e duplicatas identificadas automaticamente", tag: "XML" },
  { source: "CNAB", label: "Importar CNAB", description: "Arquivo bancário, carteira de títulos ou borderô", tag: "CNAB" },
  { source: "Planilha", label: "Importar planilha", description: "Arquivo CSV ou XLSX no leiaute da empresa", tag: "XLSX" },
  { source: "Digitação manual", label: "Digitação manual", description: "Duplicata, cheque, promissória, transferibilidade ou garantia", tag: "DIG" },
  { source: "Crédito estruturado", label: "Crédito estruturado", description: "CCB, contrato, cronograma e garantias", tag: "CCB" },
];

function NewOperationModal({ onClose, onCreate, defaultDestination }: { onClose: () => void; onCreate: (input: NewOperationInput) => void; defaultDestination?: string }) {
  const [source, setSource] = useState<OperationSource>("XML NF-e");
  const [destinationName, setDestinationName] = useState(defaultDestination && defaultDestination !== "Consolidado" ? defaultDestination : destinations[0].name);
  const [cedentId, setCedentId] = useState("");
  const [fileLoaded, setFileLoaded] = useState(false);
  const requiresFile = source === "XML NF-e" || source === "CNAB" || source === "Planilha";
  const detectedType = source === "XML NF-e" ? "Duplicata mercantil com NF-e" : source === "CNAB" ? "Carteira de títulos em CNAB" : source === "Planilha" ? "Duplicatas em leiaute validado" : source === "Crédito estruturado" ? "CCB" : "A definir na digitação";
  const destination = destinations.find(item => item.name === destinationName) ?? destinations[0];
  const cedent = initialCedents.find(item => item.id === cedentId);

  function chooseSource(next: OperationSource) {
    setSource(next);
    setFileLoaded(false);
  }

  return <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}><section className="new-modal" role="dialog" aria-modal="true" aria-label="Nova operação">
    <div className="modal-head"><div><Badge tone="eyebrow">NOVA OPERAÇÃO</Badge><h2>Como deseja iniciar esta operação?</h2><p>Escolha a origem. A STRATO identifica o tipo e aplica as regras da empresa de destino.</p></div><button onClick={onClose}><CloseIcon /></button></div>
    <div className="new-cedent-step"><div><span>1 · CEDENTE DA OPERAÇÃO</span><strong>Quem está cedendo os recebíveis?</strong><small>O risco, o limite e os apontamentos são carregados antes da entrada dos títulos.</small></div><label><select aria-label="Selecionar cedente" value={cedentId} onChange={event => setCedentId(event.target.value)}><option value="">Selecione o cedente</option>{initialCedents.map(item => <option value={item.id} key={item.id}>{item.name} · {item.document}</option>)}</select></label>{cedent && <div className="cedent-quick-risk"><span><b>Score {cedent.score}</b><small>{cedent.score >= 700 ? "Faixa positiva" : cedent.score >= 600 ? "Faixa de atenção" : "Faixa crítica"}</small></span><span><b>{preciseMoney.format(cedent.creditLimit - cedent.usedLimit)}</b><small>Limite disponível</small></span><Badge tone={cedent.incidents ? "attention" : "ready"}>{cedent.incidents ? `${cedent.incidents} apontamento(s)` : "Sem apontamentos"}</Badge></div>}</div>
    <div className="source-options">{sourceOptions.map(option => <button className={source === option.source ? "selected" : ""} onClick={() => chooseSource(option.source)} key={option.source}><span className="source-tag">{option.tag}</span><div><strong>{option.label}</strong><small>{option.description}</small></div><span className="radio"><i /></span></button>)}</div>
    <div className="operation-origin-panel">
      {requiresFile ? <div className="file-import"><div><strong>Arquivo da operação</strong><small>{source === "XML NF-e" ? "Selecione um ou mais arquivos .xml" : source === "CNAB" ? "Selecione o arquivo CNAB recebido" : "Selecione um arquivo .xlsx ou .csv"}</small></div><button className={fileLoaded ? "file-loaded" : "secondary-action"} onClick={() => setFileLoaded(true)}>{fileLoaded ? <><CheckIcon /> Arquivo analisado</> : "Selecionar arquivo"}</button></div> : source === "Digitação manual" ? <div className="structured-info"><strong>Operação criada para digitação</strong><small>O tipo do recebível será escolhido na etapa de entrada. Cheques serão mantidos em operação separada.</small></div> : <div className="structured-info"><strong>Operação CCB</strong><small>Informe as partes, condições financeiras, cronograma e garantias na próxima etapa.</small></div>}
      {(!requiresFile || fileLoaded) && <div className="detected-type"><SparkIcon /><div><span>TIPO DA OPERAÇÃO</span><strong>{detectedType}</strong><small>{requiresFile ? "Identificado pelo conteúdo do arquivo" : "Definido para esta entrada"}</small></div></div>}
    </div>
    <label className="modal-field destination-field"><span>Destino da operação</span><select value={destinationName} onChange={e => setDestinationName(e.target.value)}>{destinations.map(item => <option value={item.name} key={item.name}>{item.name} · {item.institution}</option>)}</select><small>A empresa já está cadastrada. Aqui você apenas direciona a operação.</small></label>
    <div className="modal-actions"><button className="secondary-action" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={!cedent || (requiresFile && !fileLoaded)} onClick={() => cedent && onCreate({ source, operationType: detectedType, destination, cedent })}>Iniciar operação <ArrowIcon /></button></div>
  </section></div>;
}

function InterfaceSettingsModal({ showGuidance, onChange, onClose }: { showGuidance: boolean; onChange: (value: boolean) => void; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && onClose()}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Configurações de interface"><div className="modal-head"><div><Badge tone="eyebrow">CONFIGURAÇÕES</Badge><h2>Preferências da interface</h2><p>Adapte o nível de orientação ao perfil de cada usuário.</p></div><button aria-label="Fechar configurações" onClick={onClose}><CloseIcon /></button></div><section className="settings-option"><div><strong>Explicações permanentes</strong><span>Exibe subtítulos e textos explicativos diretamente nos blocos operacionais.</span><small>Os ícones de informação continuam disponíveis mesmo quando os textos estiverem ocultos.</small></div><label className="settings-switch"><input aria-label="Exibir explicações permanentes" type="checkbox" checked={showGuidance} onChange={event => onChange(event.target.checked)} /><span /><b>{showGuidance ? "Visíveis" : "Ocultas"}</b></label></section><div className="settings-preview"><span>COMO FICA</span><strong>Tarifas e retenções <InfoTip text="Configura os componentes descontados do valor liberado, incluindo tarifas, tributos, garantia e retenções." /></strong>{showGuidance && <><b>Componentes da liberação</b><small>Tributos conforme a configuração da empresa.</small></>}</div><div className="modal-actions"><button className="primary-action" onClick={onClose}>Concluir</button></div></section></div>;
}

export default function OperationsMvp() {
  const [operations, setOperations] = useState(initialOperations);
  const [debtors, setDebtors] = useState(initialDebtors);
  const [selected, setSelected] = useState<Operation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [companyScope, setCompanyScope] = useState("Consolidado");
  const [storageReady, setStorageReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lastro-mvp-operations-v3");
      if (saved) {
        const restored = JSON.parse(saved) as Operation[];
        setOperations(restored.map((operation, index) => {
          const baseline = initialOperations.find(item => item.id === operation.id);
          const migrated = operation.id === "op-3407" && operation.stage === 5 && operation.status === "Aguardando terceiro" ? { ...operation, ...initialOperations[1] } : operation;
          const invalidLegacyIdentifiers = !baseline && !/^\d{7}$/.test(migrated.borderoNumber ?? "");
          return {
            ...baseline,
            ...migrated,
            elapsedMinutes: migrated.elapsedMinutes ?? baseline?.elapsedMinutes ?? 0,
            clientAverageMinutes: migrated.clientAverageMinutes ?? baseline?.clientAverageMinutes ?? 0,
            historySample: migrated.historySample ?? baseline?.historySample ?? 0,
            manualEntry: migrated.manualEntry?.entries?.length ? migrated.manualEntry : baseline?.manualEntry,
            riskReview: baseline?.riskReview || migrated.riskReview ? {
              ...baseline?.riskReview,
              ...migrated.riskReview,
              debtorDecisions: { ...baseline?.riskReview?.debtorDecisions, ...migrated.riskReview?.debtorDecisions },
              titleDecisions: { ...baseline?.riskReview?.titleDecisions, ...migrated.riskReview?.titleDecisions },
              audit: migrated.riskReview?.audit?.length ? migrated.riskReview.audit : baseline?.riskReview?.audit,
            } : undefined,
            lastroReview: baseline?.lastroReview || migrated.lastroReview ? { items: { ...baseline?.lastroReview?.items, ...migrated.lastroReview?.items } } : undefined,
            aditivoNumber: invalidLegacyIdentifiers ? `${datePrefix()}${String(5 + index).padStart(3, "0")}` : migrated.aditivoNumber ?? baseline?.aditivoNumber ?? `${datePrefix()}${String(5 + index).padStart(3, "0")}`,
            borderoNumber: invalidLegacyIdentifiers ? String(3409 + index).padStart(7, "0") : migrated.borderoNumber ?? baseline?.borderoNumber ?? String(3409 + index).padStart(7, "0"),
          } as Operation;
        }));
      }
      const savedDebtors = window.localStorage.getItem("lastro-mvp-debtors-v1");
      if (savedDebtors) {
        const restoredDebtors = JSON.parse(savedDebtors) as Debtor[];
        setDebtors(restoredDebtors.map(debtor => {
          const baseline = initialDebtors.find(item => item.id === debtor.id || item.document.replace(/\D/g, "") === debtor.document.replace(/\D/g, ""));
          return { ...baseline, ...debtor, score: debtor.score ?? baseline?.score, portfolioReceivable: debtor.portfolioReceivable ?? baseline?.portfolioReceivable, portfolioOverdue: debtor.portfolioOverdue ?? baseline?.portfolioOverdue, settlements: debtor.settlements ?? baseline?.settlements, lateSettlements: debtor.lateSettlements ?? baseline?.lateSettlements, averageDelayDays: debtor.averageDelayDays ?? baseline?.averageDelayDays, repurchases: debtor.repurchases ?? baseline?.repurchases, incidents: debtor.incidents ?? baseline?.incidents, publicStatus: debtor.publicStatus ?? baseline?.publicStatus, scoreReasons: debtor.scoreReasons ?? baseline?.scoreReasons, incidentDetails: debtor.incidentDetails ?? baseline?.incidentDetails, portfolioMetrics: debtor.portfolioMetrics ?? baseline?.portfolioMetrics, groupName: debtor.groupName ?? baseline?.groupName, groupCompanies: debtor.groupCompanies ?? baseline?.groupCompanies, groupExposure: debtor.groupExposure ?? baseline?.groupExposure, groupOverdue: debtor.groupOverdue ?? baseline?.groupOverdue, groupScore: debtor.groupScore ?? baseline?.groupScore } as Debtor;
        }));
      }
      const savedGuidance = window.localStorage.getItem("lastro-interface-guidance-v1");
      if (savedGuidance !== null) setShowGuidance(savedGuidance === "true");
    } catch { /* mantém os dados de demonstração se o armazenamento estiver indisponível */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("lastro-mvp-operations-v3", JSON.stringify(operations));
    window.localStorage.setItem("lastro-mvp-debtors-v1", JSON.stringify(debtors));
  }, [operations, debtors, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("lastro-interface-guidance-v1", String(showGuidance));
  }, [showGuidance, storageReady]);

  function updateOperation(updated: Operation) {
    setOperations(current => current.map(operation => operation.id === updated.id ? updated : operation));
    setSelected(updated);
  }

  function registerDebtor(debtor: Debtor) {
    setDebtors(current => [debtor, ...current.filter(item => item.document.replace(/\D/g, "") !== debtor.document.replace(/\D/g, ""))]);
  }

  function resetDemo() {
    if (!window.confirm("Restaurar todas as operações para o estado inicial da demonstração?")) return;
    window.localStorage.removeItem("lastro-mvp-operations-v3");
    window.localStorage.removeItem("lastro-mvp-debtors-v1");
    setOperations(initialOperations);
    setDebtors(initialDebtors);
    setSelected(null);
  }
  function createOperation({ source, operationType, destination, cedent }: NewOperationInput) {
    const nextActions: Record<OperationSource, string> = {
      "XML NF-e": "Conferir títulos identificados nos XMLs",
      "CNAB": "Validar leiaute e ocorrências importadas",
      "Planilha": "Conferir colunas e títulos importados",
      "Digitação manual": "Definir o tipo de recebível e iniciar a digitação",
      "Crédito estruturado": "Cadastrar condições, garantias e partes da CCB",
    };
    const prefix = datePrefix();
    const dailySequence = Math.max(0, ...operations.filter(operation => operation.aditivoNumber?.startsWith(prefix)).map(operation => Number(operation.aditivoNumber.slice(-3)) || 0)) + 1;
    const borderoSequence = Math.max(0, ...operations.map(operation => Number(operation.borderoNumber) || 0)) + 1;
    const aditivoNumber = `${prefix}${String(dailySequence).padStart(3, "0")}`;
    const borderoNumber = String(borderoSequence).padStart(7, "0");
    const next: Operation = { ...initialOperations[4], id: `op-${Date.now()}`, proposal: `#${borderoSequence}`, aditivoNumber, borderoNumber, institution: destination.institution, vehicle: destination.name, source, operationType, cedent: cedent.name, document: cedent.document, risk: cedent.score >= 700 ? "Baixo" : cedent.score >= 600 ? "Médio" : "Alto", amount: 0, netAmount: 0, titleCount: 0, stage: 1, status: "Em andamento", blockers: 0, alerts: cedent.incidents, enteredAt: "Agora", waitingFor: "agora", elapsedMinutes: 0, clientAverageMinutes: 0, historySample: 0, nextAction: nextActions[source], policy: destination.institution === "FIDC" ? "Política do fundo selecionado" : destination.institution === "Securitizadora" ? "Política comercial da securitizadora" : "Política de fomento com regresso", fundClass: destination.institution === "FIDC" ? destination.detail : undefined, participants: destination.institution === "FIDC" ? ["Gestora Atlas", "Adm. Fiduciário Orbe", "Custodiante Nexus"] : undefined };
    setOperations([next, ...operations]); setShowNew(false); setSelected(next);
  }
  return <>{selected ? <OperationWorkspace operation={selected} operationCount={operations.length} debtors={debtors} onRegisterDebtor={registerDebtor} onBack={() => setSelected(null)} onUpdate={updateOperation} showGuidance={showGuidance} onOpenSettings={() => setShowSettings(true)} /> : <OperationsList operations={operations} companyScope={companyScope} onCompanyScopeChange={setCompanyScope} onOpen={setSelected} onNew={() => setShowNew(true)} onReset={resetDemo} onOpenSettings={() => setShowSettings(true)} />}{showNew && <NewOperationModal defaultDestination={companyScope} onClose={() => setShowNew(false)} onCreate={createOperation} />}{showSettings && <InterfaceSettingsModal showGuidance={showGuidance} onChange={setShowGuidance} onClose={() => setShowSettings(false)} />}</>;
}
