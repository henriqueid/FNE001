/** Fronteiras rejeitam JSON não contratual antes de tocar credenciais ou perfis. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), db: vi.fn() }));
vi.mock("@/src/server/access/session", async original => ({
  ...(await original<object>()),
  sessionPrincipal: boundary.principal,
}));
vi.mock("@/src/server/database/postgres", async original => ({
  ...(await original<object>()),
  getDatabase: boundary.db,
}));
import { POST as requestAccess } from "@/app/api/auth/requests/route";
import { POST as login } from "@/app/api/auth/session/route";
import { POST as createUser, PUT as saveUsers } from "@/app/api/access/users/route";
import { POST as propose, PUT as decide } from "@/app/api/access/change-requests/route";
function request(body: unknown, method = "POST") {
  return new Request("http://localhost/api/access", {
    method,
    headers: { "x-strato-tenant-id": "CHURUME-test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  boundary.db.mockReturnValue({});
  boundary.principal.mockResolvedValue({ id: "CHURUME-admin", access: "admin", permissions: ["users:manage"] });
});
describe("corpos inválidos recebem 400", () => {
  it.each([null, 3, [], { name: 3 }, { name: "Nome válido", email: 3 }])("solicitação e criação: %j", async body => {
    expect((await requestAccess(request(body))).status).toBe(400);
    expect((await createUser(request(body))).status).toBe(400);
  });
  it.each([null, 3, [], { identifier: 3, password: "Senha2026Aa" }, { identifier: "login", password: {} }])(
    "login: %j",
    async body => {
      expect((await login(request(body))).status).toBe(400);
    },
  );
  it("diretório com membro null é inválido", async () => {
    expect((await saveUsers(request({ version: 2, users: [null] }, "PUT"))).status).toBe(400);
  });
  it("motivo/identificador não textual não alcança governança", async () => {
    expect((await propose(request({ subjectUserId: 3, proposed: {}, reason: 3 }))).status).toBe(400);
    expect((await decide(request({ changeId: 3, decision: "APPROVED", reason: 3 }, "PUT"))).status).toBe(400);
  });
});
