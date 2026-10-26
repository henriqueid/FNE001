/** Autorização e autoria dos limites de consumo não dependem do corpo enviado. */
import { afterEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), database: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async importOriginal => ({
  ...(await importOriginal<object>()),
  getDatabase: boundary.database,
}));
import { GET, PUT } from "@/app/api/intelligence/budget/route";
import { IntelligenceDatabase } from "./helpers/intelligence-database";
const input = {
  mode: "allocated",
  version: 0,
  monthlyTokenBudget: 100,
  allocations: [{ userId: "actor-a", monthlyTokenBudget: 100 }],
};
function setup(permissions = ["settings:manage"]) {
  const db = new IntelligenceDatabase();
  boundary.database.mockReturnValue(db);
  boundary.principal.mockResolvedValue({ id: "admin", permissions });
  return db;
}
function request(method = "GET", body: unknown = input, tenant = "tenant-a") {
  return new Request("http://localhost/api/intelligence/budget", {
    method,
    headers: { "x-strato-tenant-id": tenant, "content-type": "application/json" },
    ...(method === "PUT" ? { body: JSON.stringify(body) } : {}),
  });
}
afterEach(() => vi.clearAllMocks());
it("exige sessão e permissão de leitura; viewer não grava", async () => {
  setup();
  boundary.principal.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  setup([]);
  expect((await GET(request())).status).toBe(403);
  setup(["settings:view"]);
  expect((await GET(request())).status).toBe(200);
  expect((await PUT(request("PUT"))).status).toBe(403);
});
it("grava limites com autoria da sessão e ignora consumo forjado", async () => {
  const db = setup();
  db.row.used_tokens = 30;
  const response = await PUT(
    request("PUT", {
      ...input,
      actorId: "foreign",
      tenantId: "foreign",
      usedTokens: 0,
      users: [{ userId: "actor-a", usedTokens: 0 }],
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).budget.usedTokens).toBe(30);
  expect(db.events.find(e => e.event_type === "AI_BUDGET_CONFIGURED")?.actor_id).toBe("admin");
});
it("recusa usuário sem vínculo e cotas excedentes sem gravar", async () => {
  const db = setup();
  expect(
    (await PUT(request("PUT", { ...input, allocations: [{ userId: "foreign", monthlyTokenBudget: 1 }] }))).status,
  ).toBe(400);
  expect((await PUT(request("PUT", { ...input, monthlyTokenBudget: 1 }))).status).toBe(400);
  expect(db.events).toHaveLength(0);
});
it("recusa edição desatualizada e corpo inválido", async () => {
  setup();
  expect((await PUT(request("PUT"))).status).toBe(200);
  expect((await PUT(request("PUT"))).status).toBe(409);
  expect((await PUT(request("PUT", null))).status).toBe(400);
});
it("não retorna membros de outro tenant", async () => {
  setup();
  const result = await GET(request("GET", null, "tenant-b"));
  expect((await result.json()).budget.users).toEqual([]);
});
