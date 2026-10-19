/** Dados financeiros e comerciais permanecem consultas determinísticas, sem ações operacionais. */
import { describe, expect, it } from "vitest";
import { answerOperationalData } from "@/src/domain/copilot/operational-data";
import type { FinanceState } from "@/src/domain/finance/model";
describe("fontes operacionais complementares", () => {
  it("contas a pagar exclui baixados e cancelados, sem confundir com carteira", () => {
    const finance = {
      titles: [
        {
          id: "a",
          kind: "Pagar",
          status: "Em aberto",
          amount: 100,
          company: "A",
          counterparty: "Fornecedor",
          dueDate: "2026-10-10",
        },
        { id: "b", kind: "Pagar", status: "Baixado", amount: 900, company: "A" },
        { id: "c", kind: "Receber", status: "Em aberto", amount: 50, company: "A", dueDate: "2026-10-20" },
      ],
    } as FinanceState;
    const result = answerOperationalData("contas a pagar", { finance }, "2026-10-18")!;
    expect(result.metrics[0].value).toContain("100,00");
    expect(result.entityRefs).toEqual(["finance:a"]);
    expect(result.table?.rows).toHaveLength(1);
  });
  it("não inventa saldo quando não existe estado financeiro persistido", () => {
    expect(answerOperationalData("resumo financeiro", {}, "2026-10-18")?.paragraphs.join(" ")).toContain("persistido");
  });
  it("não substitui pergunta financeira específica por resumo genérico", () => {
    expect(
      answerOperationalData("contas a pagar do fornecedor Alfa", {}, "2026-10-18")?.paragraphs.join(" "),
    ).toContain("Especifique");
  });
});
