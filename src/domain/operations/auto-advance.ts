/**
 * Gestão por exceção na esteira: ao entrar em Lastro, a etapa é dispensada automaticamente somente
 * quando o cadastro do cedente não exige pré-checagem. A esteira sempre para em Preço.
 *
 * - Lastro obrigatório exige um parecer geral e conclusão manual; evidências, confirmações e checklist
 *   são apenas apoio e não bloqueiam o parecer.
 * - Preço nunca avança automaticamente. Salvar a condição e concluir a etapa são ações separadas.
 * - Aprovação e assinaturas continuam humanas. Depois da última assinatura e de todos os requisitos
 *   concluídos, o orquestrador apenas disponibiliza a operação na etapa de Liberação.
 * - A autorização financeira nunca é automática: favorecidos e pagamento ainda exigem conferência humana.
 *
 * Cada dispensa automática fica registrada na conclusão da etapa e no parecer de lastro
 * em nome do "Motor de elegibilidade".
 */
import { stages } from "@/src/domain/core/stages";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";
import { lastroAssessmentFor } from "./lastro";
import {
  defaultPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "./pricing";

export const AUTO_ACTOR = "Motor de elegibilidade";

export type AutoAdvanceStep = { stageId: number; stage: string; reason: string };

export type AutoAdvanceResult = {
  operation: Operation;
  steps: AutoAdvanceStep[];
  /** Por que a esteira parou (quando parou numa etapa automática). */
  stoppedAt?: { stageId: number; stage: string; reason: string };
};

const stageName = (id: number) => stages[id - 1]?.short ?? `Etapa ${id}`;

function completeStage(operation: Operation, at: string, nextAction: string): Operation {
  const next = operation.stage + 1;
  return {
    ...operation,
    stage: next,
    status: next === 6 ? "Pronta para liberar" : "Em andamento",
    nextAction,
    stageCompletions: [
      ...(operation.stageCompletions ?? []).filter(item => item.stageId !== operation.stage),
      { stageId: operation.stage, completedBy: AUTO_ACTOR, completedAt: at },
    ],
  };
}

/** Condição padrão salva pelo motor, ou o motivo pelo qual ela exige decisão humana. */
export function automaticPricing(operation: Operation, at: string): { operation?: Operation; reason: string } {
  const pricing = defaultPricing(operation);
  const calculated = pricingCalculation(operation, pricing);
  const offsets = roundPricing(
    repurchaseCalculation(operation, pricing).total + settlementAdjustmentCalculation(operation, pricing).total,
  );
  const net = roundPricing(calculated.net - offsets);
  const floor = operationalParametersFor(operation.institution).rateFloorByRisk[operation.risk];
  if (!calculated.titleRows.length) return { reason: "não há títulos para precificar" };
  if (pricing.monthlyRate < floor)
    return { reason: `a taxa padrão fica abaixo do piso de ${floor.toString().replace(".", ",")}% a.m.` };
  if (net <= 0 || calculated.spread <= 0) return { reason: "a condição padrão não gera líquido e spread positivos" };
  const saved = {
    ...pricing,
    status: "Condição salva" as const,
    savedAt: at,
    savedBy: AUTO_ACTOR,
    version: 1,
    locked: true,
    audit: [
      {
        version: 1,
        at,
        by: AUTO_ACTOR,
        action: "Condição salva" as const,
        reason: "Condição padrão da modalidade dentro da política (avanço automático)",
        face: calculated.face,
        commercialNet: calculated.net,
        repurchaseAndCompensations: offsets,
        borderoNet: net,
        monthlyRate: pricing.monthlyRate,
        method: pricing.method,
      },
    ],
  };
  return {
    operation: {
      ...operation,
      pricingReview: saved,
      amount: calculated.face,
      titleCount: calculated.titleRows.length,
      netAmount: net,
    },
    reason: "condição padrão dentro do piso, com líquido e spread positivos",
  };
}

export function autoAdvanceWithinPolicy(
  operation: Operation,
  { debtors, at }: { debtors?: Debtor[]; at: string },
): AutoAdvanceResult {
  const steps: AutoAdvanceStep[] = [];
  let current = operation;
  if (!operationalParametersFor(operation.institution).autoAdvanceWithinPolicy) return { operation, steps };
  if (current.status === "Cancelada" || current.stage !== 3) return { operation: current, steps };
  if (current.eligibilityReview && !eligibilityRouteFor(current).canAdvance) return { operation: current, steps };
  const lastro = lastroAssessmentFor(current, debtors);
  if (lastro.required)
    return {
      operation: current,
      steps,
      stoppedAt: {
        stageId: 3,
        stage: stageName(3),
        reason: lastro.ready
          ? "parecer registrado; conclua a etapa manualmente"
          : "pré-checagem obrigatória: registre o status geral do parecer",
      },
    };
  current = completeStage(
    {
      ...current,
      lastroReview: {
        ...current.lastroReview,
        status: "Dispensado",
        opinion: "Pré-checagem dispensada conforme cadastro do cedente.",
        reviewedAt: at,
        reviewedBy: AUTO_ACTOR,
      },
    },
    at,
    stages[3].description,
  );
  steps.push({ stageId: 3, stage: stageName(3), reason: "pré-checagem dispensada no cadastro do cedente" });
  return { operation: current, steps };
}

/** Frase para o operador sobre o que o motor fez (ou por que parou). */
export function autoAdvanceMessage(result: AutoAdvanceResult) {
  const done = result.steps.map(step => `${step.stage} (${step.reason})`).join(" e ");
  const stop = result.stoppedAt ? `Parou em ${result.stoppedAt.stage}: ${result.stoppedAt.reason}.` : "";
  if (!result.steps.length) return stop;
  return `Automação da esteira: ${done ? `concluiu ${done}.` : ""} ${stop || "A operação está em Preço para análise manual."}`.trim();
}
