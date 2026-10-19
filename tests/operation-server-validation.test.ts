/** Rejeita avanço forjado e inconsistências materiais antes da persistência. */
import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { assertOperationTransition } from "@/src/server/operations/governance";
import { assertAuthoritativeOperation, assertOperationTitleTotals } from "@/src/server/operations/validation";
import { emptyParty } from "@/src/domain/registry/parties";
import { defaultPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import type { OperationAuthorityContext } from "@/src/server/operations/validation";
import { operationMutationPermissionError } from "@/src/domain/operations/mutation-permissions";

function fixture(minimum = 1) {
  const current = {
    ...initialOperations[0],
    stage: 2,
    amount: 1000,
    titleCount: 1,
    manualEntry: {
      mode: "individual" as const,
      receivableType: "Duplicata" as const,
      entries: [
        {
          id: "title-1",
          amount: 1000,
          documentNumber: "NF-1",
          dueDate: "2026-12-01",
          debtorId: "debtor-1",
          debtorName: "Sacado",
          debtorDocument: "12345678000195",
        },
      ],
    },
    eligibilityReview: undefined,
    riskReview: {
      cedentDecision: "Aprovado" as const,
      debtorDecisions: { "debtor-1": "Aprovado" as const },
      titleDecisions: { "title-1": "Aprovado" as const },
    },
    approvalReview: undefined,
    releaseReview: undefined,
  };
  const context: OperationAuthorityContext = {
    asOf: "2026-10-18",
    portfolio: { version: 3, titles: [] },
    parties: [{ ...emptyParty("cedente"), document: current.document, status: "Ativo" }],
    policies: [
      {
        id: "policy",
        name: "Política persistida",
        version: "1",
        layer: "UNIVERSAL",
        status: "ATIVA",
        effectiveFrom: "2026-01-01",
        bindings: [
          {
            ruleId: "TITLE-AMOUNT-MIN-001",
            enabled: true,
            operator: "GTE",
            parameter: minimum,
            failureOutcome: "REPROVADO",
            action: "BLOQUEAR",
            overrideAllowed: false,
          },
        ],
      },
    ],
  };
  return { current, context };
}

describe("fronteira de avanço no servidor", () => {
  it("não usa alteração de risco para contornar a área responsável pelo avanço", () => {
    const { current } = fixture();
    const lastro = { ...current, stage: 3 };
    expect(
      operationMutationPermissionError(
        lastro,
        { ...lastro, stage: 4, riskReview: { ...lastro.riskReview, cedentDecision: "Reprovado" } },
        ["risk:decide"],
      ),
    ).toContain("área responsável");
  });
  it("obriga operação nova a começar na Entrada mesmo com conclusões forjadas", () => {
    expect(() => assertOperationTransition(null, { ...initialOperations[0], stage: 5 })).toThrow("Entrada");
  });
  it("não aceita pular etapas com conclusões enviadas pelo navegador", () => {
    const current = { ...initialOperations[0], stage: 1 };
    expect(() =>
      assertOperationTransition(current, {
        ...current,
        stage: 4,
        stageCompletions: [1, 2, 3].map(stageId => ({ stageId, completedAt: "2026-10-18", completedBy: "x" })),
      }),
    ).toThrow("etapa intermediária");
  });
  it("não reabre operação por PUT genérico", () => {
    const current = { ...initialOperations[0], stage: 4 };
    expect(() => assertOperationTransition(current, { ...current, stage: 1 })).toThrow("devolução");
  });
  it("não aceita totais e quantidade enviados sem títulos correspondentes", () => {
    expect(() =>
      assertOperationTitleTotals({ ...initialOperations[0], manualEntry: undefined, titleCount: 1, amount: 100 }),
    ).toThrow("Soma e quantidade");
  });
  it("rejeita avanço além do risco sem cadastro autoritativo, mesmo com snapshot aprovado", () => {
    const current = { ...initialOperations[0], stage: 2, amount: 0, titleCount: 0, manualEntry: undefined };
    expect(() =>
      assertAuthoritativeOperation(
        current,
        { ...current, stage: 3 },
        { policies: [], parties: [], portfolio: { version: 3, titles: [] }, asOf: "2026-10-18" },
      ),
    ).toThrow("cadastro persistido");
  });
  it("preserva avanço manual autorizado quando a política persistida é atendida", () => {
    const { current, context } = fixture();
    expect(() => assertAuthoritativeOperation(current, { ...current, stage: 3 }, context)).not.toThrow();
  });
  it("reexecuta política persistida e rejeita títulos abaixo do mínimo sem confiar no snapshot", () => {
    const { current, context } = fixture(2000);
    expect(() => assertAuthoritativeOperation(current, { ...current, stage: 3 }, context)).toThrow(
      "Elegibilidade reexecutada",
    );
  });
  it("rejeita política ausente em vez de recorrer à demonstração", () => {
    const { current, context } = fixture();
    expect(() => assertAuthoritativeOperation(current, { ...current, stage: 3 }, { ...context, policies: [] })).toThrow(
      "política ativa",
    );
  });
  it("recalcula o preço persistido antes de aceitar avanço à aprovação", () => {
    const { current, context } = fixture();
    const pricing = { ...defaultPricing(current), status: "Condição salva" as const };
    const priced = {
      ...current,
      stage: 4,
      pricingReview: pricing,
      netAmount: pricingCalculation(current, pricing).net,
    };
    expect(() => assertAuthoritativeOperation(priced, { ...priced, stage: 5 }, context)).not.toThrow();
    expect(() =>
      assertAuthoritativeOperation(priced, { ...priced, stage: 5, netAmount: priced.netAmount + 100 }, context),
    ).toThrow("valor líquido");
  });
});
