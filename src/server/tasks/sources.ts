import { allPermissions } from "@/src/domain/access/model";
import { buildAttentionItems, type AttentionItem } from "@/src/domain/copilot/attention-center";
import { portfolioHomeTitles } from "@/src/domain/portfolio/model";
import { listAccessChangeNotifications } from "@/src/server/access/notifications";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadOperations } from "@/src/server/operations/storage";
import { loadPublishedTaskNotifications } from "@/src/server/outbox/publisher";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";

export async function loadAutomaticTaskSources(db: DecisionDatabase, tenantId: string, now: string) {
  const system: ServerPrincipal = {
    id: "task-source",
    name: "STRATO Intelligence",
    role: "Sistema",
    department: "Diretoria",
    functionalAreas: ["Diretoria"],
    access: "admin",
    status: "active",
    tenantId,
    permissions: allPermissions,
    authorityIds: [],
    companyScopes: ["*"],
  };
  const [operations, portfolio, notifications, accessChanges] = await Promise.all([
    loadOperations(db, tenantId),
    loadCurrentPortfolio(db, tenantId),
    loadPublishedTaskNotifications(db, tenantId),
    listAccessChangeNotifications(db, tenantId, system),
  ]);
  const items = buildAttentionItems({
    operations,
    titles: portfolioHomeTitles(portfolio),
    user: { ...system, responsibilities: [] },
    referenceDate: now.slice(0, 10),
  });
  const operationsById = new Map(operations.map(operation => [operation.id, operation]));
  for (const notification of [...notifications, ...accessChanges]) {
    const operation = operationsById.get(notification.operationId);
    if (notification.operationId && !operation) continue;
    const item: AttentionItem = {
      ...notification,
      company: operation?.vehicle,
      operation,
    };
    // A audiência de uma notificação de alçada não pode desaparecer na deduplicação.
    if (!items.some(existing => existing.id === item.id)) items.push(item);
  }
  return { items, operationCompanies: new Map(operations.map(operation => [operation.id, operation.vehicle])) };
}
