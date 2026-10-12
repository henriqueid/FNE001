import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { hashPassword, passwordValidationError } from "@/src/server/access/password";
import { registerAccessRequest } from "@/src/server/access/repository";
import { getDatabase } from "@/src/server/database/postgres";
import {
  cpfValidationError,
  loginNameValidationError,
  normalizeCpf,
  normalizeLoginName,
} from "@/src/domain/access/identity";

const departments: UserDepartment[] = [
  "Diretoria",
  "Operações",
  "Risco e crédito",
  "Controladoria",
  "Financeiro",
  "Comercial",
  "Cadastro",
];

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
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
  const password = body.password ?? "";
  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Informe nome e e-mail válidos." }, 400);
  const loginError = loginNameValidationError(loginName);
  if (loginError) return json({ error: loginError }, 400);
  const cpfError = cpfValidationError(cpf);
  if (cpfError) return json({ error: cpfError }, 400);
  const passwordError = passwordValidationError(password);
  if (passwordError) return json({ error: passwordError }, 400);
  const department = departments.includes(body.department as UserDepartment) ? body.department! : "Operações";
  const result = await registerAccessRequest(getDatabase(), {
    tenantId,
    name,
    email,
    loginName,
    cpf,
    department,
    passwordHash: await hashPassword(password),
  });
  return json(
    {
      status: result.status,
      message:
        result.status === "existing"
          ? "Este e-mail, login ou CPF já possui cadastro ou solicitação. Tente entrar ou fale com o administrador."
          : "Solicitação enviada. Um administrador precisa definir o perfil e aprovar seu acesso.",
    },
    result.status === "existing" ? 200 : 201,
  );
}
