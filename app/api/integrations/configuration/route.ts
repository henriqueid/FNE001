import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import type { IntegrationChangeProposal } from "@/src/domain/integrations/model";
import {
  integrationCapabilities,
  loadIntegrationState,
  type IntegrationCapability,
} from "@/src/server/integrations/configuration-repository";
import {
  decideIntegrationProviderChange,
  IntegrationConfigurationConflictError,
  listIntegrationProviderChanges,
  requestIntegrationProviderChange,
} from "@/src/server/integrations/provider-change-repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("settings:view") && !principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para consultar integrações." }, 403);
  const integrations = await loadIntegrationState(db, tenantId);
  if (principal.permissions.includes("settings:manage"))
    integrations.changeRequests = await listIntegrationProviderChanges(db, tenantId);
  return json({ integrations });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para propor alterações de integração." }, 403);
  const body = (await request.json().catch(() => null)) as {
    capability?: IntegrationCapability;
    proposed?: IntegrationChangeProposal[];
    reason?: string;
    commandId?: string;
  } | null;
  if (
    !body?.capability ||
    !integrationCapabilities.includes(body.capability) ||
    !Array.isArray(body.proposed) ||
    !body.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(body.commandId)
  )
    return json({ error: "Proposta de integração inválida." }, 400);
  try {
    await requestIntegrationProviderChange(
      db,
      tenantId,
      principal,
      body.capability,
      body.proposed,
      body.reason ?? "",
      body.commandId,
    );
    const integrations = await loadIntegrationState(db, tenantId);
    integrations.changeRequests = await listIntegrationProviderChanges(db, tenantId);
    return json({ integrations }, 201);
  } catch (error) {
    if (error instanceof IntegrationConfigurationConflictError) return json({ error: error.message }, 409);
    if ((error as { code?: string }).code === "23505")
      return json({ error: "Já existe uma proposta pendente para esta capacidade." }, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("settings:manage"))
    return json({ error: "Sem permissão para decidir alterações de integração." }, 403);
  const body = (await request.json().catch(() => null)) as {
    changeId?: string;
    decision?: "APPROVED" | "REJECTED";
    reason?: string;
  } | null;
  if (!body?.changeId || !["APPROVED", "REJECTED"].includes(body.decision ?? ""))
    return json({ error: "Decisão de integração inválida." }, 400);
  try {
    await decideIntegrationProviderChange(db, tenantId, principal, body.changeId, body.decision!, body.reason ?? "");
    const integrations = await loadIntegrationState(db, tenantId);
    integrations.changeRequests = await listIntegrationProviderChanges(db, tenantId);
    return json({ integrations });
  } catch (error) {
    if (error instanceof IntegrationConfigurationConflictError) return json({ error: error.message }, 409);
    throw error;
  }
}
