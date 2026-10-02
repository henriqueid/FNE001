import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { effectiveRunSummary } from "@/src/domain/eligibility/decision";
import { eligibilityOperationalMetrics } from "@/src/domain/eligibility/metrics";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { compareEligibilityValues } from "@/src/domain/eligibility/operators";
import { eligibilityProfiles } from "@/src/domain/eligibility/profiles";
import { importPolicyCsv, policyImportTemplate } from "@/src/domain/eligibility/policy-import";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { eligibilityRouteFor, withEligibilityRoute } from "@/src/domain/eligibility/orchestration";
import {
  activatePolicyVersion,
  createPolicyVersion,
  seedEligibilityPolicies,
  updatePolicyBinding,
} from "@/src/domain/eligibility/policy-library";
import { buildScoreLearningRecord } from "@/src/domain/eligibility/score-dataset";
import { eligibilityTelemetry } from "@/src/domain/eligibility/telemetry";
import { automationFor, stageAdvanceBlocker } from "@/src/features/operations/workspace/workspace-model";

describe("Motor Universal de Elegibilidade", () => {
  it("executa comparações determinísticas sem embutir decisão subjetiva", () => {
    expect(compareEligibilityValues(35, "LTE", 35)).toBe(true);
    expect(compareEligibilityValues(35.01, "LTE", 35)).toBe(false);
    expect(compareEligibilityValues(false, "EQ", false)).toBe(true);
  });

  it("avalia a operação 20260925004 em modo paralelo com explicação e evidência", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const run = evaluateOperationEligibility({
      operation,
      debtors: initialDebtors,
      cedent,
      asOf: "2026-10-01",
    });

    expect(run.overallOutcome).toBe("EXCECAO");
    expect(run.evaluations).toHaveLength(21);
    expect(run.counts).toMatchObject({ APROVADO: 19, ALERTA: 1, EXCECAO: 1, REPROVADO: 0 });
    expect(new Set(run.evaluations.map(item => item.level))).toEqual(
      new Set(["TITULO", "SACADO", "CEDENTE", "OPERACAO", "CARTEIRA", "ESTRUTURA"]),
    );

    const fiscalAlert = run.evaluations.find(item => item.id === "risk-3408-3:TITLE-FISCAL-EVIDENCE-001");
    expect(fiscalAlert).toMatchObject({ outcome: "ALERTA", observed: false, parameter: true });
    expect(fiscalAlert?.evidence).toContain("vazio");

    const concentrationException = run.evaluations.find(
      item => item.subjectId === "sacado-3" && item.ruleId === "DEBTOR-OPERATION-CONCENTRATION-MAX-001",
    );
    expect(concentrationException?.outcome).toBe("EXCECAO");
    expect(concentrationException?.observed).toBeCloseTo(37.23, 2);
    expect(concentrationException?.parameter).toBe(35);
    expect(concentrationException?.overrideAuthority).toBe("Gerente de crédito");
    expect(concentrationException?.policyVersion).toBe("v4.2");
  });

  it("preserva a exceção original e calcula o efeito de uma decisão humana", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const run = evaluateOperationEligibility({ operation, debtors: initialDebtors, cedent, asOf: "2026-10-01" });
    const exception = run.evaluations.find(item => item.outcome === "EXCECAO")!;
    const overrides = [
      {
        id: "override:test",
        evaluationId: exception.id,
        ruleId: exception.ruleId,
        subjectId: exception.subjectId,
        originalOutcome: exception.outcome,
        observed: exception.observed,
        parameter: exception.parameter,
        decision: "APROVAR_EXCECAO" as const,
        justification: "Exceção deliberada pelo comitê para este teste.",
        authority: exception.overrideAuthority!,
        decidedBy: "Henrique",
        decidedAt: "2026-10-01T12:00:00",
        evidence: exception.evidence,
      },
    ];

    const effective = effectiveRunSummary(run, overrides);
    expect(run.overallOutcome).toBe("EXCECAO");
    expect(effective.overallOutcome).toBe("ALERTA");
    expect(effective.counts).toMatchObject({ APROVADO: 20, ALERTA: 1, EXCECAO: 0, REPROVADO: 0 });

    const metrics = eligibilityOperationalMetrics([
      { ...operation, eligibilityReview: { run, overrides } },
      ...initialOperations.slice(1),
    ]);
    expect(metrics).toMatchObject({
      operationsProcessed: 1,
      evaluationsProcessed: 21,
      titlesProcessed: 3,
      operationsWithException: 1,
      overridesPerformed: 1,
      humanInterventions: 1,
    });
    const events = eligibilityTelemetry({ ...operation, eligibilityReview: { run, overrides } });
    expect(events.map(event => event.type)).toEqual(["RUN_COMPLETED", "EXCEPTION_RAISED", "OVERRIDE_RECORDED"]);
  });

  it("orquestra continuidade, alçada e bloqueio pelo resultado efetivo", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const run = evaluateOperationEligibility({ operation, debtors: initialDebtors, cedent, asOf: "2026-10-01" });
    const exception = run.evaluations.find(item => item.outcome === "EXCECAO")!;
    const pending = { ...operation, eligibilityReview: { run, overrides: [] } };

    expect(eligibilityRouteFor(pending)).toMatchObject({
      state: "DECISAO_HUMANA",
      canAdvance: false,
      requiresHumanDecision: true,
    });
    expect(withEligibilityRoute(pending)).toMatchObject({ status: "Em atenção", blockers: 1 });
    const advancedWithPendingException = { ...pending, stage: 4 };
    expect(
      stageAdvanceBlocker(advancedWithPendingException, automationFor(advancedWithPendingException))?.feedback.message,
    ).toContain("Devolva a operação para Risco");

    const approvedException = {
      ...pending,
      eligibilityReview: {
        run,
        overrides: [
          {
            id: "override:approved",
            evaluationId: exception.id,
            ruleId: exception.ruleId,
            subjectId: exception.subjectId,
            originalOutcome: exception.outcome,
            observed: exception.observed,
            parameter: exception.parameter,
            decision: "APROVAR_EXCECAO" as const,
            justification: "Aprovada pela alçada competente.",
            authority: exception.overrideAuthority!,
            decidedBy: "Henrique",
            decidedAt: "2026-10-01T12:00:00",
            evidence: exception.evidence,
          },
        ],
      },
    };
    expect(eligibilityRouteFor(approvedException)).toMatchObject({ state: "FLUXO_COM_ALERTA", canAdvance: true });

    const rejectedException = {
      ...approvedException,
      eligibilityReview: {
        run,
        overrides: [
          {
            ...approvedException.eligibilityReview.overrides[0],
            id: "override:rejected",
            decision: "REJEITAR_EXCECAO" as const,
          },
        ],
      },
    };
    expect(eligibilityRouteFor(rejectedException)).toMatchObject({ state: "BLOQUEADA", canAdvance: false });
  });

  it("usa um único motor para os três perfis e prepara dados de score sem inventar nota", () => {
    const expectedLevels = ["TITULO", "SACADO", "CEDENTE", "OPERACAO", "CARTEIRA", "ESTRUTURA"];
    expect(Object.values(eligibilityProfiles)).toHaveLength(3);
    Object.values(eligibilityProfiles).forEach(profile => expect(profile.levels).toEqual(expectedLevels));

    const operation = initialOperations[0];
    const cedent = initialCedents.find(item => item.document === operation.document);
    const record = buildScoreLearningRecord({
      operation,
      cedent,
      debtors: initialDebtors,
      observedAt: "2026-10-01T12:00:00",
    });
    expect(record.observations.length).toBeGreaterThan(3);
    expect(record.outcomes).toEqual([]);
    expect(record).not.toHaveProperty("score");
  });

  it("versiona parâmetros sem alterar a política ativa nem o histórico", () => {
    const state = seedEligibilityPolicies();
    const active = state.policies.find(
      policy => policy.status === "ATIVA" && policy.company === "Lastro Prime FIDC · Classe Sênior",
    )!;
    const draft = createPolicyVersion(active, "2026-11-01");
    const edited = updatePolicyBinding(draft, "DEBTOR-OPERATION-CONCENTRATION-MAX-001", { parameter: 32 });

    expect(
      active.bindings.find(binding => binding.ruleId === "DEBTOR-OPERATION-CONCENTRATION-MAX-001")?.parameter,
    ).toBe(35);
    expect(edited.status).toBe("RASCUNHO");
    expect(
      edited.bindings.find(binding => binding.ruleId === "DEBTOR-OPERATION-CONCENTRATION-MAX-001")?.parameter,
    ).toBe(32);

    const activated = activatePolicyVersion([...state.policies, edited], edited.id, edited.effectiveFrom);
    expect(activated.find(policy => policy.id === edited.id)?.status).toBe("ATIVA");
    expect(activated.find(policy => policy.id === active.id)).toMatchObject({
      status: "ENCERRADA",
      effectiveTo: "2026-10-31",
    });
  });

  it("mantém um catálogo amplo sem inventar parâmetros universais", () => {
    expect(masterRuleCatalog.length).toBeGreaterThanOrEqual(50);
    expect(masterRuleCatalog.filter(rule => rule.readiness === "REQUER_INTEGRACAO").length).toBeGreaterThan(5);
    expect(masterRuleCatalog.every(rule => !("parameter" in rule))).toBe(true);
  });

  it("inicia com exatamente uma política por empresa do ambiente multiempresa", () => {
    const state = seedEligibilityPolicies();
    expect(state.version).toBe(2);
    expect(state.policies).toHaveLength(4);
    expect(new Set(state.policies.map(policy => policy.company)).size).toBe(4);
    expect(state.policies.every(policy => policy.status === "ATIVA" && policy.layer === "INSTITUICAO")).toBe(true);
  });

  it("importa o arquivo-padrão como rascunho vinculado à empresa", () => {
    const csv = policyImportTemplate()
      .replaceAll("PREENCHER EMPRESA", "Lastro Prime FIDC · Classe Sênior")
      .replace('"false";"GTE"', '"true";"GTE"')
      .replace('"";"EXCECAO"', '"1000";"EXCECAO"');
    const policy = importPolicyCsv(csv);

    expect(policy).toMatchObject({
      status: "RASCUNHO",
      modality: "FIDC",
      company: "Lastro Prime FIDC · Classe Sênior",
    });
    expect(policy.bindings).toHaveLength(1);
    expect(policy.bindings[0]).toMatchObject({ ruleId: "TITLE-AMOUNT-MIN-001", parameter: 1000 });
  });
});
