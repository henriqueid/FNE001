import { describe, expect, it } from "vitest";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { validateFinanceState } from "@/src/domain/finance/persistence";
import type { FinanceState } from "@/src/domain/finance/model";
describe("valores financeiros recebidos pela API", () => {
  it("devolve erro para estruturas ausentes sem lançar exceção", () => {
    expect(validateFinanceState({ version: 1, seq: 0 } as FinanceState)).toBeTruthy();
  });
  it("rejeita saldo bancário não finito", () => {
    const state = openingEntries(emptyState("2026-10-18"));
    state.accounts[0].openingBalance = Infinity;
    expect(validateFinanceState(state)).toBeTruthy();
  });
  it("rejeita partidas com NaN em vez de considerá-las balanceadas", () => {
    const state = openingEntries(emptyState("2026-10-18"));
    state.journal[0].lines[0].debit = NaN;
    expect(validateFinanceState(state)).toBeTruthy();
  });
});
