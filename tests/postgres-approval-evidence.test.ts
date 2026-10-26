/** Verifica no SQL real que aprovações/exceções de ciclos anteriores não autorizam nova aquisição. */
import { beforeAll, describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { returnOperationToRisk } from "@/src/server/operations/return-to-risk";
import { loadOperationSnapshot, saveOperationRecord } from "@/src/server/operations/storage";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { getDatabase, jsonParameter } from "@/src/server/database/postgres";
import { loadOperationApprovalGrants } from "@/src/server/operations/approval-evidence";
import { loadEligibilityExceptionGrants } from "@/src/server/operations/exception-evidence";

const isolated = process.env.STRATO_TEST_DATABASE_URL;
describe.skipIf(!isolated)("evidências de aprovação em PostgreSQL isolado", () => {
  beforeAll(() => {
    const url = new URL(isolated!);
    if (url.hostname !== "127.0.0.1" || url.port === "5432" || process.env.DATABASE_URL !== isolated)
      throw new Error("Teste permitido somente no cluster local descartável.");
  });
  it("corta concessões anteriores à devolução e conserva o histórico e o isolamento", async () => {
    const db = getDatabase();
    const tenant = `qa-${crypto.randomUUID()}`;
    const otherTenant = `qa-${crypto.randomUUID()}`;
    const operationId = "operation-cycle";
    for (const id of [tenant, otherTenant])
      await db
        .prepare("insert into private.tenants(tenant_id, legal_name, display_name) values (?, 'QA', 'QA')")
        .bind(id)
        .run();
    async function event(
      tenantId: string,
      type: string,
      aggregateId: string,
      version: number,
      name: string,
      payload: unknown,
    ) {
      const id = crypto.randomUUID();
      await db
        .prepare(
          `insert into private.domain_events (tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,payload)
        values (?,?,?,?,?,?,'user-henrique-admin',?::jsonb)`,
        )
        .bind(tenantId, id, type, aggregateId, version, name, jsonParameter(payload))
        .run();
      return id;
    }
    const approval = await event(tenant, "OperationApproval", operationId, 3, "OPERATION_APPROVAL_GRANTED", {
      slotId: "credit",
      decision: "APROVAR",
    });
    const exception = await event(tenant, "EligibilityException", operationId, 4, "ELIGIBILITY_EXCEPTION_APPROVED", {
      evaluationId: "evaluation-a",
      decision: "APROVAR_EXCECAO",
    });
    expect((await loadOperationApprovalGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([approval]);
    expect((await loadEligibilityExceptionGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([
      exception,
    ]);
    await event(otherTenant, "OperationReturn", "other-tenant-return", 1, "OPERATION_RETURNED", {
      result: { operation: { id: operationId, persistenceVersion: 100 } },
    });
    await event(tenant, "OperationReturn", "other-operation-return", 1, "OPERATION_RETURNED", {
      result: { operation: { id: "another-operation", persistenceVersion: 100 } },
    });
    expect(await loadOperationApprovalGrants(db, tenant, operationId)).toHaveLength(1);
    await event(tenant, "OperationReturn", "current-return", 1, "OPERATION_RETURNED", {
      result: { operation: { id: operationId, persistenceVersion: 5 } },
    });
    expect(await loadOperationApprovalGrants(db, tenant, operationId)).toHaveLength(0);
    expect(await loadEligibilityExceptionGrants(db, tenant, operationId)).toHaveLength(0);
    const nextApproval = await event(tenant, "OperationApproval", operationId, 6, "OPERATION_APPROVAL_GRANTED", {
      slotId: "credit",
      decision: "APROVAR",
    });
    const nextException = await event(
      tenant,
      "EligibilityException",
      operationId,
      7,
      "ELIGIBILITY_EXCEPTION_APPROVED",
      { evaluationId: "evaluation-a", decision: "APROVAR_EXCECAO" },
    );
    expect((await loadOperationApprovalGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([
      nextApproval,
    ]);
    expect((await loadEligibilityExceptionGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([
      nextException,
    ]);
    const retained = await db
      .prepare("select count(*)::integer as total from private.domain_events where tenant_id = ? and aggregate_id = ?")
      .bind(tenant, operationId)
      .first<{ total: number }>();
    expect(retained?.total).toBe(4);
  });
  it("retorno ao Risco invalida só alçadas posteriores, preservando exceções e isolando operação", async () => {
    const db = getDatabase();
    const tenant = `qa-risk-${crypto.randomUUID()}`;
    const operationId = "approval-risk-return";
    await db
      .prepare("insert into private.tenants(tenant_id, legal_name, display_name) values (?, 'QA', 'QA')")
      .bind(tenant)
      .run();
    async function event(type: string, aggregateId: string, version: number, name: string, payload: unknown) {
      const id = crypto.randomUUID();
      await db
        .prepare(
          "insert into private.domain_events (tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,payload) values (?,?,?,?,?,?,'user-henrique-admin',?::jsonb)",
        )
        .bind(tenant, id, type, aggregateId, version, name, jsonParameter(payload))
        .run();
      return id;
    }
    const approval = await event("OperationApproval", operationId, 3, "OPERATION_APPROVAL_GRANTED", {
      slotId: "credit",
      decision: "APROVAR",
    });
    const exception = await event("EligibilityException", operationId, 2, "ELIGIBILITY_EXCEPTION_APPROVED", {
      evaluationId: "rule-a",
      decision: "APROVAR_EXCECAO",
    });
    await event("OperationRiskReturn", "another-operation", 100, "OPERATION_RETURNED_TO_RISK", {
      result: { operation: { id: "another-operation", persistenceVersion: 100 } },
    });
    expect((await loadOperationApprovalGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([approval]);
    await event("OperationRiskReturn", operationId, 4, "OPERATION_RETURNED_TO_RISK", {
      result: { operation: { id: operationId, persistenceVersion: 4 } },
    });
    expect(await loadOperationApprovalGrants(db, tenant, operationId)).toHaveLength(0);
    expect((await loadEligibilityExceptionGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([
      exception,
    ]);
    const revised = await event("OperationApproval", operationId, 5, "OPERATION_APPROVAL_GRANTED", {
      slotId: "credit",
      decision: "APROVAR",
    });
    expect((await loadOperationApprovalGrants(db, tenant, operationId)).map(item => item.eventId)).toEqual([revised]);
    const retained = await db
      .prepare("select count(*)::integer as total from private.domain_events where tenant_id = ? and aggregate_id = ?")
      .bind(tenant, operationId)
      .first<{ total: number }>();
    expect(retained?.total).toBe(4);
  });
  it("comando devolve snapshot persistido com autoria, versão e replay atômicos", async () => {
    const db = getDatabase();
    const tenant = `qa-return-${crypto.randomUUID()}`;
    await db
      .prepare("insert into private.tenants(tenant_id, legal_name, display_name) values (?, 'QA', 'QA')")
      .bind(tenant)
      .run();
    const principal: ServerPrincipal = {
      id: "user-henrique-admin",
      name: "CHURUME Controladoria",
      tenantId: tenant,
      role: "Operações",
      department: "Controladoria",
      functionalAreas: ["Controladoria"],
      access: "admin",
      status: "active",
      permissions: ["controlleria:formalize"],
      authorityIds: [],
      companyScopes: ["CHURUME veículo"],
    };
    const fixture = {
      ...initialOperations[0],
      id: `churume-${crypto.randomUUID()}`,
      vehicle: "CHURUME veículo",
      stage: 5,
      status: "Pronta para formalizar" as const,
      amount: 0,
      titleCount: 0,
      manualEntry: undefined,
      pricingReview: undefined,
      releaseReview: undefined,
      approvalReview: {
        status: "Aprovada" as const,
        approvals: [{ id: "credit", role: "Crédito", approver: "Anterior", status: "Aprovado" as const }],
        audit: [{ at: "2026-10-25", by: "Anterior", action: "Decisão antiga", detail: "Preservar" }],
      },
    };
    const initial = await saveOperationRecord(db, tenant, principal.id, fixture, 0);
    expect(initial?.persistenceVersion).toBe(1);
    const command = {
      operationId: fixture.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      reason: "CHURUME revisar documentação",
    };
    const returned = await returnOperationToRisk(db, principal, command);
    expect(returned.stage).toBe(2);
    expect(returned.persistenceVersion).toBe(2);
    const stored = await loadOperationSnapshot(db, tenant, fixture.id);
    expect(stored?.stage).toBe(2);
    expect(stored?.approvalReview?.approvals).toEqual([]);
    expect(stored?.approvalReview?.audit?.[0].by).toBe("Anterior");
    expect(stored?.approvalReview?.audit?.at(-1)?.by).toBe("CHURUME Controladoria");
    expect(await returnOperationToRisk(db, principal, command)).toEqual(returned);
    await expect(
      returnOperationToRisk(db, principal, { ...command, reason: "Conteúdo diferente nesta mesma chave" }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await loadOperationSnapshot(db, tenant, fixture.id))?.persistenceVersion).toBe(2);
    const rows = await db
      .prepare(
        "select actor_id, payload from private.domain_events where tenant_id = ? and aggregate_type = 'OperationRiskReturn' and aggregate_id = ?",
      )
      .bind(tenant, fixture.id)
      .all<{ actor_id: string; payload: { previousApprovalReview: { approvals: unknown[] } } }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].actor_id).toBe(principal.id);
    expect(rows.results[0].payload.previousApprovalReview.approvals).toHaveLength(1);
  });
});
