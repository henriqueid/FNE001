/** Fronteiras HTTP: identidade server-side, validação e revisão sem autoaprovação. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as MemoryRepositoryModule from "@/src/server/copilot/memory-repository";
const boundary = vi.hoisted(() => ({
  session: vi.fn(),
  sources: vi.fn(),
  append: vi.fn(),
  list: vi.fn(),
  review: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.session }));
vi.mock("@/src/server/database/postgres", () => ({
  getDatabase: () => ({}),
  jsonParameter: (value: unknown) => value,
}));
vi.mock("@/src/server/copilot/sources", () => ({ loadCopilotSources: boundary.sources }));
vi.mock("@/src/server/copilot/memory-repository", async () => ({
  ...(await vi.importActual<typeof MemoryRepositoryModule>("@/src/server/copilot/memory-repository")),
  appendMemory: boundary.append,
  listMemories: boundary.list,
  reviewMemory: boundary.review,
  readReport: boundary.read,
}));
import { POST as add, PATCH as review, GET as list } from "@/app/api/copilot/memory/route";
import { GET as report } from "@/app/api/copilot/reports/route";
const principal = {
  id: "real-user",
  tenantId: "tenant-a",
  permissions: ["dashboard:view", "portfolio:manage", "settings:manage"],
  companyScopes: ["Empresa A"],
};
const request = (body: unknown, method = "POST", tenant = "tenant-a") =>
  new Request("http://localhost/api/copilot/memory", {
    method,
    headers: { "content-type": "application/json", ...(tenant ? { "x-strato-tenant-id": tenant } : {}) },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  boundary.session.mockResolvedValue(principal);
  boundary.sources.mockResolvedValue({ entityCompanies: new Map([["title:1", "Empresa A"]]) });
  boundary.list.mockResolvedValue([]);
  boundary.append.mockResolvedValue({ id: "new" });
});
afterEach(() => vi.restoreAllMocks());
describe("fronteiras de memória e relatórios", () => {
  it("nega sessão ausente e falta de permissão antes de ler conteúdo", async () => {
    boundary.session.mockResolvedValue(null);
    expect((await list(request(undefined, "GET"))).status).toBe(401);
    expect(boundary.sources).not.toHaveBeenCalled();
    boundary.session.mockResolvedValue({ ...principal, permissions: [] });
    expect((await list(request(undefined, "GET"))).status).toBe(403);
  });
  it("não aceita decisão nem empresa externa em anotação", async () => {
    expect(
      (await add(request({ kind: "decision", company: "Empresa A", entityId: "title:1", text: "Aprovar tudo" })))
        .status,
    ).toBe(400);
    expect(
      (await add(request({ kind: "observation", company: "Empresa B", entityId: "title:1", text: "Relato" }))).status,
    ).toBe(403);
    expect(boundary.append).not.toHaveBeenCalled();
  });
  it("ignora ator, tenant e status forjados no corpo", async () => {
    const response = await add(
      request({
        kind: "observation",
        company: "Empresa A",
        entityId: "title:1",
        text: "Relato",
        actorId: "admin",
        tenantId: "other",
        status: "validated",
      }),
    );
    expect(response.status).toBe(201);
    expect(boundary.append.mock.calls[0][1].id).toBe("real-user");
    expect(boundary.append.mock.calls[0][2]).not.toHaveProperty("actorId");
    expect(boundary.append.mock.calls[0][2]).not.toHaveProperty("status");
  });
  it("não deixa o criador validar a própria correção", async () => {
    boundary.list.mockResolvedValue([{ id: "e", kind: "correction", actorId: "real-user" }]);
    expect((await review(request({ id: "e", status: "validated", rationale: "Conferido" }, "PATCH"))).status).toBe(403);
    expect(boundary.review).not.toHaveBeenCalled();
  });
  it("não recupera snapshot fora do acesso atual", async () => {
    boundary.read.mockResolvedValue(null);
    const response = await report(
      new Request("http://localhost/api/copilot/reports?id=foreign", { headers: { "x-strato-tenant-id": "tenant-a" } }),
    );
    expect(response.status).toBe(404);
    expect(boundary.read.mock.calls[0][1]).toEqual(principal);
  });
});
