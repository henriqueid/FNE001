/** Recebe somente intenção de decisão; alçadas e resultados são resolvidos pelo servidor. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  decideOperationApproval,
  OperationApprovalCommandError,
  validateOperationApprovalCommand,
} from "@/src/server/operations/approval";
import { OperationGovernanceError } from "@/src/server/operations/governance";
import { loadOperationSnapshot } from "@/src/server/operations/storage";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { loadApprovalAuthorityPolicy } from "@/src/server/operations/approval-evidence";

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  if (
    !principal.permissions.some(permission =>
      ["operations:view", "risk:decide", "controlleria:formalize"].includes(permission),
    )
  )
    return Response.json({ error: "Sem permissão para consultar alçadas." }, { status: 403 });
  const operation = await loadOperationSnapshot(
    db,
    tenantId,
    new URL(request.url).searchParams.get("operationId") ?? "",
  );
  if (!operation || !principalHasCompanyScope(principal, operation.vehicle))
    return Response.json({ error: "Operação não localizada." }, { status: 404 });
  const policy = await loadApprovalAuthorityPolicy(db, tenantId, operation.vehicle);
  if (!policy)
    return Response.json(
      { error: "Configure e aprove a regra de alçadas da empresa em Configurações." },
      { status: 409 },
    );
  return Response.json({ slots: policy.slots });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  if (!principal.permissions.some(permission => ["risk:decide", "controlleria:formalize"].includes(permission)))
    return Response.json({ error: "Sem permissão para decidir aprovação." }, { status: 403 });
  const command: unknown = await request.json().catch(() => null);
  if (!validateOperationApprovalCommand(command))
    return Response.json({ error: "Comando de aprovação inválido." }, { status: 400 });
  try {
    return Response.json({ operation: await decideOperationApproval(db, principal, command) });
  } catch (error) {
    if (error instanceof OperationApprovalCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof OperationGovernanceError) return Response.json({ error: error.message }, { status: 409 });
    console.error("operation_approval_failed", error);
    return Response.json({ error: "Não foi possível registrar a decisão." }, { status: 500 });
  }
}
