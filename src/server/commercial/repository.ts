import { digits } from "@/src/domain/commercial/calendar";
import { validateCommercialTransition } from "@/src/domain/commercial/persistence";
import type { CommercialState } from "@/src/domain/commercial/types";
import { approvedProspectToParty } from "@/src/domain/registry/commercial-onboarding";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { findRegistryPartyByDocument, saveRegistryParty } from "@/src/server/registry/repository";

type StateRow = { payload: CommercialState; aggregate_version: number; event_id?: string };
type CommandRow = { request_hash: string; result_payload: CommercialState; result_version: number };

export class CommercialCommandConflictError extends Error {}
export class CommercialTransitionError extends Error {}

const snapshot = (state: CommercialState): CommercialState => {
  const { persistenceVersion: _persistenceVersion, carteiraEvents: _carteiraEvents, ...payload } = state;
  return payload as CommercialState;
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "persistenceVersion" && key !== "carteiraEvents")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function commercialRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: CommercialState;
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(input))));
  return hex(new Uint8Array(digest));
}

export async function loadCommercialState(db: DecisionDatabase, tenantId: string): Promise<CommercialState | null> {
  const row = await db
    .prepare(`select payload, aggregate_version from private.commercial_states where tenant_id = ?`)
    .bind(tenantId)
    .first<StateRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

async function replayed(db: DecisionDatabase, tenantId: string, commandId: string, requestHash: string) {
  const row = await db
    .prepare(
      `select request_hash, result_payload, result_version from private.commercial_commands where tenant_id = ? and command_id = ?`,
    )
    .bind(tenantId, commandId)
    .first<CommandRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw new CommercialCommandConflictError("A chave deste comando comercial já foi usada com outro conteúdo.");
  return { ...row.result_payload, persistenceVersion: row.result_version };
}

function projectionStatements(db: DecisionDatabase, tenantId: string, state: CommercialState) {
  const statements: DecisionStatement[] = [];
  for (const prospect of state.prospects)
    statements.push(
      db
        .prepare(
          `insert into private.commercial_prospects
           (tenant_id, prospect_id, document_digits, name, representative_id, stage, potential,
            lost_reason, converted_at, rejected_at, dossier, payload, updated_at)
           values (?, ?, nullif(?, ''), ?, ?, ?, ?, ?, ?::date, ?::date, ?::jsonb, ?::jsonb, now())
           on conflict (tenant_id, prospect_id) do update set
             document_digits=excluded.document_digits, name=excluded.name, representative_id=excluded.representative_id,
             stage=excluded.stage, potential=excluded.potential, lost_reason=excluded.lost_reason,
             converted_at=excluded.converted_at, rejected_at=excluded.rejected_at, dossier=excluded.dossier,
             payload=excluded.payload, updated_at=now()`,
        )
        .bind(
          tenantId,
          prospect.id,
          digits(prospect.dossier?.document ?? prospect.document ?? ""),
          prospect.name,
          prospect.repId,
          prospect.stage,
          prospect.potential,
          prospect.lost ?? null,
          prospect.convertedAt ?? null,
          prospect.rejectedAt ?? null,
          jsonParameter(prospect.dossier ?? null),
          jsonParameter(prospect),
        ),
    );
  for (const committee of state.committees) {
    const prospect = state.prospects.find(item => item.name === committee.clientName);
    statements.push(
      db
        .prepare(
          `insert into private.commercial_committees
           (tenant_id, committee_id, prospect_id, document_digits, client_name, representative_id,
            meeting_date, request_type, requested_amount, approved_amount, status, payload, decided_at, updated_at)
           values (?, ?, ?, nullif(?, ''), ?, ?, ?::date, ?, ?, ?, ?, ?::jsonb, ?::date, now())
           on conflict (tenant_id, committee_id) do update set
             prospect_id=excluded.prospect_id, document_digits=excluded.document_digits, client_name=excluded.client_name,
             representative_id=excluded.representative_id, meeting_date=excluded.meeting_date,
             request_type=excluded.request_type, requested_amount=excluded.requested_amount,
             approved_amount=excluded.approved_amount, status=excluded.status, payload=excluded.payload,
             decided_at=excluded.decided_at, updated_at=now()`,
        )
        .bind(
          tenantId,
          committee.id,
          prospect?.id ?? null,
          digits(committee.document ?? ""),
          committee.clientName,
          committee.repId,
          committee.date,
          committee.request,
          committee.requested,
          committee.approved ?? null,
          committee.status,
          jsonParameter(committee),
          committee.decidedAt ?? null,
        ),
    );
  }
  return statements;
}

export async function saveCommercialState(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  actorName: string,
  state: CommercialState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
): Promise<CommercialState | null> {
  const existing = await replayed(db, tenantId, commandId, requestHash);
  if (existing) return existing;
  const work = async (transaction: DecisionDatabase) => {
    const previous = await loadCommercialState(transaction, tenantId);
    if ((previous?.persistenceVersion ?? 0) !== expectedVersion) return null;
    const transitionError = validateCommercialTransition(previous, state);
    if (transitionError) throw new CommercialTransitionError(transitionError);
    const eventId = crypto.randomUUID();
    const outboxId = crypto.randomUUID();
    const row = await transaction
      .prepare(
        `with saved as (
           insert into private.commercial_states (tenant_id, aggregate_version, payload, created_by, updated_by)
           values (?, 1, ?::jsonb, ?, ?)
           on conflict (tenant_id) do update set
             aggregate_version=private.commercial_states.aggregate_version + 1,
             payload=excluded.payload, updated_by=excluded.updated_by, updated_at=now()
           where private.commercial_states.aggregate_version = ?
           returning payload, aggregate_version
         ), recorded as (
           insert into private.domain_events
             (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
           select ?, ?, 'CommercialState', ?, saved.aggregate_version,
             case when saved.aggregate_version = 1 then 'COMMERCIAL_STATE_CREATED' else 'COMMERCIAL_STATE_UPDATED' end,
             ?, jsonb_build_object('prospects', ?::integer, 'committees', ?::integer)
           from saved returning event_id, aggregate_version, event_type
         ), enqueued as (
           insert into private.domain_outbox
             (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
           select ?, ?, event_id, 'strato.commercial', 'CommercialState', ?, aggregate_version,
             jsonb_build_object('eventId', event_id, 'eventType', event_type, 'tenantId', ?::text, 'aggregateVersion', aggregate_version)
           from recorded
         )
         select saved.payload, saved.aggregate_version, recorded.event_id
         from saved join recorded on recorded.aggregate_version=saved.aggregate_version`,
      )
      .bind(
        tenantId,
        jsonParameter(snapshot(state)),
        actorId,
        actorId,
        expectedVersion,
        tenantId,
        eventId,
        tenantId,
        actorId,
        state.prospects.length,
        state.committees.length,
        tenantId,
        outboxId,
        tenantId,
        tenantId,
      )
      .first<StateRow>();
    if (!row) return null;
    const projections = projectionStatements(transaction, tenantId, state);
    if (projections.length) await transaction.batch(projections);
    for (const prospect of state.prospects) {
      const wasConverted = previous?.prospects.find(item => item.id === prospect.id)?.convertedAt;
      if (!prospect.convertedAt || wasConverted) continue;
      const generated = approvedProspectToParty(prospect, state, actorName);
      if (!generated) continue;
      const registered = await findRegistryPartyByDocument(transaction, tenantId, generated.document);
      const party = registered
        ? {
            ...registered,
            name: generated.name || registered.name,
            tradeName: generated.tradeName || registered.tradeName,
            email: generated.email || registered.email,
            phone: generated.phone || registered.phone,
            address: {
              ...registered.address,
              city: generated.address.city || registered.address.city,
              state: generated.address.state || registered.address.state,
            },
            contacts: registered.contacts.length ? registered.contacts : generated.contacts,
            roles: registered.roles.includes("cedente") ? registered.roles : [...registered.roles, "cedente" as const],
            roleData: { ...registered.roleData, cedente: generated.roleData.cedente },
            status: "Ativo" as const,
            updatedAt: generated.updatedAt,
            history: [...registered.history, ...generated.history],
          }
        : generated;
      await saveRegistryParty(transaction, tenantId, actorId, party);
    }
    if (!row.event_id) throw new Error("Evento comercial não registrado.");
    await transaction
      .prepare(
        `insert into private.commercial_commands
         (tenant_id, command_id, request_hash, expected_version, result_version, result_payload, event_id, actor_id)
         values (?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
      )
      .bind(
        tenantId,
        commandId,
        requestHash,
        expectedVersion,
        row.aggregate_version,
        jsonParameter(row.payload),
        row.event_id,
        actorId,
      )
      .run();
    return { ...row.payload, persistenceVersion: row.aggregate_version };
  };
  return db.transaction ? db.transaction(work) : work(db);
}
