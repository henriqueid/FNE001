import {
  createDemoSession,
  endSession,
  loginSession,
  SESSION_COOKIE,
  sessionCookie,
  sessionPrincipal,
} from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const db = getDatabase();
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const probe = request.headers.get("x-strato-auth-probe") === "1";
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return probe ? json({ authenticated: false }) : json({ error: "Sessão ausente ou expirada." }, 401);
  return json(probe ? { authenticated: true, principal } : { principal });
}

export async function POST(request: Request) {
  const db = getDatabase();
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { mode?: string; email?: string; password?: string };
  let session;
  if (body.mode === "demo") {
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
      return json({ error: "A entrada demonstrativa é bloqueada fora do ambiente local." }, 403);
    session = await createDemoSession(db);
  } else {
    const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
    if (!tenantId || !body.email?.trim() || !body.password) return json({ error: "Informe e-mail e senha." }, 400);
    session = await loginSession(db, tenantId, body.email, body.password);
    if (!session) return json({ error: "E-mail, senha ou acesso inválido." }, 401);
  }
  return json({ authenticated: true, expiresAt: session.expiresAt }, 201, {
    "set-cookie": sessionCookie(session.token, session.expiresAt, url.protocol === "https:"),
  });
}

export async function DELETE(request: Request) {
  await endSession(getDatabase(), request.headers);
  return json({ authenticated: false }, 200, {
    "set-cookie": `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
  });
}
