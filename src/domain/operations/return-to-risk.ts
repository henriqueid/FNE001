/** Invalida decisões posteriores à revisão, preservando os dados de entrada, risco, lastro e preço. */
import type { Operation } from "@/src/domain/core/types";

export function operationReturnedToRisk(operation: Operation, reason: string, by: string, at: string): Operation {
  return {
    ...operation,
    stage: 2,
    status: "Em atenção",
    blockers: Math.max(1, operation.blockers),
    nextAction: "Revisar política, dados e exceções da operação devolvida",
    stageCompletions: operation.stageCompletions?.filter(item => item.stageId < 2),
    releaseReview: undefined,
    approvalReview: {
      status: "Preparação",
      observation: reason.trim(),
      approvals: [],
      documents: [],
      signatures: [],
      finalDecision: { outcome: "DEVOLVIDA", decidedAt: at, decidedBy: by, justification: reason.trim() },
      audit: [
        ...(operation.approvalReview?.audit ?? []),
        { at, by, action: "Operação devolvida", detail: reason.trim() },
        {
          at,
          by,
          action: "Pacote decisório invalidado",
          detail: "Alçadas, documentos e assinaturas deverão ser refeitos após a revisão de risco.",
        },
      ],
    },
  };
}
