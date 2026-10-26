/** Intenção autenticada; valores, beneficiários e autoria vêm exclusivamente do servidor. */
import { sessionPrincipal } from "@/src/server/access/session";
import { operationCompanyMap } from "@/src/server/access/scope";
import { filterCommercialState } from "@/src/server/commercial/access";
import { CommissionCommandError, executeCommissionCommand } from "@/src/server/commercial/commission-command";
import { CommercialCommandConflictError, CommercialTransitionError } from "@/src/server/commercial/repository";
import { getDatabase } from "@/src/server/database/postgres";
import { filterFinanceState } from "@/src/server/finance/access";
import { FinanceCommandConflictError, FinanceTransitionError } from "@/src/server/finance/repository";

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  try {
    const result = await executeCommissionCommand(db, principal, await request.json().catch(() => null));
    const companies = await operationCompanyMap(db, tenantId);
    return Response.json({
      ...result,
      finance: filterFinanceState(result.finance, principal, companies),
      commercial: filterCommercialState(result.commercial, principal),
    });
  } catch (error) {
    if (error instanceof CommissionCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    if (
      error instanceof CommercialCommandConflictError ||
      error instanceof CommercialTransitionError ||
      error instanceof FinanceCommandConflictError ||
      error instanceof FinanceTransitionError
    )
      return Response.json({ error: error.message }, { status: 409 });
    console.error("commission_send_failed", error);
    return Response.json(
      { error: "Não foi possível enviar as comissões. Nenhuma alteração parcial foi confirmada. Tente novamente." },
      { status: 500 },
    );
  }
}
