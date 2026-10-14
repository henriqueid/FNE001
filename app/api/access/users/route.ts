import { allPermissions, type AccessState } from "@/src/domain/access/model";
import { accessProfileError } from "@/src/domain/access/governance";
import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { hashPassword, passwordValidationError } from "@/src/server/access/password";
import {
  AccessIdentityConflictError,
  AccessCriticalChangeError,
  createManagedAccessUser,
  loadAccessDirectory,
  saveAccessDirectory,
} from "@/src/server/access/repository";
import {
  cpfValidationError,
  loginNameValidationError,
  normalizeCpf,
  normalizeLoginName,
} from "@/src/domain/access/identity";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";

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
  const db = getDatabase();
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("users:manage"))
    return { error: json({ error: "Usuário sem permissão para administrar acessos." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  return json(await loadAccessDirectory(access.db, access.tenantId, access.principal.id));
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    loginName?: string;
    cpf?: string;
    password?: string;
    department?: UserDepartment;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const loginName = normalizeLoginName(body.loginName ?? "");
  const cpf = normalizeCpf(body.cpf ?? "");
  if (name.length < 3) return json({ error: "Informe o nome completo." }, 400);
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    return json({ error: "Informe um e-mail válido ou deixe o campo vazio." }, 400);
  const loginError = loginNameValidationError(loginName);
  if (loginError) return json({ error: loginError }, 400);
  const cpfError = cpfValidationError(cpf);
  if (cpfError) return json({ error: cpfError }, 400);
  const passwordError = passwordValidationError(body.password ?? "");
  if (passwordError) return json({ error: passwordError }, 400);
  const department = departments.includes(body.department as UserDepartment) ? body.department! : "Operações";
  try {
    const createdUserId = await createManagedAccessUser(access.db, {
      tenantId: access.tenantId,
      actorId: access.principal.id,
      name,
      email: email || undefined,
      loginName,
      cpf,
      department,
      passwordHash: await hashPassword(body.password!),
    });
    return json(
      {
        createdUserId,
        state: await loadAccessDirectory(access.db, access.tenantId, access.principal.id),
      },
      201,
    );
  } catch (error) {
    if (error instanceof AccessIdentityConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const state = (await request.json()) as AccessState;
  if (state?.version !== 2 || !Array.isArray(state.users)) return json({ error: "Diretório de acesso inválido." }, 400);
  if (
    state.users.some(
      user =>
        !departments.includes(user.department) ||
        !Array.isArray(user.functionalAreas) ||
        !user.functionalAreas.includes(user.department) ||
        user.functionalAreas.some(area => !departments.includes(area)),
    )
  )
    return json({ error: "As áreas de atuação do usuário são inválidas ou não incluem a área principal." }, 400);
  const invalidProfile = state.users.map(user => accessProfileError(user, allPermissions)).find(Boolean);
  if (invalidProfile) return json({ error: invalidProfile }, 400);
  try {
    await saveAccessDirectory(access.db, access.tenantId, access.principal.id, state);
    return json(await loadAccessDirectory(access.db, access.tenantId, access.principal.id));
  } catch (error) {
    if (error instanceof AccessCriticalChangeError) return json({ error: error.message }, 409);
    throw error;
  }
}
