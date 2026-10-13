import type { ServerPrincipal } from "./repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

const normalizedScope = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function principalHasCompanyScope(principal: Pick<ServerPrincipal, "companyScopes">, company: string) {
  const requested = normalizedScope(company);
  if (!requested) return false;
  return principal.companyScopes.some(scope => scope === "*" || normalizedScope(scope) === requested);
}

export function filterCompanyScope<T>(
  principal: Pick<ServerPrincipal, "companyScopes">,
  values: T[],
  companyOf: (value: T) => string,
) {
  return values.filter(value => principalHasCompanyScope(principal, companyOf(value)));
}

export function operationWriteScopeError(
  principal: Pick<ServerPrincipal, "companyScopes">,
  currentCompany: string | null,
  requestedCompany: string,
) {
  if (currentCompany !== null && !principalHasCompanyScope(principal, currentCompany))
    return "A operação existente pertence a uma empresa fora do seu escopo.";
  if (!principalHasCompanyScope(principal, requestedCompany))
    return "Esta operação pertence a uma empresa fora do seu escopo.";
  return null;
}

export async function principalCanAccessOperation(
  db: DecisionDatabase,
  principal: Pick<ServerPrincipal, "tenantId" | "companyScopes">,
  operationId: string,
) {
  const company = await operationCompany(db, principal.tenantId, operationId);
  return company !== null && principalHasCompanyScope(principal, company);
}

export async function operationCompany(db: DecisionDatabase, tenantId: string, operationId: string) {
  const operation = await db
    .prepare("select vehicle from private.operations where tenant_id = ? and operation_id = ?")
    .bind(tenantId, operationId)
    .first<{ vehicle: string }>();
  return operation?.vehicle ?? null;
}
