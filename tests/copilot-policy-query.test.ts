/** Não apresenta padrões de demonstração como parâmetros contratados do cliente. */
import { describe, expect, it } from "vitest";
import { answerAuthorizedPolicy } from "@/src/domain/copilot/policy-query";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
describe("políticas oficiais no Copiloto", () => {
  it("declara ausência de política em vez de inventar piso por risco", () => {
    const result = answerAuthorizedPolicy("qual o piso de taxa?", [], masterRuleCatalog, "2026-10-18");
    expect(result.paragraphs.join(" ")).toContain("Não há");
    expect(result.paragraphs.join(" ")).not.toContain("baixo");
  });
  it("mostra origem e versão de regras ativas sem inferir aprovação", () => {
    const result = answerAuthorizedPolicy(
      "regra de concentração de sacado",
      seedEligibilityPolicies().policies,
      masterRuleCatalog,
      "2026-10-18",
    );
    expect(result.table?.rows.length).toBeGreaterThan(0);
    expect(result.table?.head).toContain("Política / versão");
  });
});
