/** Exercita a fronteira HTTP de decisão/limite sem conexão externa. */
import { afterEach, expect, it, vi } from "vitest";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { filterCommercialState } from "@/src/server/commercial/access";
import type { ServerPrincipal } from "@/src/server/access/repository";

const boundary = vi.hoisted(() => ({ principal: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async importOriginal => ({
  ...(await importOriginal<object>()),
  getDatabase: () => ({}),
}));
vi.mock("@/src/server/commercial/repository", async importOriginal => ({
  ...(await importOriginal<object>()),
  loadCommercialState: boundary.load,
  saveCommercialState: boundary.save,
}));
import { PUT } from "@/app/api/commercial/route";

afterEach(() => vi.clearAllMocks());

it.each(["novo comitê aprovado", "limite existente", "novo vínculo com limite"])(
  "HTTP bloqueia %s sem alçada",
  async kind => {
    const previous = seedCommercial("2026-10-13");
    const principal = {
      id: "actor",
      name: "Comercial",
      access: "operator",
      commercialRepId: "rep-1",
      permissions: ["portfolio:manage"],
    } as ServerPrincipal;
    boundary.principal.mockResolvedValue(principal);
    boundary.load.mockResolvedValue(previous);
    const commercial = structuredClone(filterCommercialState(previous, principal));
    if (kind === "novo comitê aprovado")
      commercial.committees.push({
        ...commercial.committees[0],
        id: "forjado",
        repId: "rep-1",
        status: "Aprovado",
        approved: 100,
      });
    else if (kind === "limite existente") commercial.links[0].approvedLimit += 1;
    else commercial.links.push({ ...commercial.links[0], id: "forjado", approvedLimit: 100 });
    const response = await PUT(
      new Request("http://localhost/api/commercial", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-strato-tenant-id": "tenant-a" },
        body: JSON.stringify({ commercial, expectedVersion: 0, commandId: "commercial-test" }),
      }),
    );
    expect(response!.status).toBe(403);
    expect((await response!.json()).error).toContain("alçada de risco");
  },
);

it("HTTP bloqueia limite independente de decisão mesmo com alçada", async () => {
  const previous = seedCommercial("2026-10-13");
  boundary.principal.mockResolvedValue({
    id: "actor",
    name: "Risco",
    access: "operator",
    permissions: ["portfolio:manage", "risk:decide"],
  });
  boundary.load.mockResolvedValue(previous);
  const commercial = structuredClone(previous);
  commercial.links[0].approvedLimit += 1;
  const response = await PUT(
    new Request("http://localhost/api/commercial", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-strato-tenant-id": "tenant-a" },
      body: JSON.stringify({ commercial, expectedVersion: 0, commandId: "commercial-test" }),
    }),
  );
  expect(response!.status).toBe(403);
  expect((await response!.json()).error).toContain("decisão correspondente");
});
