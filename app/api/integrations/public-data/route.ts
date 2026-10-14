import type { Permission } from "@/src/domain/access/model";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  fetchBrasilApiBanks,
  fetchBrasilApiCep,
  fetchBrasilApiHolidays,
  fetchBrasilApiPixParticipants,
} from "@/src/server/integrations/cnpj-provider";
import {
  activeIntegrationProvider,
  type IntegrationCapability,
} from "@/src/server/integrations/configuration-repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const allowed: Permission[] = [
  "operations:edit",
  "portfolio:manage",
  "finance:view",
  "registry:view",
  "registry:edit",
  "settings:view",
  "settings:manage",
];

const capabilityByKind: Record<string, IntegrationCapability> = {
  cep: "CEP_LOOKUP",
  banks: "BANK_DIRECTORY",
  holidays: "HOLIDAY_CALENDAR",
  "pix-participants": "PIX_DIRECTORY",
};

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
  const capability = kind ? capabilityByKind[kind] : undefined;
  if (!capability) return json({ error: "Consulta pública não reconhecida." }, 400);

  const provider = await activeIntegrationProvider(db, tenantId, capability);
  if (!provider) return json({ error: "Esta fonte de dados não está habilitada para a empresa." }, 503);
  if (provider.providerId !== "BRASIL_API")
    return json({ error: "O provedor ativo ainda não possui conector executável no STRATO." }, 503);

  try {
    if (kind === "cep") return json({ evidence: await fetchBrasilApiCep(url.searchParams.get("value") ?? "") });
    if (kind === "banks") return json({ banks: await fetchBrasilApiBanks() });
    if (kind === "holidays") {
      const year = Number(url.searchParams.get("year"));
      return json({ holidays: await fetchBrasilApiHolidays(year, url.searchParams.get("state") ?? undefined) });
    }
    if (kind === "pix-participants") return json({ participants: await fetchBrasilApiPixParticipants() });
  } catch (reason) {
    console.error("public_data_lookup_failed", { kind, reason });
    return json(
      { error: reason instanceof Error ? reason.message : "A fonte pública está temporariamente indisponível." },
      503,
    );
  }
}
