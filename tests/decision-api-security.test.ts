import { describe, expect, it } from "vitest";
import { type Permission } from "@/src/domain/access/model";
import { type ServerPrincipal } from "@/src/server/access/repository";
import { cookieValue, hashSessionToken } from "@/src/server/access/session";
import { assertDecisionPermission } from "@/src/server/decisions/access";
import { parseDecisionEventDraft } from "@/src/server/decisions/validation";

const principal = (permissions: Permission[], authorityIds: string[] = []): ServerPrincipal => ({
  id: "user-1",
  name: "Usuário",
  role: "Operador",
  status: "active",
  tenantId: "strato-demo",
  permissions,
  authorityIds,
});

describe("seguranca da API de decisoes", () => {
  it("usa token opaco do cookie em vez de identidade enviada pelo navegador", async () => {
    const headers = new Headers({ cookie: "tema=dark; strato_session=token-secreto; outro=1" });
    expect(cookieValue(headers, "strato_session")).toBe("token-secreto");
    expect(await hashSessionToken("token-secreto")).not.toContain("token-secreto");
  });

  it("recusa decisao de alcada sem permissao de risco", () => {
    expect(() => assertDecisionPermission(principal(["operations:view"]), "EXCEPTION_APPROVED")).toThrow(
      "sem permissão",
    );
  });

  it("exige permissao e atribuicao da alcada", () => {
    expect(() =>
      assertDecisionPermission(principal(["operations:view", "risk:decide"]), "EXCEPTION_APPROVED", "credit-director"),
    ).toThrow("sem a alçada");
    expect(() =>
      assertDecisionPermission(
        principal(["operations:view", "risk:decide"], ["credit-director"]),
        "EXCEPTION_APPROVED",
        "credit-director",
      ),
    ).not.toThrow();
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
