/** Projeção somente de leitura do ledger e das notificações autorizadas, sem nova persistência. */
import type { RadarEvent, RadarSnapshot } from "@/src/domain/home/radar";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { listPublishedNotifications } from "@/src/server/outbox/publisher";
import { listAccessChangeNotifications } from "@/src/server/access/notifications";
import { readMarketIndicator } from "@/src/server/copilot/market";
import { canAccessView, type AccessUser } from "@/src/domain/access/model";
import { jsonParameter } from "@/src/server/database/postgres";

type EventRow = {
  event_id: string;
  event_type: string;
  created_at: string;
  operation_id: string;
  vehicle: string;
  cedent: string;
  stage: number;
  status: string;
};
const labels: Record<string, string> = {
  OPERATION_CREATED: "Nova operação",
  OPERATION_STAGE_CHANGED: "Operação mudou de etapa",
  OPERATION_STATUS_CHANGED: "Situação da operação alterada",
};

export async function loadRadar(db: DecisionDatabase, principal: ServerPrincipal): Promise<RadarSnapshot> {
  if (principal.status !== "active" || !principal.permissions.includes("dashboard:view"))
    throw new Error("Sem acesso ao radar.");
  const user: AccessUser = { ...principal, email: "", tenantIds: [principal.tenantId], responsibilities: [] };
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const [operationEvents, notifications, accessNotifications, market] = await Promise.all([
    principal.permissions.includes("operations:view")
      ? db
          .prepare(
            `select event.event_id, event.event_type, event.created_at, operation.operation_id,
              operation.vehicle, operation.payload->>'cedent' as cedent,
              (event.payload->>'stage')::integer as stage, event.payload->>'status' as status
       from private.domain_events event
       join private.operations operation on operation.tenant_id = event.tenant_id
         and operation.operation_id = event.aggregate_id
       where event.tenant_id = ? and event.aggregate_type = 'Operation'
         and event.event_type in ('OPERATION_CREATED', 'OPERATION_STAGE_CHANGED', 'OPERATION_STATUS_CHANGED')
         and event.created_at >= now() - interval '7 days'
         and (?::boolean or lower(trim(operation.vehicle)) in (select jsonb_array_elements_text(?::jsonb)))
       order by event.created_at desc, event.event_id desc limit 50`,
          )
          .bind(
            principal.tenantId,
            principal.companyScopes.includes("*"),
            jsonParameter(principal.companyScopes.map(s => s.trim().toLocaleLowerCase("pt-BR"))),
          )
          .all<EventRow>()
      : { results: [] },
    listPublishedNotifications(db, principal.tenantId, principal),
    listAccessChangeNotifications(db, principal.tenantId, principal),
    Promise.all([readMarketIndicator("cdi", today), readMarketIndicator("selic", today)]),
  ]);
  const events: RadarEvent[] = operationEvents.results
    .filter(row => principalHasCompanyScope(principal, row.vehicle))
    .map(row => ({
      id: row.event_id,
      title: labels[row.event_type] ?? "Operação atualizada",
      summary: `${row.cedent || row.operation_id} · etapa ${row.stage} · ${row.status}`,
      at: row.created_at,
      source: row.vehicle,
      view: "operations",
      operationId: row.operation_id,
    }));
  for (const item of [...notifications, ...accessNotifications]) {
    if (item.requiredPermission && !principal.permissions.includes(item.requiredPermission)) continue;
    if (!canAccessView(user, item.view)) continue;
    events.push({
      id: item.id,
      title: item.title,
      summary: item.summary,
      at: item.createdAt,
      source: item.department || "STRATO",
      view: item.view,
      operationId: principal.permissions.includes("operations:view") ? item.operationId || undefined : undefined,
    });
  }
  return {
    events: [...new Map(events.map(event => [event.id, event])).values()]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.id.localeCompare(b.id))
      .slice(0, 20),
    market,
    checkedAt: now.toISOString(),
  };
}
