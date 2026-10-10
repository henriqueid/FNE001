import {
  type AuthorityGrant,
  type DecisionCondition,
  type DecisionEvent,
  type DecisionLedger,
  type DecisionOutcome,
} from "./model";

/** Assinatura determinística para detectar alteração do snapshot no protótipo. */
export function decisionFingerprint(value: unknown) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `decision-${(hash >>> 0).toString(36)}`;
}

export type ExposureInput = {
  limitCents: number;
  currentExposureCents: number;
  newOperationCents: number;
  promisedSettlementCents?: number;
  confirmedSettlementCents?: number;
};

export type ExposureDecision = {
  outcome: Extract<DecisionOutcome, "WITHIN_POLICY" | "BLOCKED">;
  projectedExposureCents: number;
  projectedExcessCents: number;
  exposureAfterConfirmedSettlementCents: number;
  reasonCodes: string[];
  requiresNewAuthority: boolean;
};

/** Promessas não reduzem exposição. Somente liquidações efetivamente confirmadas entram no cálculo. */
export function evaluateExposure(input: ExposureInput): ExposureDecision {
  const confirmed = Math.max(0, input.confirmedSettlementCents ?? 0);
  const exposureAfterConfirmedSettlementCents = Math.max(0, input.currentExposureCents - confirmed);
  const projectedExposureCents = exposureAfterConfirmedSettlementCents + Math.max(0, input.newOperationCents);
  const projectedExcessCents = Math.max(0, projectedExposureCents - Math.max(0, input.limitCents));
  const reasonCodes: string[] = [];
  if ((input.promisedSettlementCents ?? 0) > 0 && confirmed === 0) reasonCodes.push("PROMISE_NOT_SETTLED");
  if (projectedExcessCents > 0) reasonCodes.push("CREDIT_LIMIT_EXCEEDED");
  return {
    outcome: projectedExcessCents > 0 ? "BLOCKED" : "WITHIN_POLICY",
    projectedExposureCents,
    projectedExcessCents,
    exposureAfterConfirmedSettlementCents,
    reasonCodes,
    requiresNewAuthority: projectedExcessCents > 0,
  };
}

/** Acrescenta um evento preservando a ordem e rejeitando colisao de identidade. */
export function appendDecisionEvent(
  ledger: DecisionLedger,
  event: Omit<DecisionEvent, "eventVersion">,
): DecisionLedger {
  if (ledger.events.some(item => item.eventId === event.eventId)) throw new Error("Evento de decisão duplicado.");
  const lastVersion = ledger.events.at(-1)?.eventVersion ?? 0;
  return { ...ledger, events: [...ledger.events, { ...event, eventVersion: lastVersion + 1 }] };
}

export type AuthorityDecisionInput = {
  actor: { id: string; role: string; authorityIds: string[] };
  authorityId: string;
  operationId: string;
  cedentDocument: string;
  policyId: string;
  policyVersion: string;
  additionalExposureCents: number;
  maximumAdditionalExposureCents: number;
  validFrom: string;
  validUntil: string;
  rationale: string;
  conditions?: DecisionCondition[];
};

/** Cria uma autorizacao escopada; ela nao pode ser reutilizada por outra operacao. */
export function createAuthorityGrant(input: AuthorityDecisionInput): AuthorityGrant {
  if (!input.actor.authorityIds.includes(input.authorityId))
    throw new Error("Usuário sem competência para esta alçada.");
  if (input.rationale.trim().length < 12) throw new Error("Informe uma justificativa objetiva para a decisão.");
  if (input.additionalExposureCents <= 0) throw new Error("A exposição adicional deve ser positiva.");
  if (input.additionalExposureCents > input.maximumAdditionalExposureCents)
    throw new Error("A exposição excede o valor máximo desta autorização.");
  if (Date.parse(input.validUntil) <= Date.parse(input.validFrom))
    throw new Error("A validade da autorização é inválida.");
  return {
    authorityId: input.authorityId,
    operationId: input.operationId,
    cedentDocument: input.cedentDocument,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    maximumAdditionalExposureCents: input.maximumAdditionalExposureCents,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    conditions: input.conditions ?? [],
    approvedBy: input.actor.id,
    rationale: input.rationale.trim(),
  };
}

export function grantAllows(
  grant: AuthorityGrant,
  request: {
    operationId: string;
    cedentDocument: string;
    policyId: string;
    policyVersion: string;
    additionalExposureCents: number;
    at: string;
  },
) {
  return (
    grant.operationId === request.operationId &&
    grant.cedentDocument === request.cedentDocument &&
    grant.policyId === request.policyId &&
    grant.policyVersion === request.policyVersion &&
    request.additionalExposureCents <= grant.maximumAdditionalExposureCents &&
    Date.parse(request.at) >= Date.parse(grant.validFrom) &&
    Date.parse(request.at) <= Date.parse(grant.validUntil) &&
    grant.conditions.every(condition => condition.status === "SATISFIED")
  );
}
