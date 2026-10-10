import { describe, expect, it } from "vitest";
import {
  appendDecisionEvent,
  createAuthorityGrant,
  decisionFingerprint,
  evaluateExposure,
  grantAllows,
} from "@/src/domain/decisions/engine";
import { emptyDecisionLedger } from "@/src/domain/decisions/model";

describe("Governanca de decisoes", () => {
  it("gera a mesma assinatura para o mesmo snapshot", () => {
    expect(decisionFingerprint({ operation: "op-1", amount: 100 })).toBe(
      decisionFingerprint({ operation: "op-1", amount: 100 }),
    );
    expect(decisionFingerprint({ operation: "op-1", amount: 100 })).not.toBe(
      decisionFingerprint({ operation: "op-1", amount: 101 }),
    );
  });

  it("nao reduz a exposicao por uma promessa ainda nao liquidada", () => {
    const result = evaluateExposure({
      limitCents: 10_000_000,
      currentExposureCents: 13_600_000,
      newOperationCents: 3_000_000,
      promisedSettlementCents: 3_600_000,
    });
    expect(result.projectedExposureCents).toBe(16_600_000);
    expect(result.projectedExcessCents).toBe(6_600_000);
    expect(result.reasonCodes).toEqual(["PROMISE_NOT_SETTLED", "CREDIT_LIMIT_EXCEEDED"]);
    expect(result.requiresNewAuthority).toBe(true);
  });

  it("mesmo depois da liquidacao confirmada exige nova alcada se continuar acima do limite", () => {
    const result = evaluateExposure({
      limitCents: 10_000_000,
      currentExposureCents: 13_600_000,
      newOperationCents: 3_000_000,
      promisedSettlementCents: 3_600_000,
      confirmedSettlementCents: 3_600_000,
    });
    expect(result.projectedExposureCents).toBe(13_000_000);
    expect(result.projectedExcessCents).toBe(3_000_000);
    expect(result.reasonCodes).toEqual(["CREDIT_LIMIT_EXCEEDED"]);
  });

  it("mantem o log append-only e incrementa a versao do evento", () => {
    const base = {
      eventId: "evt-1",
      eventType: "ANALYSIS_REQUESTED" as const,
      decisionId: "dec-1",
      tenantId: "tenant-1",
      operationId: "op-1",
      entityRefs: ["ced-1"],
      decisionType: "CREDIT",
      requestedAction: "ANALYZE",
      actorId: "user-1",
      actorRole: "Analista",
      policyId: "policy-1",
      policyVersion: "1",
      inputSnapshotId: "snap-1",
      inputSnapshotHash: "hash-1",
      computedMetrics: {},
      reasonCodes: [],
      supportingEvidenceRefs: [],
      priorDecisionRefs: [],
      outcome: "PENDING" as const,
      conditions: [],
      validFrom: "2026-10-10T12:00:00.000Z",
      createdAt: "2026-10-10T12:00:00.000Z",
      correlationId: "corr-1",
    };
    const ledger = appendDecisionEvent(emptyDecisionLedger(), base);
    expect(ledger.events[0].eventVersion).toBe(1);
    expect(() => appendDecisionEvent(ledger, base)).toThrow("duplicado");
  });

  it("nao reaproveita uma autorizacao em outra operacao", () => {
    const grant = createAuthorityGrant({
      actor: { id: "director-1", role: "Diretoria de credito", authorityIds: ["credit-director"] },
      authorityId: "credit-director",
      operationId: "op-1",
      cedentDocument: "123",
      policyId: "policy-1",
      policyVersion: "3.2",
      additionalExposureCents: 3_000_000,
      maximumAdditionalExposureCents: 3_000_000,
      validFrom: "2026-10-10T00:00:00.000Z",
      validUntil: "2026-10-11T00:00:00.000Z",
      rationale: "Excecao aprovada com garantia adicional.",
    });
    expect(
      grantAllows(grant, {
        operationId: "op-2",
        cedentDocument: "123",
        policyId: "policy-1",
        policyVersion: "3.2",
        additionalExposureCents: 3_000_000,
        at: "2026-10-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});
