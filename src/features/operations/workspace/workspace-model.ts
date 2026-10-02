/**
 * Regras puras do workspace da operação: automação exibida, bloqueio de etapas,
 * pendências para concluir etapa, resumo financeiro e transformações da operação.
 */
import { stages } from "@/src/domain/core/stages";
import { type Cedent, type ManualEntryData, type Operation } from "@/src/domain/core/types";
import { eligibilityRouteFor, withEligibilityRoute } from "@/src/domain/eligibility/orchestration";
import { type AutomationBreakdown, manualAutomation } from "@/src/domain/operations/automation";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";
import { operationNeedsCedent } from "@/src/domain/operations/queries";
import { stageInsightFor } from "@/src/domain/operations/stage-insight";

export type WorkspaceFeedback = { tone: "success" | "warning"; message: string };
export type WorkspaceView = "summary" | "stages";
export type SummaryDensity = "compact" | "expanded";
export type StageInsight = ReturnType<typeof stageInsightFor>;
export type SummaryFinancials = ReturnType<typeof summaryFinancialsFor>;

/** Carimbo de data/hora usado nos registros de conclusão e cancelamento. */
export function workspaceTimestamp() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/** Automação exibida: calculada da digitação manual ou registrada na origem. */
export function automationFor(operation: Operation): AutomationBreakdown {
  return operation.source === "Digitação manual"
    ? manualAutomation(operation.manualEntry)
    : {
        score: operation.automation,
        items: [
          {
            label: "Automação registrada",
            points: operation.automation,
            maximum: 100,
            detail: "Calculada na origem e nas integrações desta operação",
          },
        ],
      };
}

/** Etapa visível apenas para consulta (futura ou após cancelamento). */
export function isStageLocked(operation: Operation, active: number) {
  return active > 1 && (active > operation.stage || (operation.status === "Cancelada" && active >= operation.stage));
}

/** Pendência que impede concluir a etapa atual; `null` quando pode avançar. */
export function stageAdvanceBlocker(
  operation: Operation,
  automation: AutomationBreakdown,
): { feedback: WorkspaceFeedback; requireCedent?: boolean } | null {
  if (operationNeedsCedent(operation)) {
    return {
      requireCedent: true,
      feedback: { tone: "warning", message: "Defina o cedente da operação antes de continuar." },
    };
  }
  if (
    operation.stage === 1 &&
    operation.source === "Digitação manual" &&
    (!operation.manualEntry?.entries.length || operation.manualEntry.entries.some(entry => !entry.debtorId))
  ) {
    return {
      feedback: {
        tone: "warning",
        message: "Defina o tipo, vincule um sacado válido e salve os títulos antes de concluir a entrada.",
      },
    };
  }
  if (operation.stage > 2 && operation.stage < 6 && operation.eligibilityReview) {
    const route = eligibilityRouteFor(operation);
    if (!route.canAdvance) {
      return {
        feedback: {
          tone: "warning",
          message: `${route.label}: ${route.explanation} Devolva a operação para Risco antes de continuar.`,
        },
      };
    }
  }
  const currentAssessment = stageInsightFor(operation, operation.stage, automation);
  if (operation.stage === 2 && operation.eligibilityReview) {
    const route = eligibilityRouteFor(operation);
    if (!route.canAdvance) {
      return {
        feedback: {
          tone: "warning",
          message: `${route.label}: ${route.explanation}`,
        },
      };
    }
  } else if (operation.stage === 2 && operation.manualEntry?.entries.length) {
    const debtorKeys = [...new Set(operation.manualEntry.entries.map(entry => entry.debtorId || entry.debtorDocument))];
    const cedentApproved = operation.riskReview?.cedentDecision === "Aprovado";
    const debtorsDecided = debtorKeys.every(key => Boolean(operation.riskReview?.debtorDecisions?.[key]));
    const titlesDecided = operation.manualEntry.entries.every(entry =>
      Boolean(operation.riskReview?.titleDecisions?.[entry.id]),
    );
    const approvedTitles = operation.manualEntry.entries.filter(
      entry => operation.riskReview?.titleDecisions?.[entry.id] === "Aprovado",
    ).length;
    if (!cedentApproved || !debtorsDecided || !titlesDecided) {
      return {
        feedback: {
          tone: "warning",
          message:
            "Registre a decisão do cedente, de todos os sacados e de todos os títulos (aprovado ou reprovado) antes de concluir risco e elegibilidade.",
        },
      };
    }
    if (!approvedTitles) {
      return {
        feedback: {
          tone: "warning",
          message: "Nenhum título aprovado. Reveja as decisões ou cancele a operação com o motivo.",
        },
      };
    }
  } else if (operation.stage === 2 && operation.blockers > 0) {
    return {
      feedback: { tone: "warning", message: "Existem bloqueios de risco que precisam de decisão antes do avanço." },
    };
  }
  if (operation.stage === 3 && !lastroAssessmentFor(operation).ready) {
    return {
      feedback: {
        tone: "warning",
        message: "Valide todas as evidências e confirme os sacados selecionados na amostra antes de concluir o lastro.",
      },
    };
  }
  if (operation.stage === 4 && operation.pricingReview?.status !== "Condição salva") {
    return {
      feedback: { tone: "warning", message: "Salve a condição comercial antes de concluir preço e estrutura." },
    };
  }
  if (operation.stage === 5) {
    const review = operation.approvalReview;
    const allApprovals =
      Boolean(review?.approvals?.length) && review!.approvals!.every(item => item.status === "Aprovado");
    const requiredDocumentsReady =
      Boolean(review?.documents?.length) &&
      review!
        .documents!.filter(item => item.required)
        .every(item => item.status === "Pronto" || item.status === "Dispensado");
    const allSignaturesCompleted =
      Boolean(review?.signatures?.length) && review!.signatures!.every(item => item.status === "Assinado");
    if (!allApprovals || !requiredDocumentsReady || !allSignaturesCompleted) {
      return {
        feedback: {
          tone: "warning",
          message: "Conclua todas as alçadas, documentos obrigatórios e assinaturas antes de seguir para a liberação.",
        },
      };
    }
  }
  if (operation.source === "Digitação manual" && operation.stage === 5 && currentAssessment.tone === "warning") {
    return { feedback: { tone: "warning", message: currentAssessment.result } };
  }
  return null;
}

/** Registra a conclusão da etapa atual e move a operação para a seguinte. */
export function withCurrentStageCompleted(operation: Operation): Operation {
  const routedOperation = operation.stage === 2 ? withEligibilityRoute(operation) : operation;
  const next = operation.stage + 1;
  const completion = {
    stageId: operation.stage,
    completedBy: "Henrique",
    completedAt: workspaceTimestamp(),
  };
  const stageCompletions = [
    ...(operation.stageCompletions ?? []).filter(item => item.stageId !== operation.stage),
    completion,
  ];
  return {
    ...routedOperation,
    stage: next,
    stageCompletions,
    status: next === 6 ? "Pronta para liberar" : "Em andamento",
    blockers: 0,
    nextAction: stages[next - 1].description,
  };
}

/** Cancela a operação preservando a memória (assinatura) para reimportações. */
export function withCancellation(operation: Operation, category: string, reason: string): Operation {
  const cancellation = {
    category,
    reason,
    cancelledAt: workspaceTimestamp(),
    cancelledBy: "Henrique",
    stage: operation.stage,
    stageName: stages[operation.stage - 1].title,
    operationSignature: `${operation.document}|${operation.amount.toFixed(2)}|${operation.titleCount}|${operation.source ?? "sem-origem"}`,
  };
  return { ...operation, status: "Cancelada", cancellation, nextAction: "Operação encerrada — memória preservada" };
}

/** Grava os títulos digitados e recalcula valores e automação. */
export function withManualEntry(operation: Operation, data: ManualEntryData): Operation {
  const amount = data.entries.reduce((sum, entry) => sum + entry.amount, 0);
  const discounts = data.entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
  const calculatedAutomation = manualAutomation(data).score;
  return {
    ...operation,
    manualEntry: data,
    operationType: data.receivableType,
    titleCount: data.entries.length,
    amount,
    netAmount: Math.max(0, amount - discounts),
    nextAction: "Conferir títulos digitados e concluir a entrada",
    automation: calculatedAutomation,
  };
}

/** Vincula o cedente cadastrado à operação. */
export function withCedent(operation: Operation, cedent: Cedent): Operation {
  return {
    ...operation,
    cedent: cedent.name,
    document: cedent.document,
    risk: (cedent.score >= 700 ? "Baixo" : cedent.score >= 600 ? "Médio" : "Alto") as Operation["risk"],
    alerts: Math.max(operation.alerts, cedent.incidents),
    nextAction: operation.stage === 1 ? operation.nextAction : "Revisar risco com o cedente vinculado",
  };
}

/** Números do resumo financeiro lateral. */
export function summaryFinancialsFor(operation: Operation, cedents: Cedent[]) {
  const pricing = normalizedPricing(operation);
  const calculation = pricingCalculation(operation, pricing);
  const repurchase = repurchaseCalculation(operation, pricing);
  const adjustments = settlementAdjustmentCalculation(operation, pricing);
  const offsets = roundPricing(repurchase.total + adjustments.total);
  const face = calculation.face || operation.amount;
  const net = operation.pricingReview ? roundPricing(calculation.net - offsets) : operation.netAmount;
  const cedent = cedents.find(item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""));
  const availableLimit = cedent ? Math.max(0, cedent.creditLimit - cedent.usedLimit) : 0;
  const limitAfterOperation = Math.max(0, availableLimit - face);
  const approvals = operation.approvalReview?.approvals ?? [];
  const approvedCount = approvals.filter(item => item.status === "Aprovado").length;
  return { pricing, calculation, offsets, face, net, availableLimit, limitAfterOperation, approvals, approvedCount };
}
