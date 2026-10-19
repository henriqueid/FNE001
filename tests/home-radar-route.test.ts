/** A rota mantém isolamento por sessão/empresa e nunca permite cache compartilhado. */
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/home/radar/route";
import { sessionPrincipal } from "@/src/server/access/session";
import { loadRadar } from "@/src/server/home/radar";
import { seedAccessState } from "@/src/domain/access/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
vi.mock("@/src/server/database/postgres", () => ({ getDatabase: () => ({}) }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: vi.fn() }));
vi.mock("@/src/server/home/radar", () => ({ loadRadar: vi.fn() }));
const principal = {
  ...seedAccessState().users[0],
  tenantId: "tenant-a",
  companyScopes: ["Empresa A", "Empresa B"],
  functionalAreas: ["Diretoria"],
  authorityIds: [],
} as ServerPrincipal;
const request = (company = "Consolidado", tenant = "tenant-a") =>
  new Request(`http://localhost/api/home/radar?company=${encodeURIComponent(company)}`, {
    headers: tenant ? { "x-strato-tenant-id": tenant } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessionPrincipal).mockResolvedValue(principal);
  vi.mocked(loadRadar).mockResolvedValue({ events: [], market: [], checkedAt: "2026-10-19T12:00:00Z" });
});
it("exige tenant, sessão e dashboard", async () => {
  expect((await GET(request("Consolidado", ""))).status).toBe(400);
  vi.mocked(sessionPrincipal).mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  vi.mocked(sessionPrincipal).mockResolvedValueOnce({ ...principal, permissions: [] });
  expect((await GET(request())).status).toBe(403);
  expect(loadRadar).not.toHaveBeenCalled();
});
it("restringe o filtro à empresa autorizada e rejeita outra empresa", async () => {
  const result = await GET(request("Empresa A"));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(vi.mocked(loadRadar).mock.calls[0][1].companyScopes).toEqual(["Empresa A"]);
  expect((await GET(request("Empresa C"))).status).toBe(403);
  expect(loadRadar).toHaveBeenCalledTimes(1);
});
it("retorna indisponibilidade sem expor erros internos", async () => {
  vi.mocked(loadRadar).mockRejectedValue(new Error("detalhe privado"));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("detalhe privado");
});
