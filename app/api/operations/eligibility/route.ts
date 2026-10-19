/** Consulta e intenção de execução/exceção; resultados e alçadas nunca vêm do corpo. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { OperationApprovalCommandError } from "@/src/server/operations/approval";
import { OperationGovernanceError } from "@/src/server/operations/governance";
import {
  executeEligibilityDecision,
  readAuthoritativeEligibility,
  validEligibilityDecisionCommand,
} from "@/src/server/operations/eligibility-exceptions";

async function handle(request: Request, write: boolean) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  if (!principal.permissions.some(permission => ["operations:view", "risk:decide"].includes(permission)))
    return Response.json({ error: "Sem acesso à análise de risco." }, { status: 403 });
  try {
    if (write) {
      const command: unknown = await request.json().catch(() => null);
      if (!validEligibilityDecisionCommand(command))
        return Response.json({ error: "Comando de elegibilidade inválido." }, { status: 400 });
      return Response.json({ operation: await executeEligibilityDecision(db, principal, command) });
    }
    if (!db.transaction) return Response.json({ error: "A análise exige transação de banco." }, { status: 503 });
    return await db.transaction(async transaction => {
      await transaction
        .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
        .bind(`strato.finance:${tenantId}`)
        .run();
      const evaluated = await readAuthoritativeEligibility(
        transaction,
        principal,
        new URL(request.url).searchParams.get("operationId") ?? "",
      );
      return Response.json({
        run: evaluated.run,
        runHash: evaluated.runHash,
        overrides: evaluated.overrides,
        version: evaluated.operation.persistenceVersion,
      });
    });
  } catch (error) {
    if (error instanceof OperationApprovalCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof OperationGovernanceError) return Response.json({ error: error.message }, { status: 409 });
    console.error("eligibility_decision_failed", error);
    return Response.json({ error: "Não foi possível registrar a análise ou exceção." }, { status: 500 });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
