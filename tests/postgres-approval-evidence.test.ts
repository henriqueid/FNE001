/** Verifica no SQL real que aprovações/exceções de ciclos anteriores não autorizam nova aquisição. */
import { beforeAll, describe, expect, it } from "vitest";
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
});
