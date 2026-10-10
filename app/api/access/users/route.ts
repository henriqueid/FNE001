import { env } from "cloudflare:workers";
import { type AccessState } from "@/src/domain/access/model";
import { loadAccessDirectory, saveAccessDirectory } from "@/src/server/access/repository";
import { sessionPrincipal } from "@/src/server/access/session";

const json = (body: unknown, status = 200) => Response.json(body, { status });

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

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const state = (await request.json()) as AccessState;
  if (state?.version !== 2 || !Array.isArray(state.users)) return json({ error: "Diretório de acesso inválido." }, 400);
  await saveAccessDirectory(env.DB, access.tenantId, access.principal.id, state);
  return json(await loadAccessDirectory(env.DB, access.tenantId, access.principal.id));
}
