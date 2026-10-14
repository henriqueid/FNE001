import { emptyOperationalDefaults, validateOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  decideOperationalParameterChange,
  listOperationalParameterChanges,
  loadOperationalParameterState,
  OperationalParameterConflictError,
  operationalParameterRequestHash,
  requestOperationalParameterChange,
} from "@/src/server/registry/operational-parameter-requests";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (
    !access.principal.permissions.includes("settings:view") &&
    !access.principal.permissions.includes("settings:manage")
  )
    return json({ error: "Sem permissão para consultar parâmetros operacionais." }, 403);
  const state = (await loadOperationalParameterState(access.db, access.tenantId)) ?? {
    ...emptyOperationalDefaults(),
    persistenceVersion: 0,
  };
  const requests = access.principal.permissions.includes("settings:manage")
    ? await listOperationalParameterChanges(access.db, access.tenantId)
    : [];
  return json({ state, requests });
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para propor parâmetros operacionais." }, 403);
  const body = (await request.json().catch(() => null)) as {
    proposed?: ReturnType<typeof emptyOperationalDefaults>;
    expectedVersion?: number;
    reason?: string;
    commandId?: string;
  } | null;
  if (
    !body?.proposed ||
    !Number.isInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 0 ||
    !body.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(body.commandId)
  )
    return json({ error: "Proposta de parâmetros inválida." }, 400);
  const validationError = validateOperationalDefaults(body.proposed);
  if (validationError) return json({ error: validationError }, 400);
  const expectedVersion = Number(body.expectedVersion);
  const reason = body.reason ?? "";
  const requestHash = await operationalParameterRequestHash({
    tenantId: access.tenantId,
    actorId: access.principal.id,
    expectedVersion,
    proposed: body.proposed,
    reason,
  });
  try {
    await requestOperationalParameterChange(
      access.db,
      access.tenantId,
      access.principal,
      body.proposed,
      expectedVersion,
      reason,
      body.commandId,
      requestHash,
    );
    return json({ requests: await listOperationalParameterChanges(access.db, access.tenantId) }, 201);
  } catch (error) {
    if (error instanceof OperationalParameterConflictError) return json({ error: error.message }, 409);
    if ((error as { code?: string }).code === "23505")
      return json({ error: "Já existe uma proposta de parâmetros aguardando decisão." }, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para decidir parâmetros operacionais." }, 403);
  const body = (await request.json().catch(() => null)) as {
    changeId?: string;
    decision?: "APPROVED" | "REJECTED";
    reason?: string;
  } | null;
  if (!body?.changeId || !["APPROVED", "REJECTED"].includes(body.decision ?? ""))
    return json({ error: "Decisão de parâmetros inválida." }, 400);
  try {
    const state = await decideOperationalParameterChange(
      access.db,
      access.tenantId,
      access.principal,
      body.changeId,
      body.decision!,
      body.reason ?? "",
    );
    return json({ state, requests: await listOperationalParameterChanges(access.db, access.tenantId) });
  } catch (error) {
    if (error instanceof OperationalParameterConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}
