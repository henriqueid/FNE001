/**
 * Contratos de decisao e auditoria do STRATO.
 * O livro-razao e append-only: correcoes entram como novos eventos e nunca apagam o passado.
 */
export type DecisionEventType =
  | "ANALYSIS_REQUESTED"
  | "ANALYSIS_COMPLETED"
  | "POLICY_BLOCKED"
  | "EXCEPTION_REQUESTED"
  | "EXCEPTION_APPROVED"
  | "EXCEPTION_REJECTED"
  | "CONDITION_PENDING"
  | "CONDITION_SATISFIED"
  | "CONDITION_EXPIRED"
  | "OPERATION_SENT_TO_FORMALIZATION"
  | "PAYMENT_CONFIRMED"
  | "PROMISE_RECORDED"
  | "PROMISE_BROKEN"
  | "DECISION_REVIEWED";

export type DecisionOutcome =
  "PENDING" | "WITHIN_POLICY" | "BLOCKED" | "APPROVED" | "APPROVED_WITH_CONDITION" | "REJECTED";

export type DecisionEvent = {
  eventId: string;
  eventVersion: number;
  eventType: DecisionEventType;
  decisionId: string;
  tenantId: string;
  operationId: string;
  entityRefs: string[];
  decisionType: string;
  requestedAction: string;
  actorId: string;
  actorRole: string;
  authorityId?: string;
  policyId: string;
  policyVersion: string;
  inputSnapshotId: string;
  inputSnapshotHash: string;
  computedMetrics: Record<string, number | string | boolean>;
  reasonCodes: string[];
  humanRationale?: string;
  supportingEvidenceRefs: string[];
  priorDecisionRefs: string[];
  outcome: DecisionOutcome;
  conditions: DecisionCondition[];
  validFrom: string;
  validUntil?: string;
  createdAt: string;
  correlationId: string;
};

export type DecisionCondition = {
  id: string;
  type: "PAYMENT_CONFIRMED" | "DOCUMENT_RECEIVED" | "MANUAL_REVIEW";
  description: string;
  status: "PENDING" | "SATISFIED" | "EXPIRED";
  evidenceRef?: string;
  dueAt?: string;
};

export type AuthorityGrant = {
  authorityId: string;
  operationId: string;
  cedentDocument: string;
  policyId: string;
  policyVersion: string;
  maximumAdditionalExposureCents: number;
  validFrom: string;
  validUntil: string;
  conditions: DecisionCondition[];
  approvedBy: string;
  rationale: string;
};

export type DecisionLedger = {
  version: 1;
  events: DecisionEvent[];
};

export const emptyDecisionLedger = (): DecisionLedger => ({ version: 1, events: [] });
