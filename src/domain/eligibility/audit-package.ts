import { type Operation } from "@/src/domain/core/types";

/** Pacote autocontido para auditoria, fiscalização ou homologação da decisão. */
export function eligibilityAuditPackage(operation: Operation, exportedAt: string, exportedBy: string) {
  const review = operation.eligibilityReview;
  if (!review) return undefined;
  return {
    schema: "strato.eligibility-audit.v1",
    exportedAt,
    exportedBy,
    operation: {
      id: operation.id,
      proposal: operation.proposal,
      aditivoNumber: operation.aditivoNumber,
      borderoNumber: operation.borderoNumber,
      institution: operation.institution,
      vehicle: operation.vehicle,
      cedent: operation.cedent,
      cedentDocument: operation.document,
      grossAmount: operation.amount,
      netAmount: operation.netAmount,
      titleCount: operation.titleCount,
    },
    current: { run: review.run, overrides: review.overrides },
    history: review.history ?? [],
  };
}
