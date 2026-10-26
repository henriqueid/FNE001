/** API de licença devolve409 para snapshot antigo sem modificar licença/consumo. */
import { afterEach, expect, it, vi } from "vitest";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { IntelligenceDatabase } from "./helpers/intelligence-database";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), database: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async original => ({
  ...(await original<object>()),
  getDatabase: boundary.database,
}));
import { PUT } from "@/app/api/intelligence/state/route";
afterEach(() => vi.clearAllMocks());
function setup(permissions = ["settings:manage"]) {
  const db = new IntelligenceDatabase();
  Object.assign(db.row, {
    contracted: false,
    enabled: false,
    status: "AI_DISABLED",
    aggregate_version: 3,
    used_tokens: 42,
  });
  boundary.database.mockReturnValue(db);
  boundary.principal.mockResolvedValue({ id: "admin", permissions });
  return db;
}
function request(persistenceVersion: unknown = 1) {
  return new Request("http://localhost/api/intelligence/state", {
    method: "PUT",
    headers: { "x-strato-tenant-id": "tenant-a", "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        ...emptyIntelligenceState("tenant-a"),
        contracted: true,
        enabled: true,
        status: "AI_AVAILABLE",
        monthlyTokenBudget: 100,
        persistenceVersion,
      },
    }),
  });
}
it("snapshot anterior retorna409 e não reativa licença desligada", async () => {
  const db = setup();
  const response = await PUT(request());
  expect(response?.status).toBe(409);
  expect(db.row).toMatchObject({ contracted: false, enabled: false, aggregate_version: 3, used_tokens: 42 });
});
it("versão atual retorna novo token sem reduzir uso", async () => {
  const db = setup();
  const response = await PUT(request(3));
  expect(response?.status).toBe(200);
  expect((await response!.json()).state).toMatchObject({ enabled: true, persistenceVersion: 4, usedTokens: 42 });
  expect(db.row.aggregate_version).toBe(4);
});
it("recusa versão inválida, ausência de permissão e sessão", async () => {
  const db = setup();
  expect((await PUT(request("3")))?.status).toBe(400);
  setup(["settings:view"]);
  expect((await PUT(request(3)))?.status).toBe(403);
  boundary.principal.mockResolvedValue(null);
  expect((await PUT(request(3)))?.status).toBe(401);
  expect(db.row.enabled).toBe(false);
});
