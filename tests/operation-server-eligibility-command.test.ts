/** Caminho legítimo de execução, exceção e avanço com regra e fatos reexecutados no servidor. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@/src/domain/core/types";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { emptyParty } from "@/src/domain/registry/parties";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import type * as Validation from "@/src/server/operations/validation";
import {
  authoritativeEligibilityRun,
  assertAuthoritativeOperation,
  type OperationAuthorityContext,
} from "@/src/server/operations/validation";
import { eligibilityExceptionHash, type EligibilityExceptionGrant } from "@/src/server/operations/exception-evidence";
import {
  executeEligibilityDecision,
  type EligibilityDecisionCommand,
} from "@/src/server/operations/eligibility-exceptions";
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), context: vi.fn() }));
vi.mock("@/src/server/operations/storage", () => ({
  loadOperationSnapshot: mocks.load,
  saveOperationRecord: mocks.save,
}));
vi.mock("@/src/server/operations/validation", async original => ({
  ...(await original<typeof Validation>()),
  loadOperationAuthorityContext: mocks.context,
}));
let operation: Operation;
let context: OperationAuthorityContext;
let assigned: boolean;
let events: Record<string, unknown>[];
const principal: ServerPrincipal = {
  id: "director",
  name: "Diretor",
  tenantId: "tenant",
  role: "Gestor",
  department: "Risco e crédito",
  functionalAreas: ["Risco e crédito"],
  access: "manager",
  status: "active",
  permissions: ["risk:decide"],
  authorityIds: ["credit-director"],
  companyScopes: [initialOperations[0].vehicle],
};
const db: DecisionDatabase = {
  prepare(query) {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind(...parameters) {
        values = parameters.map(value =>
          value && typeof value === "object" && "__stratoJson" in value
            ? (value as unknown as { value: unknown }).value
            : value,
        );
        return statement;
      },
      first: async <T>() => {
        if (query.includes("from private.operations")) return { operation_id: operation.id } as T;
        if (query.includes("from private.authority_assignments"))
          return assigned ? ({ authority_id: "credit-director" } as T) : null;
        if (query.includes("from private.domain_events")) return null;
        throw new Error(`Consulta inesperada: ${query}`);
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (query.includes("insert into private.domain_events")) events.push(values[8] as Record<string, unknown>);
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
  assigned = true;
  events = [];
  operation = {
    ...initialOperations[0],
    stage: 2,
    persistenceVersion: 5,
    amount: 1000,
    titleCount: 1,
    netAmount: 1000,
    approvalReview: undefined,
    releaseReview: undefined,
    eligibilityReview: undefined,
    riskReview: undefined,
    manualEntry: {
      mode: "individual",
      receivableType: "Duplicata",
      entries: [
        {
          id: "title",
          amount: 1000,
          documentNumber: "NF1",
          dueDate: "2026-12-01",
          debtorId: "debtor",
          debtorName: "Sacado",
          debtorDocument: "12345678000195",
        },
      ],
    },
  };
  context = {
    asOf: "2026-10-18",
    portfolio: { version: 3, titles: [] },
    parties: [{ ...emptyParty("cedente"), document: operation.document, status: "Ativo" }],
    policies: [
      {
        id: "policy",
        name: "Política",
        version: "1",
        layer: "UNIVERSAL",
        status: "ATIVA",
        effectiveFrom: "2026-01-01",
        bindings: [
          {
            ruleId: "TITLE-AMOUNT-MIN-001",
            enabled: true,
            operator: "GTE",
            parameter: 2000,
            failureOutcome: "EXCECAO",
            action: "SOLICITAR_DECISAO",
            overrideAllowed: true,
            overrideAuthority: "credit-director",
          },
        ],
      },
    ],
    exceptionGrants: [],
  };
  mocks.load.mockImplementation(async () => operation);
  mocks.context.mockImplementation(async () => context);
  mocks.save.mockImplementation(async (_db, _tenant, _actor, next: Operation) => ({
    ...next,
    persistenceVersion: (operation.persistenceVersion ?? 0) + 1,
  }));
});
function command(): EligibilityDecisionCommand {
  const run = authoritativeEligibilityRun(operation, context);
  return {
    action: "DECIDIR",
    operationId: operation.id,
    expectedVersion: operation.persistenceVersion!,
    commandId: "a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
    reason: "Deliberação explícita da avaliação",
    runHash: eligibilityExceptionHash(operation, run),
    evaluationId: run.evaluations[0].id,
    decision: "APROVAR_EXCECAO",
  };
}
describe("comando autoritativo de exceções", () => {
  it("executa política, grava concessão específica e permite avanço legítimo", async () => {
    expect(() => assertAuthoritativeOperation(operation, { ...operation, stage: 3 }, context)).toThrow(
      "impede o avanço",
    );
    operation = await executeEligibilityDecision(db, principal, {
      action: "EXECUTAR",
      operationId: operation.id,
      expectedVersion: 5,
      commandId: "b13fe5dd-aaee-4b6d-aabe-2534ae19368b",
      reason: "Execução prévia da política no servidor",
    });
    const saved = await executeEligibilityDecision(db, principal, command());
    expect(saved.eligibilityReview?.overrides).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      actorId: principal.id,
      authority: "credit-director",
      evaluationId: saved.eligibilityReview?.run.evaluations[0].id,
    });
    context.exceptionGrants = [events.at(-1) as EligibilityExceptionGrant];
    expect(() => assertAuthoritativeOperation(saved, { ...saved, stage: 3 }, context)).not.toThrow();
    const changed = {
      ...saved,
      amount: 1001,
      manualEntry: {
        ...saved.manualEntry!,
        entries: saved.manualEntry!.entries.map(title => ({ ...title, amount: 1001 })),
      },
    };
    expect(() => assertAuthoritativeOperation(changed, { ...changed, stage: 3 }, context)).toThrow("impede o avanço");
  });
  it("preserva ausências reais como null e permite exceção explícita quando a política autoriza", async () => {
    context.policies[0].bindings[0].ruleId = "CEDENT-INTERNAL-SCORE-MIN-001";
    const run = authoritativeEligibilityRun(operation, context);
    expect(run.evaluations[0]).toMatchObject({ outcome: "NAO_AVALIADO", observed: null });
    const saved = await executeEligibilityDecision(db, principal, command());
    expect(saved.eligibilityReview?.overrides[0]).toMatchObject({ originalOutcome: "NAO_AVALIADO", observed: null });
    context.exceptionGrants = [events[0] as EligibilityExceptionGrant];
    expect(() => assertAuthoritativeOperation(saved, { ...saved, stage: 3 }, context)).not.toThrow();
  });
  it("recusa autoridade incorreta, assignment vencida, corpo forjado e fatos novos", async () => {
    await expect(executeEligibilityDecision(db, { ...principal, authorityIds: ["other"] }, command())).rejects.toThrow(
      "alçada exata",
    );
    assigned = false;
    await expect(executeEligibilityDecision(db, principal, command())).rejects.toThrow("não está vigente");
    assigned = true;
    await expect(
      executeEligibilityDecision(db, principal, {
        ...command(),
        runHash: "a".repeat(64),
      } as EligibilityDecisionCommand),
    ).rejects.toThrow("fatos ou a política mudaram");
    await expect(
      executeEligibilityDecision(db, principal, {
        ...command(),
        observed: 999,
      } as unknown as EligibilityDecisionCommand),
    ).rejects.toThrow("inválido");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("registra reexecução sem conceder qualquer exceção implícita", async () => {
    const saved = await executeEligibilityDecision(db, principal, {
      action: "EXECUTAR",
      operationId: operation.id,
      expectedVersion: 5,
      commandId: "a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
      reason: "Execução da política vigente",
    });
    expect(saved.eligibilityReview?.run.evaluations[0].outcome).toBe("EXCECAO");
    expect(saved.eligibilityReview?.overrides).toEqual([]);
  });
});
