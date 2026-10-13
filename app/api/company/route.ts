import { validateCompanyProfile, type CompanyProfile } from "@/src/domain/company/profile";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadCompanyProfile, saveCompanyProfile } from "@/src/server/registry/repository";

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
    return json({ error: "Sem permissão para consultar os dados institucionais." }, 403);
  return json({ company: await loadCompanyProfile(access.db, access.tenantId) });
}
export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para cadastrar a empresa." }, 403);
  const company = (await request.json().catch(() => null)) as CompanyProfile | null;
  if (!company) return json({ error: "Dados da empresa ausentes." }, 400);
  const error = validateCompanyProfile(company);
  if (error) return json({ error }, 400);
  try {
    await saveCompanyProfile(access.db, access.tenantId, access.principal.id, company);
    return json({ company: await loadCompanyProfile(access.db, access.tenantId) });
  } catch (reason) {
    console.error("company_profile_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar a empresa. Tente novamente." }, 500);
  }
}
