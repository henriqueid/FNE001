/** A análise de lote não pode capturar perguntas sobre a carteira inteira. */
import { describe, expect, it } from "vitest";
import { isDeskQuestion } from "@/src/domain/copilot/routing";
describe("roteamento de consultas", () => {
  it("mantém concentração e vencidos na base oficial mesmo com cenário aberto", () => {
    expect(isDeskQuestion("qual o meu sacado mais concentrado?")).toBe(false);
    expect(isDeskQuestion("por que meus títulos da carteira estão vencidos?")).toBe(false);
  });
  it("mantém simulações e comandos explícitos na mesa", () => {
    expect(isDeskQuestion("Retire o título duplicado")).toBe(true);
    expect(isDeskQuestion("Como ficaria este cenário com taxa de 2%?")).toBe(true);
  });
});
