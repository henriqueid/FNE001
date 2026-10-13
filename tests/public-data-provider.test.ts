import {
  fetchBrasilApiBanks,
  fetchBrasilApiCep,
  fetchBrasilApiHolidays,
  fetchBrasilApiPixParticipants,
} from "@/src/server/integrations/cnpj-provider";
import { describe, expect, it, vi } from "vitest";

const response = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("fontes públicas sem credenciais", () => {
  it("normaliza endereço e geolocalização por CEP", async () => {
    const fetcher = vi.fn(() =>
      response({
        cep: "01310930",
        state: "SP",
        city: "São Paulo",
        neighborhood: "Bela Vista",
        street: "Avenida Paulista",
        service: "open-cep",
        ibge: { city: "3550308", state: "35" },
        location: { coordinates: { latitude: "-23.56", longitude: "-46.65" } },
      }),
    ) as unknown as typeof fetch;

    await expect(fetchBrasilApiCep("01310-930", fetcher)).resolves.toMatchObject({
      provider: "BRASIL_API",
      zipCode: "01310-930",
      city: "São Paulo",
      state: "SP",
      ibgeCity: "3550308",
      location: { latitude: -23.56, longitude: -46.65 },
    });
  });

  it("normaliza o catálogo público de bancos", async () => {
    const fetcher = vi.fn(() =>
      response([
        { ispb: "60701190", name: "ITAÚ UNIBANCO S.A.", code: 341, fullName: "Itaú Unibanco S.A." },
      ]),
    ) as unknown as typeof fetch;

    await expect(fetchBrasilApiBanks(fetcher)).resolves.toEqual([
      expect.objectContaining({ provider: "BRASIL_API_BCB", code: 341, ispb: "60701190" }),
    ]);
  });

  it("normaliza feriados e participantes Pix sem afirmar validação de chave", async () => {
    const holidayFetcher = vi.fn(() =>
      response([{ date: "2026-01-01", name: "Confraternização universal", type: "national" }]),
    ) as unknown as typeof fetch;
    const pixFetcher = vi.fn(() =>
      response([
        {
          ispb: "00000000",
          nome: "BANCO DO BRASIL S.A.",
          nome_reduzido: "BANCO DO BRASIL",
          modalidade_participacao: "Provedor de Conta Transacional",
          tipo_participacao: "Direta",
        },
      ]),
    ) as unknown as typeof fetch;

    await expect(fetchBrasilApiHolidays(2026, "SP", holidayFetcher)).resolves.toEqual([
      expect.objectContaining({ date: "2026-01-01", type: "national" }),
    ]);
    await expect(fetchBrasilApiPixParticipants(pixFetcher)).resolves.toEqual([
      expect.objectContaining({ provider: "BRASIL_API_BCB", ispb: "00000000", participationType: "Direta" }),
    ]);
  });
});
