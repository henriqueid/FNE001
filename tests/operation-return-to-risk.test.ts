/** Devolução pré-liberação é intenção autorizada, versionada e auditada no servidor. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { Operation } from "@/src/domain/core/types";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { returnOperationToRisk, type ReturnToRiskCommand } from "@/src/server/operations/return-to-risk";
import { defaultPricing } from "@/src/domain/operations/pricing";
import { approvalHash } from "@/src/server/operations/approval-evidence";
const storage = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("@/src/server/operations/storage", () => ({
  loadOperationSnapshot: storage.load,
  saveOperationRecord: storage.save,
}));
const base = initialOperations.find(item => item.manualEntry?.entries.length)!;
const principal: ServerPrincipal = {
  id: "checker",
  name: "CHURUME Controladoria",
  tenantId: "tenant-1",
  role: "Operações",
  department: "Controladoria",
  functionalAreas: ["Controladoria"],
  access: "admin",
  status: "active",
  permissions: ["controlleria:formalize"],
  authorityIds: [],
  companyScopes: [base.vehicle],
};
const command: ReturnToRiskCommand = {
  operationId: base.id,
  expectedVersion: 3,
  commandId: "a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
  reason: "CHURUME revisar lastro e risco",
};
let current: Operation;
let events: unknown[][];
let replay: { payload: { requestHash: string; result: { operation: Operation } } } | null;
const db: DecisionDatabase = {
  prepare(query) {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind(...items) {
        values = items;
        return statement;
      },
      first: async <T>() => {
        if (query.includes("for update")) return { operation_id: base.id } as T;
        if (query.includes("select payload")) return replay as T;
        throw new Error(query);
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (query.includes("insert into private.domain_events")) events.push(values);
        return { success: true };
      },
    };
    return statement;
  },
  batch: async () => [],
  exec: async () => undefined,
  transaction: async work => work({ ...db, transaction: undefined }),
};
beforeEach(() => {
  vi.clearAllMocks();
  events = [];
  replay = null;
  current = {
    ...base,
    stage: 5,
    status: "Pronta para formalizar",
    persistenceVersion: 3,
    riskReview: {
      cedentDecision: "Aprovado",
      audit: [
        { entity: "cedente", decision: "Aprovado", by: "Analista", at: "2026-10-20", policy: "Política CHURUME" },
      ],
    },
    lastroReview: {
      status: "Favorável",
      opinion: "CHURUME evidência anterior",
      reviewedBy: "Analista",
      reviewedAt: "2026-10-20",
    },
    pricingReview: { ...defaultPricing(base), status: "Condição salva" },
    stageCompletions: [
      { stageId: 1, completedBy: "Originação", completedAt: "2026-10-20" },
      { stageId: 4, completedBy: "Analista", completedAt: "2026-10-21" },
    ],
    approvalReview: {
      status: "Aprovada",
      approvals: [{ id: "credit", role: "Crédito", approver: "Diretora", status: "Aprovado" }],
      audit: [{ at: "2026-10-21", by: "Diretora", action: "Alçada aprovada", detail: "Crédito aprovado" }],
    },
    releaseReview: undefined,
  };
  storage.load.mockImplementation(async () => current);
  storage.save.mockImplementation(async (_db, _tenant, _actor, next: Operation) => ({
    ...next,
    persistenceVersion: 4,
  }));
});
describe("comando devolver Aprovação ao Risco", () => {
  it("volta etapa e preserva entrada/risco/lastro/preço e histórico anterior", async () => {
    const saved = await returnOperationToRisk(db, principal, command);
    expect(saved.stage).toBe(2);
    expect(saved.status).toBe("Em atenção");
    expect(saved.manualEntry).toEqual(current.manualEntry);
    expect(saved.riskReview).toEqual(current.riskReview);
    expect(saved.lastroReview).toEqual(current.lastroReview);
    expect(saved.pricingReview).toEqual(current.pricingReview);
    expect(saved.approvalReview?.approvals).toEqual([]);
    expect(saved.approvalReview?.signatures).toEqual([]);
    expect(saved.approvalReview?.documents).toEqual([]);
    expect(saved.approvalReview?.audit?.[0]).toEqual(current.approvalReview?.audit?.[0]);
    expect(saved.approvalReview?.audit?.at(-1)?.by).toBe("CHURUME Controladoria");
    expect(saved.stageCompletions?.map(item => item.stageId)).toEqual([1]);
    expect(saved.persistenceVersion).toBe(4);
    expect(events).toHaveLength(1);
  });
  it("nega ausência de permissão e escopo de outra empresa", async () => {
    await expect(
      returnOperationToRisk(db, { ...principal, permissions: ["operations:edit"] }, command),
    ).rejects.toMatchObject({ status: 403 });
    await expect(returnOperationToRisk(db, { ...principal, companyScopes: ["Outra"] }, command)).rejects.toMatchObject({
      status: 404,
    });
    expect(storage.save).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...command, reason: "curto" }, { ...command, stage: 2 }, { ...command, expectedVersion: -1 }])(
    "nega corpo inválido e tentativa de snapshot: %s",
    async invalid => {
      await expect(returnOperationToRisk(db, principal, invalid as ReturnToRiskCommand)).rejects.toMatchObject({
        status: 400,
      });
      expect(storage.save).not.toHaveBeenCalled();
    },
  );
  it("nega etapa errada, cancelada, liberação preparada e versão obsoleta", async () => {
    const original = current;
    for (const operation of [
      { ...original, stage: 6 },
      { ...original, status: "Cancelada" as const },
      { ...original, releaseReview: { status: "Em preparação" as const } },
      { ...original, persistenceVersion: 4 },
    ]) {
      current = operation;
      await expect(returnOperationToRisk(db, principal, command)).rejects.toMatchObject({ status: 409 });
    }
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("repetição idêntica retorna confirmação sem regravar; conteúdo ou ator distinto falha", async () => {
    const saved = { ...current, stage: 2, persistenceVersion: 4 };
    replay = {
      payload: {
        requestHash: approvalHash({ command, actorId: principal.id, tenantId: principal.tenantId }),
        result: { operation: saved },
      },
    };
    expect(await returnOperationToRisk(db, principal, command)).toEqual(saved);
    expect(storage.save).not.toHaveBeenCalled();
    await expect(
      returnOperationToRisk(db, principal, { ...command, reason: "Outra justificativa válida" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(returnOperationToRisk(db, { ...principal, id: "outra-pessoa" }, command)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("nega sem transação ou conflito concorrente sem produzir evento de retorno", async () => {
    await expect(returnOperationToRisk({ ...db, transaction: undefined }, principal, command)).rejects.toMatchObject({
      status: 503,
    });
    storage.save.mockResolvedValue(null);
    await expect(returnOperationToRisk(db, principal, command)).rejects.toMatchObject({ status: 409 });
    expect(events).toHaveLength(0);
  });
});
