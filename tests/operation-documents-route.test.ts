/** Rotas exercitam storage real; somente sessão e consulta externa são substituídas. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const authority = vi.hoisted(() => ({
  principal: {
    id: "user-a",
    tenantId: "tenant-a",
    companyScopes: ["Empresa A"],
    permissions: ["controlleria:formalize", "operations:view"],
  } as { id: string; tenantId: string; companyScopes: string[]; permissions: string[] } | null,
  company: "Empresa A" as string | null,
}));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: async () => authority.principal }));
vi.mock("@/src/server/database/postgres", () => ({
  getDatabase: () => ({
    prepare: () => ({
      bind: () => ({ first: async () => (authority.company ? { vehicle: authority.company } : null) }),
    }),
  }),
}));
import { GET, POST } from "@/app/api/operations/documents/route";
let root: string;
const bytes = new TextEncoder().encode("%PDF-1.7\ncontrato\n%%EOF");
const makeRequest = (method: string, operationId = "OP-1", id?: string) =>
  new Request(
    `http://localhost/api/operations/documents?${new URLSearchParams({ operationId, ...(id ? { id } : {}) })}`,
    {
      method,
      headers: { "x-strato-tenant-id": "tenant-a", "x-file-name": "contrato.pdf", "content-type": "application/pdf" },
      ...(method === "POST" ? { body: bytes } : {}),
    },
  );
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "strato-doc-route-test-"));
  vi.stubEnv("STRATO_DOCUMENTS_DIR", root);
  authority.principal = {
    id: "user-a",
    tenantId: "tenant-a",
    companyScopes: ["Empresa A"],
    permissions: ["controlleria:formalize", "operations:view"],
  };
  authority.company = "Empresa A";
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (root.startsWith(join(tmpdir(), "strato-doc-route-test-"))) await rm(root, { recursive: true, force: true });
});
describe("API privada de documentos", () => {
  it("confirma upload e recupera conteúdo com headers privados", async () => {
    const uploaded = await POST(makeRequest("POST"));
    expect(uploaded.status).toBe(201);
    const { document } = await uploaded.json();
    const downloaded = await GET(makeRequest("GET", "OP-1", document.id));
    expect(downloaded.status).toBe(200);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);
    expect(downloaded.headers.get("cache-control")).toContain("no-store");
    expect(downloaded.headers.get("content-disposition")).toContain("attachment;");
  });
  it("nega sessão ausente", async () => {
    authority.principal = null;
    expect((await POST(makeRequest("POST"))).status).toBe(401);
  });
  it("nega upload sem permissão e leitura fora da empresa", async () => {
    authority.principal!.permissions = ["operations:view"];
    expect((await POST(makeRequest("POST"))).status).toBe(403);
    authority.company = "Empresa B";
    expect((await GET(makeRequest("GET", "OP-1", "doc_invalid"))).status).toBe(404);
  });
  it("não recupera anexo por outra operação ou tenant", async () => {
    const { document } = await (await POST(makeRequest("POST"))).json();
    expect((await GET(makeRequest("GET", "OP-2", document.id))).status).toBe(404);
    authority.principal!.tenantId = "tenant-b";
    expect((await GET(makeRequest("GET", "OP-1", document.id))).status).toBe(404);
  });
  it("nega operação inexistente", async () => {
    authority.company = null;
    expect((await POST(makeRequest("POST"))).status).toBe(404);
  });
  it("nega tamanho declarado excessivo antes de ler", async () => {
    const request = makeRequest("POST");
    request.headers.set("content-length", String(11 * 1024 * 1024));
    expect((await POST(request)).status).toBe(413);
  });
});
it("limita também o corpo recebido sem confiar no content-length", async () => {
  const request = new Request("http://localhost/api/operations/documents?operationId=OP-1", {
    method: "POST",
    headers: { "x-strato-tenant-id": "tenant-a", "x-file-name": "contrato.pdf", "content-type": "application/pdf" },
    body: new Uint8Array(10 * 1024 * 1024 + 1),
  });
  expect((await POST(request)).status).toBe(413);
});
