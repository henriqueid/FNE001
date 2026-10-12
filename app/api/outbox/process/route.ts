import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { outboxHealth, publishDecisionOutbox, retryFailedOutbox } from "@/src/server/outbox/publisher";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const db = getDatabase();
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("operations:view"))
    return { error: json({ error: "Usuário sem acesso ao processamento operacional." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const result = await publishDecisionOutbox(access.db, access.tenantId);
  return json({ ...result, health: await outboxHealth(access.db, access.tenantId) });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("users:manage"))
    return json({ error: "Somente administradores podem reprocessar a fila de falhas." }, 403);
  await retryFailedOutbox(access.db, access.tenantId);
  const result = await publishDecisionOutbox(access.db, access.tenantId);
  return json({ ...result, health: await outboxHealth(access.db, access.tenantId) });
}
