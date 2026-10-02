import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type ManualEntry } from "@/src/domain/core/types";
import {
  operationalParametersFor,
  riskFromScore,
  scoreBand,
  termDays,
} from "@/src/domain/eligibility/operational-parameters";
import { demoPoliciesFor } from "@/src/domain/eligibility/demo-policy";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { policyParameterFor } from "@/src/domain/eligibility/policy-parameter";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import { CONCENTRATION_RULE_ID, stageInsightFor } from "@/src/domain/operations/stage-insight";
import { defaultPricing } from "@/src/domain/operations/pricing";
import { policyMinimumFor } from "@/src/features/operations/pricing/pricing-model";
import { eligibleApproval, groupEntriesByDebtor, groupKey } from "@/src/features/operations/risk/risk-model";

const TODAY = "2026-10-01";
const withEntries = initialOperations.filter(op => (op.manualEntry?.entries.length ?? 0) > 0);

/** Implementação da v7 com os números fixos, mantida só como referência de paridade. */
function legacyEligibleApproval(entries: ManualEntry[], cedentScore: number | undefined) {
  const digits = (v: string) => v.replace(/\D/g, "");
  const debtorScore = (key: string) =>
    initialDebtors.find(item => item.id === key || digits(item.document) === digits(key))?.score ?? 0;
  const decisions: Record<string, string> = {};
  groupEntriesByDebtor(entries).forEach(item => {
    const key = groupKey(item);
    if (!decisions[key] && debtorScore(key) >= 600) decisions[key] = "Aprovado";
  });
  const titles: Record<string, string> = {};
  entries.forEach(item => {
    const key = item.debtorId || item.debtorDocument;
    const term = termDays(item.dueDate, TODAY);
    if (decisions[key] === "Aprovado" && term !== null && term >= 15) titles[item.id] = "Aprovado";
  });
  return {
    cedentDecision: (cedentScore ?? 0) >= 600 ? "Aprovado" : undefined,
    debtorDecisions: decisions,
    titleDecisions: titles,
  };
}

describe("parâmetros operacionais (números que saíram das telas)", () => {
  it("faixas de score e risco derivado", () => {
    expect([scoreBand(undefined), scoreBand(599), scoreBand(600), scoreBand(700)]).toEqual([
      "Novo",
      "Crítico",
      "Atenção",
      "Positivo",
    ]);
    expect([riskFromScore(550), riskFromScore(650), riskFromScore(750)]).toEqual(["Alto", "Médio", "Baixo"]);
  });
  it("prazo em dias de calendário", () => {
    expect(termDays("2026-10-16", TODAY)).toBe(15);
    expect(termDays("2026-09-30", TODAY)).toBe(-1);
    expect(termDays(undefined, TODAY)).toBeNull();
  });
  it("'Aprovar elegíveis' decide igual à v7 nas operações de demonstração", () => {
    for (const op of withEntries) {
      const entries = op.manualEntry!.entries;
      const result = eligibleApproval({
        review: undefined,
        grouped: groupEntriesByDebtor(entries),
        entries,
        debtors: initialDebtors,
        cedentScore: 650,
        parameters: operationalParametersFor(op.institution),
        today: TODAY,
      });
      expect(result, op.id).toEqual(legacyEligibleApproval(entries, 650));
    }
  });
  it("amostra de lastro mantém 25% / 50% / 100% por risco", () => {
    for (const op of withEntries) {
      for (const risk of ["Baixo", "Médio", "Alto"] as const) {
        const n = op.manualEntry!.entries.length;
        const ratio = { Baixo: 0.25, Médio: 0.5, Alto: 1 }[risk];
        expect(lastroAssessmentFor({ ...op, risk }).sampleSize).toBe(Math.max(1, Math.ceil(n * ratio)));
      }
    }
  });
  it("piso de taxa e condição comercial padrão por modalidade", () => {
    const op = initialOperations[0];
    expect(["Baixo", "Médio", "Alto"].map(risk => policyMinimumFor({ ...op, risk: risk as typeof op.risk }))).toEqual([
      1.4, 1.8, 2.4,
    ]);
    expect(defaultPricing({ ...op, institution: "Factoring", risk: "Alto" })).toMatchObject({
      monthlyRate: 2.8,
      fundingCostMonthly: 1.45,
      operationFee: 150,
      adValoremPercent: 0.5,
      guaranteePercent: 5,
      regress: "Com regresso",
      regressDays: 5,
      coobligation: true,
    });
    expect(defaultPricing({ ...op, institution: "FIDC", risk: "Baixo" })).toMatchObject({
      monthlyRate: 2.1,
      fundingCostMonthly: 1.2,
      operationFee: 0,
      guaranteePercent: 0,
      regress: "Sem regresso",
      coobligation: false,
    });
  });
});

describe("concentração da etapa de Risco lida do motor", () => {
  const op = withEntries[0];
  const automation = { score: 100, items: [] };
  it("usa o limite da política vigente do motor (não mais 20% fixo)", () => {
    const reading = policyParameterFor(op, CONCENTRATION_RULE_ID);
    expect(reading?.source).toBe("vigente");
    expect(reading?.parameter).toBe(35);
    const insight = stageInsightFor({ ...op, eligibilityReview: undefined }, 2, automation);
    expect(insight.result).toContain("35%");
  });
  it("respeita a política editada em Políticas", () => {
    const policies = demoPoliciesFor(op).map(policy => ({
      ...policy,
      bindings: policy.bindings.map(binding =>
        binding.ruleId === CONCENTRATION_RULE_ID ? { ...binding, parameter: 5 } : binding,
      ),
    }));
    const insight = stageInsightFor({ ...op, eligibilityReview: undefined }, 2, automation, policies);
    expect(insight.tone).toBe("warning");
    expect(insight.result).toContain("5%");
  });
  it("operação já analisada mostra o valor congelado no snapshot", () => {
    const run = evaluateOperationEligibility({ operation: op, debtors: initialDebtors });
    const frozen = {
      ...run,
      evaluations: run.evaluations.map(item =>
        item.ruleId === CONCENTRATION_RULE_ID ? { ...item, parameter: 12 } : item,
      ),
    };
    const reading = policyParameterFor(
      { ...op, eligibilityReview: { run: frozen, overrides: [] } },
      CONCENTRATION_RULE_ID,
    );
    expect(reading).toMatchObject({ source: "snapshot", parameter: 12 });
  });
});
