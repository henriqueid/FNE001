import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadIntegrationState } from "@/src/server/integrations/configuration-repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("settings:view") && !principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para consultar integrações." }, 403);
  return json({ integrations: await loadIntegrationState(db, tenantId) });
}
