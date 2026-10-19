/** PostgreSQL real descartável: comandos bancários, devolução, rollback e ponteiro de reaquisição. */
import { beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/src/server/database/postgres";
import { saveOperation, loadOperationSnapshot } from "@/src/server/operations/repository";
import { returnReleasedOperation } from "@/src/server/operations/return";
import { executeBankingCommand } from "@/src/server/banking/service";
import { financeRequestHash, loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { saveRegistryParty } from "@/src/server/registry/repository";
import { emptyParty } from "@/src/domain/registry/parties";
import { saveAccount, accountBalance } from "@/src/domain/finance/banking";
import { seedAccounts } from "@/src/domain/finance/model";
import { releasedOperation } from "./operation-return-fixture";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

const isolated = process.env.STRATO_TEST_DATABASE_URL,
  actor = "user-henrique-admin",
  today = new Date().toISOString().slice(0, 10);
const wireDate = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(2, 4);
function originalReturn(bank: "341" | "237", documentNumber: string, dueOn: string) {
  const fresh = () => Array<string>(400).fill(" "),
    put = (row: string[], start: number, value: string) => {
      for (let i = 0; i < value.length; i++) row[start - 1 + i] = value[i];
    };
  const h = fresh(),
    d = fresh(),
    t = fresh();
  put(h, 1, "02RETORNO01COBRANCA       ");
  put(h, 77, bank);
  put(h, 95, wireDate(today));
  put(h, 109, "00042");
  put(h, 395, "000001");
  put(d, 1, "10211222333000181");
  put(d, 109, "06");
  put(d, 111, wireDate(today));
  put(d, 117, documentNumber);
  put(d, 147, wireDate(dueOn));
  for (const start of [153, 176, 189, 202, 215, 228, 241, 254, 267, 280]) put(d, start, "0000000000000");
  put(d, 153, "0000000100000");
  put(d, 254, "0000000100000");
  put(d, 296, wireDate(today));
  put(d, 395, "000002");
  if (bank === "341") {
    put(h, 27, "123400123456");
    put(d, 18, "123400123456");
    put(d, 38, "T00000002");
    put(d, 63, "00000002");
    put(d, 83, "109000000020");
    put(d, 108, "I");
    put(d, 127, "00000002");
    put(d, 378, "00000000");
  } else {
    put(h, 27, "00000000000123456789");
    put(d, 18, "00000190123412345678");
    put(d, 38, "T00000000002");
    put(d, 63, "00000000000000000028");
    put(d, 83, "0000000000000000000000");
    put(d, 105, "0009");
    put(d, 127, "000000000028");
    put(d, 319, "0000000000");
  }
  put(t, 1, `9201${bank}`);
  put(t, 395, "000003");
  return [h, d, t].map(row => row.join("")).join("\r\n") + "\r\n" + (bank === "237" ? "\x1a" : "");
}
async function count(db: DecisionDatabase, tenantId: string, table: string) {
  if (!["domain_events", "finance_movements", "finance_journal_entries"].includes(table))
    throw new Error("Tabela QA não permitida.");
  return (await db
    .prepare(`select count(*)::integer as total from private.${table} where tenant_id = ?`)
    .bind(tenantId)
    .first<{ total: number }>())!.total;
}
describe.skipIf(!isolated)("CNAB e devolução em PostgreSQL descartável", () => {
  beforeAll(() => {
    const url = new URL(isolated!);
    if (url.hostname !== "127.0.0.1" || url.port === "5432" || process.env.DATABASE_URL !== isolated)
      throw new Error("Somente cluster novo local com porta dedicada.");
  });
  async function fixture(bank: "341" | "237" = "341", bankIssued = false) {
    const db = getDatabase(),
      tenantId = `qa-bank-${crypto.randomUUID()}`;
    await db
      .prepare("insert into private.tenants(tenant_id,legal_name,display_name) values (?,'QA arquivos','QA arquivos')")
      .bind(tenantId)
      .run();
    const operation = releasedOperation();
    operation.id = `op-${crypto.randomUUID()}`;
    operation.document = "52927676000129";
    operation.cedent = "Cedente QA";
    const dueOn = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      entry = operation.manualEntry!.entries[0];
    Object.assign(entry, {
      documentNumber: "DOC-QA",
      debtorDocument: "52998224725",
      debtorName: "Sacado QA",
      issueDate: today,
      dueDate: dueOn,
      ourNumber: undefined,
      bank: undefined,
    });
    operation.releaseReview!.releasedAt = `${today}T00:00:00Z`;
    operation.releaseReview!.payables![0].dueDate = today;
    operation.releaseReview!.payables![0].document = operation.document;
    operation.releaseReview!.payables![0].payee = operation.cedent;
    operation.releaseReview!.approvedById = actor;
    operation.releaseReview!.preparedById = actor;
    const saved = (await saveOperation(db, tenantId, actor, operation, 0))!;
    const address = {
      zipCode: "01001000",
      street: "Rua Um",
      number: "123",
      complement: "",
      district: "Centro",
      city: "Sao Paulo",
      state: "SP",
    };
    await saveRegistryParty(db, tenantId, actor, {
      ...emptyParty("sacado"),
      id: crypto.randomUUID(),
      kind: "PF",
      document: "52998224725",
      name: "Sacado QA",
      email: "sacado@example.test",
      address,
    });
    await saveRegistryParty(db, tenantId, actor, {
      ...emptyParty("cedente"),
      id: crypto.randomUUID(),
      kind: "PJ",
      document: "52927676000129",
      name: "Cedente QA",
      address,
    });
    const finance = (await loadFinanceState(db, tenantId))!;
    const configured = saveAccount(finance, {
      ...seedAccounts(today)[0],
      company: operation.vehicle,
      bankCode: bank,
      bankName: bank === "341" ? "Itaú" : "Bradesco",
      agency: "1234",
      account: bank === "341" ? "12345" : "1234567",
      openingBalance: 1000,
      openingDate: today,
      usage: { payments: true, receipts: true, collection: true },
      collection: {
        agreement: bank === "341" ? "" : "123456789",
        wallet: bank === "341" ? (bankIssued ? "112" : "109") : "19",
        layout: "CNAB 400",
        nextOurNumber: bankIssued ? 0 : 2,
        accountDigit: bank === "341" ? "6" : "8",
        beneficiaryDocument: "11222333000181",
        beneficiaryName: "Beneficiario QA",
        nextRemittanceSequence: 1,
        dailyInterestCents: bankIssued ? undefined : 0,
        monthlyInterestPercent: bankIssued ? 8 : undefined,
        lateFinePercent: bankIssued ? 2 : undefined,
        lateFineDaysAfterDue: bankIssued ? 1 : undefined,
        sendPayerEmail: bankIssued,
        finalBeneficiaryEnabled: true,
      },
    });
    expect(configured.error).toBeUndefined();
    const requestHash = await financeRequestHash({
      tenantId,
      actorId: actor,
      expectedVersion: finance.persistenceVersion!,
      state: configured.state,
    });
    const withBank = (await saveFinanceState(
      db,
      tenantId,
      actor,
      configured.state,
      finance.persistenceVersion!,
      crypto.randomUUID(),
      requestHash,
    ))!;
    const principal = {
      id: actor,
      name: "QA bancário",
      tenantId,
      permissions: ["finance:release"],
      companyScopes: [operation.vehicle],
    } as ServerPrincipal;
    const portfolio = await loadCurrentPortfolio(db, tenantId);
    return {
      db,
      tenantId,
      principal,
      operation: saved,
      accountId: withBank.accounts[0].id,
      titleId: portfolio.titles[0].id,
      dueOn,
    };
  }
  it.each(["341", "237"] as const)("%s: reserva remessa, recupera bytes e impede duplo caixa com alias", async bank => {
    const f = await fixture(bank),
      { db, tenantId, principal, accountId, titleId } = f;
    const remit = { action: "remittance" as const, accountId, titleIds: [titleId], commandId: crypto.randomUUID() };
    const generated = await executeBankingCommand(db, principal, remit),
      replay = await executeBankingCommand(db, principal, remit);
    expect(replay.content).toBe(generated.content);
    const lines = generated.content!.replaceAll("\x1a", "").slice(0, -2).split("\r\n");
    expect(lines.map(line => line[0])).toEqual(bank === "341" ? ["0", "1", "5", "9"] : ["0", "1", "7", "9"]);
    const finance = (await loadFinanceState(db, tenantId))!,
      before = accountBalance(finance, accountId);
    expect(finance.accounts[0].collection).toMatchObject({ nextOurNumber: 3, nextRemittanceSequence: 2 });
    const original = originalReturn(bank, "DOC-QA", f.dueOn);
    const result = await executeBankingCommand(db, principal, {
      action: "return",
      accountId,
      commandId: crypto.randomUUID(),
      content: original,
    });
    const alias = await executeBankingCommand(db, principal, {
      action: "return",
      accountId,
      commandId: crypto.randomUUID(),
      content: original.slice(0, 108) + "00043" + original.slice(113),
    });
    expect(result.processed).toBe(1);
    expect(alias.repeated).toBe(1);
    expect(await count(db, tenantId, "finance_movements")).toBe(1);
    expect(accountBalance((await loadFinanceState(db, tenantId))!, accountId)).toBe(before + 1000);
    expect((await loadCurrentPortfolio(db, tenantId)).titles[0]).toMatchObject({ status: "Pago", openAmount: 0 });
    const rows = await db
      .prepare(
        "select aggregate_type,count(*)::integer as total from private.domain_events where tenant_id = ? and aggregate_type in ('BankRemittance','BankReturn') group by aggregate_type",
      )
      .bind(tenantId)
      .all<{ aggregate_type: string; total: number }>();
    expect(Object.fromEntries(rows.results.map(row => [row.aggregate_type, row.total]))).toEqual({
      BankRemittance: 1,
      BankReturn: 1,
    });
  });
  it("Itaú112: confirma número bancário, liquida uma vez e preserva contador local", async () => {
    const f = await fixture("341", true),
      { db, tenantId, principal, accountId, titleId } = f;
    const request = { action: "remittance" as const, accountId, titleIds: [titleId], commandId: crypto.randomUUID() };
    const generated = await executeBankingCommand(db, principal, request);
    expect((await executeBankingCommand(db, principal, request)).content).toBe(generated.content);
    const detail = generated.content!.split("\r\n").find(row => row[0] === "1")!;
    expect(detail.slice(62, 70)).toBe("00000000");
    expect((await loadCurrentPortfolio(db, tenantId)).titles[0].ourNumber).toBeUndefined();
    const makeReturn = (occurrence: "02" | "06") => {
      let content = originalReturn("341", "DOC-QA", f.dueOn);
      const put = (position: number, value: string) => {
        const start = 402 + position - 1;
        content = content.slice(0, start) + value + content.slice(start + value.length);
      };
      put(38, detail.slice(37, 62));
      put(63, "12345678");
      put(83, "112123456780");
      put(127, "12345678");
      put(109, occurrence);
      if (occurrence === "02") {
        put(254, "0000000000000");
        put(296, "000000");
      }
      return content;
    };
    const submit = (content: string) =>
      executeBankingCommand(db, principal, { action: "return", accountId, commandId: crypto.randomUUID(), content });
    await expect(submit(makeReturn("06"))).rejects.toThrow(/confirm|número/i);
    await submit(makeReturn("02"));
    expect((await loadCurrentPortfolio(db, tenantId)).titles[0]).toMatchObject({
      ourNumber: "12345678",
      bankStatus: "Registrado",
    });
    await submit(makeReturn("06"));
    expect((await submit(makeReturn("06").slice(0, 108) + "00043" + makeReturn("06").slice(113))).repeated).toBe(1);
    await submit(makeReturn("02"));
    expect((await loadCurrentPortfolio(db, tenantId)).titles[0]).toMatchObject({
      ourNumber: "12345678",
      bankStatus: "Liquidado",
      status: "Pago",
    });
    expect(await count(db, tenantId, "finance_movements")).toBe(1);
    expect((await loadFinanceState(db, tenantId))!.accounts[0].collection).toMatchObject({
      nextOurNumber: 0,
      nextRemittanceSequence: 2,
    });
  });
  it("devolução preserva compras antigas e reaquisição atualiza ponteiro da projeção", async () => {
    const { db, tenantId, principal, operation } = await fixture();
    const input = {
      operationId: operation.id,
      expectedVersion: operation.persistenceVersion!,
      targetStage: 3,
      reason: "QA devolução",
      cashMoved: false,
      date: today,
      commandId: crypto.randomUUID(),
    };
    const returned = await returnReleasedOperation(db, principal, input),
      again = await returnReleasedOperation(db, principal, input);
    expect(again).toEqual(returned);
    const purchase = returned.purchaseEntryId,
      afterReturn = (await loadFinanceState(db, tenantId))!;
    expect(afterReturn.purchasePosted[operation.id]).toBe(purchase);
    expect(afterReturn.journal.find(entry => entry.id === purchase)?.reversedBy).toBeTruthy();
    const next = {
      ...operation,
      persistenceVersion: returned.operation.persistenceVersion,
      releaseReview: {
        ...operation.releaseReview!,
        payables: operation.releaseReview!.payables!.map(payable => ({
          ...payable,
          id: `new-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        })),
      },
    };
    await saveOperation(db, tenantId, actor, next, returned.operation.persistenceVersion!);
    const finance = (await loadFinanceState(db, tenantId))!,
      projection = await db
        .prepare(
          "select journal_entry_id from private.finance_purchase_postings where tenant_id = ? and operation_id = ?",
        )
        .bind(tenantId, operation.id)
        .first<{ journal_entry_id: string }>();
    expect(finance.purchasePosted[operation.id]).not.toBe(purchase);
    expect(projection!.journal_entry_id).toBe(finance.purchasePosted[operation.id]);
    const old = await db
      .prepare("select reversed_by from private.finance_journal_entries where tenant_id = ? and journal_entry_id = ?")
      .bind(tenantId, purchase)
      .first<{ reversed_by: string }>();
    expect(old!.reversed_by).toBeTruthy();
    expect((await loadCurrentPortfolio(db, tenantId)).titles[0].status).toBe("Em aberto");
  });
  it("falha PostgreSQL após reserva de remessa desfaz sequência, vínculo e eventos", async () => {
    const { db, tenantId, principal, accountId, titleId } = await fixture();
    if (!/^qa-bank-[0-9a-f-]+$/.test(tenantId)) throw new Error("Fixture inválida");
    await db.exec(
      `alter table private.portfolio_states add constraint qa_bank_rollback_guard check (tenant_id <> '${tenantId}')`,
    );
    try {
      const before = (await loadFinanceState(db, tenantId))!,
        eventCount = await count(db, tenantId, "domain_events");
      await expect(
        executeBankingCommand(db, principal, {
          action: "remittance",
          accountId,
          titleIds: [titleId],
          commandId: crypto.randomUUID(),
        }),
      ).rejects.toThrow("qa_bank_rollback_guard");
      const after = (await loadFinanceState(db, tenantId))!;
      expect(after.persistenceVersion).toBe(before.persistenceVersion);
      expect(after.accounts[0].collection?.nextOurNumber).toBe(2);
      expect(await count(db, tenantId, "domain_events")).toBe(eventCount);
      expect((await loadCurrentPortfolio(db, tenantId)).titles[0].ourNumber).toBeFalsy();
    } finally {
      await db.exec("alter table private.portfolio_states drop constraint qa_bank_rollback_guard");
    }
  });
  it("falha PostgreSQL na carteira impede devolução financeira parcial", async () => {
    const { db, tenantId, principal, operation } = await fixture();
    if (!/^qa-bank-[0-9a-f-]+$/.test(tenantId)) throw new Error("Fixture inválida");
    await db.exec(
      `alter table private.portfolio_states add constraint qa_return_rollback_guard check (tenant_id <> '${tenantId}')`,
    );
    try {
      const before = (await loadFinanceState(db, tenantId))!,
        events = await count(db, tenantId, "domain_events");
      await expect(
        returnReleasedOperation(db, principal, {
          operationId: operation.id,
          expectedVersion: operation.persistenceVersion!,
          targetStage: 3,
          reason: "QA rollback",
          cashMoved: false,
          date: today,
          commandId: crypto.randomUUID(),
        }),
      ).rejects.toThrow("qa_return_rollback_guard");
      expect((await loadFinanceState(db, tenantId))!.journal).toEqual(before.journal);
      expect((await loadOperationSnapshot(db, tenantId, operation.id))!.status).toBe("Liberada ao financeiro");
      expect(await count(db, tenantId, "domain_events")).toBe(events);
    } finally {
      await db.exec("alter table private.portfolio_states drop constraint qa_return_rollback_guard");
    }
  });
});
