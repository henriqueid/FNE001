import type {
  IntegrationChangeProposal,
  IntegrationChangeRequest,
  IntegrationConfigurationSnapshot,
} from "@/src/domain/integrations/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import {
  integrationConnectionFromRow,
  type IntegrationCapability,
  type IntegrationConfigurationRow,
} from "./configuration-repository";

type RequestRow = {
  change_id: string;
  request_hash: string;
  capability: IntegrationCapability;
  previous_payload: IntegrationConfigurationSnapshot[];
  proposed_payload: IntegrationConfigurationSnapshot[];
  reason: string;
  status: IntegrationChangeRequest["status"];
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

export class IntegrationConfigurationConflictError extends Error {}

const stable = (items: IntegrationChangeProposal[]) =>
  items
    .map(item => ({
      providerId: item.providerId,
      capability: item.capability,
      status: item.status,
      priority: item.priority,
    }))
    .sort((left, right) => left.providerId.localeCompare(right.providerId));

const same = (left: IntegrationChangeProposal[], right: IntegrationChangeProposal[]) =>
  JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function integrationChangeRequestHash(input: {
  tenantId: string;
  actorId: string;
  capability: IntegrationCapability;
  proposed: IntegrationChangeProposal[];
  reason: string;
}) {
  const normalized = { ...input, proposed: stable(input.proposed), reason: input.reason.trim() };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(normalized)));
  return hex(new Uint8Array(digest));
}

const mapped = (row: RequestRow): IntegrationChangeRequest => ({
  id: row.change_id,
  capability: row.capability,
  previous: row.previous_payload,
  proposed: row.proposed_payload,
  reason: row.reason,
  status: row.status,
  requestedById: row.requested_by,
  requestedBy: row.requested_by_name,
  requestedAt: row.requested_at,
  decidedById: row.decided_by ?? undefined,
  decidedBy: row.decided_by_name ?? undefined,
  decidedAt: row.decided_at ?? undefined,
  decisionReason: row.decision_reason ?? undefined,
});

const requestColumns = `change_id, request_hash, capability, previous_payload, proposed_payload,
  reason, status, requested_by, requested_by_name, requested_at,
  decided_by, decided_by_name, decided_at, decision_reason`;

async function configurationSnapshot(
  db: DecisionDatabase,
  tenantId: string,
  capability: IntegrationCapability,
  lock = false,
) {
  const rows = await db
    .prepare(
      `select provider_id, capability, status, priority, config, updated_at
       from private.integration_provider_configs
       where tenant_id = ? and capability = ?
       order by provider_id${lock ? " for update" : ""}`,
    )
    .bind(tenantId, capability)
    .all<IntegrationConfigurationRow>();
  return rows.results.map(row => {
    const connection = integrationConnectionFromRow(row);
    return {
      providerId: connection.providerId,
      capability: connection.capability,
      status: connection.status,
      priority: connection.priority,
      sourceType: connection.sourceType,
      label: connection.label,
    } satisfies IntegrationConfigurationSnapshot;
  });
}

function canonicalProposal(
  current: IntegrationConfigurationSnapshot[],
  proposed: IntegrationChangeProposal[],
  capability: IntegrationCapability,
) {
  if (!current.length)
    throw new IntegrationConfigurationConflictError("A capacidade não possui provedores cadastrados.");
  if (!Array.isArray(proposed) || proposed.length !== current.length)
    throw new IntegrationConfigurationConflictError("A proposta deve preservar todos os provedores da capacidade.");
  const currentByProvider = new Map(current.map(item => [item.providerId, item]));
  const priorities = new Set<number>();
  const providerIds = new Set<string>();
  const normalized = proposed.map(item => {
    const prior = currentByProvider.get(item.providerId);
    if (!prior || item.capability !== capability || providerIds.has(item.providerId))
      throw new IntegrationConfigurationConflictError("A proposta contém provedor ou capacidade inválida.");
    if (!["ACTIVE", "DEGRADED", "PLANNED", "SUSPENDED"].includes(item.status))
      throw new IntegrationConfigurationConflictError("O estado proposto é inválido.");
    if (
      !Number.isInteger(item.priority) ||
      item.priority < 1 ||
      item.priority > 10_000 ||
      priorities.has(item.priority)
    )
      throw new IntegrationConfigurationConflictError("Use prioridades inteiras, positivas e sem repetição.");
    providerIds.add(item.providerId);
    priorities.add(item.priority);
    return { ...prior, status: item.status, priority: item.priority };
  });
  if (providerIds.size !== currentByProvider.size)
    throw new IntegrationConfigurationConflictError("A proposta deve preservar todos os provedores da capacidade.");
  return normalized.sort((left, right) => left.providerId.localeCompare(right.providerId));
}

export async function listIntegrationProviderChanges(db: DecisionDatabase, tenantId: string) {
  const rows = await db
    .prepare(
      `select ${requestColumns}
       from private.integration_provider_change_requests
       where tenant_id = ?
       order by (status = 'PENDING') desc, requested_at desc
       limit 30`,
    )
    .bind(tenantId)
    .all<RequestRow>();
  return rows.results.map(mapped);
}

export async function requestIntegrationProviderChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  capability: IntegrationCapability,
  proposed: IntegrationChangeProposal[],
  reason: string,
  commandId: string,
) {
  if (reason.trim().length < 10)
    throw new IntegrationConfigurationConflictError("Informe um motivo com pelo menos 10 caracteres.");
  const requestHash = await integrationChangeRequestHash({ tenantId, actorId: actor.id, capability, proposed, reason });
  const work = async (transaction: DecisionDatabase) => {
    const replay = await transaction
      .prepare(
        `select ${requestColumns}
         from private.integration_provider_change_requests
         where tenant_id = ? and command_id = ?`,
      )
      .bind(tenantId, commandId)
      .first<RequestRow>();
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new IntegrationConfigurationConflictError("A chave deste comando já foi usada com outro conteúdo.");
      return mapped(replay);
    }
    const previous = await configurationSnapshot(transaction, tenantId, capability);
    const candidate = canonicalProposal(previous, proposed, capability);
    if (same(previous, candidate)) throw new IntegrationConfigurationConflictError("Nenhuma alteração foi informada.");
    const changeId = `integration-provider-${crypto.randomUUID()}`;
    const eventId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
    const inserted = await transaction
      .prepare(
        `with requested as (
           insert into private.integration_provider_change_requests
             (tenant_id, change_id, command_id, request_hash, capability,
              previous_payload, proposed_payload, reason, requested_by, requested_by_name)
           values (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)
           returning ${requestColumns}
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, actor_id, correlation_id, payload)
           values (?, ?, 'IntegrationProviderChangeRequest', ?, 1,
             'INTEGRATION_PROVIDER_CHANGE_REQUESTED', ?, ?,
             jsonb_build_object('capability', ?::text, 'reason', ?::text))
           returning event_id
         ), enqueued as (
           insert into private.domain_outbox
             (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
              aggregate_version, payload)
           select ?, ?, event_id, 'strato.integrations', 'IntegrationProviderChangeRequest', ?, 1,
             jsonb_build_object('eventId', event_id, 'eventType',
               'INTEGRATION_PROVIDER_CHANGE_REQUESTED', 'tenantId', ?::text,
               'changeId', ?::text, 'capability', ?::text)
           from recorded
         )
         select * from requested`,
      )
      .bind(
        tenantId,
        changeId,
        commandId,
        requestHash,
        capability,
        jsonParameter(previous),
        jsonParameter(candidate),
        reason.trim(),
        actor.id,
        actor.name,
        tenantId,
        eventId,
        changeId,
        actor.id,
        commandId,
        capability,
        reason.trim(),
        tenantId,
        outboxId,
        changeId,
        tenantId,
        changeId,
        capability,
      )
      .first<RequestRow>();
    if (!inserted) throw new IntegrationConfigurationConflictError("Não foi possível registrar a proposta.");
    return mapped(inserted);
  };
  return db.transaction ? db.transaction(work) : work(db);
}

export async function decideIntegrationProviderChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason: string,
) {
  if (decisionReason.trim().length < 5)
    throw new IntegrationConfigurationConflictError(
      "Informe uma justificativa de decisão com pelo menos 5 caracteres.",
    );
  const work = async (transaction: DecisionDatabase) => {
    const row = await transaction
      .prepare(
        `select ${requestColumns}
         from private.integration_provider_change_requests
         where tenant_id = ? and change_id = ? for update`,
      )
      .bind(tenantId, changeId)
      .first<RequestRow>();
    if (!row || row.status !== "PENDING")
      throw new IntegrationConfigurationConflictError("A proposta não está mais pendente.");
    if (row.requested_by === actor.id)
      throw new IntegrationConfigurationConflictError("O solicitante não pode decidir a própria proposta.");
    const current = await configurationSnapshot(transaction, tenantId, row.capability, true);
    if (!same(current, row.previous_payload))
      throw new IntegrationConfigurationConflictError("A configuração efetiva mudou. Rejeite e refaça a proposta.");
    const candidate = canonicalProposal(current, row.proposed_payload, row.capability);
    if (decision === "APPROVED") {
      for (const item of candidate)
        await transaction
          .prepare(
            `update private.integration_provider_configs
             set status = ?, priority = ?, updated_by = ?, updated_at = now()
             where tenant_id = ? and provider_id = ? and capability = ?`,
          )
          .bind(item.status, item.priority, actor.id, tenantId, item.providerId, row.capability)
          .run();
    }
    const now = new Date().toISOString();
    const eventType =
      decision === "APPROVED" ? "INTEGRATION_PROVIDER_CHANGE_APPROVED" : "INTEGRATION_PROVIDER_CHANGE_REJECTED";
    const eventId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
    await transaction
      .prepare(
        `with decided as (
           update private.integration_provider_change_requests set
             status = ?, decided_by = ?, decided_by_name = ?, decided_at = ?, decision_reason = ?
           where tenant_id = ? and change_id = ? and status = 'PENDING'
           returning change_id
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, actor_id, correlation_id, payload)
           select ?, ?, 'IntegrationProviderChangeRequest', change_id, 2,
             ?::text, ?, change_id,
             jsonb_build_object('decisionReason', ?::text, 'capability', ?::text)
           from decided returning event_id
         )
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id,
            aggregate_version, payload)
         select ?, ?, event_id, 'strato.integrations', 'IntegrationProviderChangeRequest', ?, 2,
           jsonb_build_object('eventId', event_id, 'eventType', ?::text,
             'tenantId', ?::text, 'changeId', ?::text, 'capability', ?::text)
         from recorded`,
      )
      .bind(
        decision,
        actor.id,
        actor.name,
        now,
        decisionReason.trim(),
        tenantId,
        changeId,
        tenantId,
        eventId,
        eventType,
        actor.id,
        decisionReason.trim(),
        row.capability,
        tenantId,
        outboxId,
        changeId,
        eventType,
        tenantId,
        changeId,
        row.capability,
      )
      .run();
    return mapped({
      ...row,
      status: decision,
      decided_by: actor.id,
      decided_by_name: actor.name,
      decided_at: now,
      decision_reason: decisionReason.trim(),
    });
  };
  return db.transaction ? db.transaction(work) : work(db);
}
