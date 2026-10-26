/** Corpos públicos malformados retornam validação em vez de lançar TypeError. */
import { expect, it } from "vitest";
import { validateCompanyProfile } from "@/src/domain/company/profile";
import { validateCompanyDestination } from "@/src/domain/company/destination";

it.each([
  null,
  [],
  1,
  "empresa",
  {},
  { legalName: 12 },
  { legalName: "Razão válida", tradeName: null },
  { legalName: "Razão válida", tradeName: "Nome válido", document: 11222333000181 },
])("recusa perfil e destino malformados %j sem exceção", body => {
  expect(typeof validateCompanyProfile(body as never)).toBe("string");
  expect(typeof validateCompanyDestination(body as never)).toBe("string");
});
it("recusa destino com instituição que não existe", () => {
  expect(
    validateCompanyDestination({
      legalName: "Empresa de teste",
      tradeName: "Teste",
      document: "11.222.333/0001-81",
      institution: "INEXISTENTE",
      detail: "Teste QA",
    } as never),
  ).toBeTruthy();
});
