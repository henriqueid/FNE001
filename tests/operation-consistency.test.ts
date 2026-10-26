/** Regressões de composição financeira, prontidão e validação da entrada. */
import { describe, expect, it, vi, afterEach } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Operation } from "@/src/domain/core/types";
import { defaultPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import { stageInsightFor } from "@/src/domain/operations/stage-insight";
import { buildReadinessChecklist } from "@/src/features/operations/approval/approval-model";
import { automationFor, stageAdvanceBlocker } from "@/src/features/operations/workspace/workspace-model";
import { createEmptyEntry, entryDraftBlockers } from "@/src/features/operations/entry/manual-entry-model";

const base = initialOperations.find(operation => operation.manualEntry?.entries.length)!;
const title = {
  ...base.manualEntry!.entries[0],
  id: "consistency-title",
  amount: 1000,
  dueDate: "2026-11-24",
  nfeKey: "",
};
const manual: Operation = {
  ...base,
  source: "Digitação manual",
  stage: 5,
  blockers: 0,
  eligibilityReview: undefined,
  lastroPrecheckRequired: false,
  lastroReview: undefined,
  manualEntry: { receivableType: "Duplicata", mode: "individual", entries: [title] },
  riskReview: { cedentDecision: "Aprovado", titleDecisions: { [title.id]: "Aprovado" } },
  pricingReview: { ...defaultPricing(base), status: "Condição salva" },
  approvalReview: {
    status: "Aprovada",
    approvals: [{ id: "all", role: "Final", approver: "Auditor", status: "Aprovado" }],
    documents: [{ id: "all", name: "Pacote", required: true, status: "Pronto", source: "Manual" }],
    signatures: [{ id: "all", party: "Cedente", signer: "Auditor", status: "Assinado" }],
  },
};
afterEach(() => vi.useRealTimers());

describe("composição do líquido por título", () => {
  it.each([false, true])("reconcilia IOF e retenção em centavos, VA=%s", vaEnabled => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00"));
    const operation = { ...manual, institution: "Factoring" as const };
    const pricing = {
      ...defaultPricing(operation),
      monthlyRate: 0,
      floatDays: 0,
      minimumTermDays: 0,
      operationFee: 0,
      feePerTitle: 0,
      adValoremPercent: 0,
      guaranteePercent: 0,
      manualRetention: 100,
      vaEnabled,
    };
    const result = pricingCalculation(operation, pricing);
    expect(result.net).toBeCloseTo(894.97, 8);
    expect(result.titleRows[0].net).toBe(894.97);
    expect(result.titleRows[0].allocatedIof).toBe(5.03);
    expect(result.titleRows[0].allocatedManualRetention).toBe(100);
  });
  it("fecha resíduo de rateio com vários títulos sem alterar líquido agregado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00"));
    const operation = {
      ...manual,
      institution: "Factoring" as const,
      riskReview: undefined,
      manualEntry: {
        ...manual.manualEntry!,
        entries: [1, 2, 3].map(id => ({ ...title, id: String(id), amount: 333.33 })),
      },
    };
    const pricing = {
      ...defaultPricing(operation),
      monthlyRate: 0,
      floatDays: 0,
      minimumTermDays: 0,
      operationFee: 0,
      feePerTitle: 0,
      adValoremPercent: 0,
      guaranteePercent: 0,
      manualRetention: 100,
    };
    const result = pricingCalculation(operation, pricing);
    expect(result.net).toBeCloseTo(894.9600503, 8);
    expect(Math.round(result.titleRows.reduce((sum, row) => sum + row.net, 0) * 100)).toBe(89496);
    expect(result.titleRows.reduce((sum, row) => sum + Math.round(row.allocatedManualRetention * 100), 0)).toBe(10000);
  });
});

describe("prontidão única da aprovação", () => {
  it("mostra evidência NF-e pendente no mesmo checklist que bloqueia conclusão", () => {
    const items = buildReadinessChecklist(manual, lastroAssessmentFor(manual));
    expect(items.some(item => !item.ok && item.detail.includes("NF-e"))).toBe(true);
    const insight = stageInsightFor(manual, 5, automationFor(manual));
    expect(insight.metrics[0].value).toBe(`${items.filter(item => item.ok).length}/${items.length}`);
    expect(stageAdvanceBlocker(manual, automationFor(manual))?.feedback.message).toContain("NF-e");
  });
  it("não dispensa parecer obrigatório só porque existe NF-e", () => {
    const operation = {
      ...manual,
      lastroPrecheckRequired: true,
      manualEntry: { ...manual.manualEntry!, entries: [{ ...title, nfeKey: "1".repeat(44) }] },
    };
    expect(stageAdvanceBlocker(operation, automationFor(operation))?.feedback.message).toContain("lastro");
  });
});

describe("entrada manual", () => {
  it("orienta documento, valor e vencimento mesmo com sacado escolhido", () => {
    const blockers = entryDraftBlockers(createEmptyEntry("draft"), "Duplicata", true);
    expect(blockers).toEqual([
      "Informe o número do documento.",
      "Informe um valor maior que zero.",
      "Informe o vencimento.",
    ]);
    expect(
      entryDraftBlockers(
        { ...createEmptyEntry("draft"), documentNumber: "D1", amount: 10, dueDate: "2026-11-24" },
        "Duplicata",
        true,
      ),
    ).toEqual([]);
  });
  it("aceita CMC7 como documento do cheque e rejeita valor não finito", () => {
    const draft = { ...createEmptyEntry("draft"), cmc7: "123", amount: 10, dueDate: "2026-11-24" };
    expect(entryDraftBlockers(draft, "Cheque", true)).toEqual([]);
    expect(entryDraftBlockers({ ...draft, amount: Number.NaN }, "Cheque", true)).toContain(
      "Informe um valor maior que zero.",
    );
  });
});

it.each(["Por valor", "Por valor × prazo"] as const)(
  "memória VA fecha equação visível e rateios: %s",
  feeAllocation => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00"));
    const operation = {
      ...manual,
      institution: "Factoring" as const,
      riskReview: undefined,
      manualEntry: {
        ...manual.manualEntry!,
        entries: [100, 203.34, 500.05].map((amount, index) => ({
          ...title,
          id: String(index),
          amount,
          dueDate: ["2026-11-24", "2026-12-24", "2027-01-24"][index],
        })),
      },
    };
    const pricing = {
      ...defaultPricing(operation),
      vaEnabled: true,
      monthlyRate: 2,
      manualRetention: 2.11,
      operationFee: 20,
      feeAllocation,
    };
    const result = pricingCalculation(operation, pricing);
    expect(Math.round(result.titleRows.reduce((sum, row) => sum + row.net, 0) * 100)).toBe(
      Math.round(result.net * 100),
    );
    for (const row of result.titleRows) {
      expect(
        Math.round(
          (row.title.amount -
            row.displayedDiscount -
            row.displayedFees -
            row.allocatedGuarantee -
            row.allocatedIof -
            row.allocatedManualRetention +
            row.netAdjustment) *
            100,
        ),
      ).toBe(Math.round(row.net * 100));
    }
  },
);
