/** Exercita o comando transacional com armazenamento isolado, sem rede nem banco real. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { Operation } from "@/src/domain/core/types";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { decideOperationApproval, type OperationApprovalCommand } from "@/src/server/operations/approval";
import { operationApprovalHash } from "@/src/server/operations/approval-evidence";
import type * as Validation from "@/src/server/operations/validation";

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), context: vi.fn(), validate: vi.fn() }));
vi.mock("@/src/server/operations/storage", () => ({
  loadOperationSnapshot: mocks.load,
  saveOperationRecord: mocks.save,
}));
vi.mock("@/src/server/operations/validation", async importOriginal => ({
  ...(await importOriginal<typeof Validation>()),
  loadOperationAuthorityContext: mocks.context,
  assertAuthoritativeOperation: mocks.validate,
}));

const policy = {
  eventId: "policy-1",
  company: initialOperations[0].vehicle,
  slots: [
    { id: "credit", authorityId: "credit-director", permission: "risk:decide" as const },
    { id: "final", authorityId: "final-director", permission: "controlleria:formalize" as const },
  ],
};
const principal: ServerPrincipal = {
  id: "checker",
  name: "Conferente",
  tenantId: "tenant-1",
  role: "Risco",
  department: "Risco e crédito",
  functionalAreas: ["Risco e crédito"],
  access: "admin",
  status: "active",
  permissions: ["risk:decide"],
  authorityIds: ["credit-director"],
  companyScopes: [policy.company],
};
const command: OperationApprovalCommand = {
  operationId: initialOperations[0].id,
  expectedVersion: 2,
  commandId: "a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
  slotId: "credit",
  decision: "APROVAR",
  reason: "Conferência da alçada documentada",
};
let operation: Operation;
let creator: string;
let assigned: boolean;
let inserted: unknown[][];
let replay: { actor_id: string; payload: { requestHash: string; operation: Operation } } | null;
const db: DecisionDatabase = {
  prepare(query) {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind(...items) {
        values = items;
        return statement;
      },
      first: async <T>() => {
        if (query.includes("select created_by")) return { created_by: creator } as T;
        if (query.includes("select actor_id, payload")) return replay as T | null;
        if (query.includes("from private.authority_assignments"))
          return assigned ? ({ authority_id: "credit-director" } as T) : null;
        throw new Error(`Consulta inesperada: ${query}`);
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (query.includes("insert into private.domain_events")) inserted.push(values);
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
  creator = "maker";
  assigned = true;
  inserted = [];
  replay = null;
  operation = {
    ...initialOperations[0],
    stage: 5,
    persistenceVersion: 2,
    amount: 0,
    titleCount: 0,
    manualEntry: undefined,
    approvalReview: undefined,
  };
  mocks.load.mockImplementation(async () => operation);
  mocks.save.mockImplementation(async (_db, _tenant, _actor, next: Operation) => ({ ...next, persistenceVersion: 3 }));
  mocks.context.mockResolvedValue({ policies: [], approvalPolicy: policy, approvalGrants: [] });
});
describe("comando de aprovação por alçada", () => {
  it("registra apenas a alçada exercida e não aprova as demais", async () => {
    const saved = await decideOperationApproval(db, principal, command);
    expect(saved.approvalReview?.status).toBe("Em aprovação");
    expect(saved.approvalReview?.approvals?.map(item => item.status)).toEqual(["Aprovado", "Pendente"]);
    expect(saved.approvalReview?.finalDecision).toBeUndefined();
    expect(inserted).toHaveLength(1);
    expect(mocks.validate).toHaveBeenCalledOnce();
  });
  it("conclui aprovação cumulativa somente após a segunda alçada real", async () => {
    const snapshotHash = operationApprovalHash(operation, [], policy);
    mocks.context.mockResolvedValue({
      policies: [],
      approvalPolicy: policy,
      approvalGrants: [
        {
          eventId: "prior",
          actorId: "director",
          slotId: "final",
          authorityId: "final-director",
          snapshotHash,
          policyEventId: policy.eventId,
          decidedAt: "2026-10-18T00:00:00Z",
          decision: "APROVAR",
        },
      ],
    });
    const saved = await decideOperationApproval(db, principal, command);
    expect(saved.approvalReview?.status).toBe("Aprovada");
    expect(saved.approvalReview?.finalDecision?.decidedBy).toBe("Conferente");
  });
  it("permite condução individual somente com permissão e atribuição formal da alçada", async () => {
    creator = principal.id;
    await expect(decideOperationApproval(db, principal, command)).resolves.toMatchObject({
      approvalReview: { status: "Em aprovação" },
    });
    await expect(decideOperationApproval(db, { ...principal, permissions: [] }, command)).rejects.toThrow("Sem alçada");
    assigned = false;
    await expect(decideOperationApproval(db, principal, command)).rejects.toThrow("não está vigente");
  });
  it("nega alçada inexistente, atribuição vencida e versão obsoleta", async () => {
    await expect(decideOperationApproval(db, principal, { ...command, slotId: "final" })).rejects.toThrow("Sem alçada");
    assigned = false;
    await expect(decideOperationApproval(db, principal, command)).rejects.toThrow("não está vigente");
    assigned = true;
    await expect(decideOperationApproval(db, principal, { ...command, expectedVersion: 1 })).rejects.toThrow(
      "operação mudou",
    );
    expect(inserted).toHaveLength(0);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("nega replay com mesmo identificador e conteúdo diferente", async () => {
    replay = { actor_id: principal.id, payload: { requestHash: "different", operation } };
    await expect(decideOperationApproval(db, principal, command)).rejects.toThrow("outro conteúdo");
    expect(inserted).toHaveLength(0);
  });
  it("nega snapshot decisório no corpo e ausência de transação", async () => {
    await expect(
      decideOperationApproval(db, principal, {
        ...command,
        finalDecision: { outcome: "APROVADA" },
      } as OperationApprovalCommand),
    ).rejects.toThrow("inválido");
    await expect(decideOperationApproval({ ...db, transaction: undefined }, principal, command)).rejects.toThrow(
      "transação",
    );
  });
});
