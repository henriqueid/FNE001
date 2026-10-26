/** Limites gerais/individuais autenticados e gravados atomicamente com trilha de auditoria. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadIntelligenceBudget, saveIntelligenceBudget } from "@/src/server/intelligence/budget-configuration";
import { AIBudgetConfigurationError, AIBudgetConflictError } from "@/src/server/intelligence/budget-policy";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
async function context(request: Request, write = false) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase(),
    principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("settings:manage") && (write || !principal.permissions.includes("settings:view")))
    return { error: json({ error: "Sem permissão para administrar limites da IA." }, 403) } as const;
  return { db, tenantId, principal } as const;
}
function failure(error: unknown) {
  if (error instanceof AIBudgetConflictError) return json({ error: error.message }, 409);
  if (error instanceof AIBudgetConfigurationError) return json({ error: error.message }, 400);
  console.error("intelligence_budget_failed");
  return json({ error: "Não foi possível carregar ou salvar os limites da IA. Tente novamente." }, 503);
}
export async function GET(request: Request) {
  const access = await context(request);
  if (access.error) return access.error;
  try {
    return json({ budget: await loadIntelligenceBudget(access.db, access.tenantId, access.principal.id) });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  const access = await context(request, true);
  if (access.error) return access.error;
  const body: unknown = await request.json().catch(() => null);
  try {
    return json({ budget: await saveIntelligenceBudget(access.db, access.tenantId, access.principal.id, body) });
  } catch (error) {
    return failure(error);
  }
}
