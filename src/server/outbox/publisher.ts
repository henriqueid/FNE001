import { type Permission } from "@/src/domain/access/model";
import { type DecisionEvent, type DecisionEventType } from "@/src/domain/decisions/model";
import { type PublishedNotification, type OutboxHealth } from "@/src/domain/notifications/model";
import { type ServerPrincipal } from "@/src/server/access/repository";
import { type DecisionDatabase } from "@/src/server/decisions/repository";

const MAX_ATTEMPTS = 5;
const RETRY_SECONDS = [60, 300, 1_800, 7_200, 21_600];

const schema = [
  `CREATE TABLE IF NOT EXISTS decision_notifications (
    tenant_id TEXT NOT NULL, notification_id TEXT NOT NULL, source_outbox_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL, decision_id TEXT NOT NULL, operation_id TEXT NOT NULL,
    kind TEXT NOT NULL, tone TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
    detail TEXT NOT NULL, impact TEXT NOT NULL, next_action TEXT NOT NULL, owner TEXT NOT NULL,
    department TEXT NOT NULL, timing TEXT NOT NULL, view TEXT NOT NULL,
    required_permission TEXT, authority_id TEXT, status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TEXT NOT NULL, resolved_at TEXT,
    PRIMARY KEY (tenant_id, notification_id), UNIQUE (tenant_id, source_outbox_id)
  )`,
  "CREATE INDEX IF NOT EXISTS decision_notifications_open_idx ON decision_notifications (tenant_id, status, created_at)",
  "CREATE INDEX IF NOT EXISTS decision_notifications_decision_idx ON decision_notifications (tenant_id, decision_id, status)",
];

export async function ensurePublisherSchema(db: DecisionDatabase) {
  for (const statement of schema) await db.prepare(statement).run();
}

type OutboxRow = {
  tenant_id: string;
  outbox_id: string;
  event_id: string;
  payload_json: string;
  attempts: number;
};

const resolutionEvents = new Set<DecisionEventType>([
  "EXCEPTION_APPROVED",
  "EXCEPTION_REJECTED",
  "CONDITION_SATISFIED",
  "CONDITION_EXPIRED",
  "PAYMENT_CONFIRMED",
  "DECISION_REVIEWED",
]);

type NotificationDraft = Omit<PublishedNotification, "id" | "sourceEventId" | "createdAt">;

export function notificationForDecisionEvent(event: DecisionEvent): NotificationDraft | null {
  const common = {
    decisionId: event.decisionId,
    operationId: event.operationId,
    owner: "Responsável pela operação",
    timing: "Agora",
  };
  if (event.eventType === "POLICY_BLOCKED")
    return {
      ...common,
      kind: "decision",
      tone: "critical",
      title: `Operação ${event.operationId} bloqueada pela política`,
      summary: "O motor determinístico encontrou uma regra impeditiva que exige tratamento.",
      detail: event.reasonCodes.length
        ? `Motivos: ${event.reasonCodes.join(", ")}.`
        : "Consulte as evidências e o snapshot usados pelo motor.",
      impact: "Operação impedida de avançar",
      nextAction: "Revisar regras, evidências e encaminhamento",
      department: "Risco e crédito",
      view: "operations",
      requiredPermission: "risk:decide",
    };
  if (event.eventType === "EXCEPTION_REQUESTED")
    return {
      ...common,
      kind: "decision",
      tone: "critical",
      title: `Exceção da operação ${event.operationId} aguarda decisão`,
      summary: "Uma exceção foi encaminhada para a alçada responsável.",
      detail: event.humanRationale || "Revise a justificativa, as métricas e as evidências antes de decidir.",
      impact: "Decisão de alçada pendente",
      nextAction: "Abrir a operação e registrar a decisão",
      department: "Risco e crédito",
      view: "operations",
      requiredPermission: "risk:decide",
      authorityId: event.authorityId,
    };
  if (event.eventType === "CONDITION_PENDING")
    return {
      ...common,
      kind: "decision",
      tone: "warning",
      title: `Condição pendente na operação ${event.operationId}`,
      summary: "A decisão possui condição precedente ainda não comprovada.",
      detail: event.conditions.map(condition => condition.description).join(" · ") || "Consulte a condição registrada.",
      impact: "Formalização permanece bloqueada",
      nextAction: "Anexar a evidência ou revisar a condição",
      department: "Controladoria",
      view: "operations",
      requiredPermission: "controlleria:formalize",
    };
  if (event.eventType === "OPERATION_SENT_TO_FORMALIZATION")
    return {
      ...common,
      kind: "release",
      tone: "good",
      title: `Operação ${event.operationId} pronta para formalização`,
      summary: "A operação foi encaminhada para conferência documental.",
      detail: "Confira instrumentos, assinaturas e condições precedentes antes de liberar o fluxo.",
      impact: "Nova formalização na fila",
      nextAction: "Abrir a operação e iniciar a formalização",
      department: "Controladoria",
      timing: "Hoje",
      view: "operations",
      requiredPermission: "controlleria:formalize",
    };
  return null;
}

export function nextRetryAt(attempts: number, now: Date) {
  const seconds = RETRY_SECONDS[Math.min(Math.max(attempts - 1, 0), RETRY_SECONDS.length - 1)];
  return new Date(now.getTime() + seconds * 1_000).toISOString();
}

export function outboxFailureDisposition(previousAttempts: number, now: Date) {
  const attempts = previousAttempts + 1;
  const status = attempts >= MAX_ATTEMPTS ? ("FAILED" as const) : ("PENDING" as const);
  return {
    attempts,
    status,
    availableAt: status === "FAILED" ? now.toISOString() : nextRetryAt(attempts, now),
  };
}

async function markFailure(db: DecisionDatabase, row: OutboxRow, error: unknown, now: Date) {
  const disposition = outboxFailureDisposition(row.attempts, now);
  await db
    .prepare(
      `UPDATE decision_outbox SET status = ?, attempts = ?, available_at = ?, last_error = ?
       WHERE tenant_id = ? AND outbox_id = ? AND status = 'PENDING'`,
    )
    .bind(
      disposition.status,
      disposition.attempts,
      disposition.availableAt,
      (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
      row.tenant_id,
      row.outbox_id,
    )
    .run();
  return disposition.status === "FAILED";
}

async function publishRow(db: DecisionDatabase, row: OutboxRow, now: Date) {
  const event = JSON.parse(row.payload_json) as DecisionEvent;
  const complete = db
    .prepare(
      `UPDATE decision_outbox SET status = 'PUBLISHED', attempts = attempts + 1,
       published_at = ?, last_error = NULL WHERE tenant_id = ? AND outbox_id = ? AND status = 'PENDING'`,
    )
    .bind(now.toISOString(), row.tenant_id, row.outbox_id);
  if (resolutionEvents.has(event.eventType)) {
    const resolve = db
      .prepare(
        `UPDATE decision_notifications SET status = 'RESOLVED', resolved_at = ?
         WHERE tenant_id = ? AND decision_id = ? AND status = 'OPEN'`,
      )
      .bind(now.toISOString(), row.tenant_id, event.decisionId);
    await db.batch([resolve, complete]);
    return;
  }
  const draft = notificationForDecisionEvent(event);
  if (!draft) {
    await complete.run();
    return;
  }
  const notificationId = `decision-${event.eventId}`;
  const insert = db
    .prepare(
      `INSERT OR IGNORE INTO decision_notifications (
        tenant_id, notification_id, source_outbox_id, source_event_id, decision_id, operation_id,
        kind, tone, title, summary, detail, impact, next_action, owner, department, timing, view,
        required_permission, authority_id, status, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, NULL)`,
    )
    .bind(
      row.tenant_id,
      notificationId,
      row.outbox_id,
      event.eventId,
      draft.decisionId,
      draft.operationId,
      draft.kind,
      draft.tone,
      draft.title,
      draft.summary,
      draft.detail,
      draft.impact,
      draft.nextAction,
      draft.owner,
      draft.department,
      draft.timing,
      draft.view,
      draft.requiredPermission ?? null,
      draft.authorityId ?? null,
      now.toISOString(),
    );
  await db.batch([insert, complete]);
}

export async function publishDecisionOutbox(db: DecisionDatabase, tenantId: string, limit = 25, now = new Date()) {
  await ensurePublisherSchema(db);
  const pending = await db
    .prepare(
      `SELECT tenant_id, outbox_id, event_id, payload_json, attempts FROM decision_outbox
       WHERE tenant_id = ? AND status = 'PENDING' AND available_at <= ?
       ORDER BY available_at, created_at LIMIT ?`,
    )
    .bind(tenantId, now.toISOString(), Math.min(Math.max(limit, 1), 100))
    .all<OutboxRow>();
  let published = 0;
  let retried = 0;
  let failed = 0;
  for (const row of pending.results) {
    try {
      await publishRow(db, row, now);
      published++;
    } catch (error) {
      if (await markFailure(db, row, error, now)) failed++;
      else retried++;
    }
  }
  return { processed: pending.results.length, published, retried, failed };
}

export async function publishAllDecisionOutboxes(db: DecisionDatabase, now = new Date()) {
  await ensurePublisherSchema(db);
  const tenants = await db
    .prepare(
      `SELECT DISTINCT tenant_id FROM decision_outbox
       WHERE status = 'PENDING' AND available_at <= ? ORDER BY tenant_id LIMIT 100`,
    )
    .bind(now.toISOString())
    .all<{ tenant_id: string }>();
  return Promise.all(
    tenants.results.map(async ({ tenant_id: tenantId }) => ({
      tenantId,
      result: await publishDecisionOutbox(db, tenantId, 100, now),
    })),
  );
}

type NotificationRow = {
  notification_id: string;
  source_event_id: string;
  decision_id: string;
  operation_id: string;
  kind: PublishedNotification["kind"];
  tone: PublishedNotification["tone"];
  title: string;
  summary: string;
  detail: string;
  impact: string;
  next_action: string;
  owner: string;
  department: string;
  timing: string;
  view: PublishedNotification["view"];
  required_permission: Permission | null;
  authority_id: string | null;
  created_at: string;
};

export async function listPublishedNotifications(db: DecisionDatabase, tenantId: string, principal: ServerPrincipal) {
  await ensurePublisherSchema(db);
  const result = await db
    .prepare(
      `SELECT * FROM decision_notifications WHERE tenant_id = ? AND status = 'OPEN'
       ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(tenantId)
    .all<NotificationRow>();
  return result.results
    .filter(row => !row.required_permission || principal.permissions.includes(row.required_permission))
    .filter(row => !row.authority_id || principal.authorityIds.includes(row.authority_id))
    .filter(row => principal.access === "admin" || row.department === principal.department)
    .map((row): PublishedNotification => ({
      id: row.notification_id,
      sourceEventId: row.source_event_id,
      decisionId: row.decision_id,
      operationId: row.operation_id,
      kind: row.kind,
      tone: row.tone,
      title: row.title,
      summary: row.summary,
      detail: row.detail,
      impact: row.impact,
      nextAction: row.next_action,
      owner: row.owner,
      department: row.department,
      timing: row.timing,
      view: row.view,
      requiredPermission: row.required_permission ?? undefined,
      authorityId: row.authority_id ?? undefined,
      createdAt: row.created_at,
    }));
}

export async function outboxHealth(db: DecisionDatabase, tenantId: string): Promise<OutboxHealth> {
  const result = await db
    .prepare("SELECT status, COUNT(*) AS total FROM decision_outbox WHERE tenant_id = ? GROUP BY status")
    .bind(tenantId)
    .all<{ status: "PENDING" | "PUBLISHED" | "FAILED"; total: number }>();
  const health: OutboxHealth = { pending: 0, failed: 0, published: 0 };
  for (const row of result.results) health[row.status.toLowerCase() as keyof OutboxHealth] = Number(row.total);
  return health;
}

export async function retryFailedOutbox(db: DecisionDatabase, tenantId: string, now = new Date()) {
  const result = await db
    .prepare(
      `UPDATE decision_outbox SET status = 'PENDING', attempts = 0, available_at = ?, last_error = NULL
       WHERE tenant_id = ? AND status = 'FAILED'`,
    )
    .bind(now.toISOString(), tenantId)
    .run();
  return result.success;
}
