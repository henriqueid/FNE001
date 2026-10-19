/** Comando autenticado de devolução; o navegador envia intenção, nunca snapshots financeiros. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  returnReleasedOperation,
  OperationReturnError,
  type OperationReturnCommand,
} from "@/src/server/operations/return";
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  try {
    const db = getDatabase(),
      principal = await sessionPrincipal(db, request.headers, tenantId);
    if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
    const command = (await request.json().catch(() => null)) as OperationReturnCommand;
    return Response.json({ result: await returnReleasedOperation(db, principal, command) });
  } catch (error) {
    if (error instanceof OperationReturnError) return Response.json({ error: error.message }, { status: error.status });
    console.error("operation_return_failed");
    return Response.json(
      { error: "A devolução não foi concluída. Nenhuma alteração parcial foi confirmada." },
      { status: 500 },
    );
  }
}
