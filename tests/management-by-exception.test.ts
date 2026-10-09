import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { authorityQueue, pendingAuthoritiesFor, pendingDecisionsFor } from "@/src/domain/eligibility/authority-queue";
import { type EligibilityOutcome } from "@/src/domain/eligibility/model";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { AUTO_ACTOR, autoAdvanceWithinPolicy } from "@/src/domain/operations/auto-advance";
import { defaultPricing } from "@/src/domain/operations/pricing";
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

/** Todas as evidências validadas e todos os títulos confirmados. */
function withLastroReady(op: Operation): Operation {
  const items = Object.fromEntries(
    (op.manualEntry?.entries ?? []).map(title => [
      title.id,
      { evidenceDecision: "Validada" as const, confirmation: "Confirmado" as const },
    ]),
  );
  return { ...op, lastroReview: { items } };
}

const atStage = (op: Operation, stage: number): Operation => ({
  ...op,
  stage,
  status: "Em andamento",
  pricingReview: undefined,
  cancellation: undefined,
});

describe("avanço automático dentro da política", () => {
  it("dentro da política com lastro pronto: Lastro e Preço avançam sozinhos até a Aprovação", () => {
    const op = withLastroReady(withRun(atStage(base, 3), "APROVADO"));
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(5);
    expect(result.steps.map(step => step.stageId)).toEqual([3, 4]);
    expect(result.operation.pricingReview).toMatchObject({
      status: "Condição salva",
      savedBy: AUTO_ACTOR,
      locked: true,
    });
    expect(result.operation.stageCompletions?.filter(item => item.completedBy === AUTO_ACTOR)).toHaveLength(2);
  });
  it("para no Lastro quando falta confirmação do sacado", () => {
    const op = withRun(atStage({ ...base, lastroReview: undefined, risk: "Alto" }, 3), "APROVADO");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.steps).toEqual([]);
    expect(result.stoppedAt?.stageId).toBe(3);
  });
  it("exceção pendente no motor: nada avança", () => {
    const op = withLastroReady(withRun(atStage(base, 3), "EXCECAO"));
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(3);
    expect(result.steps).toEqual([]);
  });
  it("exceção aprovada pela alçada libera o avanço", () => {
    const op = withLastroReady(withRun(atStage(base, 3), "EXCECAO"));
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
    expect(autoAdvanceWithinPolicy(decided, { debtors: initialDebtors, at: AT }).operation.stage).toBe(5);
  });
  it("Preço com condição em simulação para e espera o operador", () => {
    const op = withRun(atStage(base, 4), "APROVADO");
    const simulated = { ...op, pricingReview: { ...defaultPricing(op), status: "Simulação" as const } };
    const result = autoAdvanceWithinPolicy(simulated, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(4);
    expect(result.stoppedAt?.reason).toContain("simulação");
  });
  it("taxa padrão abaixo do piso: Preço para para a alçada comercial", () => {
    const op = withRun(atStage({ ...base, institution: "FIDC", risk: "Alto" }, 4), "APROVADO");
    // FIDC: taxa padrão 2,1% a.m. contra piso de 2,4% a.m. para risco alto.
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT });
    expect(result.operation.stage).toBe(4);
    expect(result.stoppedAt?.reason).toContain("piso");
  });
  it("sem snapshot do motor, a esteira continua manual", () => {
    const op = withLastroReady({ ...atStage(base, 3), eligibilityReview: undefined });
    expect(autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: AT }).operation.stage).toBe(3);
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
