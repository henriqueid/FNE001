import { describe, expect, it } from "vitest";
import { answerSystemQuestion, type SystemKnowledge } from "@/src/domain/copilot/system-query";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { portfolioTitles } from "@/src/domain/home/metrics";

const kb: SystemKnowledge = {
  operations: initialOperations,
  cedents: initialCedents,
  titles: portfolioTitles(initialOperations),
  policies: seedEligibilityPolicies().policies,
  rules: masterRuleCatalog,
  parameters: operationalParametersFor(),
  today: "2026-10-09",
};
const ask = (text: string) => answerSystemQuestion(text, kb);
const all = (text: string) => {
  const reply = ask(text);
  return [reply.tool ?? "", ...reply.paragraphs, ...(reply.table?.rows.flat() ?? [])].join(" ");
};

describe("Copiloto · consulta à base", () => {
  it("encontra o cedente pelo nome e traz limite, score e carteira", () => {
    const text = all("como está a GZ Transportes?");
    expect(text).toContain("GZ Transportes Ltda");
    expect(text).toContain("score 742");
    expect(text).toContain("Limite");
  });

  it("encontra o cedente pelo CNPJ", () => {
    expect(all("52.927.676/0001-29")).toContain("GZ Transportes Ltda");
  });

  it("não apresenta score ou limite ausente como valor zero", () => {
    const newCedent = {
      ...kb.cedents[0],
      id: "cedente-novo",
      document: "11.111.111/0001-11",
      name: "Cedente Novo",
      score: 0,
      creditLimit: 0,
      usedLimit: 0,
    };
    const answer = answerSystemQuestion("como está o Cedente Novo?", { ...kb, cedents: [newCedent] });
    const text = answer.paragraphs.join(" ");

    expect(text).toContain("score interno ainda não calculado");
    expect(text).toContain("Limite de crédito ainda não disponível");
    expect(text).not.toContain("R$ 0,00");
  });

  it("encontra o sacado e mostra a exposição", () => {
    const sacado = kb.titles[0].debtorName;
    const text = all(`qual a exposição do ${sacado}?`);
    expect(text).toContain(sacado);
    expect(text).toContain("da carteira");
  });

  it("lista maiores sacados com participação", () => {
    const reply = ask("maiores sacados da carteira");
    expect(reply.table?.rows.length).toBeGreaterThan(0);
    expect(reply.tool).toContain("agrupar=sacado");
  });

  it("responde regras da política com parâmetro e versão", () => {
    const reply = ask("qual a regra de concentração de sacado?");
    expect(reply.tool).toContain("consultar_politica");
    expect(reply.paragraphs.join(" ")).toContain("Concentração máxima do sacado");
    expect(reply.paragraphs.join(" ")).toMatch(/v1\.0/);
  });

  it("responde piso de taxa pelos parâmetros operacionais", () => {
    expect(all("qual o piso de taxa da política?")).toContain("Piso de taxa por risco");
  });

  it("resume a carteira e não inventa quando não sabe", () => {
    expect(all("resumo da carteira")).toContain("títulos");
    expect(all("quantos títulos tenho?")).toContain(`${kb.titles.length} títulos`);
    expect(ask("qual a cor do céu?").tool).toBeUndefined();
  });

  it("consulta uma carteira persistida mesmo sem operações na mesa", () => {
    const answer = answerSystemQuestion("qual é o total da carteira?", { ...kb, operations: [] });

    expect(answer.tool).toBe("consultar_carteira(resumo)");
    expect(answer.paragraphs.join(" ")).toContain(`${kb.titles.length} títulos`);
    expect(answer.paragraphs.join(" ")).not.toContain("R$ 0,00");
  });
});
