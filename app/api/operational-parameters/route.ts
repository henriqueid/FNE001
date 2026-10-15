import { emptyOperationalDefaults, validateOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  loadOperationalParameterState,
  OperationalParameterConflictError,
  operationalParameterSaveHash,
  saveOperationalParameterState,
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
  return json({ state });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para salvar parâmetros operacionais." }, 403);
  const body = (await request.json().catch(() => null)) as {
    state?: ReturnType<typeof emptyOperationalDefaults>;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !body?.state ||
    !Number.isInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 0 ||
    !body.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(body.commandId)
  )
    return json({ error: "Parâmetros operacionais inválidos." }, 400);
  const validationError = validateOperationalDefaults(body.state);
  if (validationError) return json({ error: validationError }, 400);
  const expectedVersion = Number(body.expectedVersion);
  const requestHash = await operationalParameterSaveHash({
    tenantId: access.tenantId,
    actorId: access.principal.id,
    expectedVersion,
    state: body.state,
  });
  try {
    const state = await saveOperationalParameterState(
      access.db,
      access.tenantId,
      access.principal,
      body.state,
      expectedVersion,
      body.commandId,
      requestHash,
    );
    return json({ state });
  } catch (error) {
    if (error instanceof OperationalParameterConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}
