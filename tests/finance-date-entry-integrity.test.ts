import { expect, it } from "vitest";
import { seedFinance } from "@/src/domain/finance/setup";
import { createTitle, editTitle, rescheduleTitles } from "@/src/domain/finance/titles";
import { validateFinanceState } from "@/src/domain/finance/persistence";
import { closeFinancePeriod } from "@/src/domain/finance/closing";
const state = seedFinance("2026-10-26");
const input = {
  kind: "Pagar" as const,
  description: "CHURUME entrada",
  counterparty: "CHURUME",
  company: state.accounts[0].company,
  categoryId: state.categories.find(category => category.kind === "Despesa")!.id,
  competenceDate: "2026-10-26",
  dueDate: "2026-10-30",
  amount: 100,
};
it.each(["2026-02-30", "2025-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "", "26/10/2026"])(
  "não cria título com vencimento inválido %s",
  dueDate => {
    const result = createTitle(state, { ...input, dueDate }, "CHURUME");
    expect(result.error).toMatch(/data|vencimento/i);
    expect(result.state).toBe(state);
  },
);
it("recusa competência impossível antes de gerar o diário", () => {
  const result = createTitle(state, { ...input, competenceDate: "2026-02-31" }, "CHURUME");
  expect(result.error).toMatch(/data|competência/i);
  expect(result.state).toBe(state);
});
it("recusa valor infinito na origem do lançamento", () => {
  const result = createTitle(state, { ...input, amount: Infinity }, "CHURUME");
  expect(result.error).toMatch(/valor/i);
  expect(result.state).toBe(state);
});
it("recusa edição e prorrogação para data impossível, sem mudar histórico", () => {
  const created = createTitle(state, input, "CHURUME").state;
  const title = created.titles.at(-1)!;
  const edited = editTitle(created, title.id, { dueDate: "2026-02-30" }, "Motivo CHURUME", "CHURUME");
  expect(edited.error).toMatch(/data|vencimento/i);
  expect(edited.state).toBe(created);
  const moved = rescheduleTitles(created, [title.id], { newDate: "2026-04-31", reason: "Motivo CHURUME" }, "CHURUME");
  expect(moved.error).toMatch(/data|vencimento/i);
  expect(moved.state).toBe(created);
});
it.each(["dueDate", "competenceDate"] as const)("API recusa data inválida no título: %s", field => {
  const created = createTitle(state, input, "CHURUME").state;
  const copy = structuredClone(created);
  copy.titles.at(-1)![field] = "2026-02-30";
  expect(validateFinanceState(copy)).toMatch(/data|vencimento|competência/i);
});
it("API recusa datas inexistentes no diário e no extrato", () => {
  const journal = structuredClone(state);
  journal.journal[0].date = "2026-02-30";
  expect(validateFinanceState(journal)).toMatch(/data/i);
  const statement = structuredClone(state);
  statement.statement = [
    {
      id: "CHURUME",
      accountId: state.accounts[0].id,
      date: "2026-13-01",
      amount: 1,
      memo: "CHURUME",
      status: "Pendente",
      fitid: "CHURUME",
      importedAt: "2026-10-26",
      file: "CHURUME.ofx",
      importedBy: "CHURUME",
    } as NonNullable<typeof statement.statement>[number],
  ];
  expect(validateFinanceState(statement)).toMatch(/data/i);
});
it("fechamento recusa dia inexistente", () => {
  const result = closeFinancePeriod(state, input.company, "2026-02-30", "CHURUME");
  expect(result.error).toMatch(/data/i);
  expect(result.state).toBe(state);
});
it("preserva data válida de ano bissexto", () => {
  const result = createTitle(state, { ...input, competenceDate: "2028-02-29", dueDate: "2028-02-29" }, "CHURUME");
  expect(result.error).toBeUndefined();
  expect(validateFinanceState(result.state)).toBeNull();
});
