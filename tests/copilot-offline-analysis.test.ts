import { describe, expect, it } from "vitest";
import { buildOfflineDeskContext } from "@/src/domain/copilot/offline-analysis";
import { firstScenario } from "@/src/domain/copilot/desk-engine";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";

describe("Copiloto offline", () => {
  it("lê XML real, modela o cenário e avalia score e limite sem IA", () => {
    const cedent = { ...initialCedents[0], score: 580, creditLimit: 10_000, usedLimit: 9_000 };
    const debtor = initialDebtors[0];
    const xml = `<NFe Id="NFe12345678901234567890123456789012345678901234"><infNFe><ide><nNF>900</nNF><dhEmi>2026-10-13T09:00:00-03:00</dhEmi></ide><dest><CNPJ>${debtor.document.replace(/\D/g, "")}</CNPJ><xNome>${debtor.name}</xNome></dest><cobr><dup><nDup>900/1</nDup><dVenc>2026-11-13</dVenc><vDup>2500.00</vDup></dup></cobr></infNFe></NFe>`;
    const result = buildOfflineDeskContext({
      files: [{ name: "operacao.xml", format: "XML", detail: "NF-e", content: xml }],
      cedentId: cedent.id,
      debtors: initialDebtors,
      knowledge: {
        operations: initialOperations,
        cedents: [cedent],
        titles: [],
        policies: [],
        rules: masterRuleCatalog,
        parameters: operationalParametersFor(),
        today: "2026-10-13",
      },
    });
    expect(result).toMatchObject({ acceptedRows: 1, issues: [], fileErrors: [] });
    const scenario = firstScenario(result.context!);
    expect(scenario.result).toMatchObject({ count: 1, faceCents: 250_000 });
    expect(scenario.result.findings.map(item => item.id)).toEqual(
      expect.arrayContaining(["cedent-score", "cedent-limit"]),
    );
  });
});
