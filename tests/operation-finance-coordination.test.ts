/** Exercita operação, recebíveis e financeiro na mesma transação de aplicação, sem navegador ou banco remoto. */
import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { Operation } from "@/src/domain/core/types";
import { saveOperation } from "@/src/server/operations/repository";
import { loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { settleTitle, reverseSettlement } from "@/src/domain/finance/titles";
import { loadOperationSnapshot } from "@/src/server/operations/repository";
import { OperationalDatabase } from "./helpers/operational-database";

function releasedOperation(): Operation {
  const source = structuredClone(initialOperations.find(operation => operation.manualEntry?.entries.length)!);
  const entry = {
    ...source.manualEntry!.entries[0],
    id: "entry-test",
    amount: 1000,
    nfeKey: "",
    dueDate: "2026-11-18",
  };
  return {
    ...source,
    id: "op-test",
    vehicle: "Empresa A",
    institution: "Securitizadora",
    amount: 1000,
    netAmount: 900,
    titleCount: 1,
    stage: 6,
    status: "Liberada ao financeiro",
    pricingReview: undefined,
    riskReview: undefined,
    manualEntry: { ...source.manualEntry!, entries: [entry] },
    releaseReview: {
      status: "Enviada ao financeiro",
      releasedAt: "2026-10-18T12:00:00.000Z",
      approvedById: "checker",
      preparedById: "maker",
      payables: [
        {
          id: "CP-TEST",
          payee: source.cedent,
          document: source.document,
          method: "PIX",
          destination: "Chave homologação",
          amount: 900,
          dueDate: "2026-10-18",
          payingAccount: "Conta teste",
          status: "Pendente de pagamento",
          createdAt: "2026-10-18T12:00:00.000Z",
        },
      ],
      audit: [],
    },
  };
}

describe("coordenação financeira no servidor", () => {
  it("grava compra e obrigação financeira ao salvar uma liberação, sem depender da interface", async () => {
    const db = new OperationalDatabase();
    await saveOperation(db, "tenant-a", "checker", releasedOperation(), 0);
    const finance = await loadFinanceState(db, "tenant-a");

    expect(finance?.titles).toHaveLength(1);
    expect(finance?.titles[0]).toMatchObject({
      operationId: "op-test",
      amount: 900,
      status: "Em aberto",
      company: "Empresa A",
    });
    expect(finance?.journal).toHaveLength(1);
    expect(db.receivables.size).toBe(1);
  });

  it("reverte operação, recebíveis e eventos se a gravação financeira falhar", async () => {
    const db = new OperationalDatabase();
    db.failFinance = true;
    await expect(saveOperation(db, "tenant-a", "checker", releasedOperation(), 0)).rejects.toThrow("Falha simulada");
    expect(db.operations.size).toBe(0);
    expect(db.receivables.size).toBe(0);
    expect(db.finance.size).toBe(0);
    expect(db.events).toEqual([]);
  });

  it("não duplica obrigações ao salvar novamente a operação liberada", async () => {
    const db = new OperationalDatabase();
    const saved = await saveOperation(db, "tenant-a", "checker", releasedOperation(), 0);
    await saveOperation(db, "tenant-a", "checker", saved!, 1);
    const finance = await loadFinanceState(db, "tenant-a");
    expect(finance?.titles).toHaveLength(1);
    expect(finance?.journal).toHaveLength(1);
    expect(finance?.persistenceVersion).toBe(1);
  });

  it("pagamento e estorno atualizam os favorecidos dentro da gravação financeira", async () => {
    const db = new OperationalDatabase();
    await saveOperation(db, "tenant-a", "checker", releasedOperation(), 0);
    const finance = (await loadFinanceState(db, "tenant-a"))!;
    expect(finance).not.toBeNull();
    finance.accounts.push({
      id: "bank-a",
      company: "Empresa A",
      bankCode: "001",
      bankName: "Banco",
      agency: "1",
      account: "1",
      type: "Conta movimento",
      nickname: "Teste",
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
      { accountId: "bank-a", date: "2026-10-18", method: "PIX" },
      "Pagador",
    );
    expect(payment.error).toBeUndefined();
    const paid = await saveFinanceState(db, "tenant-a", "payer", payment.state, 1, "payment-1", "payment-hash");
    expect((await loadOperationSnapshot(db, "tenant-a", "op-test"))?.releaseReview?.payables?.[0].status).toBe("Pago");

    const reversal = reverseSettlement(
      paid!,
      paid!.titles[0].id,
      { cashMoved: false, reason: "Registro incorreto" },
      "Pagador",
    );
    expect(reversal.error).toBeUndefined();
    await saveFinanceState(db, "tenant-a", "payer", reversal.state, 2, "reversal-1", "reversal-hash");
    const operation = await loadOperationSnapshot(db, "tenant-a", "op-test");
    expect(operation?.releaseReview?.payables?.[0].status).toBe("Pendente de pagamento");
    expect(operation?.releaseReview?.audit?.map(event => event.by)).toEqual(["payer", "payer"]);
  });
});
