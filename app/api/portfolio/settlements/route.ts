/** Endpoint de intenção; o cliente nunca fornece uma nova posição financeira pronta. */
import { sessionPrincipal } from "@/src/server/access/session";
import { operationCompanyMap } from "@/src/server/access/scope";
import { getDatabase } from "@/src/server/database/postgres";
import { filterFinanceState } from "@/src/server/finance/access";
import { FinanceCommandConflictError, FinanceTransitionError } from "@/src/server/finance/repository";
import { filterPortfolioScope } from "@/src/server/portfolio/access";
import { executeReceivableCommand, ReceivableCommandError } from "@/src/server/portfolio/financial-commands";
import { PortfolioCommandConflictError, PortfolioTransitionError } from "@/src/server/portfolio/repository";

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return Response.json({ error: "Empresa não informada." }, { status: 400 });
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  try {
    const result = await executeReceivableCommand(db, principal, await request.json().catch(() => null));
    const companies = await operationCompanyMap(db, tenantId);
    return Response.json({
      ...result,
      finance: filterFinanceState(result.finance, principal, companies),
      portfolio: filterPortfolioScope(principal, result.portfolio),
    });
  } catch (error) {
    if (error instanceof ReceivableCommandError)
      return Response.json({ error: error.message }, { status: error.status });
    if (
      error instanceof FinanceCommandConflictError ||
      error instanceof FinanceTransitionError ||
      error instanceof PortfolioCommandConflictError ||
      error instanceof PortfolioTransitionError
    )
      return Response.json({ error: error.message }, { status: 409 });
    console.error("receivable_settlement_failed", error);
    return Response.json(
      { error: "Não foi possível gravar a liquidação. Nenhuma alteração parcial foi confirmada." },
      { status: 500 },
    );
  }
}
