/** Comissões gravam obrigação e fechamento juntos; retries e concorrência não duplicam pagamentos. */
import { afterEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), database: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async importOriginal => ({
  ...(await importOriginal<object>()),
  getDatabase: boundary.database,
}));
import { POST } from "@/app/api/commercial/commissions/route";
afterEach(() => vi.clearAllMocks());
import { emptyState, openingEntries } from "@/src/domain/finance/ledger";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { closeCommission } from "@/src/domain/commercial/actions";
import { prepareCommissionTransfer } from "@/src/domain/commercial/finance-transfer";
import { executeCommissionCommand } from "@/src/server/commercial/commission-command";
import { loadCommercialState } from "@/src/server/commercial/repository";
import { loadFinanceState } from "@/src/server/finance/repository";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { OperationalDatabase } from "./helpers/operational-database";

const principal: ServerPrincipal = {
  id: "finance-admin",
  name: "Ator real",
  role: "Admin",
  department: "Financeiro",
  functionalAreas: [],
  access: "admin",
  status: "active",
  tenantId: "tenant-a",
  permissions: ["portfolio:manage", "finance:release"],
  authorityIds: [],
  companyScopes: ["*"],
};
const command = { month: "2026-09", expectedCommercialVersion: 1, expectedFinanceVersion: 1 };
function fixture() {
  const db = new OperationalDatabase();
  const finance = openingEntries(emptyState("2026-01-01"));
  const commercial = seedCommercial("2026-10-25");
  const closed = closeCommission(commercial, commercial.deals, "2026-09", "Gestor").state;
  closed.closings["2026-09"].lines = [
    {
      repId: closed.reps[0].id,
      base: 1000,
      goal: 1000,
      attainment: 100,
      rate: 10,
      commission: 100,
      bonus: 0,
      bonusAccounts: [],
      clawback: 0,
      total: 100,
      deals: 1,
    },
  ];
  closed.reps[0].company = finance.accounts[0].company;
  db.finance.set("tenant-a", { payload: finance, aggregate_version: 1 });
  db.commercial.set("tenant-a", { payload: closed, aggregate_version: 1 });
  return { db, finance, commercial: closed };
}

describe("envio transacional de comissões", () => {
  it("grava um título por representante com valor e autoria do servidor", async () => {
    const { db } = fixture();
    const result = await executeCommissionCommand(db, principal, command);
    expect(result.finance.titles).toHaveLength(1);
    expect(result.finance.titles[0]).toMatchObject({ amount: 100, counterparty: result.commercial.reps[0].name });
    expect(result.finance.titles[0].history[0].by).toBe("finance-admin");
    expect(result.commercial.closings["2026-09"]).toMatchObject({
      status: "Enviada ao financeiro",
      financeTitles: [result.finance.titles[0].id],
    });
    expect(result.replayed).toBe(false);
  });
  it("falha comercial desfaz financeiro e retry completa sem duplicata", async () => {
    const { db } = fixture();
    db.failCommercial = true;
    await expect(executeCommissionCommand(db, principal, command)).rejects.toThrow("Falha simulada");
    expect((await loadFinanceState(db, "tenant-a"))?.titles).toHaveLength(0);
    expect(db.commands.size).toBe(0);
    expect(db.events).toEqual([]);
    db.failCommercial = false;
    await executeCommissionCommand(db, principal, command);
    expect((await loadFinanceState(db, "tenant-a"))?.titles).toHaveLength(1);
  });
  it("repetição concorrente ou após perda de resposta devolve posição sem novas obrigações", async () => {
    const { db } = fixture();
    const results = await Promise.all([
      executeCommissionCommand(db, principal, command),
      executeCommissionCommand(db, principal, command),
    ]);
    expect(results.map(result => result.replayed)).toEqual([false, true]);
    const again = await executeCommissionCommand(db, principal, {
      ...command,
      expectedFinanceVersion: 2,
      expectedCommercialVersion: 2,
    });
    expect(again.replayed).toBe(true);
    expect(again.finance.titles).toHaveLength(1);
    expect(again.finance.journal.filter(entry => entry.origin.type === "Título")).toHaveLength(1);
    expect((await loadCommercialState(db, "tenant-a"))?.persistenceVersion).toBe(2);
  });
  it("bloqueia escopo, permissão, versões antigas e payload financeiro forjado", async () => {
    const { db } = fixture();
    await expect(
      executeCommissionCommand(db, { ...principal, companyScopes: ["Outra"] }, command),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      executeCommissionCommand(db, { ...principal, permissions: ["portfolio:manage"] }, command),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      executeCommissionCommand(db, principal, { ...command, expectedFinanceVersion: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      executeCommissionCommand(db, principal, { ...command, finance: { titles: [] } }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await loadFinanceState(db, "tenant-a"))?.titles).toHaveLength(0);
  });
  it("demo repete envio sem duplicar e recusa representantes duplicados", () => {
    const { finance, commercial } = fixture();
    const first = prepareCommissionTransfer(finance, commercial, "2026-09", "2026-10-25", "Demo");
    const second = prepareCommissionTransfer(first.finance, first.commercial, "2026-09", "2026-10-25", "Demo");
    expect(second.finance.titles).toHaveLength(1);
    commercial.closings["2026-09"].lines.push(commercial.closings["2026-09"].lines[0]);
    expect(() => prepareCommissionTransfer(finance, commercial, "2026-09", "2026-10-25", "Demo")).toThrow(/duplicad/i);
  });
});

describe("limites do comando de comissão", () => {
  it("não alcança agregado de outro tenant", async () => {
    const { db } = fixture();
    await expect(executeCommissionCommand(db, { ...principal, tenantId: "tenant-b" }, command)).rejects.toMatchObject({
      status: 409,
    });
    expect((await loadFinanceState(db, "tenant-a"))?.titles).toHaveLength(0);
  });
  it("recusa escopo comercial segmentado mesmo com permissão financeira", async () => {
    const { db } = fixture();
    await expect(
      executeCommissionCommand(db, { ...principal, access: "operator", commercialRepId: "rep-1" }, command),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("financeiro indisponível não marca competência como enviada", async () => {
    const { db } = fixture();
    db.failFinance = true;
    await expect(executeCommissionCommand(db, principal, command)).rejects.toThrow("Falha simulada");
    expect((await loadCommercialState(db, "tenant-a"))?.closings["2026-09"].status).toBe("Fechada");
    expect(db.events).toEqual([]);
  });
  it("recusa execução sem transação e fechamento com vínculo financeiro quebrado", async () => {
    const { db, finance, commercial } = fixture();
    await expect(
      executeCommissionCommand(
        { prepare: db.prepare.bind(db), batch: db.batch.bind(db), exec: db.exec.bind(db) },
        principal,
        command,
      ),
    ).rejects.toMatchObject({ status: 503 });
    commercial.closings["2026-09"] = {
      ...commercial.closings["2026-09"],
      status: "Enviada ao financeiro",
      financeTitles: ["missing-title"],
    };
    expect(() => prepareCommissionTransfer(finance, commercial, "2026-09", "2026-10-25", "Demo")).toThrow(
      /inconsistente/,
    );
  });
});

it.each([
  { total: 101 },
  { commission: 101, total: 101 },
  { bonus: 50, total: 150 },
  { clawback: Number.NaN },
  { rate: Number.POSITIVE_INFINITY },
])("recusa memória de cálculo incoerente no fechamento: %j", patch => {
  const { finance, commercial } = fixture();
  Object.assign(commercial.closings["2026-09"].lines[0], patch);
  expect(() => prepareCommissionTransfer(finance, commercial, "2026-09", "2026-10-25", "Demo")).toThrow(
    /cálculo|inválid/i,
  );
});

function request(body: unknown = command, tenant = "tenant-a") {
  return new Request("http://localhost/api/commercial/commissions", {
    method: "POST",
    headers: { "x-strato-tenant-id": tenant, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
it("endpoint exige tenant/sessão e rejeita cliente fornecendo beneficiário ou valor", async () => {
  const { db } = fixture();
  boundary.database.mockReturnValue(db);
  boundary.principal.mockResolvedValue(null);
  expect((await POST(request(command, ""))).status).toBe(400);
  expect((await POST(request())).status).toBe(401);
  boundary.principal.mockResolvedValue(principal);
  expect((await POST(request({ ...command, amount: 9999, actorId: "forjado" }))).status).toBe(400);
  expect((await loadFinanceState(db, "tenant-a"))?.titles).toHaveLength(0);
});
it("endpoint responde agregado conjunto e retry mantém identificadores", async () => {
  const { db } = fixture();
  boundary.database.mockReturnValue(db);
  boundary.principal.mockResolvedValue(principal);
  const first = await POST(request());
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.commercial.closings["2026-09"].financeTitles).toEqual([body.finance.titles[0].id]);
  const repeated = await POST(request());
  expect(repeated.status).toBe(200);
  const replay = await repeated.json();
  expect(replay.replayed).toBe(true);
  expect(replay.finance.titles).toHaveLength(1);
  expect(replay.finance.titles[0].id).toBe(body.finance.titles[0].id);
});
