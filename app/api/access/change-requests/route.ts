import { accessProfileError } from "@/src/domain/access/governance";
import { allPermissions, type AccessUser } from "@/src/domain/access/model";
import { sessionPrincipal } from "@/src/server/access/session";
import {
  AccessChangeConflictError,
  decideAccessChange,
  listPendingAccessChanges,
  requestAccessChange,
} from "@/src/server/access/change-requests";
import { loadAccessDirectory } from "@/src/server/access/repository";
import { getDatabase } from "@/src/server/database/postgres";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("users:manage"))
    return { error: json({ error: "Usuário sem permissão para administrar acessos." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error!;
  return json({ requests: await listPendingAccessChanges(access.db, access.tenantId) });
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error!;
  const body = (await request.json().catch(() => null)) as {
    subjectUserId?: string;
    proposed?: AccessUser;
    reason?: string;
  } | null;
  if (
    !body ||
    typeof body.subjectUserId !== "string" ||
    !body.subjectUserId ||
    !body.proposed ||
    (body.reason !== undefined && typeof body.reason !== "string")
  )
    return json({ error: "Proposta de acesso inválida." }, 400);
  const validationError = accessProfileError(body.proposed, allPermissions);
  if (validationError) return json({ error: validationError }, 400);
  try {
    const changeId = await requestAccessChange(
      access.db,
      access.tenantId,
      access.principal,
      body.subjectUserId,
      body.proposed,
      body.reason ?? "",
    );
    return json(
      {
        changeId,
        applied: changeId === null,
        state:
          changeId === null ? await loadAccessDirectory(access.db, access.tenantId, access.principal.id) : undefined,
        requests: await listPendingAccessChanges(access.db, access.tenantId),
      },
      201,
    );
  } catch (error) {
    if (error instanceof AccessChangeConflictError) return json({ error: error.message }, 409);
    if ((error as { code?: string }).code === "23505")
      return json({ error: "Este usuário já possui uma alteração crítica pendente." }, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error!;
  if (access.principal.access !== "admin")
    return json({ error: "Somente administrador pode decidir alterações críticas de acesso." }, 403);
  const body = (await request.json().catch(() => null)) as {
    changeId?: string;
    decision?: "APPROVED" | "REJECTED";
    reason?: string;
  } | null;
  if (
    !body ||
    typeof body.changeId !== "string" ||
    !body.changeId ||
    (body.reason !== undefined && typeof body.reason !== "string") ||
    !["APPROVED", "REJECTED"].includes(body.decision ?? "")
  )
    return json({ error: "Decisão de acesso inválida." }, 400);
  try {
    await decideAccessChange(
      access.db,
      access.tenantId,
      access.principal,
      body.changeId,
      body.decision!,
      body.reason ?? "",
    );
    return json({
      requests: await listPendingAccessChanges(access.db, access.tenantId),
      state: await loadAccessDirectory(access.db, access.tenantId, access.principal.id),
    });
  } catch (error) {
    if (error instanceof AccessChangeConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}
