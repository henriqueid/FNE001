import type { AccessUser } from "@/src/domain/access/model";
import { taskAssigneeError, taskAudiencePermissions } from "@/src/domain/tasks/assignment";
import { functionalAreasMatchQueue } from "@/src/domain/copilot/daily-briefing";
import { taskIsExplicitlyAssigned, type TaskRecord, type TaskState } from "@/src/domain/tasks/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";

function taskWithinCompanyScope(
  task: TaskRecord,
  principal: Pick<ServerPrincipal, "companyScopes">,
  operationCompanies: Map<string, string>,
) {
  const operationId = task.snapshot.operationId;
  if (task.snapshot.company && !principalHasCompanyScope(principal, task.snapshot.company)) return false;
  if (!operationId) return task.id !== "portfolio-overdue";
  const company = operationCompanies.get(operationId);
  return Boolean(company && principalHasCompanyScope(principal, company));
}

function taskAudienceAllowed(task: TaskRecord, principal: ServerPrincipal) {
  const required = taskAudiencePermissions(task.snapshot);
  return (
    required.every(permission => principal.permissions?.includes(permission)) &&
    (!task.snapshot.authorityId || principal.authorityIds?.includes(task.snapshot.authorityId))
  );
}

export function taskVisibleTo(task: TaskRecord, principal: ServerPrincipal, operationCompanies: Map<string, string>) {
  if (!taskWithinCompanyScope(task, principal, operationCompanies) || !taskAudienceAllowed(task, principal))
    return false;
  // Uma tarefa assumida/delegada é nominal. A área continua servindo apenas para filas ainda
  // não atribuídas, evitando que o delegante mantenha a pendência depois da transferência.
  if (taskIsExplicitlyAssigned(task))
    return task.ownerUserId ? task.ownerUserId === principal.id : task.owner === principal.name;
  return (
    principal.access === "admin" ||
    task.owner === principal.name ||
    functionalAreasMatchQueue(principal.functionalAreas, task.department)
  );
}

/**
 * Recorte usado para sincronizar a Central do Dia entre servidor e cliente.
 * O administrador recebe também as tarefas delegadas a outras pessoas para que a fila automática
 * não as recrie no painel do delegante; a barreira de empresa continua valendo para todos os perfis.
 * GET, validação do PUT e resposta do PUT precisam usar este mesmo recorte.
 */
export function taskSyncVisibleTo(
  task: TaskRecord,
  principal: ServerPrincipal,
  operationCompanies: Map<string, string>,
) {
  if (!taskWithinCompanyScope(task, principal, operationCompanies) || !taskAudienceAllowed(task, principal))
    return false;
  return principal.access === "admin" || taskVisibleTo(task, principal, operationCompanies);
}

export const syncTaskState = (
  state: TaskState | null,
  principal: ServerPrincipal,
  operationCompanies: Map<string, string>,
): TaskState | null =>
  state
    ? { ...state, tasks: state.tasks.filter(task => taskSyncVisibleTo(task, principal, operationCompanies)) }
    : null;

export const visibleTaskState = (
  state: TaskState | null,
  principal: ServerPrincipal,
  operationCompanies: Map<string, string>,
): TaskState | null =>
  state ? { ...state, tasks: state.tasks.filter(task => taskVisibleTo(task, principal, operationCompanies)) } : null;

export function taskAssignmentError(
  task: TaskRecord,
  user: AccessUser,
  tenantId: string,
  operationCompanies = new Map<string, string>(),
): string | null {
  const audienceError = taskAssigneeError(task.snapshot, user, tenantId);
  if (audienceError) return audienceError;
  if (!taskWithinCompanyScope(task, user, operationCompanies))
    return "O destinatário não possui acesso à empresa desta tarefa.";
  return null;
}
