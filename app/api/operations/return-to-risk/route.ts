/** Recebe somente intenção de devolver a análise; o snapshot é reconstruído no servidor. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { OperationApprovalCommandError } from "@/src/server/operations/approval";
import { returnOperationToRisk, validReturnToRiskCommand } from "@/src/server/operations/return-to-risk";

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  try {
    const db = getDatabase();
    const principal = await sessionPrincipal(db, request.headers, tenantId);
    if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
    const command: unknown = await request.json().catch(() => null);
    if (!validReturnToRiskCommand(command))
      return Response.json({ error: "Comando de devolução ao Risco inválido." }, { status: 400 });
    return Response.json({ operation: await returnOperationToRisk(db, principal, command) });
  } catch (error) {
    if (error instanceof OperationApprovalCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error("operation_risk_return_failed");
    return Response.json(
      { error: "A devolução não foi concluída. Nenhuma alteração parcial foi confirmada." },
      { status: 500 },
    );
  }
}
