import { describe, expect, it } from "vitest";
import { normalizeBrasilApiCnpj } from "@/src/server/integrations/cnpj-provider";

describe("normalização de evidência CNPJ", () => {
  it("converte a resposta externa para o contrato estável do STRATO", () => {
    const evidence = normalizeBrasilApiCnpj(
      {
        cnpj: "51.137.439/0001-00",
        razao_social: "FINANCIA GROUP FIDC",
        nome_fantasia: "FINANCIA FIDC",
        situacao_cadastral: 2,
        data_inicio_atividade: "10/01/2024",
        capital_social: 100000,
        cep: "01310930",
        logradouro: "Avenida Paulista",
        numero: "1000",
        municipio: "São Paulo",
        uf: "sp",
        cnae_fiscal: 6492100,
        cnae_fiscal_descricao: "Securitização de créditos",
        qsa: [{ nome_socio: "Sócio Teste", qualificacao_socio: "Administrador" }],
      },
      new Date("2026-10-12T12:00:00Z"),
    );
    expect(evidence.registrationNumber).toBe("51137439000100");
    expect(evidence.registrationStatus.label).toBe("Ativa");
    expect(evidence.openedAt).toBe("2024-01-10");
    expect(evidence.address.zipCode).toBe("01310-930");
    expect(evidence.address.state).toBe("SP");
    expect(evidence.partners).toHaveLength(1);
    expect(evidence.expiresAt).toBe("2026-11-11T12:00:00.000Z");
  });
});
