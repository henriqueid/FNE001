import { describe, expect, it } from "vitest";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { releasedOperation } from "./operation-return-fixture";
import { bindRepurchaseSources, applyRepurchases, reverseRepurchases } from "@/src/server/operations/repurchase";
import type { PortfolioState } from "@/src/domain/portfolio/model";
function fixture(writeOffTitle = false) {
  const operation = releasedOperation();
  const title = structuredClone(seedPortfolio([]).titles[0]);
  title.id = "real-old";
  title.company = operation.vehicle;
  title.ownerDocument = operation.document;
  title.status = "Em aberto";
  title.bankStatus = "Sem boleto";
  title.originalAmount = 900;
  title.openAmount = 400;
  title.paidAmount = 500;
  title.payments = [];
  title.repurchasedAmount = 0;
  const portfolio: PortfolioState = { version: 3, titles: [title] };
  operation.pricingReview = {
    repurchaseTitleIds: [title.id],
    repurchaseSourceBalances: { [title.id]: 400 },
    repurchaseTerms: { [title.id]: { writeOffTitle, lateInterestMonthly: 0, penaltyPercent: 0, action: "Recompra" } },
  } as NonNullable<typeof operation.pricingReview>;
  return { operation, portfolio, title };
}
describe("recompra real autoritativa", () => {
  it("vincula somente saldo aberto e ignora fonte enviada pelo navegador", () => {
    const { operation, portfolio } = fixture();
    operation.repurchaseContext = { titles: [] };
    expect(bindRepurchaseSources(operation, portfolio).repurchaseContext?.titles[0].faceAmount).toBe(400);
  });
  it.each(["company", "ownerDocument", "positionReviewRequired", "repurchaseReservation"])(
    "bloqueia origem incompatível %s",
    field => {
      const { operation, portfolio, title } = fixture();
      Object.assign(title, { [field]: field === "repurchaseReservation" ? { applicationId: "other" } : "outra" });
      expect(() => bindRepurchaseSources(operation, portfolio)).toThrow();
    },
  );
  it("bloqueia saldo antigo, escolha ausente e parcial", () => {
    const { operation, portfolio, title } = fixture();
    title.openAmount = 399;
    expect(() => bindRepurchaseSources(operation, portfolio)).toThrow(/saldo/i);
    title.openAmount = 400;
    operation.pricingReview!.repurchaseTerms![title.id].writeOffTitle = undefined;
    expect(() => bindRepurchaseSources(operation, portfolio)).toThrow(/Sim ou Não/);
    operation.pricingReview!.repurchaseTerms![title.id].writeOffTitle = true;
    operation.pricingReview!.repurchaseTerms![title.id].action = "Recompra parcial";
    expect(() => bindRepurchaseSources(operation, portfolio)).toThrow(/integral/i);
  });
  it.each([false, true])("aplica opção %s uma vez, preserva banco e estorna vínculo", writeOffTitle => {
    const { operation, portfolio } = fixture(writeOffTitle);
    const applied = applyRepurchases(operation, portfolio, "actor", "2026-10-25T12:00:00Z");
    expect(applied.portfolio.titles[0].status).toBe(writeOffTitle ? "Recomprado" : "Em aberto");
    expect(applied.portfolio.titles[0].bankStatus).toBe("Sem boleto");
    expect(applied.portfolio.titles[0].repurchaseReservation?.amount).toBe(400);
    expect(() => bindRepurchaseSources({ ...operation, id: "another" }, applied.portfolio)).toThrow();
    expect(
      applyRepurchases(applied.operation, applied.portfolio, "actor", "later").operation.repurchaseApplications,
    ).toHaveLength(1);
    const reversed = reverseRepurchases(applied.operation, applied.portfolio, "actor", "2026-10-25T13:00:00Z");
    expect(reversed.portfolio.titles[0].openAmount).toBe(400);
    expect(reversed.portfolio.titles[0].repurchaseReservation).toBeUndefined();
    expect(reversed.operation.repurchaseApplications![0].reversedAt).toBeTruthy();
  });
  it("não reabre ativo que recebeu após desconto", () => {
    const { operation, portfolio } = fixture();
    const applied = applyRepurchases(operation, portfolio, "actor", "2026-10-25T12:00:00Z");
    applied.portfolio.titles[0].paidAmount += 10;
    expect(() => reverseRepurchases(applied.operation, applied.portfolio, "actor", "now")).toThrow(/alterado/i);
  });
});

import { BankingDatabase } from "./cnab400-server-database";
import { repurchaseCalculation, normalizedPricing, defaultPricing } from "@/src/domain/operations/pricing";
import { saveOperation, loadOperationSnapshot } from "@/src/server/operations/repository";
import { loadFinanceState } from "@/src/server/finance/repository";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { returnReleasedOperation } from "@/src/server/operations/return";
import type { ServerPrincipal } from "@/src/server/access/repository";
async function serverFixture(writeOffTitle = false) {
  const { operation, portfolio } = fixture(writeOffTitle);
  const terms = operation.pricingReview!;
  operation.institution = "FIDC";
  operation.pricingReview = {
    ...defaultPricing(operation),
    ...terms,
    monthlyRate: 0,
    operationFee: 0,
    feePerTitle: 0,
    adValoremPercent: 0,
    guaranteePercent: 0,
  };
  operation.netAmount = 600;
  operation.releaseReview!.payables![0].amount = 600;
  const db = new BankingDatabase();
  db.portfolio.set("tenant-a", { payload: portfolio, aggregate_version: 1 });
  return { db, operation, portfolio };
}
const principal = {
  id: "actor",
  name: "actor",
  tenantId: "tenant-a",
  permissions: ["finance:release"],
  companyScopes: ["Empresa A"],
} as ServerPrincipal;
describe("recompra coordenada no servidor", () => {
  it("recusa favorecido ou líquido desatualizado antes de aplicar", async () => {
    const { db, operation } = await serverFixture();
    operation.releaseReview!.payables![0].amount = 601;
    await expect(saveOperation(db, "tenant-a", "actor", operation, 0)).rejects.toThrow(/líquido|favorecido/i);
    expect(db.operations.size).toBe(0);
    expect((await loadCurrentPortfolio(db, "tenant-a")).titles[0].repurchaseReservation).toBeUndefined();
  });
  it.each([false, true])(
    "aplica %s, replay preserva ciclo e retorno reverte carteira/razão juntos",
    async writeOffTitle => {
      const { db, operation } = await serverFixture(writeOffTitle);
      const saved = (await saveOperation(db, "tenant-a", "actor", operation, 0))!;
      const finance = (await loadFinanceState(db, "tenant-a"))!;
      expect(finance.journal).toHaveLength(writeOffTitle ? 2 : 1);
      expect(finance.titles[0].amount).toBe(600);
      const portfolio = await loadCurrentPortfolio(db, "tenant-a");
      expect(portfolio.titles.find(t => t.id === "real-old")!.repurchaseReservation?.amount).toBe(400);
      await saveOperation(db, "tenant-a", "actor", saved, saved.persistenceVersion!);
      expect((await loadFinanceState(db, "tenant-a"))!.journal).toHaveLength(writeOffTitle ? 2 : 1);
      const current = (await loadOperationSnapshot(db, "tenant-a", operation.id))!;
      expect(repurchaseCalculation(current, normalizedPricing(current)).total).toBe(400);
      expect(
        bindRepurchaseSources(current, await loadCurrentPortfolio(db, "tenant-a")).repurchaseContext?.titles.filter(
          t => t.id === "real-old",
        ),
      ).toHaveLength(1);
      const input = {
        operationId: operation.id,
        expectedVersion: current.persistenceVersion!,
        targetStage: 3,
        reason: "Revisão",
        cashMoved: false,
        date: "2026-10-25",
        commandId: "repurchase-return-test",
      };
      const returned = await returnReleasedOperation(db, principal, input);
      expect(await returnReleasedOperation(db, principal, input)).toEqual(returned);
      expect((await loadCurrentPortfolio(db, "tenant-a")).titles.find(t => t.id === "real-old")!.openAmount).toBe(400);
      const after = (await loadFinanceState(db, "tenant-a"))!;
      expect(after.journal.filter(e => !e.reversalOf).every(e => e.reversedBy)).toBe(true);
    },
  );
  it("falha financeira desfaz operação, reserva e ativo novo", async () => {
    const { db, operation } = await serverFixture(true);
    db.failFinance = true;
    await expect(saveOperation(db, "tenant-a", "actor", operation, 0)).rejects.toThrow();
    expect(db.operations.size).toBe(0);
    expect(db.receivables.size).toBe(0);
    expect((await loadCurrentPortfolio(db, "tenant-a")).titles[0].repurchaseReservation).toBeUndefined();
  });
  it("duas liberações concorrentes não consomem título duas vezes", async () => {
    const { db, operation } = await serverFixture();
    const other = structuredClone(operation);
    other.id = "other-operation";
    const results = await Promise.allSettled([
      saveOperation(db, "tenant-a", "actor", operation, 0),
      saveOperation(db, "tenant-a", "actor", other, 0),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(db.operations.size).toBe(1);
  });
  it("tenant alheio não encontra título nem aceita contexto forjado", async () => {
    const { db, operation } = await serverFixture();
    operation.repurchaseContext = { titles: [{ id: "real-old", faceAmount: 400 } as never] };
    await expect(saveOperation(db, "tenant-b", "actor", operation, 0)).rejects.toThrow(/indisponível/i);
    expect(db.operations.size).toBe(0);
  });
});

describe("dependência entre operações", () => {
  it("não devolve origem cujo título permanece aberto e reservado em outra recompra", async () => {
    const db = new BankingDatabase();
    const original = (await saveOperation(db, "tenant-a", "actor", releasedOperation(), 0))!;
    const source = (await loadCurrentPortfolio(db, "tenant-a")).titles[0];
    const next = structuredClone(releasedOperation());
    next.id = "dependent-repurchase";
    next.institution = "FIDC";
    next.amount = 2000;
    next.netAmount = 1000;
    next.manualEntry!.entries[0] = {
      ...next.manualEntry!.entries[0],
      id: "new-entry",
      documentNumber: "NEW-DEPENDENT",
      amount: 2000,
    };
    next.releaseReview!.payables![0] = { ...next.releaseReview!.payables![0], id: "new-payable", amount: 1000 };
    next.pricingReview = {
      ...defaultPricing(next),
      monthlyRate: 0,
      operationFee: 0,
      feePerTitle: 0,
      adValoremPercent: 0,
      guaranteePercent: 0,
      repurchaseTitleIds: [source.id],
      repurchaseSourceBalances: { [source.id]: 1000 },
      repurchaseTerms: {
        [source.id]: { lateInterestMonthly: 0, penaltyPercent: 0, writeOffTitle: false, action: "Recompra" },
      },
    };
    await saveOperation(db, "tenant-a", "actor", next, 0);
    await expect(
      returnReleasedOperation(db, principal, {
        operationId: original.id,
        expectedVersion: original.persistenceVersion!,
        targetStage: 3,
        reason: "rever origem",
        cashMoved: false,
        date: "2026-10-25",
        commandId: "source-return-dependent",
      }),
    ).rejects.toThrow(/recompra.*outra|vinculado.*recompra/i);
    expect((await loadCurrentPortfolio(db, "tenant-a")).titles.find(t => t.id === source.id)?.status).toBe("Em aberto");
  });
});
