import { validateCommercialState } from "@/src/domain/commercial/persistence";
import type { CommercialState } from "@/src/domain/commercial/types";
import { sessionPrincipal } from "@/src/server/access/session";
import { CommercialScopeError, filterCommercialState, mergeCommercialScope } from "@/src/server/commercial/access";
import {
  commercialRequestHash,
  CommercialCommandConflictError,
  CommercialTransitionError,
  loadCommercialState,
  saveCommercialState,
} from "@/src/server/commercial/repository";
import { getDatabase } from "@/src/server/database/postgres";

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
    !access.principal.permissions.includes("portfolio:manage") &&
    !access.principal.permissions.includes("risk:decide")
  )
    return json({ error: "Sem permissão para consultar os vínculos comerciais." }, 403);
  const commercial = await loadCommercialState(access.db, access.tenantId);
  return json({ commercial: commercial ? filterCommercialState(commercial, access.principal) : null });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("portfolio:manage"))
    return json({ error: "Sem permissão para alterar o Comercial." }, 403);
  const command = (await request.json().catch(() => null)) as {
    commercial?: CommercialState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.commercial ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    !command.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando comercial inválido." }, 400);
  const validationError = validateCommercialState(command.commercial);
  if (validationError) return json({ error: validationError }, 400);
  const previous = await loadCommercialState(access.db, access.tenantId);
  let merged: CommercialState;
  try {
    merged = mergeCommercialScope(previous, command.commercial, access.principal);
  } catch (reason) {
    if (reason instanceof CommercialScopeError) return json({ error: reason.message }, 403);
    throw reason;
  }
  const mergedValidationError = validateCommercialState(merged);
  if (mergedValidationError) return json({ error: mergedValidationError }, 400);
  const registersDecision = merged.committees.some(committee => {
    const prior = previous?.committees.find(item => item.id === committee.id);
    return prior?.status === "Em pauta" && committee.status !== "Em pauta";
  });
  if (registersDecision && !access.principal.permissions.includes("risk:decide"))
    return json({ error: "Somente um usuário com alçada de risco pode registrar a decisão do comitê." }, 403);
  const expectedVersion = Number(command.expectedVersion);
  const requestHash = await commercialRequestHash({
    tenantId: access.tenantId,
    actorId: access.principal.id,
    expectedVersion,
    state: merged,
  });
  try {
    const commercial = await saveCommercialState(
      access.db,
      access.tenantId,
      access.principal.id,
      access.principal.name,
      merged,
      expectedVersion,
      command.commandId,
      requestHash,
    );
    if (!commercial)
      return json({ error: "O Comercial foi alterado por outra pessoa. Atualize a tela antes de salvar." }, 409);
    return json({ commercial: filterCommercialState(commercial, access.principal) });
  } catch (reason) {
    if (reason instanceof CommercialCommandConflictError || reason instanceof CommercialTransitionError)
      return json({ error: reason.message }, 409);
    console.error("commercial_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar o Comercial. Tente novamente." }, 500);
  }
}
