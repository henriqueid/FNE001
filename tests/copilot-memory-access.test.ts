/** Reautorização de snapshots e memória, inclusive após revogação de acesso. */
import { describe, expect, it } from "vitest";
import { canReadReport, canReadMemory, reviewMemoryError } from "@/src/server/copilot/memory-repository";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { CopilotReport } from "@/src/domain/copilot/report";
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";
const user = {
  id: "user",
  tenantId: "a",
  companyScopes: ["Empresa A"],
  permissions: ["dashboard:view", "portfolio:manage"],
} as ServerPrincipal;
const report = {
  companies: ["Empresa A"],
  requiredPermissions: ["portfolio:manage"],
  entityRefs: ["title:1"],
} as CopilotReport;
const memory = {
  tenantId: "a",
  actorId: "user",
  company: "Empresa A",
  entityId: "title:1",
  visibility: "private",
  kind: "correction",
  status: "pending",
  evidenceRefs: ["title:1"],
} as BehaviorEvent;
describe("acesso a memória e análise", () => {
  it("requer mesmo tenant e autor para recuperar conversa", () => {
    expect(
      canReadReport(user, { tenant_id: "a", actor_id: "user", payload: report }, new Map([["title:1", "Empresa A"]])),
    ).toBe(true);
    expect(canReadReport(user, { tenant_id: "b", actor_id: "user", payload: report }, new Map())).toBe(false);
    expect(canReadReport(user, { tenant_id: "a", actor_id: "other", payload: report }, new Map())).toBe(false);
  });
  it("nega snapshot quando empresa, entidade ou permissão mudou", () => {
    expect(
      canReadReport(user, { tenant_id: "a", actor_id: "user", payload: report }, new Map([["title:1", "Empresa B"]])),
    ).toBe(false);
    expect(
      canReadReport(
        { ...user, permissions: ["dashboard:view"] },
        { tenant_id: "a", actor_id: "user", payload: report },
        new Map([["title:1", "Empresa A"]]),
      ),
    ).toBe(false);
  });
  it("não entrega nota privada ao revisor e impede autoaprovação", () => {
    expect(
      canReadMemory(
        { ...user, id: "reviewer", permissions: [...user.permissions, "settings:manage"] },
        memory,
        new Map([["title:1", "Empresa A"]]),
      ),
    ).toBe(false);
    expect(
      reviewMemoryError(
        { ...user, permissions: [...user.permissions, "settings:manage"] },
        { ...memory, visibility: "company" },
        "validated",
      ),
    ).toBeTruthy();
  });
  it("permite revisão por outra pessoa habilitada, mas não valida observação como fato", () => {
    const reviewer = { ...user, id: "reviewer", permissions: [...user.permissions, "settings:manage" as const] };
    expect(reviewMemoryError(reviewer, { ...memory, visibility: "company" }, "validated")).toBeNull();
    expect(reviewMemoryError(reviewer, { ...memory, kind: "observation" }, "validated")).toBeTruthy();
  });
  it("reautoriza política mesmo quando não existem títulos ou operações", () => {
    const settings = { ...user, permissions: ["dashboard:view", "settings:view"] } as ServerPrincipal;
    const row = {
      tenant_id: "a",
      actor_id: "user",
      payload: {
        ...report,
        companies: ["Empresa A"],
        requiredPermissions: ["settings:view"],
        entityRefs: ["policy:1"],
      } as CopilotReport,
    };
    expect(canReadReport(settings, row, new Map([["policy:1", "Empresa A"]]))).toBe(true);
    expect(canReadReport({ ...settings, companyScopes: ["Empresa B"] }, row, new Map())).toBe(false);
  });
});
