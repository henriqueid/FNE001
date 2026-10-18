/** Identidade interna e erros sem detalhes do banco ou credenciais. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { IntelligenceBudgetError } from "@/src/server/intelligence/repository";
import { CopilotAccessError } from "./service";
export class CopilotHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function copilotRequestContext(request: Request) {
  const tenant = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenant) throw new CopilotHttpError("Empresa não informada.", 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenant);
  if (!principal) throw new CopilotHttpError("Sessão ausente ou expirada.", 401);
  if (!principal.permissions.includes("dashboard:view"))
    throw new CopilotHttpError("Seu perfil não possui acesso ao Copiloto.", 403);
  return { db, principal };
}
export function copilotFailure(error: unknown) {
  if (error instanceof CopilotHttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof CopilotAccessError || error instanceof IntelligenceBudgetError)
    return Response.json({ error: error.message }, { status: 403 });
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "42P01")
    return Response.json(
      { error: "As tabelas de memória do Copiloto ainda não foram instaladas neste ambiente." },
      { status: 503 },
    );
  console.error("copilot_request_failed", { code: typeof code === "string" ? code : "request_failed" });
  return Response.json(
    { error: "Não foi possível concluir a consulta. Os dados foram preservados; tente novamente." },
    { status: 502 },
  );
}
