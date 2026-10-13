import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  return json({ portfolio: await loadCurrentPortfolio(db, tenantId) });
}
