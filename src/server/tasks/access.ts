import { functionalAreasMatchQueue } from "@/src/domain/copilot/daily-briefing";
import type { TaskRecord, TaskState } from "@/src/domain/tasks/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";

export function taskVisibleTo(task: TaskRecord, principal: ServerPrincipal, operationCompanies: Map<string, string>) {
  const operationId = task.snapshot.operationId;
  if (operationId) {
    const company = operationCompanies.get(operationId);
    if (!company || !principalHasCompanyScope(principal, company)) return false;
  }
  return (
    principal.access === "admin" ||
    task.owner === principal.name ||
    functionalAreasMatchQueue(principal.functionalAreas, task.department)
  );
}

export const visibleTaskState = (
  state: TaskState | null,
  principal: ServerPrincipal,
  operationCompanies: Map<string, string>,
): TaskState | null =>
  state ? { ...state, tasks: state.tasks.filter(task => taskVisibleTo(task, principal, operationCompanies)) } : null;
