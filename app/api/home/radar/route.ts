/** Radar autenticado: sessão e permissões resolvidas no servidor; resposta privada e sem cache. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadRadar } from "@/src/server/home/radar";
import { principalHasCompanyScope } from "@/src/server/access/scope";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie, x-strato-tenant-id" },
  });
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("dashboard:view")) return json({ error: "Sem acesso ao radar." }, 403);
  const company = new URL(request.url).searchParams.get("company");
  if (company && company !== "Consolidado" && !principalHasCompanyScope(principal, company))
    return json({ error: "Empresa fora do seu acesso." }, 403);
  const scoped = company && company !== "Consolidado" ? { ...principal, companyScopes: [company] } : principal;
  try {
    return json(await loadRadar(db, scoped));
  } catch (error) {
    console.error(
      "Radar indisponível",
      error instanceof Error ? error.name : "UnknownError",
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "sem código",
    );
    return json({ error: "Não foi possível atualizar o radar. Tente novamente." }, 503);
  }
}
