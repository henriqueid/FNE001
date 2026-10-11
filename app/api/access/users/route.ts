import { env } from "cloudflare:workers";
import { type AccessState } from "@/src/domain/access/model";
import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { hashPassword, passwordValidationError } from "@/src/server/access/password";
import {
  AccessEmailConflictError,
  createManagedAccessUser,
  loadAccessDirectory,
  saveAccessDirectory,
} from "@/src/server/access/repository";
import { sessionPrincipal } from "@/src/server/access/session";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const departments: UserDepartment[] = [
  "Diretoria",
  "Operações",
  "Risco e crédito",
  "Controladoria",
  "Financeiro",
  "Comercial",
  "Cadastro",
];

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const principal = await sessionPrincipal(env.DB, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("users:manage"))
    return { error: json({ error: "Usuário sem permissão para administrar acessos." }, 403) } as const;
  return { tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  return json(await loadAccessDirectory(env.DB, access.tenantId, access.principal.id));
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
    department?: UserDepartment;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Informe nome e login válidos." }, 400);
  const passwordError = passwordValidationError(body.password ?? "");
  if (passwordError) return json({ error: passwordError }, 400);
  const department = departments.includes(body.department as UserDepartment) ? body.department! : "Operações";
  try {
    const createdUserId = await createManagedAccessUser(env.DB, {
      tenantId: access.tenantId,
      actorId: access.principal.id,
      name,
      email,
      department,
      passwordHash: await hashPassword(body.password!),
    });
    return json(
      {
        createdUserId,
        state: await loadAccessDirectory(env.DB, access.tenantId, access.principal.id),
      },
      201,
    );
  } catch (error) {
    if (error instanceof AccessEmailConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const state = (await request.json()) as AccessState;
  if (state?.version !== 2 || !Array.isArray(state.users)) return json({ error: "Diretório de acesso inválido." }, 400);
  await saveAccessDirectory(env.DB, access.tenantId, access.principal.id, state);
  return json(await loadAccessDirectory(env.DB, access.tenantId, access.principal.id));
}
