/** Pergunta singular recebe resultado pontual, sem substituir ausência de dados por zero. */
import { describe, expect, it } from "vitest";
import { answerSystemQuestion, type SystemKnowledge } from "@/src/domain/copilot/system-query";
import { analyzePortfolioQuestion } from "@/src/domain/copilot/analytics";
import { registryFacts } from "@/src/domain/copilot/registry-facts";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";

const cedent = initialCedents[0];
const metrics = cedent.portfolioMetrics!;
const kb: SystemKnowledge = {
  operations: [],
  titles: [],
  policies: [],
  rules: [],
  today: "2026-10-25",
  parameters: operationalParametersFor(),
  cedents: [
    {
      ...cedent,
      name: "Cliente Alfa",
      score: 700,
      portfolioMetrics: {
        ...metrics,
        settledOnTime: { count: 2, amount: 900 },
        settledLate: { count: 1, amount: 100 },
      },
    },
    {
      ...cedent,
      id: "b",
      name: "Cliente Beta",
      score: 300,
      portfolioMetrics: {
        ...metrics,
        settledOnTime: { count: 9, amount: 800 },
        settledLate: { count: 1, amount: 200 },
      },
    },
    { ...cedent, id: "c", name: "Cliente Novo", score: 0, portfolioMetrics: undefined },
  ],
};

describe("respostas pontuais", () => {
  it("responde qual cliente tem menor score sem relatório geral", () => {
    const reply = answerSystemQuestion("Qual cliente tem o menor score?", kb);
    expect(reply.table).toBeUndefined();
    expect(reply.paragraphs[0]).toContain("Cliente Beta");
    expect(reply.paragraphs[0]).toContain("300");
    expect(reply.paragraphs[0]).not.toContain("Cliente Alfa");
    expect(reply.paragraphs.join(" ")).toContain("25/10/2026");
  });
  it("melhor liquidez usa valores pagos, não contagem ou saldo em aberto", () => {
    const reply = answerSystemQuestion("Qual cedente tem o melhor índice de liquidez?", kb);
    expect(reply.table).toBeUndefined();
    expect(reply.paragraphs[0]).toContain("Cliente Alfa");
    expect(reply.paragraphs[0]).toContain("90,0%");
    expect(reply.paragraphs.join(" ")).toContain("900,00");
    expect(reply.paragraphs.join(" ")).toContain("1.000,00");
  });
  it("não transforma liquidez em ranking por saldo na rota do servidor", () => {
    expect(analyzePortfolioQuestion("qual cedente tem o maior índice de liquidez?", [], kb.today)).toBeNull();
  });
  it("explicita empates sem escolher cliente arbitrariamente", () => {
    const reply = answerSystemQuestion("Quem tem o menor score?", {
      ...kb,
      cedents: kb.cedents.slice(0, 2).map(c => ({ ...c, score: 300 })),
    });
    expect(reply.paragraphs[0]).toContain("empate");
    expect(reply.paragraphs[0]).toContain("Cliente Alfa");
    expect(reply.paragraphs[0]).toContain("Cliente Beta");
    expect(reply.table).toBeUndefined();
  });
  it("não declara melhor liquidez quando não há histórico", () => {
    const reply = answerSystemQuestion("qual o cedente com a melhor liquidez?", {
      ...kb,
      cedents: kb.cedents.map(c => ({ ...c, portfolioMetrics: undefined })),
    });
    expect(reply.paragraphs.join(" ")).toContain("Não consigo identificar");
    expect(reply.paragraphs.join(" ")).not.toContain("0,0%");
  });
  it("fonte cadastral real sem métricas não inventa vencedor", () => {
    for (const question of ["qual cliente tem menor score?", "qual cedente tem melhor liquidez?"]) {
      const reply = registryFacts(answerSystemQuestion(question, kb), kb, { portfolio: true, operations: true });
      expect(reply.paragraphs.join(" ")).toContain("não fornece");
      expect(reply.paragraphs[0]).not.toContain("Cliente Beta");
      expect(reply.paragraphs[0]).not.toContain("Cliente Alfa");
    }
  });
  it("mantém lista de score quando ranking foi solicitado", () => {
    expect(answerSystemQuestion("Liste os clientes por score", kb).table?.rows.length).toBe(2);
  });
});

it("não aplica histórico agregado a um período solicitado", () => {
  const reply = answerSystemQuestion("Qual cedente teve a melhor liquidez no mês passado?", kb);
  expect(reply.table).toBeUndefined();
  expect(reply.paragraphs[0]).toContain("nesse período");
  expect(reply.paragraphs[0]).not.toContain("Cliente Alfa");
});

it("score ausente não vira menor score zero", () => {
  const reply = answerSystemQuestion("Qual cliente tem menor score?", { ...kb, cedents: [{ ...cedent, score: 0 }] });
  expect(reply.paragraphs[0]).toContain("Não consigo identificar");
  expect(reply.paragraphs[0]).not.toContain("0 de 1000");
});

it("universo plural não transforma pergunta singular em lista", () => {
  const reply = answerSystemQuestion("Qual dos clientes tem o menor score?", kb);
  expect(reply.table).toBeUndefined();
  expect(reply.paragraphs[0]).toContain("Cliente Beta");
});

it.each(["em 2025", "no primeiro trimestre", "desde janeiro"])("não ignora recorte histórico %s", period => {
  const reply = answerSystemQuestion(`Qual cedente teve melhor liquidez ${period}?`, kb);
  expect(reply.paragraphs[0]).toContain("nesse período");
  expect(reply.paragraphs[0]).not.toContain("Cliente Alfa");
});

it("não usa nome com superlativo como instrução de comparação", () => {
  const named = { ...kb.cedents[0], name: "Melhor Transportes" };
  const reply = answerSystemQuestion("Qual o score da Melhor Transportes?", { ...kb, cedents: [named] });
  expect(reply.tool).not.toContain("extremo=");
});
