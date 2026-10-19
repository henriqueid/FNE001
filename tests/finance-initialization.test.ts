/** Exercita inicialização autorizada, isolamento e reenvio pelo endpoint financeiro e repositório reais. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFinance } from "@/src/domain/finance/setup";
import { saveFinanceState } from "@/src/server/finance/repository";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type * as PostgresModule from "@/src/server/database/postgres";
import { OperationalDatabase } from "./helpers/operational-database";

let database: OperationalDatabase;
let principal: ServerPrincipal;
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: async () => principal }));
vi.mock("@/src/server/database/postgres", async importOriginal => ({
  ...(await importOriginal<typeof PostgresModule>()),
  getDatabase: () => database,
}));
const { PUT } = await import("@/app/api/finance/route");

const request = (expectedVersion = 0) =>
  new Request("http://localhost/api/finance", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-strato-tenant-id": "tenant-a" },
    body: JSON.stringify({ finance: emptyFinance(), expectedVersion, commandId: "initialize-a" }),
  });

beforeEach(() => {
  database = new OperationalDatabase();
  principal = {
    id: "admin-a",
    tenantId: "tenant-a",
    companyScopes: ["Empresa A"],
    permissions: ["finance:view", "finance:release", "settings:manage"],
  } as ServerPrincipal;
});

describe("inicialização financeira", () => {
  it("inicializa tenant vazio pelo endpoint e não duplica ao reenviar o mesmo comando", async () => {
    const first = await PUT(request());
    expect(first.status).toBe(200);
    expect((await first.json()).finance.persistenceVersion).toBe(1);
    const second = await PUT(request());
    expect(second.status).toBe(200);
    expect((await second.json()).finance.persistenceVersion).toBe(1);
    expect(database.finance.size).toBe(1);
    expect(database.events).toEqual(["finance:tenant-a:1"]);
    expect(database.finance.has("tenant-b")).toBe(false);
  });

  it("impede inicialização por operador financeiro sem administração de configurações", async () => {
    principal.permissions = ["finance:release"];
    expect((await PUT(request())).status).toBe(403);
    expect(database.finance.size).toBe(0);
  });

  it("impede inicialização com versão não zero mesmo por chamada direta ao repositório", async () => {
    expect((await PUT(request(5))).status).toBe(409);
    expect(
      await saveFinanceState(database, "tenant-a", "admin-a", emptyFinance(), 5, "bad-version", "hash"),
    ).toBeNull();
    expect(database.finance.size).toBe(0);
  });
});
