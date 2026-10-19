/** A única saída de dados permitida consulta séries fixas, sem enviar conteúdo do cliente. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readMarketIndicator } from "@/src/server/copilot/market";
afterEach(() => vi.unstubAllEnvs());
describe("indicadores financeiros autorizados", () => {
  it("não consulta rede sem ativação explícita", async () => {
    vi.stubEnv("STRATO_MARKET_INDICATORS_ENABLED", "false");
    const fetcher = vi.fn();
    expect((await readMarketIndicator("qual o CDI?", "2026-10-18", fetcher)).available).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("usa apenas URL fixa do BCB e mantém unidade diária do CDI", async () => {
    vi.stubEnv("STRATO_MARKET_INDICATORS_ENABLED", "true");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ data: "15/10/2026", valor: "0.050788" }])));
    const result = await readMarketIndicator("CDI do sacado privado 123", "2026-10-18", fetcher);
    expect(result).toMatchObject({
      available: true,
      name: "CDI",
      unit: "% ao dia",
      date: "2026-10-15",
      value: 0.050788,
    });
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("sacado");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("recusa ponto futuro, conteúdo inválido e múltiplos indicadores ambíguos", async () => {
    vi.stubEnv("STRATO_MARKET_INDICATORS_ENABLED", "true");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ data: "04/11/2026", valor: "13.75" }])));
    expect((await readMarketIndicator("Selic", "2026-10-18", fetcher)).available).toBe(false);
    const unused = vi.fn();
    expect((await readMarketIndicator("CDI e IPCA", "2026-10-18", unused)).available).toBe(false);
    expect(unused).not.toHaveBeenCalled();
  });
});
