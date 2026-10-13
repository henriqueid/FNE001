import { describe, expect, it } from "vitest";
import { type DecisionEvent } from "@/src/domain/decisions/model";
import { nextRetryAt, notificationForDecisionEvent, outboxFailureDisposition } from "@/src/server/outbox/publisher";
import { functionalAreasMatchQueue } from "@/src/domain/copilot/daily-briefing";

const event = (eventType: DecisionEvent["eventType"], overrides: Partial<DecisionEvent> = {}): DecisionEvent => ({
  eventId: "event-1",
  eventVersion: 1,
  eventType,
  decisionId: "decision-1",
  tenantId: "tenant-1",
  operationId: "operation-1",
  entityRefs: ["cedent-1"],
  decisionType: "CREDIT",
  requestedAction: "REVIEW",
  actorId: "user-1",
  actorRole: "Analista",
  authorityId: "credit-director",
  policyId: "policy-1",
  policyVersion: "1",
  inputSnapshotId: "snapshot-1",
  inputSnapshotHash: "hash-1",
  computedMetrics: {},
  reasonCodes: ["LIMIT_EXCEEDED"],
  supportingEvidenceRefs: [],
  priorDecisionRefs: [],
  outcome: "PENDING",
  conditions: [],
  validFrom: "2026-10-10T12:00:00.000Z",
  createdAt: "2026-10-10T12:00:00.000Z",
  correlationId: "correlation-1",
  ...overrides,
});

describe("publicador da outbox", () => {
  it("encaminha excecao somente para a permissao e alcada responsaveis", () => {
    expect(notificationForDecisionEvent(event("EXCEPTION_REQUESTED"))).toMatchObject({
      kind: "decision",
      tone: "critical",
      department: "Risco e crédito",
      requiredPermission: "risk:decide",
      authorityId: "credit-director",
    });
  });

  it("nao cria notificacao para eventos informativos sem acao", () => {
    expect(notificationForDecisionEvent(event("ANALYSIS_COMPLETED"))).toBeNull();
  });

  it("aplica backoff crescente e limitado", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    expect(nextRetryAt(1, now)).toBe("2026-10-10T12:01:00.000Z");
    expect(nextRetryAt(2, now)).toBe("2026-10-10T12:05:00.000Z");
    expect(nextRetryAt(5, now)).toBe("2026-10-10T18:00:00.000Z");
    expect(nextRetryAt(99, now)).toBe("2026-10-10T18:00:00.000Z");
  });

  it("move para a fila de falhas na quinta tentativa", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    expect(outboxFailureDisposition(3, now)).toMatchObject({ attempts: 4, status: "PENDING" });
    expect(outboxFailureDisposition(4, now)).toEqual({
      attempts: 5,
      status: "FAILED",
      availableAt: now.toISOString(),
    });
  });

  it("roteia notificações pela combinação de áreas do usuário", () => {
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Cadastro")).toBe(true);
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Carteira e cobrança")).toBe(true);
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Financeiro")).toBe(false);
  });
});
