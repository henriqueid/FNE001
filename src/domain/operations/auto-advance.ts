/**
 * Gestão por exceção na esteira: depois que o motor libera a operação (snapshot dentro da política ou
 * exceções já deliberadas), as etapas sem decisão humana avançam sozinhas até a Tela Final (Aprovação).
 *
 * - Lastro avança quando todas as evidências estão validadas e a amostra sorteada foi confirmada.
 *   Se há confirmação pendente, a esteira PARA ali: ligar para o sacado é trabalho humano.
 * - Preço avança quando a condição comercial já foi salva, ou quando a condição padrão da modalidade
 *   respeita o piso de taxa e gera líquido e spread positivos (ela é salva em nome do motor).
 * - Aprovação e assinaturas continuam humanas. Depois da última assinatura e de todos os requisitos
 *   concluídos, o orquestrador apenas disponibiliza a operação na etapa de Liberação.
 * - A autorização financeira nunca é automática: favorecidos e pagamento ainda exigem conferência humana.
 *
 * Cada avanço automático fica registrado na conclusão da etapa ("Motor de elegibilidade") e no
 * histórico da condição comercial, com o motivo.
 */
import { stages } from "@/src/domain/core/stages";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";
import { isConfirmationResolved, lastroAssessmentFor } from "./lastro";
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
  for (let guard = 0; guard < 3; guard++) {
    if (current.status === "Cancelada" || !current.eligibilityReview) break;
    if (!eligibilityRouteFor(current).canAdvance) break;
    if (current.stage === 3) {
      const lastro = lastroAssessmentFor(current, debtors);
      if (!lastro.ready) {
        const pending = lastro.rows.filter(
          row => row.evidenceStatus !== "Validada" || (row.sampled && !isConfirmationResolved(row)),
        ).length;
        return {
          operation: current,
          steps,
          stoppedAt: {
            stageId: 3,
            stage: stageName(3),
            reason: lastro.divergences
              ? `${lastro.divergences} divergência(s) de lastro exigem análise`
              : `${pending} título(s) aguardam evidência ou confirmação do sacado`,
          },
        };
      }
      if (lastro.exceptions.length)
        return {
          operation: current,
          steps,
          stoppedAt: {
            stageId: 3,
            stage: stageName(3),
            reason: `${lastro.exceptions.length} exceção(ões) de lastro registrada(s): conclua a etapa manualmente`,
          },
        };
      current = completeStage(current, at, stages[3].description);
      steps.push({ stageId: 3, stage: stageName(3), reason: "evidências validadas e amostra confirmada" });
      continue;
    }
    if (current.stage === 4) {
      if (current.pricingReview?.status === "Condição salva") {
        current = completeStage(current, at, "Submeter condição comercial às alçadas");
        steps.push({ stageId: 4, stage: stageName(4), reason: "condição comercial salva" });
        continue;
      }
      if (current.pricingReview) {
        return {
          operation: current,
          steps,
          stoppedAt: { stageId: 4, stage: stageName(4), reason: "condição comercial em simulação" },
        };
      }
      const priced = automaticPricing(current, at);
      if (!priced.operation)
        return { operation: current, steps, stoppedAt: { stageId: 4, stage: stageName(4), reason: priced.reason } };
      current = completeStage(priced.operation, at, "Submeter condição comercial às alçadas");
      steps.push({ stageId: 4, stage: stageName(4), reason: priced.reason });
      continue;
    }
    break;
  }
  return { operation: current, steps };
}

/** Frase para o operador sobre o que o motor fez (ou por que parou). */
export function autoAdvanceMessage(result: AutoAdvanceResult) {
  const done = result.steps.map(step => `${step.stage} (${step.reason})`).join(" e ");
  const stop = result.stoppedAt ? `Parou em ${result.stoppedAt.stage}: ${result.stoppedAt.reason}.` : "";
  if (!result.steps.length) return stop;
  return `Dentro da política: o motor concluiu ${done}. ${stop || "A operação está na Tela Final para decisão."}`.trim();
}
