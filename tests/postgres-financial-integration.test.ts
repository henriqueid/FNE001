/** Executado somente por scripts/test-postgres-isolated.mjs em cluster novo e descartável. */
import { beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/src/server/database/postgres";
import { saveOperation } from "@/src/server/operations/repository";
import { financeRequestHash, loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { executeReceivableCommand } from "@/src/server/portfolio/financial-commands";
import { saveAccount } from "@/src/domain/finance/banking";
import { seedAccounts } from "@/src/domain/finance/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { ServerPrincipal } from "@/src/server/access/repository";

const isolated = process.env.STRATO_TEST_DATABASE_URL;
const actor = "user-henrique-admin";
describe.skipIf(!isolated)("coordenação em PostgreSQL isolado", () => {
  beforeAll(() => {
    const url = new URL(isolated!);
    if (url.hostname !== "127.0.0.1" || url.port === "5432" || process.env.DATABASE_URL !== isolated)
      throw new Error("Teste permitido somente em cluster local descartável com porta própria.");
  });
  async function fixture() {
    const db = getDatabase();
    const tenantId = `qa-${crypto.randomUUID()}`;
    await db
      .prepare(
        "insert into private.tenants(tenant_id, legal_name, display_name) values (?, 'QA isolado', 'QA isolado')",
      )
      .bind(tenantId)
      .run();
    const operation = structuredClone(initialOperations.find(item => item.manualEntry?.entries.length)!);
    Object.assign(operation, {
      id: `op-${crypto.randomUUID()}`,
      vehicle: "Empresa QA",
      institution: "Securitizadora",
      stage: 6,
      status: "Liberada ao financeiro",
      amount: 1000,
      netAmount: 900,
      titleCount: 1,
      pricingReview: undefined,
      manualEntry: {
        ...operation.manualEntry!,
        entries: [
          {
            ...operation.manualEntry!.entries[0],
            id: "entry-qa",
            amount: 1000,
            discount: 0,
            nfeKey: "",
            dueDate: "2026-11-18",
          },
        ],
      },
      releaseReview: {
        status: "Enviada ao financeiro",
        releasedAt: "2026-10-18T12:00:00Z",
        approvedById: actor,
        preparedById: actor,
        payables: [
          {
            id: "CP-QA",
            payee: operation.cedent,
            document: operation.document,
            method: "PIX",
            destination: "QA",
            amount: 900,
            dueDate: "2026-10-18",
            payingAccount: "QA",
            status: "Pendente de pagamento",
            createdAt: "2026-10-18T12:00:00Z",
          },
        ],
        audit: [],
      },
    });
    const saved = await saveOperation(db, tenantId, actor, operation, 0);
    expect(saved).toBeTruthy();
    const finance = (await loadFinanceState(db, tenantId))!;
    const candidate = saveAccount(finance, {
      ...seedAccounts("2026-10-18")[0],
      company: operation.vehicle,
      openingBalance: 0,
    });
    expect(candidate.error).toBeUndefined();
    const hash = await financeRequestHash({
      tenantId,
      actorId: actor,
      expectedVersion: finance.persistenceVersion!,
      state: candidate.state,
    });
    const withBank = (await saveFinanceState(
      db,
      tenantId,
      actor,
      candidate.state,
      finance.persistenceVersion!,
      crypto.randomUUID(),
      hash,
    ))!;
    const portfolio = await loadCurrentPortfolio(db, tenantId);
    const principal = {
      id: actor,
      name: "QA",
      tenantId,
      companyScopes: ["*"],
      permissions: ["finance:release"],
    } as ServerPrincipal;
    const command = {
      action: "settle",
      titleId: portfolio.titles[0].id,
      commandId: crypto.randomUUID(),
      expectedFinanceVersion: withBank.persistenceVersion!,
      expectedPortfolioVersion: portfolio.persistenceVersion!,
      date: "2026-10-18",
      accountId: withBank.accounts[0].id,
      principal: 400,
      interest: 20,
      discount: 10,
      method: "Manual QA",
    };
    return { db, tenantId, principal, command };
  }
  it("liberação, baixa, replay e estorno preservam projeções e eventos reais", async () => {
    const { db, tenantId, principal, command } = await fixture();
    const saved = await executeReceivableCommand(db, principal, command);
    expect(saved.portfolio.titles[0].openAmount).toBe(600);
    const replay = await executeReceivableCommand(db, principal, command);
    expect(replay.replayed).toBe(true);
    expect(replay.finance.movements).toHaveLength(1);
    const reversed = await executeReceivableCommand(db, principal, {
      action: "reverse",
      titleId: command.titleId,
      commandId: crypto.randomUUID(),
      expectedFinanceVersion: saved.finance.persistenceVersion!,
      expectedPortfolioVersion: saved.portfolio.persistenceVersion!,
      date: "2026-10-18",
      paymentId: command.commandId,
      reason: "QA de estorno",
      cashMoved: false,
    });
    expect(reversed.portfolio.titles[0].openAmount).toBe(1000);
    const count = await db
      .prepare("select count(*)::integer as total from private.finance_journal_entries where tenant_id = ?")
      .bind(tenantId)
      .first<{ total: number }>();
    expect(count!.total).toBe(reversed.finance.journal.length);
  });
  it("conexões concorrentes aceitam uma única baixa para a mesma versão", async () => {
    const { db, principal, command } = await fixture();
    const result = await Promise.allSettled([
      executeReceivableCommand(db, principal, command),
      executeReceivableCommand(db, principal, { ...command, commandId: crypto.randomUUID() }),
    ]);
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect((await loadFinanceState(db, principal.tenantId))!.movements).toHaveLength(1);
  });
  it("falha de restrição na Carteira desfaz caixa, comandos e projeções já enviados ao PostgreSQL", async () => {
    const { db, tenantId, principal, command } = await fixture();
    if (!/^qa-[0-9a-f-]+$/.test(tenantId)) throw new Error("Identificador de fixture inválido.");
    await db.exec(
      `alter table private.portfolio_states add constraint qa_rollback_guard check (tenant_id <> '${tenantId}')`,
    );
    try {
      await expect(executeReceivableCommand(db, principal, command)).rejects.toThrow("qa_rollback_guard");
      const current = (await loadFinanceState(db, tenantId))!;
      expect(current.persistenceVersion).toBe(command.expectedFinanceVersion);
      expect(current.movements).toHaveLength(0);
      const commands = await db
        .prepare(
          "select count(*)::integer as total from private.finance_commands where tenant_id = ? and command_id = ?",
        )
        .bind(tenantId, `receivable:${command.commandId}`)
        .first<{ total: number }>();
      expect(commands!.total).toBe(0);
      const movements = await db
        .prepare("select count(*)::integer as total from private.finance_movements where tenant_id = ?")
        .bind(tenantId)
        .first<{ total: number }>();
      expect(movements!.total).toBe(0);
    } finally {
      await db.exec("alter table private.portfolio_states drop constraint qa_rollback_guard");
    }
  });
});
