import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadReceivables } from "@/src/server/receivables/repository";
import type { Permission } from "@/src/domain/access/model";
import { principalHasCompanyScope } from "@/src/server/access/scope";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  const allowed = (
    ["operations:view", "risk:decide", "controlleria:formalize", "finance:release"] as Permission[]
  ).some(permission => principal.permissions.includes(permission));
  if (!allowed) return json({ error: "Sem permissão para consultar recebíveis." }, 403);
  const operationId = new URL(request.url).searchParams.get("operation")?.trim() || undefined;
  const operations = await db
    .prepare("select operation_id, vehicle from private.operations where tenant_id = ?")
    .bind(tenantId)
    .all<{ operation_id: string; vehicle: string }>();
  const allowedOperationIds = new Set(
    operations.results
      .filter(operation => principalHasCompanyScope(principal, operation.vehicle))
      .map(operation => operation.operation_id),
  );
  if (operationId && !allowedOperationIds.has(operationId))
    return json({ error: "Operação fora do seu escopo de empresa." }, 403);
  const receivables = await loadReceivables(db, tenantId, operationId);
  return json({ receivables: receivables.filter(receivable => allowedOperationIds.has(receivable.operationId)) });
}
