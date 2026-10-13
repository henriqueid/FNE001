import type { Operation } from "@/src/domain/core/types";
import type { Permission } from "@/src/domain/access/model";
import { validatePersistedOperation } from "@/src/domain/operations/persistence";
import { sessionPrincipal } from "@/src/server/access/session";
import { filterCompanyScope, operationCompany, operationWriteScopeError } from "@/src/server/access/scope";
import { getDatabase } from "@/src/server/database/postgres";
import {
  governReleaseTransition,
  OperationGovernanceError,
  releaseReviewChanged,
} from "@/src/server/operations/governance";
import { loadOperationSnapshot, loadOperations, saveOperation } from "@/src/server/operations/repository";
import { ReceivableDuplicateError } from "@/src/server/receivables/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const allowed = (
    ["operations:view", "risk:decide", "controlleria:formalize", "finance:release"] as Permission[]
  ).some(permission => access.principal.permissions.includes(permission));
  if (!allowed) return json({ error: "Sem permissão para consultar operações." }, 403);
  const operations = await loadOperations(access.db, access.tenantId);
  return json({ operations: filterCompanyScope(access.principal, operations, operation => operation.vehicle) });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const allowed = (
    ["operations:edit", "risk:decide", "controlleria:formalize", "finance:release"] as Permission[]
  ).some(permission => access.principal.permissions.includes(permission));
  if (!allowed) return json({ error: "Sem permissão para alterar operações." }, 403);
  const command = (await request.json().catch(() => null)) as {
    operation?: Operation;
    expectedVersion?: number;
  } | null;
  if (!command?.operation || !Number.isInteger(command.expectedVersion) || Number(command.expectedVersion) < 0)
    return json({ error: "Comando de persistência inválido." }, 400);
  const error = validatePersistedOperation(command.operation);
  if (error) return json({ error }, 400);
  const current = await loadOperationSnapshot(access.db, access.tenantId, command.operation.id);
  const currentCompany = current?.vehicle ?? (await operationCompany(access.db, access.tenantId, command.operation.id));
  const scopeError = operationWriteScopeError(access.principal, currentCompany, command.operation.vehicle);
  if (scopeError) return json({ error: scopeError }, 403);
  try {
    if (releaseReviewChanged(current, command.operation) && !access.principal.permissions.includes("finance:release"))
      return json({ error: "Somente o Financeiro pode preparar ou aprovar uma liberação." }, 403);
    const governed = governReleaseTransition(current, command.operation, access.principal);
    const operation = await saveOperation(
      access.db,
      access.tenantId,
      access.principal.id,
      governed,
      Number(command.expectedVersion),
    );
    if (!operation)
      return json(
        { error: "A operação foi alterada por outra pessoa. Atualize a tela antes de tentar novamente." },
        409,
      );
    return json({ operation });
  } catch (reason) {
    if (reason instanceof OperationGovernanceError) return json({ error: reason.message }, 409);
    if (reason instanceof ReceivableDuplicateError)
      return json(
        {
          error: `Este recebível já pertence à operação ${reason.existingOperationId}. Revise a duplicidade antes de continuar.`,
        },
        409,
      );
    console.error("operation_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar a operação. Tente novamente." }, 500);
  }
}
