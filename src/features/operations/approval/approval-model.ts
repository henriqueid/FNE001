"use client";
/**
 * Modelo puro da etapa de Aprovação: tipos do pacote decisório, valores padrão
 * (alçadas, documentos, assinaturas), checklist de prontidão, números do resumo
 * financeiro e trilha da decisão. Nada aqui tem estado nem efeitos colaterais.
 */
import { stages } from "@/src/domain/core/stages";
import { type Cedent, type Operation } from "@/src/domain/core/types";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";
import { type lastroAssessmentFor } from "@/src/domain/operations/lastro";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";

export type ApprovalReview = NonNullable<Operation["approvalReview"]>;
export type ApprovalStatus = ApprovalReview["status"];
export type ApprovalItem = NonNullable<ApprovalReview["approvals"]>[number];
export type ApprovalDocument = NonNullable<ApprovalReview["documents"]>[number];
export type ApprovalSignature = NonNullable<ApprovalReview["signatures"]>[number];
export type ApprovalAuditEvent = NonNullable<ApprovalReview["audit"]>[number];

export type ReadinessItem = { label: string; ok: boolean; detail: string };
export type TimelineEvent = { at: string; by: string; action: string; detail: string };

export const reportTypes = ["Borderô", "Termo de cessão", "Memória financeira", "Dossiê da operação"] as const;
export type ReportType = (typeof reportTypes)[number];

export const manualReasons = [
  "Contrato assinado fisicamente",
  "Assinatura em cartório",
  "Assinatura por procuração",
  "Provedor de assinatura indisponível",
  "Outro",
];

export type ManualSignatureDraft = {
  signedDate: string;
  reason: string;
  notes: string;
  attachmentName: string;
};

type RepurchaseAction = "Recompra" | "Baixar do banco" | "Baixar somente do sistema" | "Recompra parcial";

/** Número com vírgula decimal, no formato usado em taxas e fatores (ex.: 2,10). */
export function decimal(value: number, digits: number) {
  return value.toFixed(digits).replace(".", ",");
}

/** Data/hora curta em pt-BR usada nos registros da trilha e na emissão de relatórios. */
export function nowLabel() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function reportInitials(report: ReportType) {
  return report === "Borderô"
    ? "BO"
    : report === "Termo de cessão"
      ? "TC"
      : report === "Memória financeira"
        ? "MF"
        : "DO";
}

export function reviewStatusTone(status: ApprovalStatus) {
  return status === "Aprovada" || status === "Em formalização"
    ? "ready"
    : status === "Reprovada"
      ? "cancelled"
      : "attention";
}

/** Mensagens com estes termos são exibidas como alerta; as demais como sucesso. */
export function feedbackTone(feedback: string) {
  return feedback.includes("pendente") || feedback.includes("precisa") || feedback.includes("Conclua")
    ? "warning"
    : "success";
}

/** Reúne todos os números da condição comercial usados no resumo e nos relatórios. */
export function buildFinancialFigures(operation: Operation, registryCedents: Cedent[]) {
  const pricing = normalizedPricing(operation);
  const calculated = pricingCalculation(operation, pricing);
  const repurchase = repurchaseCalculation(operation, pricing);
  const adjustments = settlementAdjustmentCalculation(operation, pricing);
  const totalOffsets = repurchase.total + adjustments.total;
  const finalNet = roundPricing(calculated.net - totalOffsets);
  const cedent = registryCedents.find(
    item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""),
  );
  const availableLimit = cedent ? Math.max(0, cedent.creditLimit - cedent.usedLimit) : 0;
  const projectedLimit = Math.max(0, availableLimit - calculated.face);
  const retainedTotal = roundPricing(calculated.guarantee + pricing.manualRetention);
  const targetFinalRate = pricing.targetFinalRateMonthly ?? 0;
  const operationFeeTotal = roundPricing(pricing.operationFee);
  const titleFeeTotal = roundPricing(pricing.feePerTitle * calculated.titleRows.length);
  const adValoremTotal = roundPricing((calculated.face * pricing.adValoremPercent) / 100);
  const averageTerm = Math.round(calculated.weightedTerm);
  const averageFloat = pricing.floatDays;
  const averageNetTerm = Math.max(0, averageTerm - averageFloat);
  const periodFactor = averageTerm > 0 ? (calculated.originalDiscount / Math.max(1, calculated.face)) * 100 : 0;
  const realMonthlyFactor = calculated.allInMonthly;
  const suggestedMonthlyFactor = targetFinalRate || Math.max(pricing.monthlyRate, pricing.fundingCostMonthly);
  const projectedRoa = calculated.face > 0 ? calculated.spread * 12 : 0;
  const repurchaseByAction = (action: RepurchaseAction) =>
    roundPricing(
      repurchase.selected
        .filter(item => (item.terms.action ?? "Recompra") === action)
        .reduce((sum, item) => sum + item.presentValue, 0),
    );
  return {
    pricing,
    calculated,
    repurchase,
    adjustments,
    totalOffsets,
    finalNet,
    cedent,
    availableLimit,
    projectedLimit,
    retainedTotal,
    targetFinalRate,
    operationFeeTotal,
    titleFeeTotal,
    adValoremTotal,
    averageTerm,
    averageFloat,
    averageNetTerm,
    periodFactor,
    realMonthlyFactor,
    suggestedMonthlyFactor,
    projectedRoa,
    repurchaseByAction,
  };
}

export type FinancialFigures = ReturnType<typeof buildFinancialFigures>;

export function isRiskApproved(operation: Operation) {
  if (operation.eligibilityReview) return eligibilityRouteFor(operation).canAdvance;
  return (
    operation.riskReview?.cedentDecision === "Aprovado" &&
    (operation.manualEntry?.entries ?? []).every(title => Boolean(operation.riskReview?.titleDecisions?.[title.id])) &&
    (operation.manualEntry?.entries ?? []).some(
      title => operation.riskReview?.titleDecisions?.[title.id] === "Aprovado",
    )
  );
}

/** Requisitos das etapas anteriores que precisam estar concluídos antes das alçadas. */
export function buildReadinessChecklist(
  operation: Operation,
  lastro: ReturnType<typeof lastroAssessmentFor>,
): ReadinessItem[] {
  const riskApproved = isRiskApproved(operation);
  const route = operation.eligibilityReview ? eligibilityRouteFor(operation) : undefined;
  return [
    {
      label: "Risco e elegibilidade",
      ok: riskApproved,
      detail: route
        ? `${route.label} · ${route.explanation}`
        : riskApproved
          ? "Cedente, sacados e títulos aprovados"
          : "Existem decisões de risco pendentes",
    },
    {
      label: "Lastro e confirmação",
      ok: lastro.ready,
      detail: lastro.ready
        ? "Evidências e confirmações concluídas"
        : `${lastro.divergences} divergência(s) ou confirmação pendente`,
    },
    {
      label: "Condição comercial",
      ok: operation.pricingReview?.status === "Condição salva",
      detail:
        operation.pricingReview?.status === "Condição salva"
          ? `Condição v${operation.pricingReview.version ?? 1} protegida`
          : "A condição ainda não foi salva",
    },
    {
      label: "Bloqueios operacionais",
      ok: operation.blockers === 0,
      detail: operation.blockers ? `${operation.blockers} bloqueio(s) exigem deliberação` : "Nenhum bloqueio aberto",
    },
  ];
}

export function buildDefaultApprovals(operation: Operation, prerequisitesReady: boolean): ApprovalItem[] {
  return [
    {
      id: "originacao",
      role: "Responsável pela operação",
      approver: operation.owner,
      status: "Aprovado",
      decidedAt: "Agora",
      note: "Pacote preparado e conferido",
    },
    {
      id: "credito",
      role: "Alçada de crédito",
      approver: operation.risk === "Baixo" ? "Motor de alçada" : "Comitê de Crédito",
      status: operation.risk === "Baixo" && prerequisitesReady ? "Aprovado" : "Pendente",
      decidedAt: operation.risk === "Baixo" && prerequisitesReady ? "Agora" : undefined,
      note: operation.risk === "Baixo" ? "Dentro da política vigente" : "Requer deliberação humana",
    },
    {
      id: "diretoria",
      role: "Alçada final",
      approver: operation.institution === "FIDC" ? "Diretoria / Gestora" : "Diretoria Comercial",
      status: "Pendente",
    },
  ];
}

export function buildDefaultDocuments(
  operation: Operation,
  lastro: ReturnType<typeof lastroAssessmentFor>,
): ApprovalDocument[] {
  return [
    { id: "bordero", name: "Borderô da operação", required: true, status: "Pronto", source: "Gerado pelo sistema" },
    {
      id: "cessao",
      name: operation.institution === "FIDC" ? "Termo de cessão" : "Instrumento de cessão",
      required: true,
      status: "Pronto",
      source: "Modelo do veículo",
    },
    {
      id: "memoria",
      name: "Memória da condição comercial",
      required: true,
      status: operation.pricingReview?.status === "Condição salva" ? "Pronto" : "Pendente",
      source: "Etapa Preço",
    },
    {
      id: "lastro",
      name: "Dossiê de lastro e confirmações",
      required: true,
      status: lastro.ready ? "Pronto" : "Pendente",
      source: "Etapa Lastro",
    },
    {
      id: "nfe",
      name: "Documentos fiscais e recebíveis",
      required: true,
      status: (operation.manualEntry?.entries ?? []).every(
        item => Boolean(item.nfeKey) || operation.operationType === "Cheque",
      )
        ? "Pronto"
        : "Pendente",
      source: "Entrada da operação",
    },
    {
      id: "compliance",
      name: "Cadastro e compliance do cedente",
      required: true,
      status: operation.document !== "Cadastro pendente" ? "Pronto" : "Pendente",
      source: "Cadastro do cedente",
    },
  ];
}

export function buildDefaultSignatures(operation: Operation): ApprovalSignature[] {
  return [
    { id: "cedente", party: operation.cedent, signer: "Representante autorizado do cedente", status: "Não enviado" },
    {
      id: "cessionaria",
      party: operation.vehicle,
      signer: operation.institution === "FIDC" ? "Representante da gestora" : "Representante autorizado",
      status: "Não enviado",
    },
  ];
}

/** Etapas concluídas seguidas dos eventos de auditoria, do mais recente para o mais antigo. */
export function buildApprovalTimeline(operation: Operation, audit: ApprovalAuditEvent[]): TimelineEvent[] {
  return [
    ...(operation.stageCompletions ?? []).map(item => ({
      at: item.completedAt,
      by: item.completedBy,
      action: `${stages[item.stageId - 1]?.short ?? "Etapa"} concluída`,
      detail: "Dados preservados para a decisão",
    })),
    ...audit,
  ].reverse();
}

export function emptyManualDraft(signedDate: string): ManualSignatureDraft {
  return { signedDate, reason: "Contrato assinado fisicamente", notes: "", attachmentName: "" };
}
