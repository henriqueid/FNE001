import { env } from "cloudflare:workers";
import { createDemoSession, sessionCookie, sessionPrincipal } from "@/src/server/access/session";

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const principal = await sessionPrincipal(env.DB, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  return json({ principal });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    return json({ error: "A entrada demonstrativa é bloqueada fora do ambiente local." }, 403);
  const session = await createDemoSession(env.DB);
  return json({ authenticated: true, expiresAt: session.expiresAt }, 201, {
    "set-cookie": sessionCookie(session.token, session.expiresAt, url.protocol === "https:"),
  });
}
