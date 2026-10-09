import { describe, expect, it } from "vitest";
import { parseMoneyBR } from "@/src/features/finance/finance-ui";
import { accountBalance } from "@/src/domain/finance/banking";
import { seedFinance } from "@/src/domain/finance/setup";
import { createTitle, reverseSettlement } from "@/src/domain/finance/titles";
import { trialBalance } from "@/src/domain/finance/reports";

const TODAY = "2026-09-30";
const sumJournal = (state: ReturnType<typeof seedFinance>) =>
  state.journal.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.debit - l.credit, 0), 0);

describe("parser monetário pt-BR", () => {
  it.each([
    ["1.500,55", 1500.55],
    ["1500,55", 1500.55],
    ["1500.55", 1500.55],
    ["1.500", 1500],
    ["R$ 2.000,00", 2000],
    ["-1.000,00", -1000],
    ["", 0],
    ["abc", 0],
  ])("%s → %d", (input, expected) => expect(parseMoneyBR(input)).toBeCloseTo(expected, 6));
});

describe("motor financeiro", () => {
  const state = seedFinance(TODAY);
  const account = state.accounts[0];

  it("o seed fecha em partidas dobradas", () => {
    expect(Math.abs(sumJournal(state))).toBeLessThan(0.01);
  });
  it("lançar e baixar um título a pagar reduz o saldo da conta e mantém o balancete fechado", () => {
    const before = accountBalance(state, account.id);
    const category = state.categories.find(c => c.kind === "Despesa")!;
    const result = createTitle(
      state,
      {
        kind: "Pagar",
        description: "Teste",
        counterparty: "Fornecedor",
        categoryId: category.id,
        company: account.company,
        competenceDate: TODAY,
        dueDate: TODAY,
        amount: 1000,
      },
      "Teste",
      { accountId: account.id, date: TODAY, method: "Pix" },
    );
    expect(result.error).toBeUndefined();
    expect(accountBalance(result.state, account.id)).toBeCloseTo(before - 1000, 2);
    expect(Math.abs(sumJournal(result.state))).toBeLessThan(0.01);
    const tb = trialBalance(result.state, "Consolidado", "2000-01-01", TODAY);
    expect(Array.isArray(tb)).toBe(true);
  });
  it("título baixado não pode ser excluído, só estornado", () => {
    const category = state.categories.find(c => c.kind === "Despesa")!;
    const created = createTitle(
      state,
      {
        kind: "Pagar",
        description: "Estorno",
        counterparty: "F",
        categoryId: category.id,
        company: account.company,
        competenceDate: TODAY,
        dueDate: TODAY,
        amount: 500,
      },
      "Teste",
      { accountId: account.id, date: TODAY, method: "Pix" },
    );
    const title = created.state.titles.find(t => t.description === "Estorno")!;
    expect(title.status).toBe("Baixado");
    // estornar com "dinheiro não saiu": o movimento volta e o saldo é restaurado
    const reversed = reverseSettlement(created.state, title.id, { reason: "teste", cashMoved: false }, "Teste");
    expect(reversed.error).toBeUndefined();
    expect(accountBalance(reversed.state, account.id)).toBeCloseTo(accountBalance(state, account.id), 2);
  });
});
