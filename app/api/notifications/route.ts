import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { listPublishedNotifications, outboxHealth } from "@/src/server/outbox/publisher";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const db = getDatabase();
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("dashboard:view"))
    return json({ error: "Usuário sem acesso à Central do Dia." }, 403);
  return json({
    notifications: await listPublishedNotifications(db, tenantId, principal),
    health: principal.access === "admin" ? await outboxHealth(db, tenantId, principal.companyScopes) : undefined,
  });
}
