import { describe, expect, it } from "vitest";
import { emptyCompanyDestination, validateCompanyDestination } from "@/src/domain/company/destination";

describe("cadastro de empresas e veículos", () => {
  it("exige identificação jurídica e descrição operacional", () => {
    expect(validateCompanyDestination(emptyCompanyDestination())).toBe("Informe a razão social.");
  });

  it("aceita um escopo empresarial completo", () => {
    expect(
      validateCompanyDestination({
        legalName: "Lastro Prime Fundo de Investimento em Direitos Creditórios",
        tradeName: "Lastro Prime FIDC",
        document: "41.228.905/0001-09",
        institution: "FIDC",
        detail: "Classe Sênior · Subclasse A",
      }),
    ).toBeUndefined();
  });
});
