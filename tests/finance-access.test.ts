import { describe, expect, it } from "vitest";
import { emptyFinance } from "@/src/domain/finance/setup";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { filterFinanceState, mergeFinanceState } from "@/src/server/finance/access";

const principal = (permissions: ServerPrincipal["permissions"] = ["finance:view", "finance:release"]) =>
  ({ companyScopes: ["Empresa A"], permissions }) as Pick<ServerPrincipal, "companyScopes" | "permissions">;

const state = () => {
  const finance = emptyFinance();
  finance.accounts = [
    {
      id: "a",
      company: "Empresa A",
      bankCode: "001",
      bankName: "Banco",
      agency: "1",
      account: "1",
      type: "Conta movimento",
      nickname: "A",
      usage: { payments: true, receipts: true, collection: false },
      openingBalance: 0,
      openingDate: "2026-01-01",
      minimumBalance: 0,
      ledgerCode: "1.1.1.01",
      active: true,
    },
    {
      id: "b",
      company: "Empresa B",
      bankCode: "001",
      bankName: "Banco",
      agency: "1",
      account: "2",
      type: "Conta movimento",
      nickname: "B",
      usage: { payments: true, receipts: true, collection: false },
      openingBalance: 0,
      openingDate: "2026-01-01",
      minimumBalance: 0,
      ledgerCode: "1.1.1.02",
      active: true,
    },
  ];
  finance.movements = [
    {
      id: "ma",
      accountId: "a",
      date: "2026-01-01",
      description: "A",
      amount: 10,
      kind: "Entrada",
      reconciled: false,
      history: [],
    },
    {
      id: "mb",
      accountId: "b",
      date: "2026-01-01",
      description: "B",
      amount: 20,
      kind: "Entrada",
      reconciled: false,
      history: [],
    },
  ];
  finance.registrations = {
    "op-a": { sentAt: "2026-01-01", titles: 1, account: "a" },
    "op-b": { sentAt: "2026-01-01", titles: 1, account: "b" },
  };
  return finance;
};

const companies = new Map([
  ["op-a", "Empresa A"],
  ["op-b", "Empresa B"],
]);

describe("escopo financeiro por empresa", () => {
  it("não expõe contas, movimentos nem registros de outra empresa", () => {
    const visible = filterFinanceState(state(), principal(), companies)!;
    expect(visible.accounts.map(account => account.id)).toEqual(["a"]);
    expect(visible.movements.map(movement => movement.id)).toEqual(["ma"]);
    expect(Object.keys(visible.registrations)).toEqual(["op-a"]);
  });

  it("preserva a fatia oculta ao salvar a empresa autorizada", () => {
    const current = state();
    const requested = filterFinanceState(current, principal(), companies)!;
    requested.accounts[0].nickname = "Conta alterada";
    const merged = mergeFinanceState(current, requested, principal(), companies).state!;
    expect(merged.accounts.find(account => account.id === "a")?.nickname).toBe("Conta alterada");
    expect(merged.accounts.find(account => account.id === "b")?.nickname).toBe("B");
    expect(merged.movements.some(movement => movement.id === "mb")).toBe(true);
    expect(merged.registrations["op-b"]).toBeDefined();
  });

  it("recusa injeção cruzada e alteração da configuração global sem permissão", () => {
    const current = state();
    const requested = filterFinanceState(current, principal(), companies)!;
    requested.accounts.push({ ...current.accounts[1] });
    expect(mergeFinanceState(current, requested, principal(), companies).error).toContain("fora do seu escopo");

    const configChange = filterFinanceState(current, principal(), companies)!;
    configChange.categories = [
      ...configChange.categories,
      { id: "x", name: "X", kind: "Despesa", ledgerCode: "5", group: "X" },
    ];
    expect(mergeFinanceState(current, configChange, principal(), companies).error).toContain("configurações");
  });

  it("recusa remoção de fatos e referências para operações de outra empresa", () => {
    const current = state();
    const removed = filterFinanceState(current, principal(), companies)!;
    removed.movements = [];
    expect(mergeFinanceState(current, removed, principal(), companies).error).toContain("não pode remover");

    const crossed = filterFinanceState(current, principal(), companies)!;
    crossed.titles.push({
      id: "ta",
      kind: "Receber",
      origin: "Manual",
      description: "Título",
      counterparty: "Cliente",
      company: "Empresa A",
      competenceDate: "2026-01-01",
      dueDate: "2026-01-31",
      amount: 10,
      settlementLedger: "1.1.3.01",
      status: "Em aberto",
      operationId: "op-b",
      history: [],
    });
    expect(mergeFinanceState(current, crossed, principal(), companies).error).toContain("referencia");
  });
});
