import type { Permission } from "@/src/domain/access/model";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  fetchBrasilApiBanks,
  fetchBrasilApiCep,
  fetchBrasilApiHolidays,
  fetchBrasilApiPixParticipants,
} from "@/src/server/integrations/cnpj-provider";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const allowed: Permission[] = [
  "operations:edit",
  "portfolio:manage",
  "finance:view",
  "registry:edit",
  "settings:manage",
];

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.some(permission => allowed.includes(permission)))
    return json({ error: "Sem permissão para consultar fontes públicas." }, 403);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind")?.trim();
  try {
    if (kind === "cep") return json({ evidence: await fetchBrasilApiCep(url.searchParams.get("value") ?? "") });
    if (kind === "banks") return json({ banks: await fetchBrasilApiBanks() });
    if (kind === "holidays") {
      const year = Number(url.searchParams.get("year"));
      return json({ holidays: await fetchBrasilApiHolidays(year, url.searchParams.get("state") ?? undefined) });
    }
    if (kind === "pix-participants") return json({ participants: await fetchBrasilApiPixParticipants() });
    return json({ error: "Consulta pública não reconhecida." }, 400);
  } catch (reason) {
    console.error("public_data_lookup_failed", { kind, reason });
    return json(
      { error: reason instanceof Error ? reason.message : "A fonte pública está temporariamente indisponível." },
      503,
    );
  }
}
