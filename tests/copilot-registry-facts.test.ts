/** Impede que zeros de inicialização sejam apresentados como histórico verdadeiro. */
import { expect, it } from "vitest";
import { registryFacts } from "@/src/domain/copilot/registry-facts";
import type { SystemKnowledge } from "@/src/domain/copilot/system-query";
it("separa ausência de histórico de zero liquidações e não calcula disponível fictício", () => {
  const knowledge = {
    cedents: [
      {
        name: "Cedente",
        document: "11111111000111",
        creditLimit: 1000,
        usedLimit: 0,
        settlements: 0,
        averageDelayDays: 0,
      },
    ],
    titles: [],
    operations: [],
    today: "2026-10-18",
  } as unknown as SystemKnowledge;
  const result = registryFacts({ tool: 'consultar_cadastro(cedente="Cedente")', paragraphs: [] }, knowledge, {
    portfolio: false,
    operations: false,
  });
  expect(result.paragraphs.join(" ")).toContain("não estão disponíveis");
  expect(result.paragraphs.join(" ")).not.toContain("0 liquidações");
  expect(result.paragraphs.join(" ")).not.toContain("disponível R$");
});
