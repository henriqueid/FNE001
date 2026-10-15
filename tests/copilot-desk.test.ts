import { describe, expect, it } from "vitest";
import { answerDesk } from "@/src/domain/copilot/desk-assistant";
import { deskDemoPolicy, deskDemoTitles, deskFileFormat } from "@/src/domain/copilot/desk-demo";
import {
  bestConcentrationFix,
  deskCalculation,
  type DeskContext,
  firstScenario,
} from "@/src/domain/copilot/desk-engine";

const context: DeskContext = { titles: deskDemoTitles, policy: deskDemoPolicy, bureauChecked: true };
const all = deskDemoTitles.map(title => title.id);

describe("Mesa Inteligente · motor", () => {
  it("soma face e fecha o líquido sem resíduo", () => {
    const result = deskCalculation(context, all, 2.9);
    expect(result.faceCents).toBe(9783000);
    expect(result.netCents).toBe(result.faceCents - result.discountCents - result.feesCents - result.iofCents);
    expect(Number.isInteger(result.discountCents) && Number.isInteger(result.iofCents)).toBe(true);
  });

  it("bloqueia aprovação rápida com duplicidade e concentração", () => {
    const result = deskCalculation(context, all, 2.9);
    expect(result.blockers.map(item => item.id)).toEqual(["dup-t4"]);
    expect(result.exceptions.map(item => item.id)).toEqual(["concentration"]);
    expect(result.fastTrack).toBe(false);
  });

  it("sacado novo sem consulta ao birô vira impedimento", () => {
    const result = deskCalculation({ ...context, bureauChecked: false }, all, 2.9);
    expect(result.blockers.some(item => item.id === "bureau")).toBe(true);
  });

  it("taxa abaixo do piso exige alçada", () => {
    const result = deskCalculation(context, all, 2.2);
    expect(result.exceptions.some(item => item.id === "rate-floor")).toBe(true);
  });

  it("recomenda a menor retirada que enquadra a concentração", () => {
    const base = firstScenario(context);
    const withoutDuplicate = { ...base, included: all.filter(id => id !== "t4") };
    const fix = bestConcentrationFix(context, withoutDuplicate);
    expect(fix?.title.document).toBe("NF 1187-2");
    expect(fix?.result.fastTrack).toBe(true);
  });

  it("reconhece o formato pela extensão", () => {
    expect(deskFileFormat("lote.XML").format).toBe("XML");
    expect(deskFileFormat("remessa.rem").format).toBe("CNAB");
    expect(deskFileFormat("extrato.xlsx").format).toBe("XLS");
    expect(deskFileFormat("foto.png").format).toBe("OUTRO");
  });
});

describe("Mesa Inteligente · analista", () => {
  it("simular cria versão nova sem mexer na anterior", () => {
    const scenarios = [firstScenario(context)];
    const { scenario } = answerDesk("Simule taxa de 2,6%", context, scenarios);
    expect(scenario?.version).toBe(2);
    expect(scenario?.ratePercent).toBe(2.6);
    expect(scenarios[0].ratePercent).toBe(2.9);
  });

  it("fluxo de enquadramento libera a via rápida", () => {
    let scenarios = [firstScenario(context)];
    const step1 = answerDesk("Retire o título duplicado", context, scenarios);
    scenarios = [...scenarios, step1.scenario!];
    const step2 = answerDesk("retire o 1187-2", context, scenarios);
    expect(step2.scenario?.result.fastTrack).toBe(true);
  });

  it("explicação traz regra, fato e versão da política", () => {
    const { reply, scenario } = answerDesk("Por que a Rede Mercantil Nacional foi sinalizada?", context, [
      firstScenario(context),
    ]);
    expect(scenario).toBeUndefined();
    expect(reply.tool).toContain("CONC-SACADO-001");
    expect(reply.paragraphs.join(" ")).toContain("v3.2");
  });

  it("responde aos botões de score e limite com o apontamento correspondente", () => {
    const constrained: DeskContext = {
      ...context,
      cedent: { name: "3C Transportes", score: 0, creditLimitCents: 0, usedLimitCents: 0 },
    };
    const scenario = firstScenario(constrained);

    expect(
      answerDesk(scenario.result.findings.find(item => item.id === "cedent-score")!.question!, constrained, [scenario])
        .reply.tool,
    ).toBe("explicar_apontamento(cedent-score)");
    expect(
      answerDesk(scenario.result.findings.find(item => item.id === "cedent-limit")!.question!, constrained, [scenario])
        .reply.tool,
    ).toBe("explicar_apontamento(cedent-limit)");
  });

  it("não interrompe a resposta quando o documento importado não contém espaço", () => {
    const imported: DeskContext = {
      ...context,
      titles: [{ ...deskDemoTitles[0], id: "importado", document: "123456" }],
      cedent: { name: "Cedente Importado", score: 0, creditLimitCents: 0, usedLimitCents: 0 },
    };
    const scenario = firstScenario(imported);
    const answer = answerDesk("Como está o score do cedente?", imported, [scenario]);

    expect(answer.reply.tool).toBe("explicar_apontamento(cedent-score)");
    expect(answer.reply.paragraphs.join(" ")).toContain("Cedente Importado");
  });
});
