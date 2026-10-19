import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { authorityQueue, pendingAuthoritiesFor, pendingDecisionsFor } from "@/src/domain/eligibility/authority-queue";
import { type EligibilityOutcome } from "@/src/domain/eligibility/model";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { AUTO_ACTOR, autoAdvanceWithinPolicy, withResolvedLastroPrecheck } from "@/src/domain/operations/auto-advance";
import { inQueue } from "@/src/features/operations/central/central-model";

const AT = "02/10/2026 10:00";
const base = initialOperations.find(op => (op.manualEntry?.entries.length ?? 0) > 0)!;

/** Operação com snapshot do motor em que todas as regras têm o resultado informado. */
function withRun(op: Operation, outcome: EligibilityOutcome, authority = "Comitê de crédito"): Operation {
  const run = evaluateOperationEligibility({ operation: op, debtors: initialDebtors });
  return {
    ...op,
    eligibilityReview: {
      run: {
        ...run,
        evaluations: run.evaluations.map((item, index) =>
          index === 0 ? { ...item, outcome, overrideAuthority: authority } : { ...item, outcome: "APROVADO" },
        ),
      },
      overrides: [],
    },
  };
}

const atStage = (op: Operation, stage: number): Operation => ({
  ...op,
  stage,
  status: "Em andamento",
  pricingReview: undefined,
  cancellation: undefined,
});

describe("avanço automático dentro da política", () => {
  it("sem pré-checagem obrigatória, dispensa o Lastro e para em Preço", () => {
    const op = withRun(atStage({ ...base, lastroPrecheckRequired: false }, 3), "APROVADO");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(4);
    expect(result.steps.map(step => step.stageId)).toEqual([3]);
    expect(result.operation.lastroReview).toMatchObject({ status: "Dispensado", reviewedBy: AUTO_ACTOR });
    expect(result.operation.pricingReview).toBeUndefined();
    expect(result.operation.stageCompletions?.filter(item => item.completedBy === AUTO_ACTOR)).toHaveLength(1);
  });
  it("com pré-checagem obrigatória, para no Lastro quando falta o parecer geral", () => {
    const op = withRun(
      atStage({ ...base, lastroPrecheckRequired: true, lastroReview: undefined, risk: "Alto" }, 3),
      "APROVADO",
    );
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.steps).toEqual([]);
    expect(result.stoppedAt?.stageId).toBe(3);
    expect(result.stoppedAt?.reason).toContain("status geral");
  });
  it("exceção pendente no motor: nada avança", () => {
    const op = withRun(atStage(base, 3), "EXCECAO");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.steps).toEqual([]);
  });
  it("exceção aprovada pela alçada libera o avanço", () => {
    const op = withRun(atStage({ ...base, lastroPrecheckRequired: false }, 3), "EXCECAO");
    const evaluation = op.eligibilityReview!.run.evaluations[0];
    const decided: Operation = {
      ...op,
      eligibilityReview: {
        ...op.eligibilityReview!,
        overrides: [
          {
            id: "ov-1",
            evaluationId: evaluation.id,
            ruleId: evaluation.ruleId,
            subjectId: evaluation.subjectId,
            originalOutcome: "EXCECAO",
            observed: evaluation.observed,
            parameter: evaluation.parameter,
            decision: "APROVAR_EXCECAO",
            justification: "Cliente com garantia adicional",
            authority: "Comitê de crédito",
            decidedBy: "Henrique",
            decidedAt: "2026-10-02T10:00:00Z",
            evidence: evaluation.evidence,
          },
        ],
      },
    };
    expect(autoAdvanceWithinPolicy(decided, { debtors: initialDebtors, at: AT }).operation.stage).toBe(4);
  });
  it("Preço nunca avança automaticamente", () => {
    const op = withRun(atStage(base, 4), "APROVADO");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(4);
    expect(result.steps).toEqual([]);
    expect(result.operation.pricingReview).toBeUndefined();
  });
  it("o parecer obrigatório nunca conclui o Lastro automaticamente", () => {
    const op = {
      ...withRun(atStage(base, 3), "APROVADO"),
      lastroPrecheckRequired: true,
      lastroReview: { status: "Favorável" as const, opinion: "Apto para seguir." },
    };
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.stoppedAt?.reason).toContain("manualmente");
  });
  it("Aprovação nunca avança sozinha", () => {
    const op = withRun(atStage(base, 5), "APROVADO");
    expect(autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT }).operation.stage).toBe(5);
  });
});

describe("fila de exceções por alçada", () => {
  it("lista só exceções sem decisão e agrupa por alçada", () => {
    const a = withRun({ ...base, id: "a" }, "EXCECAO", "Comitê de crédito");
    const b = withRun({ ...base, id: "b" }, "EXCECAO", "Gerente de crédito");
    const c = withRun({ ...base, id: "c" }, "APROVADO");
    expect(pendingDecisionsFor(a)).toHaveLength(1);
    expect(pendingAuthoritiesFor(c)).toEqual([]);
    expect(authorityQueue([a, b, c])).toEqual([
      { authority: "Comitê de crédito", operations: 1, decisions: 1 },
      { authority: "Gerente de crédito", operations: 1, decisions: 1 },
    ]);
    expect([a, b, c].filter(op => inQueue(op, "authority")).map(op => op.id)).toEqual(["a", "b"]);
  });
  it("operação cancelada sai da fila", () => {
    const a = withRun({ ...base, status: "Cancelada" }, "EXCECAO");
    expect(pendingDecisionsFor(a)).toEqual([]);
  });
});

describe("operações anteriores à pré-checagem por cedente", () => {
  const legacy = (): Operation => {
    const op = withRun(atStage({ ...base, lastroReview: undefined }, 3), "APROVADO");
    delete op.lastroPrecheckRequired;
    return op;
  };

  it("não dispensa o Lastro de operação sem a exigência registrada", () => {
    const result = autoAdvanceWithinPolicy(legacy(), { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.steps).toEqual([]);
  });

  it("não dispensa o Lastro sem análise de elegibilidade", () => {
    const op = { ...atStage({ ...base, lastroPrecheckRequired: false }, 3), eligibilityReview: undefined };
    expect(autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT }).steps).toEqual([]);
  });

  it("resolve a exigência pelo cadastro atual do cedente", () => {
    const op = legacy();
    const cedent = { document: op.document, name: op.cedent, requiresLastroPrecheck: true };
    const required = withResolvedLastroPrecheck(op, [cedent]);
    expect(required?.lastroPrecheckRequired).toBe(true);
    expect(autoAdvanceWithinPolicy(required!, { debtors: initialDebtors, at: AT }).operation.stage).toBe(3);

    const optional = withResolvedLastroPrecheck(op, [{ ...cedent, requiresLastroPrecheck: false }]);
    expect(autoAdvanceWithinPolicy(optional!, { debtors: initialDebtors, at: AT }).operation.stage).toBe(4);
  });

  it("sem cedente localizado, mantém a etapa para decisão humana", () => {
    expect(withResolvedLastroPrecheck(legacy(), [])).toBeUndefined();
  });
});
