import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  automationFor,
  isStageReadOnly,
  stageAdvanceBlocker,
} from "@/src/features/operations/workspace/workspace-model";

describe("guardrails da esteira operacional", () => {
  const base = initialOperations[0];

  it("mantém etapas concluídas e operações encerradas somente para consulta", () => {
    expect(isStageReadOnly({ ...base, stage: 4 }, 3)).toBe(true);
    expect(isStageReadOnly({ ...base, stage: 4 }, 4)).toBe(false);
    expect(isStageReadOnly({ ...base, stage: 6, status: "Liberada ao financeiro" }, 6)).toBe(true);
    expect(isStageReadOnly({ ...base, status: "Cancelada" }, 1)).toBe(true);
  });

  it("não permite avançar uma importação vazia", () => {
    const imported = {
      ...base,
      id: "importacao-vazia",
      stage: 1,
      source: "XML NF-e" as const,
      titleCount: 0,
      manualEntry: undefined,
    };

    expect(stageAdvanceBlocker(imported, automationFor(imported))?.feedback.message).toContain("ao menos um título");
  });
});
