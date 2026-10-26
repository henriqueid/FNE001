import { executeRegistryPartyCommand, RegistryCommandError } from "@/src/server/registry/party-command";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadRegistryParties, loadRegistryPartyStats, searchRegistryParties } from "@/src/server/registry/repository";

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
  if (!access.principal.permissions.includes("registry:view"))
    return json({ error: "Sem permissão para consultar cadastros." }, 403);
  const params = new URL(request.url).searchParams;
  if (params.get("stats") === "1") return json({ stats: await loadRegistryPartyStats(access.db, access.tenantId) });
  if (params.has("role") || params.has("q") || params.has("offset")) {
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    return json(
      await searchRegistryParties(access.db, access.tenantId, {
        role: params.get("role") ?? undefined,
        query: params.get("q") ?? undefined,
        status: params.get("status") ?? undefined,
        limit,
        offset,
      }),
    );
  }
  return json({ parties: await loadRegistryParties(access.db, access.tenantId) });
}
export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("registry:edit"))
    return json({ error: "Sem permissão para editar cadastros." }, 403);
  const input = await request.json().catch(() => null);
  try {
    const party = await executeRegistryPartyCommand(access.db, access.tenantId, access.principal, input);
    return json({ party });
  } catch (reason) {
    if (reason instanceof RegistryCommandError) return json({ error: reason.message }, reason.status);
    console.error("registry_party_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar o cadastro. Tente novamente." }, 500);
  }
}
