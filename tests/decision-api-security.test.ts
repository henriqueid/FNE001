import { describe, expect, it } from "vitest";
import { seedAccessState } from "@/src/domain/access/model";
import { assertDecisionPermission, DecisionAccessError, decisionPrincipal } from "@/src/server/decisions/access";
import { parseDecisionEventDraft } from "@/src/server/decisions/validation";

const headersFor = (userId: string, tenantId = "strato-demo") =>
  new Headers({ "x-strato-user-id": userId, "x-strato-tenant-id": tenantId });

describe("seguranca da API de decisoes", () => {
  it("aceita somente empresas vinculadas ao usuario", () => {
    const admin = seedAccessState().users[0];
    expect(decisionPrincipal(headersFor(admin.id)).tenantId).toBe("strato-demo");
    expect(() => decisionPrincipal(headersFor(admin.id, "outra-empresa"))).toThrow(DecisionAccessError);
  });

  it("recusa decisao de alcada sem permissao de risco", () => {
    const operator = seedAccessState().users.find(user => user.department === "Operações")!;
    expect(() => assertDecisionPermission(operator, "EXCEPTION_APPROVED")).toThrow("sem permissão");
  });

  it("valida o contrato antes de persistir", () => {
    expect(() => parseDecisionEventDraft({ eventType: "ANALYSIS_REQUESTED" })).toThrow("incompleto");
    const event = parseDecisionEventDraft({
      eventId: "event-1",
      eventType: "ANALYSIS_REQUESTED",
      decisionId: "decision-1",
      operationId: "operation-1",
      entityRefs: [],
      decisionType: "OPERATION_ELIGIBILITY",
      requestedAction: "ANALYSIS_REQUESTED",
      policyId: "policy-1",
      policyVersion: "1",
      inputSnapshotId: "snapshot-1",
      inputSnapshotHash: "hash-1",
      computedMetrics: {},
      reasonCodes: [],
      supportingEvidenceRefs: [],
      priorDecisionRefs: [],
      outcome: "PENDING",
      conditions: [],
      validFrom: "2026-10-10T00:00:00.000Z",
      correlationId: "correlation-1",
    });
    expect(event.decisionId).toBe("decision-1");
  });
});
