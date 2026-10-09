import { type Operation } from "@/src/domain/core/types";
import { effectiveRunSummary } from "./decision";

export type EligibilityRouteState =
  "AGUARDANDO_EXECUCAO" | "FLUXO_NORMAL" | "FLUXO_COM_ALERTA" | "DECISAO_HUMANA" | "BLOQUEADA";

export type EligibilityRoute = {
  state: EligibilityRouteState;
  canAdvance: boolean;
  requiresHumanDecision: boolean;
  label: string;
  explanation: string;
  blockers: number;
  alerts: number;
  nextAction: string;
};

/**
 * Traduz o resultado efetivo do motor em comportamento operacional. A função
 * nunca recalcula a política: usa somente o snapshot preservado e os overrides.
 */
export function eligibilityRouteFor(operation: Operation): EligibilityRoute {
  const review = operation.eligibilityReview;
  if (!review) {
    return {
      state: "AGUARDANDO_EXECUCAO",
      canAdvance: false,
      requiresHumanDecision: false,
      label: "Aguardando motor",
      explanation: "A política aplicável ainda não possui execução congelada para esta operação.",
      blockers: 1,
      alerts: 0,
      nextAction: "Executar a política aplicável",
    };
  }

  const summary = effectiveRunSummary(review.run, review.overrides);
  if (summary.counts.REPROVADO > 0) {
    return {
      state: "BLOQUEADA",
      canAdvance: false,
      requiresHumanDecision: false,
      label: "Inelegível",
      explanation: `${summary.counts.REPROVADO} critério(s) impeditivo(s) permanecem ativos conforme a política executada.`,
      blockers: summary.counts.REPROVADO,
      alerts: summary.counts.ALERTA,
      nextAction: "Devolver ou reprovar a operação",
    };
  }
  if (summary.counts.EXCECAO > 0) {
    return {
      state: "DECISAO_HUMANA",
      canAdvance: false,
      requiresHumanDecision: true,
      label: "Decisão humana necessária",
      explanation: `${summary.counts.EXCECAO} exceção(ões) aguardam decisão da alçada configurada.`,
      blockers: summary.counts.EXCECAO,
      alerts: summary.counts.ALERTA,
      nextAction: "Deliberar exceções da política",
    };
  }
  if (summary.counts.NAO_AVALIADO > 0) {
    return {
      state: "DECISAO_HUMANA",
      canAdvance: false,
      requiresHumanDecision: true,
      label: "Análise incompleta",
      explanation: `${summary.counts.NAO_AVALIADO} avaliação(ões) não possuem dados suficientes.`,
      blockers: summary.counts.NAO_AVALIADO,
      alerts: summary.counts.ALERTA,
      nextAction: "Completar dados ou deliberar análise incompleta",
    };
  }
  if (summary.counts.ALERTA > 0) {
    return {
      state: "FLUXO_COM_ALERTA",
      canAdvance: true,
      requiresHumanDecision: false,
      label: "Liberada com alertas",
      explanation: `${summary.counts.ALERTA} alerta(s) permanecem visíveis, mas não impedem a continuidade.`,
      blockers: 0,
      alerts: summary.counts.ALERTA,
      nextAction: "Continuar com alertas monitorados",
    };
  }
  return {
    state: "FLUXO_NORMAL",
    canAdvance: true,
    requiresHumanDecision: false,
    label: "Dentro da política",
    explanation: "Todas as avaliações determinísticas foram atendidas.",
    blockers: 0,
    alerts: 0,
    nextAction: "Continuar fluxo automático",
  };
}

/** Sincroniza indicadores da Central sem alterar o snapshot ou a trilha. */
export function withEligibilityRoute(operation: Operation): Operation {
  const route = eligibilityRouteFor(operation);
  if (route.state === "AGUARDANDO_EXECUCAO") return operation;
  return {
    ...operation,
    status:
      route.state === "DECISAO_HUMANA" || route.state === "BLOQUEADA"
        ? "Em atenção"
        : operation.status === "Em atenção"
          ? "Em andamento"
          : operation.status,
    blockers: route.blockers,
    alerts: Math.max(operation.alerts, route.alerts),
    nextAction: route.nextAction,
  };
}
