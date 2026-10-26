/** Diretório self-only hidrata operador real sem abrir manutenção ou expor outros usuários. */
import { beforeEach, expect, it, vi } from "vitest";
import { seedAccessState, type AccessUser } from "@/src/domain/access/model";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), database: vi.fn(), directory: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async original => ({
  ...(await original<object>()),
  getDatabase: boundary.database,
}));
vi.mock("@/src/server/access/repository", async original => ({
  ...(await original<object>()),
  loadAccessDirectory: boundary.directory,
}));
import { GET, POST, PUT } from "@/app/api/access/users/route";
const admin = { ...seedAccessState().users[0], tenantIds: ["tenant-a"] };
const own: AccessUser = {
  ...admin,
  id: "CHURUME-operator",
  name: "CHURUME Operador",
  access: "operator",
  role: "Operador",
  status: "active",
  tenantIds: ["tenant-a"],
  permissions: ["dashboard:view", "operations:view"],
  authorityIds: [],
  companyScopes: ["Empresa A"],
};
function request(method = "GET", tenant = "tenant-a") {
  return new Request("http://localhost/api/access/users?userId=outro", {
    method,
    headers: { "x-strato-tenant-id": tenant, "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify({ version: 2, users: [] }) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.database.mockReturnValue({});
  boundary.principal.mockResolvedValue({
    id: own.id,
    status: "active",
    tenantId: "tenant-a",
    permissions: own.permissions,
  });
  boundary.directory.mockResolvedValue({
    version: 2,
    authenticatedUserId: admin.id,
    previewUserId: admin.id,
    users: [admin, own],
  });
});
it("operador sem users:manage recebe só seu perfil persistido e ID real, sem preview/admin seed", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ version: 2, authenticatedUserId: own.id, users: [own] });
  expect(boundary.directory).toHaveBeenCalledWith(expect.anything(), "tenant-a", own.id);
});
it("gestor de acessos conserva diretório completo", async () => {
  boundary.principal.mockResolvedValue({
    id: admin.id,
    status: "active",
    tenantId: "tenant-a",
    permissions: ["users:manage"],
  });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).users).toEqual([admin, own]);
});
it("POST e PUT continuam negados para operador", async () => {
  expect((await POST(request("POST"))).status).toBe(403);
  expect((await PUT(request("PUT"))).status).toBe(403);
  expect(boundary.directory).not.toHaveBeenCalled();
});
it.each(["ausente", "suspenso", "sem-vínculo"])("GET falha fechado quando próprio usuário está %s", async scenario => {
  boundary.directory.mockResolvedValue({
    version: 2,
    authenticatedUserId: own.id,
    users:
      scenario === "ausente"
        ? [admin]
        : [{ ...own, ...(scenario === "suspenso" ? { status: "suspended" } : { tenantIds: ["tenant-b"] }) }],
  });
  expect((await GET(request())).status).toBe(401);
});
it("sessão ausente ou sem tenant solicitado recebe401 sem consultar diretório", async () => {
  boundary.principal.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  expect((await GET(request("GET", "tenant-b"))).status).toBe(401);
  expect(boundary.directory).not.toHaveBeenCalled();
});
