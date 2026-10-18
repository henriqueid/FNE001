/** Integração das rotas com autorização e reserva, isolando somente banco/sessão/contexto. */
import { afterEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), database: vi.fn(), context: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", () => ({ getDatabase: boundary.database }));
vi.mock("@/src/server/intelligence/authorized-context", () => ({ loadAuthorizedCopilotContext: boundary.context }));
import { POST as chat } from "@/app/api/copilot/chat/route";
import { POST as testConnection } from "@/app/api/intelligence/configuration/route";

function request(question: unknown = "Resumo") {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "x-strato-tenant-id": "tenant-a", "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
function setup(permissions: string[] = ["dashboard:view"]) {
  boundary.principal.mockResolvedValue({ id: "user", tenantId: "tenant-a", permissions });
  boundary.context.mockResolvedValue({});
  boundary.database.mockReturnValue({ prepare: () => ({ bind: () => ({ first: async () => null }) }) });
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetcher = vi.fn(async () => {
    throw new Error("Provedor não deve ser acessado");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("rotas exigem acesso e orçamento no servidor", () => {
  it("Copiloto nega usuário sem permissão antes de acessar contexto ou provedor", async () => {
    const fetcher = setup([]);
    expect((await chat(request()))?.status).toBe(403);
    expect(boundary.context).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("Copiloto nega ausência de saldo antes de acessar provedor", async () => {
    const fetcher = setup();
    expect((await chat(request()))?.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("teste de conexão também exige reserva de orçamento", async () => {
    const fetcher = setup(["settings:manage"]);
    expect((await testConnection(request()))?.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("entrada não textual é recusada sem acessar provedor", async () => {
    const fetcher = setup();
    expect((await chat(request({ malicious: true })))?.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
