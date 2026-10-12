import { validateParty, type Party } from "@/src/domain/registry/parties";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadRegistryParties, saveRegistryParty } from "@/src/server/registry/repository";

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
  return json({ parties: await loadRegistryParties(access.db, access.tenantId) });
}
export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("registry:edit"))
    return json({ error: "Sem permissão para editar cadastros." }, 403);
  const party = (await request.json().catch(() => null)) as Party | null;
  if (!party?.id || !Array.isArray(party.roles)) return json({ error: "Cadastro inválido." }, 400);
  const existing = await loadRegistryParties(access.db, access.tenantId);
  const blocking = validateParty(party, existing).find(issue => issue.blocking);
  if (blocking) return json({ error: blocking.message }, 400);
  try {
    await saveRegistryParty(access.db, access.tenantId, access.principal.id, party);
    return json({ party });
  } catch (reason) {
    console.error("registry_party_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar o cadastro. Tente novamente." }, 500);
  }
}
