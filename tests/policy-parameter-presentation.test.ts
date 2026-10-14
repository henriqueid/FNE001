import { describe, expect, it } from "vitest";
import { parsePolicyParameter, policyParameterPresentation } from "@/src/domain/eligibility/policy-parameter-presentation";
import type { MasterRule } from "@/src/domain/eligibility/model";

const rule = (variable: string, defaultOperator: MasterRule["defaultOperator"] = "LTE"): MasterRule => ({
  id: "TEST",
  name: "Regra de teste",
  description: "Teste",
  category: "TESTE",
  modalities: ["TODAS"],
  level: "OPERACAO",
  variable,
  dataSource: "teste",
  defaultOperator,
  technicalMessage: "Teste",
  friendlyMessage: "Teste",
});

describe("apresentação de parâmetros de política", () => {
  it("explica moeda, percentual, dias e lista", () => {
    expect(policyParameterPresentation(rule("faceAmount"), null).kind).toBe("currency");
    expect(policyParameterPresentation(rule("concentrationPercent"), null).kind).toBe("percentage");
    expect(policyParameterPresentation(rule("termDays"), null).kind).toBe("days");
    expect(policyParameterPresentation(rule("debtorState", "IN"), null).kind).toBe("list");
  });

  it("converte lista e moeda para o tipo esperado pelo motor", () => {
    expect(parsePolicyParameter("list", "SP, RJ, MG")).toEqual(["SP", "RJ", "MG"]);
    expect(parsePolicyParameter("currency", "100.000,50")).toBe(100000.5);
  });
});
