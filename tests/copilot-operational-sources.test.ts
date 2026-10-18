/** Integração dos filtros oficiais com fontes financeiras, comerciais e atribuição nominal. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ finance: vi.fn(), commercial: vi.fn(), tasks: vi.fn() }));
vi.mock("@/src/server/finance/repository", () => ({ loadFinanceState: boundary.finance }));
vi.mock("@/src/server/commercial/repository", () => ({ loadCommercialState: boundary.commercial }));
vi.mock("@/src/server/tasks/repository", () => ({ loadTaskState: boundary.tasks }));
import { loadOperationalSources } from "@/src/server/copilot/operational-sources";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { Operation } from "@/src/domain/core/types";
const principal = {
  id: "u",
  tenantId: "a",
  name: "User",
  role: "Operador",
  department: "Operações",
  status: "active",
  authorityIds: [],
  access: "operator",
  functionalAreas: [],
  companyScopes: ["Empresa A"],
  permissions: ["dashboard:view"],
} as ServerPrincipal;
beforeEach(() => {
  vi.clearAllMocks();
  boundary.finance.mockResolvedValue(null);
  boundary.commercial.mockResolvedValue(null);
  boundary.tasks.mockResolvedValue(null);
});
describe("fontes complementares autorizadas", () => {
  it("não lê módulo sem permissão", async () => {
    await loadOperationalSources({} as DecisionDatabase, principal, [], { version: 3, titles: [] });
    expect(boundary.finance).not.toHaveBeenCalled();
    expect(boundary.commercial).not.toHaveBeenCalled();
    expect(boundary.tasks).not.toHaveBeenCalled();
  });
  it("não incorpora tarefas atribuídas a outra pessoa", async () => {
    const task = (id: string, ownerUserId: string) => ({
      id,
      ownerUserId,
      owner: ownerUserId,
      status: "open",
      snapshot: { operationId: "op" },
      history: [{ id: "assigned", action: "assigned", by: "User", at: "2026-10-18", detail: "Atribuição nominal" }],
    });
    boundary.tasks.mockResolvedValue({ version: 1, tasks: [task("mine", "u"), task("other", "other")] });
    const result = await loadOperationalSources(
      {} as DecisionDatabase,
      { ...principal, permissions: ["dashboard:view", "operations:view"] },
      [{ id: "op", vehicle: "Empresa A", document: "1" }] as Operation[],
      { version: 3, titles: [] },
    );
    expect([...result.entities.keys()]).toEqual(["task:mine"]);
  });
});
