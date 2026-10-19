/** Impede divergência entre snapshot e projeções de banco/extrato e preserva a trilha de alterações. */
import { describe, expect, it } from "vitest";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { createTitle } from "@/src/domain/finance/titles";
import { importStatement, autoReconcile, undoReconcile } from "@/src/domain/finance/reconciliation";
import { validateFinanceTransition } from "@/src/domain/finance/persistence";

function financialFacts() {
  const state = openingEntries(emptyState("2026-10-18"));
  const bank = state.accounts[0];
  const result = createTitle(
    state,
    {
      kind: "Pagar",
      description: "Despesa teste",
      counterparty: "Fornecedor",
      company: bank.company,
      categoryId: state.categories.find(category => category.kind === "Despesa")!.id,
      amount: 100,
      competenceDate: "2026-10-18",
      dueDate: "2026-10-18",
    },
    "Autor original",
    { accountId: bank.id, date: "2026-10-18", method: "PIX" },
  );
  if (result.error) throw new Error(result.error);
  return importStatement(
    result.state,
    bank.id,
    [{ fitid: "bank-fitid", date: "2026-10-18", amount: -100, memo: "Débito" }],
    "extrato.ofx",
    "Importador",
  ).state;
}

describe("fatos financeiros persistidos", () => {
  it.each(["valor", "data", "conta", "histórico"])("recusa reescrita de %s no movimento bancário", field => {
    const previous = financialFacts();
    const next = structuredClone(previous);
    if (field === "valor") next.movements[0].amount = -900;
    if (field === "data") next.movements[0].date = "2026-10-19";
    if (field === "conta") next.movements[0].accountId = next.accounts[1].id;
    if (field === "histórico") next.movements[0].history[0].by = "Autor forjado";
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it.each(["valor", "identificador", "data", "arquivo"])("recusa reescrita de %s no extrato importado", field => {
    const previous = financialFacts();
    const next = structuredClone(previous);
    if (field === "valor") next.statement[0].amount = -900;
    if (field === "identificador") next.statement[0].fitid = "outro";
    if (field === "data") next.statement[0].date = "2026-10-19";
    if (field === "arquivo") next.statement[0].file = "arquivo-forjado.ofx";
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it("recusa reescrever histórico de títulos", () => {
    const previous = financialFacts();
    const next = structuredClone(previous);
    next.titles[0].history[0].by = "Autor forjado";
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it("recusa alterar saldo ou data de abertura já registrados", () => {
    const previous = financialFacts();
    const next = structuredClone(previous);
    next.accounts[0].openingBalance += 1000;
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
    next.accounts[0].openingBalance = previous.accounts[0].openingBalance;
    next.accounts[0].openingDate = "2026-10-19";
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it("preserva conciliação e desconciliação legítimas em período aberto", () => {
    const previous = financialFacts();
    const reconciled = autoReconcile(previous, previous.accounts[0].id, "Conciliador");
    expect(reconciled.error).toBeUndefined();
    expect(validateFinanceTransition(previous, reconciled.state)).toBeNull();
    const undone = undoReconcile(reconciled.state, reconciled.state.statement[0].matchGroup!, "Conciliador");
    expect(undone.error).toBeUndefined();
    expect(validateFinanceTransition(reconciled.state, undone.state)).toBeNull();
  });
});
