import type { EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import { validateEligibilityPolicyState } from "@/src/domain/eligibility/policy-persistence";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  loadEligibilityPolicyState,
  PolicyCommandConflictError,
  policyRequestHash,
  PolicyTransitionError,
  saveEligibilityPolicyState,
} from "@/src/server/eligibility/policy-repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("settings:manage"))
    return { error: json({ error: "Sem permissão para administrar políticas." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  return json({ policies: await loadEligibilityPolicyState(access.db, access.tenantId) });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const command = (await request.json().catch(() => null)) as {
    policies?: EligibilityPolicyState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.policies ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    !command.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando de políticas inválido." }, 400);
  const validationError = validateEligibilityPolicyState(command.policies);
  if (validationError) return json({ error: validationError }, 400);
  const expectedVersion = Number(command.expectedVersion);
  const requestHash = await policyRequestHash({
    tenantId: access.tenantId,
    actorId: access.principal.id,
    expectedVersion,
    state: command.policies,
  });
  try {
    const policies = await saveEligibilityPolicyState(
      access.db,
      access.tenantId,
      { id: access.principal.id, name: access.principal.name },
      command.policies,
      expectedVersion,
      command.commandId,
      requestHash,
    );
    if (!policies)
      return json(
        { error: "As políticas foram alteradas por outra pessoa. Atualize a página antes de tentar novamente." },
        409,
      );
    return json({ policies });
  } catch (reason) {
    if (reason instanceof PolicyCommandConflictError || reason instanceof PolicyTransitionError)
      return json({ error: reason.message }, 409);
    console.error("eligibility_policy_state_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar as políticas. Tente novamente." }, 500);
  }
}
