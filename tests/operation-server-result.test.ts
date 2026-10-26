/** Respostas persistidas e criação assistida têm tratamentos distintos dos rascunhos locais. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  consumeOperationServerResult,
  newOperationAtEntry,
  operationSavedByServer,
  mergeOperationAcknowledgement,
} from "@/src/app/operation-server-result";
import { decideOperationApproval } from "@/src/app/operation-approval-client";

afterEach(() => vi.unstubAllGlobals());

it("incorpora efeitos autoritativos sem apagar edição local posterior ao envio", () => {
  const submitted = { ...initialOperations[0], persistenceVersion: 1 };
  const current = { ...submitted, financialObservation: "Edição posterior" };
  const saved = {
    ...submitted,
    persistenceVersion: 2,
    repurchaseApplications: [{ id: "server-application" } as never],
    repurchaseContext: { titles: [] },
  };
  expect(mergeOperationAcknowledgement(current, submitted, saved)).toMatchObject({
    financialObservation: "Edição posterior",
    persistenceVersion: 2,
    repurchaseApplications: saved.repurchaseApplications,
  });
  expect(mergeOperationAcknowledgement(submitted, submitted, saved)).toBe(saved);
  expect(
    mergeOperationAcknowledgement({ ...current, persistenceVersion: 3 }, submitted, saved).persistenceVersion,
  ).toBe(3);
});

describe("integração de operações persistidas", () => {
  it("identifica resposta do comando dedicado e reintenta transporte sem mudar a intenção", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("transporte interrompido"))
      .mockResolvedValueOnce(Response.json({ operation: { ...initialOperations[0], persistenceVersion: 8 } }));
    vi.stubGlobal("fetch", fetch);
    const saved = await decideOperationApproval({
      operationId: initialOperations[0].id,
      expectedVersion: 7,
      slotId: "credito",
      decision: "APROVAR",
      reason: "Conferência documentada da alçada",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(consumeOperationServerResult(saved)).toBe(true);
  });
  it("não confia apenas em persistenceVersion e consome recibo uma única vez", () => {
    const local = { ...initialOperations[0], persistenceVersion: 5 };
    expect(consumeOperationServerResult(local)).toBe(false);
    const saved = operationSavedByServer({ ...local });
    expect(consumeOperationServerResult({ ...saved })).toBe(false);
    expect(consumeOperationServerResult(saved)).toBe(true);
    expect(consumeOperationServerResult(saved)).toBe(false);
  });
  it("normaliza criação assistida sem perder títulos, lote ou origem", () => {
    const source = {
      ...initialOperations[0],
      stage: 5,
      persistenceVersion: 99,
      repurchaseApplications: [{ id: "previous-cycle" } as never],
      repurchaseContext: { titles: [] },
      copilotOrigin: {
        runId: "run-1",
        scenarioVersion: 2,
        policyName: "Referência",
        policyVersion: "1",
        generatedAt: "2026-10-18",
        generatedBy: "Analista",
        fileNames: ["lote.csv"],
      },
      eligibilityReview: {
        run: {
          id: "fake",
          evaluatedAt: "2026-10-18",
          overallOutcome: "APROVADO" as const,
          policyVersions: [],
          evaluations: [],
          counts: { APROVADO: 0, ALERTA: 0, EXCECAO: 0, REPROVADO: 0, NAO_AVALIADO: 0 },
        },
        overrides: [],
      },
    };
    const normalized = newOperationAtEntry(source);
    expect(normalized.stage).toBe(1);
    expect(normalized.manualEntry).toBe(source.manualEntry);
    expect(normalized.entryIntake).toBe(source.entryIntake);
    expect(normalized.copilotOrigin).toBe(source.copilotOrigin);
    expect(normalized.titleCount).toBe(source.manualEntry?.entries.length ?? 0);
    for (const field of [
      "persistenceVersion",
      "stageCompletions",
      "riskReview",
      "eligibilityReview",
      "enrichmentReview",
      "lastroReview",
      "pricingReview",
      "approvalReview",
      "releaseReview",
      "cancellation",
      "repurchaseApplications",
      "repurchaseContext",
    ] as const)
      expect(normalized[field]).toBeUndefined();
    expect(source.stage).toBe(5);
  });
});
