import { describe, expect, it } from "vitest";
import { emptyFinance } from "@/src/domain/finance/setup";
import { validateFinanceState } from "@/src/domain/finance/persistence";

describe("persistência financeira", () => {
  it("aceita o estado financeiro vazio e consistente", () => {
    expect(validateFinanceState(emptyFinance())).toBeNull();
  });

  it("recusa lançamentos desbalanceados antes de acessar o banco", () => {
    const state = emptyFinance();
    state.journal.push({
      id: "LC-TESTE",
      date: "2026-10-12",
      company: "STRATO",
      history: "Teste",
      lines: [
        { ledger: "1.1.1.01", debit: 100, credit: 0 },
        { ledger: "3.1", debit: 0, credit: 99 },
      ],
      origin: { type: "Abertura", id: "teste" },
      createdAt: "2026-10-12T10:00:00.000Z",
      createdBy: "Teste",
    });
    expect(validateFinanceState(state)).toContain("desbalanceado");
  });

  it("recusa movimento sem conta bancária", () => {
    const state = emptyFinance();
    state.movements.push({
      id: "MB-TESTE",
      accountId: "inexistente",
      date: "2026-10-12",
      description: "Teste",
      amount: 10,
      kind: "Entrada",
      reconciled: false,
      history: [],
    });
    expect(validateFinanceState(state)).toBe("Conta bancária ausente no movimento MB-TESTE.");
  });
});
