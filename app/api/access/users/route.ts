import { env } from "cloudflare:workers";
import { type AccessState } from "@/src/domain/access/model";
import { loadAccessDirectory, saveAccessDirectory } from "@/src/server/access/repository";
import { sessionPrincipal } from "@/src/server/access/session";
import { supabaseForRequest } from "@/src/supabase/request";
import { type Json } from "@/src/supabase/database.types";

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
  const supabase = supabaseForRequest(request.headers);
  if (supabase) {
    const { data, error } = await supabase.rpc("strato_access_directory", { p_tenant_id: access.tenantId });
    if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 500);
    return json(data);
  }
  return json(await loadAccessDirectory(env.DB, access.tenantId, access.principal.id));
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const state = (await request.json()) as AccessState;
  if (state?.version !== 2 || !Array.isArray(state.users)) return json({ error: "Diretório de acesso inválido." }, 400);
  const supabase = supabaseForRequest(request.headers);
  if (supabase) {
    const { data, error } = await supabase.rpc("strato_save_access_directory", {
      p_tenant_id: access.tenantId,
      p_state: state as unknown as Json,
    });
    if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 400);
    return json(data);
  }
  await saveAccessDirectory(env.DB, access.tenantId, access.principal.id, state);
  return json(await loadAccessDirectory(env.DB, access.tenantId, access.principal.id));
}
