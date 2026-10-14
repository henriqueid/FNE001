import { describe, expect, it } from "vitest";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { destinations } from "@/src/domain/core/demo/companies";
import { firstScenario, type DeskContext } from "@/src/domain/copilot/desk-engine";
import {
  approveCopilotOperation,
  buildCopilotOperation,
  type CopilotOperationRequest,
} from "@/src/domain/copilot/operation-handoff";

const context: DeskContext = {
  titles: [
    {
      id: "title-1",
      document: "NF-100",
      debtor: initialDebtors[0].name,
      amountCents: 100_000,
      days: 45,
      source: "XML",
    },
  ],
  policy: {
    name: "Política teste",
    version: "1",
    concentrationLimit: 100,
    rateFloor: 1,
    minDays: 15,
    operationFeeCents: 1_000,
    perTitleFeeCents: 100,
    defaultRate: 2,
  },
  bureauChecked: true,
  cedent: {
    name: initialCedents[0].name,
    score: 800,
    creditLimitCents: 10_000_000,
    usedLimitCents: 0,
  },
};

function generatedOperation() {
  const scenario = firstScenario(context);
  const request: CopilotOperationRequest = {
    runId: "run-test",
    cedentId: initialCedents[0].id,
    scenario,
    context,
    files: [{ name: "lote.xml", format: "XML", detail: "XML de teste" }],
  };
  return buildCopilotOperation({
    request,
    destination: destinations[0],
    cedent: initialCedents[0],
    operations: [],
    commercial: seedCommercial(),
    debtors: initialDebtors,
    actor: { name: "Analista" },
    today: "2026-10-14",
    at: "2026-10-14T12:00:00.000Z",
  });
}

describe("handoff da análise do Copiloto para a esteira", () => {
  it("gera uma operação real na etapa de risco com a Entrada carimbada", () => {
    const operation = generatedOperation();

    expect(operation.stage).toBe(2);
    expect(operation.copilotOrigin).toMatchObject({ runId: "run-test", scenarioVersion: 1 });
    expect(operation.stageCompletions?.[0]).toMatchObject({
      stageId: 1,
      completedBy: "Copiloto STRATO",
      source: "COPILOT",
    });
    expect(operation.eligibilityReview?.run.inputFingerprint).toContain("run-test:1");
    expect(operation.pricingReview?.status).toBe("Condição salva");
  });

  it("aprova o risco dentro da política e para no primeiro controle obrigatório", () => {
    const operation = generatedOperation();
    const approved = approveCopilotOperation(operation, {
      actor: "Analista",
      at: "2026-10-14T12:05:00.000Z",
      debtors: initialDebtors,
    });

    expect(approved.stage).toBe(3);
    expect(approved.stageCompletions).toContainEqual(
      expect.objectContaining({ stageId: 2, completedBy: "Motor de elegibilidade", source: "ENGINE" }),
    );
    expect(approved.nextAction).toContain("Evidências");
  });
});
