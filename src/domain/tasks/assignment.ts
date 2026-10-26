import type { AccessUser, Permission } from "@/src/domain/access/model";
import type { AttentionItem } from "@/src/domain/copilot/attention-center";

type TaskAudience = Pick<AttentionItem, "company" | "requiredPermission" | "authorityId" | "view">;

export function taskAudiencePermissions(task: TaskAudience): Permission[] {
  const modulePermission = (
    {
      operations: "operations:view",
      finance: "finance:view",
      portfolio: "portfolio:manage",
      controlleria: "controlleria:formalize",
      registry: "registry:view",
      settings: "settings:manage",
      policies: "settings:manage",
      integrations: "settings:manage",
      live: "users:manage",
      home: "dashboard:view",
      commercial: "portfolio:manage",
    } as const
  )[task.view];
  return [
    ...new Set(
      [modulePermission, task.requiredPermission].filter((permission): permission is Permission => !!permission),
    ),
  ];
}

export function taskAssigneeError(task: TaskAudience, user: AccessUser, tenantId: string): string | null {
  if (user.status !== "active" || !user.tenantIds.includes(tenantId))
    return "O destinatário precisa estar ativo e vinculado a esta organização.";
  if (
    task.company &&
    !user.companyScopes.some(
      scope =>
        scope === "*" || scope.trim().toLocaleLowerCase("pt-BR") === task.company!.trim().toLocaleLowerCase("pt-BR"),
    )
  )
    return "O destinatário não possui acesso à empresa desta tarefa.";
  const required = taskAudiencePermissions(task);
  if (
    !user.permissions.includes("dashboard:view") ||
    required.some(permission => !user.permissions.includes(permission)) ||
    (task.authorityId && !user.authorityIds?.includes(task.authorityId))
  )
    return "O destinatário não possui permissão ou alçada para esta tarefa.";
  return null;
}

export function taskSnoozeError(until: string, now = new Date().toISOString()): string | null {
  const error = "Informe uma data futura válida para o lembrete.";
  const calendar = /^(\d{4})-(\d{2})-(\d{2})T/.exec(until);
  if (!calendar) return error;
  const year = Number(calendar[1]),
    month = Number(calendar[2]),
    day = Number(calendar[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return error;
  const instant = Date.parse(until);
  return !Number.isFinite(instant) || instant <= Date.parse(now) ? error : null;
}
