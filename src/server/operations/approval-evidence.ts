/** Contrato persistido das alçadas e evidências materiais de aprovação. */
import { createHash } from "node:crypto";
import type { Permission } from "@/src/domain/access/model";
import type { Operation } from "@/src/domain/core/types";
import type { EligibilityPolicy } from "@/src/domain/eligibility/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

export type ApprovalSlot = {
  id: string;
  authorityId: string;
  permission: Extract<Permission, "risk:decide" | "controlleria:formalize">;
};
export type ApprovalAuthorityPolicy = { eventId: string; company: string; slots: ApprovalSlot[] };
export type OperationApprovalGrant = {
  eventId: string;
  actorId: string;
  slotId: string;
  authorityId: string;
  snapshotHash: string;
  policyEventId: string;
  decidedAt: string;
  decision: "APROVAR" | "REPROVAR";
};
export type ServerApprovalReview = NonNullable<Operation["approvalReview"]> & {
  serverApproval?: { snapshotHash: string; eventIds: string[]; policyEventId: string };
};

const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, stable(item)]),
        )
      : value;
export const approvalHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");

export function operationApprovalHash(
  operation: Operation,
  policies: EligibilityPolicy[],
  policy: ApprovalAuthorityPolicy,
) {
  return approvalHash({
    id: operation.id,
    vehicle: operation.vehicle,
    institution: operation.institution,
    document: operation.document,
    amount: operation.amount,
    titleCount: operation.titleCount,
    netAmount: operation.netAmount,
    risk: operation.risk,
    policy: operation.policy,
    manualEntry: operation.manualEntry,
    riskReview: operation.riskReview,
    lastroReview: operation.lastroReview,
    pricingReview: operation.pricingReview,
    clientOperationalParameters: operation.clientOperationalParameters,
    policies,
    approvalPolicy: policy,
  });
}

export function approvalEvidenceComplete(
  operation: Operation,
  policies: EligibilityPolicy[],
  policy: ApprovalAuthorityPolicy | undefined,
  grants: OperationApprovalGrant[],
) {
  if (!policy?.slots.length) return false;
  const reference = (operation.approvalReview as ServerApprovalReview | undefined)?.serverApproval;
  const snapshotHash = operationApprovalHash(operation, policies, policy);
  if (!reference || reference.snapshotHash !== snapshotHash || reference.policyEventId !== policy.eventId) return false;
  const applicable = grants.filter(
    grant => grant.snapshotHash === snapshotHash && grant.policyEventId === policy.eventId,
  );
  if (applicable.some(grant => grant.decision === "REPROVAR")) return false;
  return policy.slots.every(slot =>
    applicable.some(
      grant =>
        Boolean(grant.actorId) &&
        grant.decision === "APROVAR" &&
        grant.slotId === slot.id &&
        grant.authorityId === slot.authorityId &&
        reference.eventIds.includes(grant.eventId),
    ),
  );
}

export async function loadApprovalAuthorityPolicy(
  db: DecisionDatabase,
  tenantId: string,
  company: string,
): Promise<ApprovalAuthorityPolicy | undefined> {
  const row = await db
    .prepare(
      `select event_id, payload from private.domain_events where tenant_id = ? and aggregate_type = 'OperationApprovalPolicy' and aggregate_id = ? and event_type = 'OPERATION_APPROVAL_POLICY_CONFIGURED' order by aggregate_version desc limit 1`,
    )
    .bind(tenantId, company)
    .first<{ event_id: string; payload: { company: string; slots: ApprovalSlot[] } }>();
  const slots = row?.payload.slots;
  if (
    !row ||
    row.payload.company !== company ||
    !Array.isArray(slots) ||
    !slots.length ||
    new Set(slots.map(slot => slot.id)).size !== slots.length ||
    slots.some(
      slot => !slot.id || !slot.authorityId || !["risk:decide", "controlleria:formalize"].includes(slot.permission),
    )
  )
    return undefined;
  return { eventId: row.event_id, company, slots };
}

export async function loadOperationApprovalGrants(
  db: DecisionDatabase,
  tenantId: string,
  operationId: string,
): Promise<OperationApprovalGrant[]> {
  const rows = await db
    .prepare(
      `select event_id, actor_id, payload, aggregate_version,
         coalesce((select max((returned.payload->'result'->'operation'->>'persistenceVersion')::integer)
           from private.domain_events returned where returned.tenant_id = approvals.tenant_id
             and ((returned.aggregate_type = 'OperationReturn' and returned.event_type = 'OPERATION_RETURNED')
               or (returned.aggregate_type = 'OperationRiskReturn' and returned.event_type = 'OPERATION_RETURNED_TO_RISK'))
             and returned.payload->'result'->'operation'->>'id' = approvals.aggregate_id), 0) as return_version
       from private.domain_events approvals
       where tenant_id = ? and aggregate_type = 'OperationApproval' and aggregate_id = ?
         and event_type in ('OPERATION_APPROVAL_GRANTED', 'OPERATION_APPROVAL_REJECTED')
         and aggregate_version > coalesce((
           select max((returned.payload->'result'->'operation'->>'persistenceVersion')::integer)
           from private.domain_events returned
           where returned.tenant_id = approvals.tenant_id
             and ((returned.aggregate_type = 'OperationReturn' and returned.event_type = 'OPERATION_RETURNED')
               or (returned.aggregate_type = 'OperationRiskReturn' and returned.event_type = 'OPERATION_RETURNED_TO_RISK'))
             and returned.payload->'result'->'operation'->>'id' = approvals.aggregate_id
         ), 0)
       order by aggregate_version`,
    )
    .bind(tenantId, operationId)
    .all<{
      event_id: string;
      actor_id: string;
      payload: OperationApprovalGrant;
      aggregate_version: number;
      return_version: number;
    }>();
  return rows.results
    .filter(row => row.aggregate_version > Number(row.return_version))
    .map(row => ({ ...row.payload, eventId: row.event_id, actorId: row.actor_id }));
}
