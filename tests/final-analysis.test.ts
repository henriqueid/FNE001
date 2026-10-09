import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { buildEnrichmentSnapshot } from "@/src/domain/integrations/enrichment";
import { seedIntegrationState } from "@/src/domain/integrations/model";
import {
  approvalPackageComplete,
  buildFinalDecisionSnapshot,
  withFormalizationCompleted,
} from "@/src/features/operations/approval/approval-model";

describe("Tela Final de Análise", () => {
  const operation = initialOperations.find(item => item.aditivoNumber === "20260925004")!;
  const cedent = initialCedents.find(item => item.document === operation.document);

  it("consolida títulos pelo resultado efetivo do motor", () => {
    const run = evaluateOperationEligibility({ operation, debtors: initialDebtors, cedent, asOf: "2026-10-01" });
    const snapshot = buildFinalDecisionSnapshot({
      ...operation,
      eligibilityReview: { run, overrides: [] },
    });

    expect(snapshot.totalTitles).toBe(3);
    expect(snapshot.eligibleTitles).toBe(3);
    expect(snapshot.pendingTitles).toBe(0);
    expect(snapshot.portfolioEvaluations.length).toBeGreaterThan(0);
  });

  it("expõe a qualidade das fontes sem transformar demonstração em oficial", () => {
    const enrichment = buildEnrichmentSnapshot({
      operation,
      debtors: initialDebtors,
      cedent,
      integrations: seedIntegrationState(),
      at: "2026-10-04T12:00:00.000Z",
    });
    const snapshot = buildFinalDecisionSnapshot({
      ...operation,
      enrichmentReview: { snapshot: enrichment, history: [] },
    });

    expect(snapshot.demoSources).toBeGreaterThan(0);
    expect(snapshot.officialSources).toBe(0);
    expect(snapshot.dataPending).toBeGreaterThan(0);
  });

  it("disponibiliza automaticamente após a última formalidade, sem liberar dinheiro", () => {
    const review = {
      status: "Em formalização" as const,
      finalDecision: {
        outcome: "APROVADA" as const,
        decidedAt: "04/10/2026, 12:00",
        decidedBy: "Henrique",
        justification: "Política e alçadas atendidas.",
      },
      approvals: [{ id: "credito", role: "Crédito", approver: "Comitê", status: "Aprovado" as const }],
      documents: [{ id: "cessao", name: "Termo", required: true, status: "Pronto" as const, source: "Modelo" }],
      signatures: [{ id: "cedente", party: "Cedente", signer: "Representante", status: "Assinado" as const }],
      audit: [],
    };

    expect(approvalPackageComplete(review)).toBe(true);
    const available = withFormalizationCompleted({ ...operation, stage: 5 }, review, "04/10/2026, 12:05");
    expect(available).toMatchObject({ stage: 6, status: "Pronta para liberar" });
    expect(available.status).not.toBe("Liberada ao financeiro");
    expect(available.stageCompletions).toEqual(
      expect.arrayContaining([expect.objectContaining({ stageId: 5, completedBy: "Orquestrador FNE001" })]),
    );
  });

  it("não avança quando ainda existe assinatura pendente", () => {
    const review = {
      status: "Em formalização" as const,
      finalDecision: {
        outcome: "APROVADA" as const,
        decidedAt: "04/10/2026, 12:00",
        decidedBy: "Henrique",
        justification: "Política e alçadas atendidas.",
      },
      approvals: [{ id: "credito", role: "Crédito", approver: "Comitê", status: "Aprovado" as const }],
      documents: [{ id: "cessao", name: "Termo", required: true, status: "Pronto" as const, source: "Modelo" }],
      signatures: [{ id: "cedente", party: "Cedente", signer: "Representante", status: "Enviado" as const }],
      audit: [],
    };

    expect(approvalPackageComplete(review)).toBe(false);
    expect(withFormalizationCompleted({ ...operation, stage: 5 }, review).stage).toBe(5);
  });
});
