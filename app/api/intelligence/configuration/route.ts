import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { openAIConfiguration } from "@/src/server/intelligence/openai-gateway";
import { createBudgetedOpenAIResponse } from "@/src/server/intelligence/budgeted-response";
import { IntelligenceBudgetError } from "@/src/server/intelligence/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function authorize(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("settings:manage"))
    return { error: json({ error: "Sem permissão para configurar a inteligência." }, 403) } as const;
  return { principal, db, tenantId } as const;
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  return json({ configuration: openAIConfiguration() });
}

export async function POST(request: Request) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  const configuration = openAIConfiguration();
  if (!configuration.configured)
    return json({ configuration, error: "Defina OPENAI_API_KEY no servidor antes de testar a conexão." }, 422);
  try {
    const result = await createBudgetedOpenAIResponse(
      access.db,
      access.tenantId,
      "Responda somente com a palavra OK.",
      "Você está executando um teste de conectividade. Não inclua explicações.",
      { actorId: access.principal.id, maxOutputTokens: 16, timeoutMs: 30_000 },
    );
    const test = { ...result, ok: result.text.trim().toLocaleUpperCase().includes("OK") };
    return json({ configuration, test });
  } catch (error) {
    if (error instanceof IntelligenceBudgetError) return json({ configuration, error: error.message }, 403);
    console.error("openai_connection_test_failed", error);
    return json(
      { configuration, error: error instanceof Error ? error.message : "Não foi possível testar a conexão." },
      502,
    );
  }
}
