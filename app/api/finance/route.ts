import type { FinanceState } from "@/src/domain/finance/model";
import { validateFinanceState } from "@/src/domain/finance/persistence";
import { sessionPrincipal } from "@/src/server/access/session";
import { operationCompanyMap } from "@/src/server/access/scope";
import { getDatabase } from "@/src/server/database/postgres";
import { filterFinanceState, mergeFinanceState } from "@/src/server/finance/access";
import {
  financeRequestHash,
  FinanceCommandConflictError,
  FinanceTransitionError,
  loadFinanceState,
  saveFinanceState,
} from "@/src/server/finance/repository";

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
  if (!access.principal.permissions.includes("finance:view"))
    return json({ error: "Sem permissão para consultar o Financeiro." }, 403);
  const [finance, operationCompanies] = await Promise.all([
    loadFinanceState(access.db, access.tenantId),
    operationCompanyMap(access.db, access.tenantId),
  ]);
  return json({ finance: filterFinanceState(finance, access.principal, operationCompanies) });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (!access.principal.permissions.includes("finance:release"))
    return json({ error: "Sem permissão para alterar o Financeiro." }, 403);
  const command = (await request.json().catch(() => null)) as {
    finance?: FinanceState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.finance ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    !command.commandId ||
    !/^[A-Za-z0-9._:-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando financeiro inválido." }, 400);
  const error = validateFinanceState(command.finance);
  if (error) return json({ error }, 400);
  try {
    const expectedVersion = Number(command.expectedVersion);
    const [current, operationCompanies] = await Promise.all([
      loadFinanceState(access.db, access.tenantId),
      operationCompanyMap(access.db, access.tenantId),
    ]);
    if (!current) return json({ error: "O Financeiro ainda precisa ser inicializado." }, 409);
    const merged = mergeFinanceState(current, command.finance, access.principal, operationCompanies);
    if (!merged.state) return json({ error: merged.error }, 403);
    const mergedError = validateFinanceState(merged.state);
    if (mergedError) return json({ error: mergedError }, 400);
    const requestHash = await financeRequestHash({
      tenantId: access.tenantId,
      actorId: access.principal.id,
      expectedVersion,
      state: command.finance,
    });
    const finance = await saveFinanceState(
      access.db,
      access.tenantId,
      access.principal.id,
      merged.state,
      expectedVersion,
      command.commandId,
      requestHash,
    );
    if (!finance)
      return json(
        { error: "O Financeiro foi alterado por outra pessoa. Atualize a tela antes de tentar novamente." },
        409,
      );
    return json({ finance: filterFinanceState(finance, access.principal, operationCompanies) });
  } catch (reason) {
    if (reason instanceof FinanceCommandConflictError || reason instanceof FinanceTransitionError)
      return json({ error: reason.message }, 409);
    console.error("finance_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar o Financeiro. Tente novamente." }, 500);
  }
}
