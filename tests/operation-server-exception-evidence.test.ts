/** Override efetivo exige regra, ator, alçada e hash dos fatos atuais. */
import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import {
  eligibilityExceptionHash,
  loadEligibilityExceptionGrants,
  verifiedEligibilityOverrides,
  type EligibilityExceptionGrant,
} from "@/src/server/operations/exception-evidence";
function fixture() {
  const operation = initialOperations[0];
  const raw = evaluateOperationEligibility({ operation, debtors: [], asOf: "2026-10-18" });
  const evaluation = {
    ...raw.evaluations[0],
    outcome: "EXCECAO" as const,
    overrideAllowed: true,
    overrideAuthority: "credit-director",
  };
  const run = { ...raw, evaluations: [evaluation] };
  const grant: EligibilityExceptionGrant = {
    id: "grant",
    eventId: "grant",
    actorId: "director",
    operationId: operation.id,
    runHash: eligibilityExceptionHash(operation, run),
    evaluationId: evaluation.id,
    ruleId: evaluation.ruleId,
    subjectId: evaluation.subjectId,
    originalOutcome: evaluation.outcome,
    observed: evaluation.observed,
    parameter: evaluation.parameter,
    decision: "APROVAR_EXCECAO",
    justification: "Exceção deliberada pela alçada",
    authority: "credit-director",
    decidedBy: "director",
    decidedAt: "2026-10-18T12:00:00Z",
    evidence: evaluation.evidence,
  };
  return { operation, run, grant };
}
describe("exceções por avaliação autoritativa", () => {
  it("não reaproveita exceção de ciclo anterior quando a reaquisição mantém os mesmos fatos", async () => {
    const { operation, run, grant } = fixture();
    const db = {
      prepare: () => {
        const statement = {
          bind: () => statement,
          all: async () => ({
            results: [
              {
                event_id: grant.eventId,
                actor_id: grant.actorId,
                payload: grant,
                aggregate_version: 4,
                return_version: 5,
              },
            ],
          }),
        };
        return statement;
      },
    } as unknown as DecisionDatabase;
    const currentGrants = await loadEligibilityExceptionGrants(db, "tenant", operation.id);
    expect(verifiedEligibilityOverrides(operation, run, currentGrants)).toEqual([]);
  });
  it("aceita somente concessão da alçada da regra", () => {
    const { operation, run, grant } = fixture();
    expect(verifiedEligibilityOverrides(operation, run, [grant])).toHaveLength(1);
    expect(verifiedEligibilityOverrides(operation, run, [{ ...grant, authority: "outra-alcada" }])).toHaveLength(0);
    expect(verifiedEligibilityOverrides(operation, run, [{ ...grant, actorId: "" }])).toHaveLength(0);
  });
  it("invalida concessão quando título, política ou fatos observados mudam", () => {
    const { operation, run, grant } = fixture();
    expect(verifiedEligibilityOverrides({ ...operation, amount: operation.amount + 1 }, run, [grant])).toHaveLength(0);
    expect(
      verifiedEligibilityOverrides(
        operation,
        { ...run, evaluations: run.evaluations.map(evaluation => ({ ...evaluation, observed: 999 })) },
        [grant],
      ),
    ).toHaveLength(0);
    expect(verifiedEligibilityOverrides(operation, { ...run, policyVersions: [] }, [grant])).toHaveLength(0);
  });
  it("não aplica decisão para regra sem permissão de exceção", () => {
    const { operation, run, grant } = fixture();
    const forbidden = {
      ...run,
      evaluations: run.evaluations.map(evaluation => ({ ...evaluation, overrideAllowed: false })),
    };
    expect(
      verifiedEligibilityOverrides(operation, forbidden, [
        { ...grant, runHash: eligibilityExceptionHash(operation, forbidden) },
      ]),
    ).toHaveLength(0);
  });
});
