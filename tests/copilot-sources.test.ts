/** As fontes do Copiloto exigem permissão do módulo antes de carregar dados. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ operations: vi.fn(), portfolio: vi.fn(), parties: vi.fn(), policies: vi.fn() }));
vi.mock("@/src/server/copilot/operational-sources", () => ({
  loadOperationalSources: async () => ({ entities: new Map(), labels: new Map(), behavior: [] }),
}));
vi.mock("@/src/server/operations/repository", () => ({ loadOperations: boundary.operations }));
vi.mock("@/src/server/portfolio/repository", () => ({ loadCurrentPortfolio: boundary.portfolio }));
vi.mock("@/src/server/registry/repository", () => ({ loadRegistryParties: boundary.parties }));
vi.mock("@/src/server/eligibility/policy-repository", () => ({ loadEligibilityPolicyState: boundary.policies }));
import { loadCopilotSources } from "@/src/server/copilot/sources";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
const principal = {
  id: "u",
  tenantId: "a",
  companyScopes: ["Empresa A"],
  permissions: ["dashboard:view"],
} as ServerPrincipal;
beforeEach(() => vi.clearAllMocks());
describe("fontes completas e autorizadas", () => {
  it("não carrega módulos sem permissão nem injeta dados demonstrativos", async () => {
    const result = await loadCopilotSources({} as DecisionDatabase, principal);
    expect(result.knowledge.titles).toEqual([]);
    expect(result.knowledge.operations).toEqual([]);
    expect(boundary.operations).not.toHaveBeenCalled();
    expect(boundary.portfolio).not.toHaveBeenCalled();
    expect(boundary.parties).not.toHaveBeenCalled();
    expect(boundary.policies).not.toHaveBeenCalled();
  });
  it("filtra empresas antes de construir evidências e memória", async () => {
    boundary.operations.mockResolvedValue([
      { id: "op-a", vehicle: "Empresa A", document: "1" },
      { id: "op-b", vehicle: "Empresa B", document: "2" },
    ]);
    const result = await loadCopilotSources({} as DecisionDatabase, {
      ...principal,
      permissions: ["dashboard:view", "operations:view"],
    });
    expect([...result.entityCompanies.keys()]).toEqual(["operation:op-a"]);
    expect(result.knowledge.operations).toHaveLength(1);
  });
});
