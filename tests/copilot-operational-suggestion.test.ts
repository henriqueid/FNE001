import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { operationalSuggestion } from "@/src/domain/copilot/operational-suggestion";
import { describe, expect, it } from "vitest";

const operation = (partial: Partial<Operation>): Operation => ({ ...initialOperations[0], ...partial });

describe("recomendação operacional do Copiloto", () => {
  it("usa plural natural e destaca a maior operação bloqueada", () => {
    const suggestion = operationalSuggestion(
      [
        operation({ id: "menor", cedent: "Empresa Menor", amount: 100_000, blockers: 1 }),
        operation({ id: "maior", cedent: "Empresa Prioritária", amount: 4_690_000, blockers: 2 }),
      ],
      [],
    );

    expect(suggestion.title).toBe("2 operações aguardam decisão");
    expect(suggestion.body).toContain("Empresa Prioritária");
    expect(suggestion.body.replace(/\s/g, " ")).toContain("R$ 4,69 mi");
    expect(suggestion.body).toContain("Há 2 impedimentos para revisar");
    expect(suggestion.action).toBe("Abrir fila de decisões");
  });

  it("usa singular sem marcadores artificiais", () => {
    const suggestion = operationalSuggestion(
      [operation({ id: "unica", cedent: "Empresa Única", amount: 355_000, blockers: 1 })],
      [],
    );

    expect(suggestion.title).toBe("1 operação aguarda decisão");
    expect(suggestion.body).toContain("Há 1 impedimento para revisar");
    expect(`${suggestion.title} ${suggestion.body}`).not.toContain("(ões)");
  });
});
