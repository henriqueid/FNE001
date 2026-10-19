/** Aprovação depende de evidência material e alçadas individuais, nunca de rótulos do cliente. */
import { describe, expect, it } from "vitest";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  approvalEvidenceComplete,
  loadOperationApprovalGrants,
  operationApprovalHash,
  type ApprovalAuthorityPolicy,
  type OperationApprovalGrant,
  type ServerApprovalReview,
} from "@/src/server/operations/approval-evidence";

const policy: ApprovalAuthorityPolicy = {
  eventId: "policy-1",
  company: initialOperations[0].vehicle,
  slots: [
    { id: "credit", authorityId: "credit-director", permission: "risk:decide" },
    { id: "final", authorityId: "final-director", permission: "controlleria:formalize" },
  ],
};
function evidence() {
  const operation = { ...initialOperations[0] };
  const snapshotHash = operationApprovalHash(operation, [], policy);
  const grants: OperationApprovalGrant[] = policy.slots.map((slot, index) => ({
    eventId: `event-${index}`,
    actorId: `actor-${index}`,
    slotId: slot.id,
    authorityId: slot.authorityId,
    snapshotHash,
    policyEventId: policy.eventId,
    decidedAt: "2026-10-18T12:00:00Z",
    decision: "APROVAR",
  }));
  const approvalReview: ServerApprovalReview = {
    status: "Aprovada",
    serverApproval: { snapshotHash, policyEventId: policy.eventId, eventIds: grants.map(grant => grant.eventId) },
  };
  return { operation: { ...operation, approvalReview }, grants };
}
describe("evidência de aprovação formal", () => {
  it("não reutiliza alçadas anteriores à devolução e reaquisição dos mesmos dados", async () => {
    const { grants } = evidence();
    const db = {
      prepare: () => {
        const statement = {
          bind: () => statement,
          all: async () => ({
            results: [
              { event_id: "old", actor_id: "actor-old", payload: grants[0], aggregate_version: 4, return_version: 5 },
              { event_id: "new", actor_id: "actor-new", payload: grants[1], aggregate_version: 8, return_version: 5 },
            ],
          }),
        };
        return statement;
      },
    } as unknown as DecisionDatabase;
    expect((await loadOperationApprovalGrants(db, "tenant", "operation")).map(grant => grant.eventId)).toEqual(["new"]);
  });
  it("exige ator real em cada concessão de alçada", () => {
    const { operation, grants } = evidence();
    grants[0].actorId = "";
    expect(approvalEvidenceComplete(operation, [], policy, grants)).toBe(false);
  });
  it("aceita concessões cumulativas de todas as alçadas", () => {
    const { operation, grants } = evidence();
    expect(approvalEvidenceComplete(operation, [], policy, grants)).toBe(true);
    expect(approvalEvidenceComplete(operation, [], policy, grants.slice(0, 1))).toBe(false);
  });
  it("aceita a mesma pessoa em todas as alçadas quando possui as concessões exigidas", () => {
    const { operation, grants } = evidence();
    grants.forEach(grant => {
      grant.actorId = "operador-autorizado";
    });
    expect(approvalEvidenceComplete(operation, [], policy, grants)).toBe(true);
  });
  it("invalida aprovação quando dados materiais ou política mudam", () => {
    const { operation, grants } = evidence();
    expect(approvalEvidenceComplete({ ...operation, amount: operation.amount + 1 }, [], policy, grants)).toBe(false);
    expect(approvalEvidenceComplete(operation, [], { ...policy, eventId: "policy-2" }, grants)).toBe(false);
  });
});
