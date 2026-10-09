import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { autoAdvanceWithinPolicy } from "@/src/domain/operations/auto-advance";
import { lastroAssessmentFor, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { buildDefaultApprovals } from "@/src/features/operations/approval/approval-model";

const base = initialOperations.find(op => (op.manualEntry?.entries.length ?? 0) > 0)!;

function withLastro(op: Operation, confirmation: NonNullable<LastroReviewItem["confirmation"]>): Operation {
  const items = Object.fromEntries(
    (op.manualEntry?.entries ?? []).map(title => [
      title.id,
      { evidenceDecision: "Validada" as const, confirmation, confirmationNotes: "Sacado atendeu e não confirmou." },
    ]),
  );
  return { ...op, lastroReview: { items } };
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

describe("exceções de confirmação no lastro", () => {
  it.each(["Não confirmado", "Não confirma para terceiros", "Confirmado com ressalva"] as const)(
    "%s não trava o lastro, mas fica registrado como exceção",
    confirmation => {
      const lastro = lastroAssessmentFor(withLastro(base, confirmation), initialDebtors);
      expect(lastro.ready).toBe(true);
      expect(lastro.exceptions.length).toBe(lastro.sampleSize);
      expect(lastro.divergences).toBe(0);
    },
  );

  it("recusa continua sendo divergência que bloqueia o avanço", () => {
    const lastro = lastroAssessmentFor(withLastro(base, "Recusado"), initialDebtors);
    expect(lastro.ready).toBe(false);
    expect(lastro.divergences).toBeGreaterThan(0);
  });

  it("com exceção o avanço automático para no Lastro para conclusão manual", () => {
    const op = withLastro(atLastro(base), "Não confirma para terceiros");
    const result = autoAdvanceWithinPolicy(op, { debtors: initialDebtors, at: "05/10/2026 10:00" });
    expect(result.operation.stage).toBe(3);
    expect(result.stoppedAt?.reason).toContain("exceção");
  });

  it("exceção de lastro tira a aprovação automática da alçada de crédito", () => {
    const low = { ...base, risk: "Baixo" as const };
    const credit = (exceptions: number) =>
      buildDefaultApprovals(low, true, exceptions).find(item => item.id === "credito");
    expect(credit(0)?.status).toBe("Aprovado");
    expect(credit(2)).toMatchObject({ status: "Pendente", approver: "Comitê de Crédito" });
    expect(credit(2)?.note).toContain("Exceção de lastro");
  });
});
