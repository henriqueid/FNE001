import type { Operation } from "@/src/domain/core/types";
import type { Permission } from "@/src/domain/access/model";
import { validatePersistedOperation } from "@/src/domain/operations/persistence";
import { operationMutationPermissionError } from "@/src/domain/operations/mutation-permissions";
import { sessionPrincipal } from "@/src/server/access/session";
import { filterCompanyScope, operationCompany, operationWriteScopeError } from "@/src/server/access/scope";
import { getDatabase } from "@/src/server/database/postgres";
import {
  assertOperationTransition,
  governReleaseTransition,
  OperationGovernanceError,
} from "@/src/server/operations/governance";
import { loadOperationSnapshot, loadOperations, saveOperation } from "@/src/server/operations/repository";
import { ReceivableDuplicateError } from "@/src/server/receivables/repository";
import { assertFormalizationDocuments } from "@/src/server/operations/formalization-documents";
import {
  assertAuthoritativeOperation,
  assertOperationTitleTotals,
  loadOperationAuthorityContext,
  operationRequiresAuthority,
} from "@/src/server/operations/validation";

import { bindRepurchaseSources } from "@/src/server/operations/repurchase";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";

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
  let requested = command.operation;
  const expectedVersion = Number(command.expectedVersion);
  if (!access.db.transaction) return json({ error: "A gravação exige transação de banco." }, 503);
  try {
    return await access.db.transaction(async transaction => {
      await transaction
        .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
        .bind(`strato.finance:${access.tenantId}`)
        .run();
      const current = await loadOperationSnapshot(transaction, access.tenantId, requested.id);
      const currentCompany = current?.vehicle ?? (await operationCompany(transaction, access.tenantId, requested.id));
      const scopeError = operationWriteScopeError(access.principal, currentCompany, requested.vehicle);
      if (scopeError) return json({ error: scopeError }, 403);
      const permissionError = operationMutationPermissionError(current, requested, access.principal.permissions);
      if (permissionError) return json({ error: permissionError }, 403);
      for (const field of ["approvals", "finalDecision", "serverApproval"] as const) {
        const previous = current?.approvalReview as Record<string, unknown> | undefined;
        const next = requested.approvalReview as Record<string, unknown> | undefined;
        if (JSON.stringify(previous?.[field]) !== JSON.stringify(next?.[field]))
          throw new OperationGovernanceError("Decisões de aprovação exigem o comando dedicado de alçada.");
      }
      if (JSON.stringify(current?.eligibilityReview) !== JSON.stringify(requested.eligibilityReview))
        throw new OperationGovernanceError(
          "Execuções e exceções de elegibilidade exigem o comando dedicado do servidor.",
        );
      requested = bindRepurchaseSources(requested, await loadCurrentPortfolio(transaction, access.tenantId));
      assertOperationTransition(current, requested);
      assertOperationTitleTotals(requested);
      await assertFormalizationDocuments(requested, access.tenantId, access.principal.id);
      if (current && operationRequiresAuthority(current, requested)) {
        const authority = await loadOperationAuthorityContext(transaction, access.tenantId, current);
        assertAuthoritativeOperation(current, requested, authority);
      }
      const governed = governReleaseTransition(current, requested, access.principal);
      const operation = await saveOperation(
        transaction,
        access.tenantId,
        access.principal.id,
        governed,
        expectedVersion,
      );
      if (!operation)
        return json(
          { error: "A operação foi alterada por outra pessoa. Atualize a tela antes de tentar novamente." },
          409,
        );
      return json({ operation });
    });
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
