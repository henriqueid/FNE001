import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { autoAdvanceWithinPolicy } from "@/src/domain/operations/auto-advance";
import { lastroAssessmentFor, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { buildDefaultApprovals } from "@/src/features/operations/approval/approval-model";
import { automationFor, stageAdvanceBlocker } from "@/src/features/operations/workspace/workspace-model";

const base = initialOperations.find(op => (op.manualEntry?.entries.length ?? 0) > 0)!;

function withLastro(op: Operation, confirmation: NonNullable<LastroReviewItem["confirmation"]>): Operation {
  const items = Object.fromEntries(
    (op.manualEntry?.entries ?? []).map(title => [
      title.id,
      { evidenceDecision: "Validada" as const, confirmation, confirmationNotes: "Sacado atendeu e não confirmou." },
    ]),
  );
  return {
    ...op,
    lastroPrecheckRequired: true,
    lastroReview: { status: "Favorável", opinion: "Parecer geral registrado.", items },
  };
}

const atLastro = (op: Operation): Operation => {
  const staged = { ...op, stage: 3, status: "Em andamento" as const, pricingReview: undefined };
  const run = evaluateOperationEligibility({ operation: staged, debtors: initialDebtors });
  return {
    ...staged,
    eligibilityReview: {
      run: { ...run, evaluations: run.evaluations.map(item => ({ ...item, outcome: "APROVADO" as const })) },
      overrides: [],
    },
  };
};

describe("parecer geral da pré-checagem de lastro", () => {
  it.each(["Não confirmado", "Não confirma para terceiros", "Confirmado com ressalva"] as const)(
    "%s fica como apoio e não trava um parecer geral registrado",
    confirmation => {
      const lastro = lastroAssessmentFor(withLastro(base, confirmation), initialDebtors);
      expect(lastro.ready).toBe(true);
      expect(lastro.exceptions.length).toBe(lastro.sampleSize);
      expect(lastro.divergences).toBe(0);
    },
  );

  it("divergência não substitui nem bloqueia o status geral", () => {
    const lastro = lastroAssessmentFor(withLastro(base, "Recusado"), initialDebtors);
    expect(lastro.ready).toBe(true);
    expect(lastro.divergences).toBeGreaterThan(0);
  });

  it("pré-checagem obrigatória sem status geral permanece pendente", () => {
    const op: Operation = { ...base, lastroPrecheckRequired: true, lastroReview: undefined };
    expect(lastroAssessmentFor(op, initialDebtors).ready).toBe(false);
  });

  it("com parecer registrado, o avanço automático ainda para para conclusão manual", () => {
    const op = withLastro(atLastro(base), "Não confirma para terceiros");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: "05/10/2026 10:00" });
    expect(result.operation.stage).toBe(3);
    expect(result.stoppedAt?.reason).toContain("manualmente");
  });

  it("parecer com ressalva tira a aprovação automática da alçada de crédito", () => {
    const low = { ...base, risk: "Baixo" as const };
    const credit = (exceptions: number) =>
      buildDefaultApprovals(low, true, exceptions).find(item => item.id === "credito");
    expect(credit(0)?.status).toBe("Aprovado");
    expect(credit(2)).toMatchObject({ status: "Pendente", approver: "Comitê de Crédito" });
    expect(credit(2)?.note).toContain("ressalva ou desfavorável");
  });

  it("documentos e confirmações não são obrigatórios para concluir a etapa", () => {
    const entries = (base.manualEntry?.entries ?? []).map(entry =>
      entry.id === "risk-3408-3"
        ? { ...entry, nfeKey: "41260952927676000129550010000664201002468102", cfop: "5102" }
        : entry,
    );
    const items = Object.fromEntries(
      entries.map(entry => [
        entry.id,
        {
          evidenceDecision: "Validada" as const,
          confirmation: entry.debtorId === "sacado-2" ? ("Confirmado" as const) : ("Pendente" as const),
        },
      ]),
    );
    const realOperation: Operation = {
      ...base,
      id: "operacao-real-lastro",
      risk: "Baixo",
      stage: 3,
      blockers: 0,
      lastroPrecheckRequired: true,
      eligibilityReview: undefined,
      manualEntry: { ...base.manualEntry!, entries },
      lastroReview: { status: "Desfavorável", opinion: "Risco relevante para o preço.", items },
    };

    expect(lastroAssessmentFor(realOperation, initialDebtors).ready).toBe(true);
    expect(lastroAssessmentFor(realOperation, []).ready).toBe(true);
    expect(stageAdvanceBlocker(realOperation, automationFor(realOperation), initialDebtors)).toBeNull();
  });
});
