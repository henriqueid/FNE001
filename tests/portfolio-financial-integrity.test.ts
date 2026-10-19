import { describe, expect, it } from "vitest";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { validatePortfolioState, validatePortfolioTransition } from "@/src/domain/portfolio/persistence";
describe("integridade financeira da Carteira", () => {
  it("rejeita valores não finitos e saldo negativo", () => {
    for (const value of [NaN, Infinity, -1]) {
      const state = seedPortfolio(initialOperations);
      state.titles[0].openAmount = value;
      expect(validatePortfolioState(state)).toBeTruthy();
    }
  });
  it("preserva fatos de pagamento mesmo em comandos especializados", () => {
    const before = seedPortfolio(initialOperations);
    before.titles[0].payments = [
      {
        id: "payment-a",
        amount: 100,
        date: "2026-10-18",
        bank: "Banco",
        createdAt: "2026-10-18T12:00:00Z",
        createdBy: "Ator",
      },
    ];
    const next = structuredClone(before);
    next.titles[0].payments[0].amount = 200;
    expect(validatePortfolioTransition(before, next, "Ator", { financialCommand: true })).toBeTruthy();
  });
});
