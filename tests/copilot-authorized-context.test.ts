import { authorizeCopilotContext } from "@/src/server/intelligence/authorized-context";
import { describe, expect, it } from "vitest";

describe("contexto autorizado do Copiloto", () => {
  const input = {
    referenceDate: "2026-10-13",
    operations: [
      {
        id: "op-a",
        cedent: "Cedente A",
        document: "11.111.111/0001-11",
        amount: 100,
        status: "Em análise",
        stage: 2,
        vehicle: "Empresa A",
        institution: "FIDC",
        blockers: 0,
        hidden: "não deve chegar ao modelo",
      },
      {
        id: "op-b",
        cedent: "Cedente B",
        document: "22.222.222/0001-22",
        amount: 900,
        vehicle: "Empresa B",
      },
    ],
    portfolio: [
      {
        debtor: "Sacado A",
        cedentDocument: "11.111.111/0001-11",
        amount: 80,
        dueDate: "2026-11-01",
        source: "Operação",
        vehicle: "Empresa A",
      },
      {
        debtor: "Sacado B",
        cedentDocument: "22.222.222/0001-22",
        amount: 800,
        dueDate: "2026-11-01",
        source: "Operação",
        vehicle: "Empresa B",
      },
    ],
    cedents: [
      { id: "a", name: "Cedente A", document: "11.111.111/0001-11", score: 800 },
      { id: "b", name: "Cedente B", document: "22.222.222/0001-22", score: 300 },
    ],
    policies: [
      { id: "pa", name: "Política A", company: "Empresa A", status: "ATIVA", version: "1", bindings: [] },
      { id: "pb", name: "Política B", company: "Empresa B", status: "ATIVA", version: "1", bindings: [] },
    ],
  };

  it("mantém somente empresas e cadastros alcançáveis pelo escopo da sessão", () => {
    const result = authorizeCopilotContext(input, ["Empresa A"]);

    expect(result.operations.map(item => item.id)).toEqual(["op-a"]);
    expect(result.portfolio.map(item => item.debtor)).toEqual(["Sacado A"]);
    expect(result.cedents.map(item => item.id)).toEqual(["a"]);
    expect(result.policies.map(item => item.id)).toEqual(["pa"]);
  });

  it("remove campos não previstos antes de enviar o contexto ao provedor", () => {
    const result = authorizeCopilotContext(input, ["*"]);

    expect(result.operations[0]).not.toHaveProperty("hidden");
    expect(result.operations[0]).toEqual(expect.objectContaining({ id: "op-a", vehicle: "Empresa A", amount: 100 }));
  });

  it("recusa contexto acima do limite operacional", () => {
    expect(() =>
      authorizeCopilotContext({ operations: [{ vehicle: "Empresa A", data: "x".repeat(61_000) }] }, ["*"]),
    ).toThrow("excede o limite");
  });
});
