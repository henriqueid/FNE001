import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { eligibilityAuditPackage } from "@/src/domain/eligibility/audit-package";
import { effectiveRunSummary, replaceEligibilityRun } from "@/src/domain/eligibility/decision";
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

  it("explica e libera pela alçada uma avaliação sem dado quando a política permite override", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const evaluated = evaluateOperationEligibility({ operation, debtors: initialDebtors, cedent, asOf: "2026-10-01" });
    const source = evaluated.evaluations[0];
    const unavailable = {
      ...source,
      outcome: "NAO_AVALIADO" as const,
      observed: null,
      overrideAllowed: true,
      overrideAuthority: "Gerente de crédito",
    };
    const run = {
      ...evaluated,
      evaluations: [unavailable],
      overallOutcome: "NAO_AVALIADO" as const,
      counts: { APROVADO: 0, ALERTA: 0, EXCECAO: 0, REPROVADO: 0, NAO_AVALIADO: 1 },
    };
    const pending = { ...operation, eligibilityReview: { run, overrides: [] } };

    expect(eligibilityRouteFor(pending)).toMatchObject({
      state: "DECISAO_HUMANA",
      canAdvance: false,
      explanation: expect.stringContaining(`${unavailable.subjectLabel} — ${unavailable.ruleName}`),
    });

    const decided = {
      ...pending,
      eligibilityReview: {
        run,
        overrides: [
          {
            id: "override:missing-data",
            evaluationId: unavailable.id,
            ruleId: unavailable.ruleId,
            subjectId: unavailable.subjectId,
            originalOutcome: unavailable.outcome,
            observed: unavailable.observed,
            parameter: unavailable.parameter,
            decision: "APROVAR_EXCECAO" as const,
            justification: "Dado validado pela alçada responsável.",
            authority: unavailable.overrideAuthority!,
            decidedBy: "Henrique",
            decidedAt: "2026-10-01T12:00:00",
            evidence: unavailable.evidence,
          },
        ],
      },
    };

    expect(eligibilityRouteFor(decided)).toMatchObject({ state: "FLUXO_NORMAL", canAdvance: true });
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

    const activated = activatePolicyVersion([...state.policies, edited], edited.id, edited.effectiveFrom, {
      approvedById: "user-henrique-admin",
      approvedBy: "Henrique",
      approvedAt: "2026-10-13T12:00:00.000Z",
      justification: "Revisão de limites aprovada pela Diretoria.",
    });
    expect(activated.find(policy => policy.id === edited.id)?.status).toBe("ATIVA");
    expect(activated.find(policy => policy.id === active.id)).toMatchObject({
      status: "ENCERRADA",
      effectiveTo: "2026-10-31",
    });
  });

  it("detecta mudança de entrada e preserva a execução substituída com seus overrides", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const original = evaluateOperationEligibility({ operation, debtors: initialDebtors, cedent, asOf: "2026-10-01" });
    const changed = evaluateOperationEligibility({
      operation: { ...operation, amount: operation.amount + 10_000 },
      debtors: initialDebtors,
      cedent,
      asOf: "2026-10-01",
    });
    expect(original.inputFingerprint).toBeTruthy();
    expect(changed.inputFingerprint).not.toBe(original.inputFingerprint);

    const exception = original.evaluations.find(item => item.outcome === "EXCECAO")!;
    const override = {
      id: "override:history",
      evaluationId: exception.id,
      ruleId: exception.ruleId,
      subjectId: exception.subjectId,
      originalOutcome: exception.outcome,
      observed: exception.observed,
      parameter: exception.parameter,
      decision: "APROVAR_EXCECAO" as const,
      justification: "Decisão anterior preservada na trilha.",
      authority: exception.overrideAuthority!,
      decidedBy: "Henrique",
      decidedAt: "2026-10-01T12:00:00",
      evidence: exception.evidence,
    };
    const review = replaceEligibilityRun({ run: original, overrides: [override] }, changed, {
      at: "2026-10-02T09:00:00",
      by: "Henrique",
      reason: "Valor bruto atualizado",
    });
    expect(review.overrides).toEqual([]);
    expect(review.history).toHaveLength(1);
    expect(review.history?.[0]).toMatchObject({
      run: { id: original.id },
      overrides: [{ id: "override:history" }],
      supersededBy: "Henrique",
      reason: "Valor bruto atualizado",
    });
    const audit = eligibilityAuditPackage(
      { ...operation, eligibilityReview: review },
      "2026-10-02T10:00:00",
      "Henrique",
    );
    expect(audit).toMatchObject({
      schema: "strato.eligibility-audit.v1",
      exportedBy: "Henrique",
      current: { run: { id: changed.id }, overrides: [] },
      history: [{ run: { id: original.id }, overrides: [{ id: "override:history" }] }],
    });
  });

  it("disponibiliza fatos projetados de sacado, cedente, operação e carteira para políticas específicas", () => {
    const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
    const cedent = initialCedents.find(item => item.document === operation.document);
    const policy = {
      id: "POL-FACTS-TEST:v1",
      name: "Política de fatos disponíveis",
      version: "v1",
      layer: "UNIVERSAL" as const,
      effectiveFrom: "2026-01-01",
      status: "ATIVA" as const,
      bindings: [
        "DEBTOR-PORTFOLIO-CONCENTRATION-MAX-001",
        "DEBTOR-GROUP-CONCENTRATION-MAX-001",
        "DEBTOR-INTERNAL-SCORE-MIN-001",
        "CEDENT-INTERNAL-SCORE-MIN-001",
        "OPERATION-WEIGHTED-TERM-MAX-001",
        "PORTFOLIO-DEBTOR-CONCENTRATION-MAX-001",
        "PORTFOLIO-DIVERSIFICATION-MIN-001",
      ].map(ruleId => ({
        ruleId,
        enabled: true,
        parameter: ruleId.includes("SCORE-MIN") || ruleId.includes("DIVERSIFICATION-MIN") ? 0 : 100,
        failureOutcome: "EXCECAO" as const,
        action: "SOLICITAR_DECISAO" as const,
        overrideAllowed: true,
        overrideAuthority: "Gerente de crédito",
      })),
    };
    const run = evaluateOperationEligibility({
      operation,
      debtors: initialDebtors,
      cedent,
      asOf: "2026-10-01",
      policies: [policy],
    });
    expect(run.evaluations.length).toBeGreaterThan(7);
    expect(run.evaluations.every(item => item.observed !== null)).toBe(true);
    expect(run.evaluations.find(item => item.ruleId === "PORTFOLIO-DEBTOR-CONCENTRATION-MAX-001")?.evidence).toContain(
      "carteira projetada",
    );
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
