/** Projeta decisões do ledger sem copiar nem modificar seus eventos canônicos. */
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { listOperationDecisionEvents, type DecisionDatabase } from "@/src/server/decisions/repository";
import type { CopilotSources } from "./sources";
export async function loadLedgerBehavior(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  sources: CopilotSources,
): Promise<BehaviorEvent[]> {
  if (!principal.permissions.includes("operations:view") || !sources.knowledge.operations.length) return [];
  const events = await listOperationDecisionEvents(
    db,
    principal.tenantId,
    sources.knowledge.operations.map(operation => operation.id),
  );
  return events.flatMap(event => {
    const company = sources.entityCompanies.get(`operation:${event.operationId}`);
    if (!company) return [];
    return [
      {
        id: `ledger:${event.eventId}`,
        tenantId: principal.tenantId,
        company,
        entityId: `operation:${event.operationId}`,
        actorId: event.actorId,
        at: event.createdAt,
        kind: "decision" as const,
        source: "ledger" as const,
        visibility: "company" as const,
        status: "recorded" as const,
        text: `${event.eventType} · ${event.outcome}. ${event.humanRationale ?? "Sem justificativa adicional"} Política ${event.policyId} ${event.policyVersion}; alçada ${event.authorityId ?? "não aplicável"}. Este histórico não concede nova autorização.`,
        evidenceRefs: [`decision:${event.eventId}`, event.inputSnapshotId, ...event.supportingEvidenceRefs].filter(
          Boolean,
        ),
        validUntil: event.validUntil,
      },
    ];
  });
}
