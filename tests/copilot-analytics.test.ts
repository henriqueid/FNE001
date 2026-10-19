/** Regressões para rankings reais, identidade e critérios da carteira. */
import { describe, expect, it } from "vitest";
import { analyzePortfolioQuestion } from "@/src/domain/copilot/analytics";
import type { PortfolioTitle } from "@/src/domain/home/metrics";

const title = (
  id: string,
  debtor: string,
  document: string,
  amount: number,
  owner = "Cedente A",
  due = "2026-10-10",
): PortfolioTitle => ({
  id,
  debtorName: debtor,
  debtorDocument: document,
  ownerName: owner,
  ownerDocument: owner === "Cedente A" ? "11111111000111" : "22222222000122",
  amount,
  dueDate: due,
  reference: id,
  source: "Carteira",
  vehicle: "Empresa A",
});
const titles = [
  title("1", "Alfa", "12345678000199", 100),
  title("2", "Alfa Ltda", "12.345.678/0001-99", 100),
  title("3", "Alfa", "99999999000199", 900, "Cedente B"),
  title("4", "Beta", "88888888000188", 500, "Cedente B", "2026-10-18"),
];
const ask = (question: string, rows = titles) => analyzePortfolioQuestion(question, rows, "2026-10-18");

describe("consultas determinísticas do Copiloto", () => {
  it("responde o sacado mais concentrado por saldo, separando homônimos", () => {
    const result = ask("qual o meu sacado mais concentrado?")!;
    expect(result.query.metric).toBe("balance");
    expect(result.rows[0]).toMatchObject({ document: "99999999000199", balance: 900, count: 1, share: 56.25 });
    expect(result.rows.find(row => row.document === "12345678000199")?.count).toBe(2);
  });
  it("ordena sacados por quantidade vencida, não por valor", () => {
    const result = ask("lista dos sacados com mais títulos vencidos")!;
    expect(result.query.metric).toBe("count");
    expect(result.rows[0]).toMatchObject({ document: "12345678000199", count: 2, balance: 200 });
    expect(result.titleCount).toBe(3);
  });
  it("distingue cedentes e ordenação por valor", () => {
    expect(ask("cedentes com mais títulos vencidos")?.rows[0].name).toBe("Cedente A");
    expect(ask("cedentes com maior valor vencido")?.rows[0].name).toBe("Cedente B");
  });
  it("calcula sobre todos os registros e mantém hoje fora dos vencidos", () => {
    const many = Array.from({ length: 1501 }, (_, i) => title(String(i), "Grande", "77777777000177", 1));
    expect(ask("resumo da carteira", many)).toMatchObject({ totalBalance: 1501, titleCount: 1501 });
    expect(ask("títulos vencidos")?.totalBalance).toBe(1100);
  });
  it("não mistura registros sem documento e sinaliza a limitação", () => {
    const result = ask("maiores sacados", [title("a", "Sem documento", "", 20), title("b", "Sem documento", "", 30)])!;
    expect(result.rows).toHaveLength(2);
    expect(result.warnings.join(" ")).toContain("documento");
  });
  it("não responde com ranking genérico quando existe filtro não suportado", () => {
    expect(ask("sacados vencidos no mês passado")?.clarification).toBeTruthy();
    expect(ask("qual sacado mais concentrado na Empresa B?")?.clarification).toBeTruthy();
  });
  it("recusa números inválidos, saldo zero e datas inválidas com aviso", () => {
    const result = ask("resumo da carteira", [
      title("a", "A", "1", NaN),
      title("b", "B", "2", 0),
      title("c", "C", "3", 12, "Cedente A", "inválida"),
    ])!;
    expect(result.totalBalance).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("não transforma consulta a uma entidade em ranking global", () => {
    const result = ask("qual a exposição do sacado Beta?")!;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: "Beta", balance: 500, share: 31.25 });
  });
  it("pede documento ao encontrar nome homônimo", () => {
    expect(ask("como está o sacado Alfa?")?.clarification).toContain("documento");
  });
  it("não responde valor conhecido com data impossível", () => {
    expect(
      ask("resumo da carteira", [title("a", "A", "12345678000199", 100, "Cedente A", "2026-99-99")])?.totalBalance,
    ).toBe(0);
  });
  it("não confunde histórico de atrasos com concentração atual", () => {
    expect(ask("quais sacados mais atrasam?")?.clarification).toBeTruthy();
    expect(ask("sacados com histórico de atraso")?.clarification).toBeTruthy();
  });
});
