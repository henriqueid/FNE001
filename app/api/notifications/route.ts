import { env } from "cloudflare:workers";
import { sessionPrincipal } from "@/src/server/access/session";
import { listPublishedNotifications, outboxHealth } from "@/src/server/outbox/publisher";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const principal = await sessionPrincipal(env.DB, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("operations:view"))
    return json({ error: "Usuário sem acesso às notificações operacionais." }, 403);
  return json({
    notifications: await listPublishedNotifications(env.DB, tenantId, principal),
    health: principal.access === "admin" ? await outboxHealth(env.DB, tenantId) : undefined,
  });
}
