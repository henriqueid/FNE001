import { emptyIntelligenceState, validateIntelligenceState } from "@/src/domain/intelligence/model";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadIntelligenceState, saveIntelligenceState } from "@/src/server/intelligence/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (
    !access.principal.permissions.includes("settings:view") &&
    !access.principal.permissions.includes("settings:manage")
  )
    return json({ error: "Sem permissão para consultar a configuração de IA." }, 403);
  const state =
    (await loadIntelligenceState(access.db, access.tenantId, access.principal.id)) ??
    emptyIntelligenceState(access.tenantId);
  return json({ state });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para salvar a configuração de IA." }, 403);
  const body = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const validation = validateIntelligenceState(body?.state, access.tenantId);
  if (!validation.ok) return json({ error: validation.error }, 400);
  const state = await saveIntelligenceState(access.db, access.tenantId, access.principal.id, validation.state);
  return json({ state });
}
