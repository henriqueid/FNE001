/** Consulta e governa regras explícitas de alçadas sem defaults demonstrativos. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { OperationApprovalCommandError } from "@/src/server/operations/approval";
import {
  configureApprovalPolicy,
  readApprovalPolicyConfiguration,
  validateApprovalPolicyCommand,
} from "@/src/server/operations/approval-policy";

async function handle(request: Request, write: boolean) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  try {
    if (!write)
      return Response.json(
        await readApprovalPolicyConfiguration(db, principal, new URL(request.url).searchParams.get("company") ?? ""),
      );
    const command: unknown = await request.json().catch(() => null);
    if (!validateApprovalPolicyCommand(command)) return Response.json({ error: "Comando inválido." }, { status: 400 });
    return Response.json(await configureApprovalPolicy(db, principal, command));
  } catch (error) {
    if (error instanceof OperationApprovalCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error("approval_policy_failed", error);
    return Response.json({ error: "Não foi possível acessar a regra de alçadas." }, { status: 500 });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
