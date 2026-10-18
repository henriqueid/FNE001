/** Persistência append-only com reautorização de empresa, entidade, autor e módulo. */
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { CopilotReport } from "@/src/domain/copilot/report";
import { type BehaviorEvent, type MemoryDraft } from "@/src/domain/copilot/behavior";

type ReportRow = { tenant_id: string; actor_id: string; payload: CopilotReport };
type MemoryRow = { payload: BehaviorEvent; review_status?: BehaviorEvent["status"]; reviewer_id?: string };
const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export function canReadMemory(principal: ServerPrincipal, event: BehaviorEvent, entities: Map<string, string>) {
  const company = entities.get(event.entityId);
  return (
    principal.tenantId === event.tenantId &&
    !!company &&
    same(company, event.company) &&
    principalHasCompanyScope(principal, company) &&
    (event.visibility === "company" || event.actorId === principal.id)
  );
}
export function canReadReport(principal: ServerPrincipal, row: ReportRow, entities: Map<string, string>) {
  return (
    row.tenant_id === principal.tenantId &&
    row.actor_id === principal.id &&
    row.payload.requiredPermissions.every(permission => principal.permissions.includes(permission)) &&
    row.payload.companies.every(company => principalHasCompanyScope(principal, company)) &&
    row.payload.entityRefs.every(ref => {
      const company = entities.get(ref);
      return (
        !!company &&
        principalHasCompanyScope(principal, company) &&
        row.payload.companies.some(original => same(original, company))
      );
    })
  );
}
export function reviewMemoryError(
  principal: ServerPrincipal,
  event: BehaviorEvent,
  status: "validated" | "rejected" | "revoked",
) {
  if (status === "revoked" && principal.id === event.actorId) return null;
  if (!principal.permissions.includes("settings:manage"))
    return "A revisão exige permissão de gestão de configurações.";
  if (status === "validated" && (!["correction", "guidance"].includes(event.kind) || principal.id === event.actorId))
    return "Somente correções e orientações podem ser revisadas por um segundo responsável; observações não viram fatos.";
  return null;
}

export async function saveReport(db: DecisionDatabase, principal: ServerPrincipal, report: CopilotReport) {
  await db
    .prepare("insert into private.copilot_reports (tenant_id, report_id, actor_id, payload) values (?, ?, ?, ?::jsonb)")
    .bind(principal.tenantId, report.id, principal.id, jsonParameter(report))
    .run();
}
export async function readReport(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  reportId: string,
  entities: Map<string, string>,
) {
  const row = await db
    .prepare(
      "select tenant_id, actor_id, payload from private.copilot_reports where tenant_id = ? and report_id = ? and actor_id = ?",
    )
    .bind(principal.tenantId, reportId, principal.id)
    .first<ReportRow>();
  return row && canReadReport(principal, row, entities) ? row.payload : null;
}
export async function recentReports(db: DecisionDatabase, principal: ServerPrincipal, entities: Map<string, string>) {
  const rows = await db
    .prepare(
      "select tenant_id, actor_id, payload from private.copilot_reports where tenant_id = ? and actor_id = ? order by created_at desc, report_id desc limit 10",
    )
    .bind(principal.tenantId, principal.id)
    .all<ReportRow>();
  return rows.results.filter(row => canReadReport(principal, row, entities)).map(row => row.payload);
}
export async function listMemories(db: DecisionDatabase, principal: ServerPrincipal, entities: Map<string, string>) {
  const rows = await db
    .prepare(
      `select m.payload, r.status as review_status, r.reviewer_id
    from private.copilot_memories m left join lateral (
      select status, reviewer_id from private.copilot_memory_reviews r
      where r.tenant_id = m.tenant_id and r.memory_id = m.memory_id order by review_version desc limit 1
    ) r on true where m.tenant_id = ? and (m.visibility = 'company' or m.actor_id = ?) order by m.created_at desc, m.memory_id desc`,
    )
    .bind(principal.tenantId, principal.id)
    .all<MemoryRow>();
  return rows.results
    .map(row => ({
      ...row.payload,
      ...(row.review_status ? { status: row.review_status, reviewerId: row.reviewer_id } : {}),
    }))
    .filter(event => canReadMemory(principal, event, entities));
}
export async function appendMemory(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  draft: MemoryDraft,
  entities: Map<string, string>,
) {
  const event: BehaviorEvent = {
    id: crypto.randomUUID(),
    tenantId: principal.tenantId,
    actorId: principal.id,
    company: draft.company,
    entityId: draft.entityId,
    kind: draft.kind,
    text: draft.text,
    question: draft.question,
    queryKey: draft.queryKey,
    at: new Date().toISOString(),
    evidenceRefs: [draft.entityId],
    visibility: draft.visibility ?? "private",
    status: draft.kind === "correction" || draft.kind === "guidance" ? "pending" : "recorded",
    source: "memory",
    validUntil: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  };
  if (!canReadMemory(principal, event, entities)) throw new Error("Entidade ou empresa fora do seu acesso atual.");
  await db
    .prepare(
      "insert into private.copilot_memories (tenant_id, memory_id, actor_id, company, entity_id, visibility, payload) values (?, ?, ?, ?, ?, ?, ?::jsonb)",
    )
    .bind(
      principal.tenantId,
      event.id,
      principal.id,
      event.company,
      event.entityId,
      event.visibility,
      jsonParameter(event),
    )
    .run();
  return event;
}
export async function reviewMemory(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  memoryId: string,
  status: "validated" | "rejected" | "revoked",
  rationale: string,
  entities: Map<string, string>,
) {
  const event = (await listMemories(db, principal, entities)).find(item => item.id === memoryId);
  if (!event) throw new Error("Memória indisponível para seu acesso.");
  const error = reviewMemoryError(principal, event, status);
  if (error) throw new Error(error);
  await db
    .prepare(
      "insert into private.copilot_memory_reviews (tenant_id, memory_id, reviewer_id, status, rationale) values (?, ?, ?, ?, ?)",
    )
    .bind(principal.tenantId, memoryId, principal.id, status, rationale)
    .run();
}
