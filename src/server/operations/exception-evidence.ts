/** Exceções seladas pelo servidor, vinculadas à avaliação e aos fatos reexecutados. */
import type { Operation } from "@/src/domain/core/types";
import type { EligibilityOverride, EligibilityRun } from "@/src/domain/eligibility/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { approvalHash } from "./approval-evidence";

export type EligibilityExceptionGrant = EligibilityOverride & {
  eventId: string;
  actorId: string;
  runHash: string;
  operationId: string;
};
export function eligibilityExceptionHash(operation: Operation, run: EligibilityRun) {
  return approvalHash({
    operationId: operation.id,
    vehicle: operation.vehicle,
    document: operation.document,
    institution: operation.institution,
    amount: operation.amount,
    netAmount: operation.netAmount,
    titles: operation.manualEntry,
    riskReview: operation.riskReview,
    pricingReview: operation.pricingReview,
    run,
  });
}
export function verifiedEligibilityOverrides(
  operation: Operation,
  run: EligibilityRun,
  grants: EligibilityExceptionGrant[],
): EligibilityOverride[] {
  const hash = eligibilityExceptionHash(operation, run);
  const byEvaluation = new Map<string, EligibilityExceptionGrant>();
  for (const grant of grants) {
    const evaluation = run.evaluations.find(item => item.id === grant.evaluationId);
    if (
      grant.operationId === operation.id &&
      grant.runHash === hash &&
      grant.actorId &&
      evaluation?.overrideAllowed &&
      evaluation.overrideAuthority &&
      grant.authority === evaluation.overrideAuthority &&
      grant.ruleId === evaluation.ruleId &&
      grant.subjectId === evaluation.subjectId &&
      !["APROVADO", "ALERTA"].includes(evaluation.outcome)
    )
      byEvaluation.set(evaluation.id, grant);
  }
  return [...byEvaluation.values()];
}
export async function loadEligibilityExceptionGrants(
  db: DecisionDatabase,
  tenantId: string,
  operationId: string,
): Promise<EligibilityExceptionGrant[]> {
  const rows = await db
    .prepare(
      `select event_id, actor_id, payload, aggregate_version,
      coalesce((select max((returned.payload->'result'->'operation'->>'persistenceVersion')::integer)
        from private.domain_events returned where returned.tenant_id = exceptions.tenant_id
          and returned.aggregate_type = 'OperationReturn' and returned.event_type = 'OPERATION_RETURNED'
          and returned.payload->'result'->'operation'->>'id' = exceptions.aggregate_id), 0) as return_version
    from private.domain_events exceptions
    where tenant_id = ? and aggregate_type = 'EligibilityException' and aggregate_id = ?
      and event_type in ('ELIGIBILITY_EXCEPTION_APPROVED', 'ELIGIBILITY_EXCEPTION_REJECTED')
      and aggregate_version > coalesce((select max((returned.payload->'result'->'operation'->>'persistenceVersion')::integer)
        from private.domain_events returned where returned.tenant_id = exceptions.tenant_id
          and returned.aggregate_type = 'OperationReturn' and returned.event_type = 'OPERATION_RETURNED'
          and returned.payload->'result'->'operation'->>'id' = exceptions.aggregate_id), 0)
    order by aggregate_version`,
    )
    .bind(tenantId, operationId)
    .all<{
      event_id: string;
      actor_id: string;
      payload: EligibilityExceptionGrant;
      aggregate_version: number;
      return_version: number;
    }>();
  return rows.results
    .filter(row => row.aggregate_version > Number(row.return_version))
    .map(row => ({
      ...row.payload,
      eventId: row.event_id,
      actorId: row.actor_id,
      decidedBy: row.payload.decidedBy || row.actor_id,
    }));
}
