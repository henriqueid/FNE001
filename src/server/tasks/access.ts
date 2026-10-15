import { functionalAreasMatchQueue } from "@/src/domain/copilot/daily-briefing";
import { taskIsExplicitlyAssigned, type TaskRecord, type TaskState } from "@/src/domain/tasks/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";

function taskWithinCompanyScope(task: TaskRecord, principal: ServerPrincipal, operationCompanies: Map<string, string>) {
  const operationId = task.snapshot.operationId;
  if (!operationId) return true;
  const company = operationCompanies.get(operationId);
  return Boolean(company && principalHasCompanyScope(principal, company));
}

export function taskVisibleTo(task: TaskRecord, principal: ServerPrincipal, operationCompanies: Map<string, string>) {
  if (!taskWithinCompanyScope(task, principal, operationCompanies)) return false;
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
  if (!taskWithinCompanyScope(task, principal, operationCompanies)) return false;
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
