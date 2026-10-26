/** Devolução e reaquisição atravessam repositórios reais, com falhas apenas no limite SQL isolado. */
import { describe, expect, it } from "vitest";
import { BankingDatabase } from "./cnab400-server-database";
import { releasedOperation } from "./operation-return-fixture";
import { returnReleasedOperation, type OperationReturnCommand } from "@/src/server/operations/return";
import { saveOperation, loadOperationSnapshot } from "@/src/server/operations/repository";
import { loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { settleTitle } from "@/src/domain/finance/titles";
import { accountBalance } from "@/src/domain/finance/banking";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { portfolioBalance } from "@/src/domain/portfolio/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
const principal = {
  id: "actor",
  name: "Operador",
  tenantId: "tenant-a",
  permissions: ["finance:release"],
  companyScopes: ["Empresa A"],
} as ServerPrincipal;
async function fixture() {
  const db = new BankingDatabase();
  const operation = await saveOperation(db, "tenant-a", principal.id, releasedOperation(), 0);
  return { db, operation: operation! };
}
const command = (id: string, version: number): OperationReturnCommand => ({
  operationId: id,
  expectedVersion: version,
  targetStage: 3,
  reason: "Regularizar documentação",
  cashMoved: false,
  date: "2026-10-18",
  commandId: "return-operation-0001",
});
describe("comando de devolução transacional", () => {
  it("preserva origem/compra e devolve operação/carteira juntos com replay seguro", async () => {
    const { db, operation } = await fixture();
    const input = command(operation.id, operation.persistenceVersion!);
    const before = (await loadFinanceState(db, "tenant-a"))!,
      purchase = before.purchasePosted[operation.id];
    const first = await returnReleasedOperation(db, principal, input),
      replay = await returnReleasedOperation(db, principal, input);
    expect(replay).toEqual(first);
    expect(first.operation.stage).toBe(3);
    expect(first.operation.releaseReview?.status).toBe("Em preparação");
    const finance = (await loadFinanceState(db, "tenant-a"))!;
    expect(finance.purchasePosted[operation.id]).toBe(purchase);
    expect(finance.journal).toHaveLength(2);
    expect(finance.journal.find(e => e.id === purchase)?.reversedBy).toBeTruthy();
    expect(finance.titles[0].status).toBe("Cancelado");
    const portfolio = await loadCurrentPortfolio(db, "tenant-a");
    expect(portfolio.titles[0]).toMatchObject({ status: "Cancelado", openAmount: 0 });
    expect(db.bankEvents.filter(e => e.type === "OperationReturn")).toHaveLength(1);
  });
  it("reaquisição cria compra/obrigações novas e reativa exposição sem apagar histórico", async () => {
    const { db, operation } = await fixture();
    const result = await returnReleasedOperation(db, principal, command(operation.id, operation.persistenceVersion!));
    const next = {
      ...releasedOperation(),
      persistenceVersion: result.operation.persistenceVersion,
      releaseReview: {
        ...releasedOperation().releaseReview!,
        payables: releasedOperation().releaseReview!.payables!.map(p => ({
          ...p,
          id: "payable-cycle-2",
          createdAt: "2026-10-18T16:00:00Z",
        })),
      },
    };
    await saveOperation(db, "tenant-a", principal.id, next, result.operation.persistenceVersion!);
    const finance = (await loadFinanceState(db, "tenant-a"))!;
    expect(finance.journal).toHaveLength(3);
    expect(finance.titles).toHaveLength(2);
    const portfolio = await loadCurrentPortfolio(db, "tenant-a");
    expect(portfolio.titles[0]).toMatchObject({ status: "Em aberto", bankStatus: "Sem boleto" });
    expect(portfolioBalance(portfolio.titles[0])).toBe(1000);
    expect(portfolio.titles[0].events.some(e => e.action === "Devolução de operação")).toBe(true);
  });
  it("falha após calcular contrapartidas desfaz operação, recebíveis e financeiro", async () => {
    const { db, operation } = await fixture();
    db.failPortfolio = true;
    await expect(
      returnReleasedOperation(db, principal, command(operation.id, operation.persistenceVersion!)),
    ).rejects.toThrow();
    const finance = (await loadFinanceState(db, "tenant-a"))!;
    expect(finance.journal).toHaveLength(1);
    expect(finance.titles[0].status).toBe("Em aberto");
    expect((await loadOperationSnapshot(db, "tenant-a", operation.id))?.status).toBe("Liberada ao financeiro");
    expect(db.bankEvents.filter(e => e.type === "OperationReturn")).toHaveLength(0);
  });
  it("recusa tenant/escopo/versão e retorno com título registrado", async () => {
    const { db, operation } = await fixture();
    const input = command(operation.id, operation.persistenceVersion!);
    await expect(returnReleasedOperation(db, { ...principal, tenantId: "tenant-b" }, input)).rejects.toThrow();
    await expect(returnReleasedOperation(db, { ...principal, companyScopes: ["Outra"] }, input)).rejects.toThrow();
    await expect(returnReleasedOperation(db, principal, { ...input, expectedVersion: 999 })).rejects.toThrow();
    const portfolio = await loadCurrentPortfolio(db, "tenant-a");
    portfolio.titles[0].bankStatus = "Registrado";
    db.portfolio.set("tenant-a", { payload: portfolio, aggregate_version: 1 });
    await expect(returnReleasedOperation(db, principal, input)).rejects.toThrow(/banco/i);
  });
});

it.each([true, false])(
  "estorna pagamento com cashMoved=%s e preserva caixa ou recuperação corretamente",
  async cashMoved => {
    const { db, operation } = await fixture();
    const finance = (await loadFinanceState(db, "tenant-a"))!;
    finance.accounts.push({
      id: "bank-return",
      company: "Empresa A",
      bankCode: "341",
      bankName: "Itaú",
      agency: "1234",
      account: "12345",
      type: "Conta movimento",
      nickname: "Conta A",
      usage: { payments: true, receipts: true, collection: false },
      openingBalance: 1000,
      openingDate: "2026-10-18",
      minimumBalance: 0,
      ledgerCode: "1.1.1.01",
      active: true,
    });
    const payment = settleTitle(
      finance,
      finance.titles[0].id,
      { accountId: "bank-return", date: "2026-10-18", method: "PIX" },
      "Operador",
    );
    expect(payment.error).toBeUndefined();
    await saveFinanceState(
      db,
      "tenant-a",
      principal.id,
      payment.state,
      finance.persistenceVersion!,
      "return-test-payment",
      "hash-payment",
    );
    const paidOperation = (await loadOperationSnapshot(db, "tenant-a", operation.id))!;
    await returnReleasedOperation(db, principal, {
      ...command(operation.id, paidOperation.persistenceVersion!),
      cashMoved,
    });
    const after = (await loadFinanceState(db, "tenant-a"))!;
    expect(accountBalance(after, "bank-return")).toBe(cashMoved ? 100 : 1000);
    const recoveries = after.titles.filter(title => title.origin === "Recuperação de pagamento");
    expect(recoveries).toHaveLength(cashMoved ? 1 : 0);
    if (cashMoved) expect(recoveries[0]).toMatchObject({ amount: 900, status: "Em aberto", kind: "Receber" });
    expect(after.titles.find(title => title.origin === "Liberação de operação")?.status).toBe("Cancelado");
  },
);

it("não confunde desconto contratual de origem com recebimento posterior do ativo", async () => {
  const db = new BankingDatabase(),
    operation = releasedOperation();
  operation.manualEntry!.entries[0].discount = 50;
  const saved = (await saveOperation(db, "tenant-a", principal.id, operation, 0))!;
  const returned = await returnReleasedOperation(db, principal, command(saved.id, saved.persistenceVersion!));
  expect(returned.operation.stage).toBe(3);
  expect((await loadCurrentPortfolio(db, "tenant-a")).titles[0].status).toBe("Cancelado");
});

it("conflito de chave ou devoluções concorrentes não repete estorno", async () => {
  const { db, operation } = await fixture(),
    input = command(operation.id, operation.persistenceVersion!);
  const outcomes = await Promise.allSettled([
    returnReleasedOperation(db, principal, input),
    returnReleasedOperation(db, principal, { ...input, commandId: "return-operation-0002" }),
  ]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const winner = outcomes.find(result => result.status === "fulfilled");
  if (!winner) throw new Error("Nenhuma devolução foi confirmada.");
  const winningInput = { ...input, commandId: winner.value.commandId };
  expect((await returnReleasedOperation(db, principal, winningInput)).commandId).toBe(winner.value.commandId);
  await expect(returnReleasedOperation(db, principal, { ...winningInput, reason: "Outro conteúdo" })).rejects.toThrow(
    /chave/i,
  );
  expect((await loadFinanceState(db, "tenant-a"))!.journal).toHaveLength(2);
});
