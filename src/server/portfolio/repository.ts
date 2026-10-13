import type { Party } from "@/src/domain/registry/parties";
import {
  portfolioTitleFromReceivable,
  type PortfolioState,
  type PortfolioTitleRecord,
} from "@/src/domain/portfolio/model";
import { validatePortfolioTransition } from "@/src/domain/portfolio/persistence";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { loadReceivables } from "@/src/server/receivables/repository";

type ImportedPortfolioRow = {
  title_id: string;
  document_number: string;
  receivable_type: string;
  negotiation_date: string;
  original_due_date: string;
  current_due_date: string;
  original_amount: number;
  wallet_code: string;
  internal_wallet: string;
  title_payload: Record<string, unknown>;
  position_date: string;
  open_amount: number;
  present_amount: number;
  paid_amount: number;
  discount_amount: number;
  discount_income: number;
  late_fee_amount: number;
  monetary_correction_amount: number;
  collection_agreement: boolean;
  collection_status: string;
  position_payload: Record<string, unknown>;
  cedent: Party;
  debtor: Party;
  company: string;
  institution: string;
};

const numberValue = (value: number) => Number(value ?? 0);

function importedTitle(row: ImportedPortfolioRow): PortfolioTitleRecord {
  const additionalNumber = String(row.title_payload.additionalNumber ?? "");
  const source = String(row.title_payload.sourceSystem ?? "Importação de carteira");
  return {
    id: row.title_id,
    status: "Em aberto",
    bankStatus: row.wallet_code ? "Registrado" : "Sem boleto",
    source: "Carteira anterior",
    importSource: "Planilha",
    receivableType: row.receivable_type,
    company: row.company,
    institution: row.institution,
    proposal: `Posição importada em ${row.position_date}`,
    aditivoNumber: additionalNumber,
    borderoNumber: row.internal_wallet || row.wallet_code,
    operationType: "Carteira importada",
    documentNumber: row.document_number,
    ownerName: row.cedent.name,
    ownerDocument: row.cedent.document,
    debtorName: row.debtor.name,
    debtorDocument: row.debtor.document,
    issueDate: row.negotiation_date,
    originalDueDate: row.original_due_date,
    dueDate: row.current_due_date,
    originalAmount: numberValue(row.original_amount),
    openAmount: numberValue(row.open_amount),
    paidAmount: numberValue(row.paid_amount),
    repurchasedAmount: 0,
    discountAmount: numberValue(row.discount_amount),
    abatementAmount: 0,
    payments: [],
    wallet: row.wallet_code,
    collectionInstruction: row.collection_status,
    collectionOccurrences: [],
    confirmation: { status: "Não iniciada" },
    events: [
      {
        id: `import-${row.title_id}`,
        at: row.position_date,
        by: "Importação controlada",
        action: "Entrada na carteira",
        detail: `${source} · saldo e posição preservados no banco.`,
      },
    ],
  };
}

async function loadSourcePortfolio(db: DecisionDatabase, tenantId: string): Promise<PortfolioState> {
  const rows = await db
    .prepare(
      `with latest as (
         select max(position_date) as position_date
         from private.portfolio_title_positions
         where tenant_id = ?
       )
       select t.title_id, t.document_number, t.receivable_type,
              t.negotiation_date::text, t.original_due_date::text, t.current_due_date::text,
              t.original_amount::float8, t.wallet_code, t.internal_wallet,
              t.payload as title_payload,
              p.position_date::text, p.open_amount::float8, p.present_amount::float8,
              p.paid_amount::float8, p.discount_amount::float8, p.discount_income::float8,
              p.late_fee_amount::float8, p.monetary_correction_amount::float8,
              p.collection_agreement, p.collection_status, p.payload as position_payload,
              cedent.payload as cedent, debtor.payload as debtor,
              coalesce(company.trade_name, company.legal_name, 'Carteira') as company,
              coalesce(company.institution_type, 'FIDC') as institution
       from private.portfolio_titles t
       join private.portfolio_title_positions p
         on p.tenant_id = t.tenant_id and p.title_id = t.title_id
       join latest on latest.position_date = p.position_date
       join private.registry_parties cedent
         on cedent.tenant_id = t.tenant_id and cedent.party_id = t.cedent_party_id
       join private.registry_parties debtor
         on debtor.tenant_id = t.tenant_id and debtor.party_id = t.debtor_party_id
       left join private.company_profiles company on company.tenant_id = t.tenant_id
       where t.tenant_id = ? and p.lifecycle_status = 'OPEN' and p.open_amount > 0
       order by p.computed_days_past_due desc, t.current_due_date, t.title_id`,
    )
    .bind(tenantId, tenantId)
    .all<ImportedPortfolioRow>();
  const positionDate = rows.results[0]?.position_date;
  const historical = await db
    .prepare(`select count(*)::integer as total from private.portfolio_titles where tenant_id = ?`)
    .bind(tenantId)
    .first<{ total: number }>();
  const imported = rows.results.map(importedTitle);
  const receivables = (await loadReceivables(db, tenantId))
    .filter(receivable => receivable.lifecycleStatus === "ASSIGNED")
    .map(portfolioTitleFromReceivable);
  const byId = new Map([...imported, ...receivables].map(title => [title.id, title]));
  return {
    version: 3,
    titles: [...byId.values()],
    positionDate,
    historicalTitleCount: Number(historical?.total ?? imported.length) + receivables.length,
  };
}

type PortfolioStateRow = { payload: PortfolioState; aggregate_version: number; event_id?: string };
type PortfolioCommandRow = { request_hash: string; result_payload: PortfolioState; result_version: number };

export class PortfolioCommandConflictError extends Error {}
export class PortfolioTransitionError extends Error {}

const snapshot = (state: PortfolioState): PortfolioState => {
  const { persistenceVersion: _persistenceVersion, ...payload } = state;
  return payload;
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "persistenceVersion")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function portfolioRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: PortfolioState;
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(input))));
  return hex(new Uint8Array(digest));
}

async function loadStoredPortfolio(db: DecisionDatabase, tenantId: string) {
  const row = await db
    .prepare(`select payload, aggregate_version from private.portfolio_states where tenant_id = ?`)
    .bind(tenantId)
    .first<PortfolioStateRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

function overlayTitle(source: PortfolioTitleRecord, stored: PortfolioTitleRecord): PortfolioTitleRecord {
  return {
    ...source,
    status: stored.status,
    bankStatus: stored.bankStatus,
    dueDate: stored.dueDate,
    protestOffice: stored.protestOffice,
    collectionInstruction: stored.collectionInstruction,
    payments: stored.payments,
    collectionOccurrences: stored.collectionOccurrences,
    confirmation: stored.confirmation,
    events: stored.events,
  };
}

export async function loadCurrentPortfolio(db: DecisionDatabase, tenantId: string): Promise<PortfolioState> {
  const [source, stored] = await Promise.all([loadSourcePortfolio(db, tenantId), loadStoredPortfolio(db, tenantId)]);
  if (!stored) return { ...source, persistenceVersion: 0 };
  const storedById = new Map(stored.titles.map(title => [title.id, title]));
  const sourceIds = new Set(source.titles.map(title => title.id));
  return {
    version: 3,
    titles: [
      ...source.titles.map(title =>
        storedById.has(title.id) ? overlayTitle(title, storedById.get(title.id)!) : title,
      ),
      ...stored.titles.filter(title => !sourceIds.has(title.id)),
    ],
    positionDate: source.positionDate ?? stored.positionDate,
    historicalTitleCount: Math.max(source.historicalTitleCount ?? 0, stored.historicalTitleCount ?? 0),
    persistenceVersion: stored.persistenceVersion,
  };
}

async function replayedCommand(db: DecisionDatabase, tenantId: string, commandId: string, requestHash: string) {
  const row = await db
    .prepare(
      `select request_hash, result_payload, result_version from private.portfolio_commands where tenant_id = ? and command_id = ?`,
    )
    .bind(tenantId, commandId)
    .first<PortfolioCommandRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw new PortfolioCommandConflictError("A chave deste comando da Carteira já foi usada com outro conteúdo.");
  return { ...row.result_payload, persistenceVersion: row.result_version };
}

async function saveEnvelope(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: PortfolioState,
  expectedVersion: number,
) {
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  return db
    .prepare(
      `with saved as (
         insert into private.portfolio_states (tenant_id, aggregate_version, payload, created_by, updated_by)
         values (?, 1, ?::jsonb, ?, ?)
         on conflict (tenant_id) do update set
           aggregate_version = private.portfolio_states.aggregate_version + 1,
           payload = excluded.payload, updated_by = excluded.updated_by, updated_at = now()
         where private.portfolio_states.aggregate_version = ?
         returning payload, aggregate_version
       ), recorded as (
         insert into private.domain_events
           (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         select ?, ?, 'PortfolioState', ?, saved.aggregate_version, 'PORTFOLIO_MAINTENANCE_UPDATED', ?,
           jsonb_build_object('titles', ?::integer, 'positionDate', ?::text)
         from saved returning event_id, aggregate_version, event_type
       ), enqueued as (
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         select ?, ?, event_id, 'strato.portfolio', 'PortfolioState', ?, aggregate_version,
           jsonb_build_object('eventId', event_id, 'eventType', event_type, 'tenantId', ?::text, 'aggregateVersion', aggregate_version)
         from recorded
       )
       select saved.payload, saved.aggregate_version, recorded.event_id
       from saved join recorded on recorded.aggregate_version = saved.aggregate_version`,
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
      state.titles.length,
      state.positionDate ?? null,
      tenantId,
      outboxId,
      tenantId,
      tenantId,
    )
    .first<PortfolioStateRow>();
}

function projectionStatements(
  db: DecisionDatabase,
  tenantId: string,
  actor: { id: string; name: string },
  previous: PortfolioState,
  state: PortfolioState,
) {
  const statements: DecisionStatement[] = [];
  for (const title of state.titles) {
    const prior = previous.titles.find(candidate => candidate.id === title.id);
    for (const occurrence of title.collectionOccurrences.slice(prior?.collectionOccurrences.length ?? 0))
      statements.push(
        db
          .prepare(
            `insert into private.portfolio_collection_occurrences
             (tenant_id, occurrence_id, title_id, charged_at, channel, outcome, next_contact_at, created_by, payload, created_at)
           values (?, ?, ?, ?::timestamptz, ?, ?, ?::timestamptz, ?, ?::jsonb, ?::timestamptz)
           on conflict (tenant_id, occurrence_id) do nothing`,
          )
          .bind(
            tenantId,
            occurrence.id,
            title.id,
            occurrence.chargedAt,
            occurrence.channel,
            occurrence.outcome,
            occurrence.nextContactAt,
            actor.id,
            jsonParameter(occurrence),
            occurrence.createdAt,
          ),
      );
    if (title.confirmation.updatedAt && JSON.stringify(title.confirmation) !== JSON.stringify(prior?.confirmation))
      statements.push(
        db
          .prepare(
            `insert into private.portfolio_confirmations
             (tenant_id, title_id, status, updated_by, updated_at, payload)
           values (?, ?, ?, ?, ?::timestamptz, ?::jsonb)
           on conflict (tenant_id, title_id) do update set
             status = excluded.status, updated_by = excluded.updated_by,
             updated_at = excluded.updated_at, payload = excluded.payload
           where private.portfolio_confirmations.updated_at < excluded.updated_at`,
          )
          .bind(
            tenantId,
            title.id,
            title.confirmation.status,
            actor.id,
            title.confirmation.updatedAt,
            jsonParameter(title.confirmation),
          ),
      );
    for (const event of title.events.slice(prior?.events.length ?? 0))
      statements.push(
        db
          .prepare(
            `insert into private.portfolio_maintenance_events
             (tenant_id, event_id, title_id, occurred_at, actor_id, actor_name, action, detail)
           values (?, ?, ?, ?::timestamptz, ?, ?, ?, ?)
           on conflict (tenant_id, event_id) do nothing`,
          )
          .bind(
            tenantId,
            event.id,
            title.id,
            event.at,
            event.by === actor.name ? actor.id : null,
            event.by,
            event.action,
            event.detail,
          ),
      );
  }
  return statements;
}

export async function savePortfolioState(
  db: DecisionDatabase,
  tenantId: string,
  actor: { id: string; name: string },
  requested: PortfolioState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
): Promise<PortfolioState | null> {
  const replay = await replayedCommand(db, tenantId, commandId, requestHash);
  if (replay) return replay;
  const work = async (transaction: DecisionDatabase) => {
    const repeated = await replayedCommand(transaction, tenantId, commandId, requestHash);
    if (repeated) return repeated;
    const previous = await loadCurrentPortfolio(transaction, tenantId);
    if ((previous.persistenceVersion ?? 0) !== expectedVersion) return null;
    const requestedIds = new Set(requested.titles.map(title => title.id));
    const state = {
      ...requested,
      titles: [...requested.titles, ...previous.titles.filter(title => !requestedIds.has(title.id))],
    };
    const transitionError = validatePortfolioTransition(previous, state, actor.name);
    if (transitionError) throw new PortfolioTransitionError(transitionError);
    const saved = await saveEnvelope(transaction, tenantId, actor.id, state, expectedVersion);
    if (!saved) return replayedCommand(transaction, tenantId, commandId, requestHash);
    const projections = projectionStatements(transaction, tenantId, actor, previous, state);
    if (projections.length) await transaction.batch(projections);
    await transaction
      .prepare(
        `insert into private.portfolio_commands
         (tenant_id, command_id, request_hash, expected_version, result_version, result_payload, event_id, actor_id)
       values (?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
      )
      .bind(
        tenantId,
        commandId,
        requestHash,
        expectedVersion,
        saved.aggregate_version,
        jsonParameter(saved.payload),
        saved.event_id,
        actor.id,
      )
      .run();
    return { ...saved.payload, persistenceVersion: saved.aggregate_version };
  };
  return db.transaction ? db.transaction(work) : work(db);
}
