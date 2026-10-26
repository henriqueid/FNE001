/** CCB não implementada não pode ser introduzida por conversão nem editada como legado. */
import { expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { Operation } from "@/src/domain/core/types";
import { validatePersistedOperation } from "@/src/domain/operations/persistence";
import { operationMutationPermissionError } from "@/src/domain/operations/mutation-permissions";
import { assertOperationTransition } from "@/src/server/operations/governance";
const draft: Operation = {
  ...initialOperations[0],
  source: "Digitação manual",
  operationType: "Duplicata",
  stage: 1,
  status: "Em andamento",
  riskReview: undefined,
  eligibilityReview: undefined,
  approvalReview: undefined,
  releaseReview: undefined,
  stageCompletions: [],
};
it.each([
  { source: "Crédito estruturado" as const, operationType: "CCB" },
  { source: "Digitação manual" as const, operationType: "CCB" },
  { source: "Crédito estruturado" as const, operationType: "Duplicata" },
])("nega introdução de CCB no PUT existente ou criação: %j", change => {
  const requested = { ...draft, ...change };
  expect(validatePersistedOperation(requested)).toBeNull();
  expect(operationMutationPermissionError(draft, requested, ["operations:edit"])).toBeNull();
  expect(() => assertOperationTransition(draft, requested)).toThrow(/CCB.*não suportada/);
  expect(() => assertOperationTransition(null, requested)).toThrow(/CCB.*não suportada/);
});
it("legado CCB preserva consulta e cancelamento, mas recusa edição/avanço/disfarce de origem", () => {
  const legacy = { ...draft, source: "Crédito estruturado" as const, operationType: "CCB" };
  expect(() => assertOperationTransition(legacy, { ...legacy })).not.toThrow();
  expect(() =>
    assertOperationTransition(legacy, {
      ...legacy,
      status: "Cancelada",
      nextAction: "Operação encerrada — memória preservada",
    }),
  ).not.toThrow();
  for (const requested of [
    { ...legacy, amount: 123 },
    { ...legacy, stage: 2 },
    { ...legacy, source: "Digitação manual" as const, operationType: "Duplicata" },
    { ...legacy, status: "Cancelada" as const, amount: 123 },
  ])
    expect(() => assertOperationTransition(legacy, requested)).toThrow(/CCB legada.*consulta/);
});
