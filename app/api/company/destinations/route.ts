import {
  validateCompanyDestination,
  type CompanyDestinationDraft,
} from "@/src/domain/company/destination";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  loadCompanyDestinations,
  loadCompanyProfile,
  saveCompanyDestination,
} from "@/src/server/registry/repository";

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
  if (!access.principal.permissions.some(permission => permission === "settings:view" || permission === "settings:manage"))
    return json({ error: "Sem permissão para consultar empresas e veículos." }, 403);
  const destinations = await loadCompanyDestinations(access.db, access.tenantId);
  if (destinations.length) return json({ destinations });
  const primary = await loadCompanyProfile(access.db, access.tenantId);
  return json({
    destinations: primary
      ? [
          {
            id: `primary-${access.tenantId}`,
            legalName: primary.legalName,
            tradeName: primary.tradeName,
            name: primary.tradeName,
            document: primary.document,
            institution:
              primary.institutionType === "FIDC" || primary.institutionType === "Securitizadora"
                ? primary.institutionType
                : "Factoring",
            detail: "Empresa principal",
            status: "ACTIVE",
          },
        ]
      : [],
  });
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para cadastrar empresas e veículos." }, 403);
  const input = (await request.json().catch(() => null)) as CompanyDestinationDraft | null;
  if (!input) return json({ error: "Dados do cadastro ausentes." }, 400);
  const error = validateCompanyDestination(input);
  if (error) return json({ error }, 400);
  try {
    const destination = await saveCompanyDestination(access.db, access.tenantId, access.principal.id, input);
    return json({ destination }, 201);
  } catch (reason) {
    console.error("company_destination_save_failed", reason);
    const duplicate = reason instanceof Error && /unique|duplicate/i.test(reason.message);
    return json(
      { error: duplicate ? "Este CNPJ já está cadastrado neste ambiente." : "Não foi possível salvar o cadastro." },
      duplicate ? 409 : 500,
    );
  }
}
