import { type DecisionEventDraft, type DecisionEventType, type DecisionOutcome } from "@/src/domain/decisions/model";

const eventTypes = new Set<DecisionEventType>([
  "ANALYSIS_REQUESTED",
  "ANALYSIS_COMPLETED",
  "POLICY_BLOCKED",
  "EXCEPTION_REQUESTED",
  "EXCEPTION_APPROVED",
  "EXCEPTION_REJECTED",
  "CONDITION_PENDING",
  "CONDITION_SATISFIED",
  "CONDITION_EXPIRED",
  "OPERATION_SENT_TO_FORMALIZATION",
  "PAYMENT_CONFIRMED",
  "PROMISE_RECORDED",
  "PROMISE_BROKEN",
  "DECISION_REVIEWED",
]);

const outcomes = new Set<DecisionOutcome>([
  "PENDING",
  "WITHIN_POLICY",
  "BLOCKED",
  "APPROVED",
  "APPROVED_WITH_CONDITION",
  "REJECTED",
]);

const stringField = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === "string" && Boolean((record[key] as string).trim());
const stringArray = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string");

export function parseDecisionEventDraft(value: unknown): DecisionEventDraft {
  if (!value || typeof value !== "object") throw new Error("Evento de decisão inválido.");
  const record = value as Record<string, unknown>;
  const required = [
    "eventId",
    "decisionId",
    "operationId",
    "decisionType",
    "requestedAction",
    "policyId",
    "policyVersion",
    "inputSnapshotId",
    "inputSnapshotHash",
    "validFrom",
    "correlationId",
  ];
  if (required.some(key => !stringField(record, key))) throw new Error("Evento de decisão incompleto.");
  if (!eventTypes.has(record.eventType as DecisionEventType)) throw new Error("Tipo de evento desconhecido.");
  if (!outcomes.has(record.outcome as DecisionOutcome)) throw new Error("Resultado de decisão desconhecido.");
  if (!stringArray(record.entityRefs) || !stringArray(record.reasonCodes)) throw new Error("Referências inválidas.");
  if (!stringArray(record.supportingEvidenceRefs) || !stringArray(record.priorDecisionRefs))
    throw new Error("Evidências ou decisões anteriores inválidas.");
  if (!record.computedMetrics || typeof record.computedMetrics !== "object" || Array.isArray(record.computedMetrics))
    throw new Error("Métricas calculadas inválidas.");
  if (!Array.isArray(record.conditions)) throw new Error("Condições inválidas.");
  return record as unknown as DecisionEventDraft;
}
