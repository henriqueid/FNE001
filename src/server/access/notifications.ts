/** Projeta solicitações persistidas de acesso na Central do Dia, inclusive pendências anteriores à publicação. */
import type { PublishedNotification } from "@/src/domain/notifications/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { ServerPrincipal } from "./repository";
import { listPendingAccessChanges } from "./change-requests";

export async function listAccessChangeNotifications(
  db: DecisionDatabase,
  tenantId: string,
  principal: ServerPrincipal,
): Promise<PublishedNotification[]> {
  if (
    principal.status !== "active" ||
    principal.tenantId !== tenantId ||
    !principal.permissions.includes("users:manage")
  )
    return [];
  const requests = await listPendingAccessChanges(db, tenantId);
  return requests
    .filter(request => principal.access === "admin" || request.requestedById === principal.id)
    .map(request => ({
      id: `access-${request.id}`,
      sourceEventId: request.id,
      decisionId: request.id,
      operationId: "",
      kind: "decision",
      tone: "warning",
      title: `Ajuste de acesso de ${request.proposed.name} aguarda decisão`,
      summary: `Solicitado por ${request.requestedBy}.`,
      detail: request.reason,
      impact: "Alteração de perfil pendente",
      nextAction: "Abrir Configurações → Usuários e acessos e decidir a solicitação",
      owner: "Administrador",
      department: "Diretoria",
      timing: "Agora",
      view: "settings",
      requiredPermission: "users:manage",
      createdAt: request.requestedAt,
    }));
}
