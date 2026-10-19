import { describe, expect, it } from "vitest";
import { OperationalDatabase } from "./helpers/operational-database";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { executeReceivableCommand } from "@/src/server/portfolio/financial-commands";
import type { ServerPrincipal } from "@/src/server/access/repository";

const principal = {
  id: "actor",
  name: "Tesouraria",
  tenantId: "tenant-a",
  companyScopes: ["*"],
  permissions: ["finance:release"],
} as ServerPrincipal;
function fixture() {
  const db = new OperationalDatabase();
  const finance = openingEntries(emptyState("2026-10-18"));
  const portfolio = seedPortfolio(initialOperations);
  const title = portfolio.titles[0];
  Object.assign(title, {
    company: finance.accounts[0].company,
    originalAmount: 1000,
    openAmount: 1000,
    paidAmount: 0,
    discountAmount: 0,
    repurchasedAmount: 0,
    abatementAmount: 0,
    payments: [],
    status: "Em aberto",
  });
  portfolio.titles = [title];
  db.finance.set("tenant-a", { payload: finance, aggregate_version: 1 });
  db.portfolios.set("tenant-a", { payload: portfolio, aggregate_version: 1 });
  const command = {
    action: "settle",
    titleId: title.id,
    commandId: "settlement-command",
    expectedFinanceVersion: 1,
    expectedPortfolioVersion: 1,
    accountId: finance.accounts[0].id,
    date: "2026-10-18",
    principal: 400,
    interest: 20,
    discount: 10,
    method: "Manual",
  };
  return { db, command };
}
describe("comando de liquidação no servidor", () => {
  it("persiste caixa e carteira e repete sem duplicar o recebimento", async () => {
    const { db, command } = fixture();
    const saved = await executeReceivableCommand(db, principal, command);
    expect(saved.portfolio.titles[0].openAmount).toBe(600);
    expect(saved.finance.movements).toHaveLength(1);
    const replay = await executeReceivableCommand(db, principal, command);
    expect(replay.replayed).toBe(true);
    expect(replay.finance.movements).toHaveLength(1);
  });
  it("desfaz toda a transação se a Carteira não puder ser gravada", async () => {
    const { db, command } = fixture();
    db.failPortfolio = true;
    await expect(executeReceivableCommand(db, principal, command)).rejects.toThrow("Falha simulada");
    expect(db.finance.get("tenant-a")?.aggregate_version).toBe(1);
    expect(db.finance.get("tenant-a")?.payload.movements).toHaveLength(0);
    expect(db.commands.size).toBe(0);
  });
  it("aceita apenas um de dois recebimentos concorrentes com a mesma versão", async () => {
    const { db, command } = fixture();
    const results = await Promise.allSettled([
      executeReceivableCommand(db, principal, command),
      executeReceivableCommand(db, principal, { ...command, commandId: "settlement-other" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(db.finance.get("tenant-a")?.payload.movements).toHaveLength(1);
  });
  it("nega outra empresa e versão antiga sem efeitos", async () => {
    const { db, command } = fixture();
    await expect(
      executeReceivableCommand(db, { ...principal, companyScopes: ["Outra empresa"] }, command),
    ).rejects.toThrow("escopo");
    await expect(executeReceivableCommand(db, principal, { ...command, expectedFinanceVersion: 0 })).rejects.toThrow(
      "alterados",
    );
    expect(db.commands.size).toBe(0);
  });
});
