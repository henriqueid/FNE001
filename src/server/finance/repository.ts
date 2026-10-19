import type { FinanceState } from "@/src/domain/finance/model";
import { validateFinanceTransition } from "@/src/domain/finance/persistence";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import { syncOperationPaymentStatuses } from "./operation-effects";
import { attributeFinanceChanges } from "./attribution";
import { releasePaymentIntegrityError, type ReleaseIntegrityOptions } from "./release-integrity";
import { settlementIntegrityError } from "./settlement-integrity";

type FinanceRow = { payload: FinanceState; aggregate_version: number; event_id?: string };
type FinanceCommandRow = { request_hash: string; result_payload: FinanceState; result_version: number };

export class FinanceCommandConflictError extends Error {}
export class FinanceTransitionError extends Error {}

const snapshot = (state: FinanceState): FinanceState => {
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

export async function financeRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: FinanceState;
}) {
  const body = JSON.stringify(stable(input));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return hex(new Uint8Array(digest));
}

export async function replayedFinanceCommand(
  db: DecisionDatabase,
  tenantId: string,
  commandId: string,
  requestHash: string,
) {
  const row = await db
    .prepare(
      `select request_hash, result_payload, result_version
       from private.finance_commands where tenant_id = ? and command_id = ?`,
    )
    .bind(tenantId, commandId)
    .first<FinanceCommandRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw new FinanceCommandConflictError("A chave deste comando financeiro já foi usada com outro conteúdo.");
  return { ...row.result_payload, persistenceVersion: row.result_version };
}

export async function loadFinanceState(db: DecisionDatabase, tenantId: string): Promise<FinanceState | null> {
  const row = await db
    .prepare(`select payload, aggregate_version from private.finance_states where tenant_id = ?`)
    .bind(tenantId)
    .first<FinanceRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

async function saveEnvelope(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: FinanceState,
  expectedVersion: number,
) {
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  return db
    .prepare(
      `with saved as (
         insert into private.finance_states
           (tenant_id, aggregate_version, sequence_number, roles, registrations, chart_origin,
            chart_imports, payload, created_by, updated_by)
         values (?, 1, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?::jsonb, ?, ?)
         on conflict (tenant_id) do update set
           aggregate_version = private.finance_states.aggregate_version + 1,
           sequence_number = excluded.sequence_number,
           roles = excluded.roles,
           registrations = excluded.registrations,
           chart_origin = excluded.chart_origin,
           chart_imports = excluded.chart_imports,
           payload = excluded.payload,
           updated_by = excluded.updated_by,
           updated_at = now()
         where private.finance_states.aggregate_version = ?
         returning payload, aggregate_version
       ), recorded as (
         insert into private.domain_events
           (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         select ?, ?, 'FinanceState', ?, saved.aggregate_version,
           case when saved.aggregate_version = 1 then 'FINANCE_STATE_CREATED' else 'FINANCE_STATE_UPDATED' end,
           ?, jsonb_build_object('sequenceNumber', ?::integer, 'journalEntries', ?::integer)
         from saved
         returning event_id, aggregate_version, event_type
       ), enqueued as (
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         select ?, ?, event_id, 'strato.finance', 'FinanceState', ?, aggregate_version,
           jsonb_build_object('eventId', event_id, 'eventType', event_type,
             'tenantId', ?::text, 'aggregateVersion', aggregate_version)
         from recorded
       )
       select saved.payload, saved.aggregate_version, recorded.event_id
       from saved join recorded on recorded.aggregate_version = saved.aggregate_version`,
    )
    .bind(
      tenantId,
      state.seq,
      jsonParameter(state.roles ?? {}),
      jsonParameter(state.registrations),
      state.chartOrigin ?? null,
      jsonParameter(state.chartImports ?? []),
      jsonParameter(snapshot(state)),
      actorId,
      actorId,
      expectedVersion,
      tenantId,
      eventId,
      tenantId,
      actorId,
      state.seq,
      state.journal.length,
      tenantId,
      outboxId,
      tenantId,
      tenantId,
    )
    .first<FinanceRow>();
}

function projectionStatements(db: DecisionDatabase, tenantId: string, actorId: string, state: FinanceState) {
  const commands: DecisionStatement[] = [];
  for (const account of state.chart)
    commands.push(
      db
        .prepare(
          `insert into private.finance_chart_accounts
             (tenant_id, account_code, name, nature, analytic, short_code, referential)
           values (?, ?, ?, ?, ?, ?, ?)
           on conflict (tenant_id, account_code) do update set
             name=excluded.name, nature=excluded.nature, analytic=excluded.analytic,
             short_code=excluded.short_code, referential=excluded.referential`,
        )
        .bind(
          tenantId,
          account.code,
          account.name,
          account.nature,
          account.analytic,
          account.shortCode ?? null,
          account.referential ?? null,
        ),
    );
  for (const category of state.categories)
    commands.push(
      db
        .prepare(
          `insert into private.finance_categories
             (tenant_id, category_id, name, kind, ledger_code, account_group)
           values (?, ?, ?, ?, ?, ?)
           on conflict (tenant_id, category_id) do update set
             name=excluded.name, kind=excluded.kind, ledger_code=excluded.ledger_code, account_group=excluded.account_group`,
        )
        .bind(tenantId, category.id, category.name, category.kind, category.ledgerCode, category.group),
    );
  for (const account of state.accounts)
    commands.push(
      db
        .prepare(
          `insert into private.finance_bank_accounts
             (tenant_id, bank_account_id, company, bank_code, bank_name, agency, account_number,
              account_type, nickname, ledger_code, opening_balance, opening_date, minimum_balance, active, payload)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
           on conflict (tenant_id, bank_account_id) do update set
             company=excluded.company, bank_code=excluded.bank_code, bank_name=excluded.bank_name,
             agency=excluded.agency, account_number=excluded.account_number, account_type=excluded.account_type,
             nickname=excluded.nickname, ledger_code=excluded.ledger_code, minimum_balance=excluded.minimum_balance,
             active=excluded.active, payload=excluded.payload`,
        )
        .bind(
          tenantId,
          account.id,
          account.company,
          account.bankCode,
          account.bankName,
          account.agency,
          account.account,
          account.type,
          account.nickname,
          account.ledgerCode,
          account.openingBalance,
          account.openingDate,
          account.minimumBalance,
          account.active,
          jsonParameter(account),
        ),
    );
  for (const title of state.titles)
    commands.push(
      db
        .prepare(
          `insert into private.finance_titles
             (tenant_id, title_id, kind, origin, description, counterparty, counterparty_document,
              category_id, company, competence_date, due_date, amount, settlement_ledger, status,
              operation_id, payable_id, payload, created_by, updated_by)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
           on conflict (tenant_id, title_id) do update set
             description=excluded.description, counterparty=excluded.counterparty,
             counterparty_document=excluded.counterparty_document, category_id=excluded.category_id,
             company=excluded.company, competence_date=excluded.competence_date, due_date=excluded.due_date,
             amount=excluded.amount, settlement_ledger=excluded.settlement_ledger, status=excluded.status,
             operation_id=excluded.operation_id, payable_id=excluded.payable_id, payload=excluded.payload,
             updated_by=excluded.updated_by, updated_at=now()`,
        )
        .bind(
          tenantId,
          title.id,
          title.kind,
          title.origin,
          title.description,
          title.counterparty,
          title.counterpartyDocument ?? null,
          title.categoryId ?? null,
          title.company,
          title.competenceDate,
          title.dueDate,
          title.amount,
          title.settlementLedger,
          title.status,
          title.operationId ?? null,
          title.payableId ?? null,
          jsonParameter(title),
          actorId,
          actorId,
        ),
    );
  for (const entry of state.journal)
    commands.push(
      db
        .prepare(
          `insert into private.finance_journal_entries
             (tenant_id, journal_entry_id, entry_date, company, history, origin_type, origin_id,
              reversal_of, source_created_by, created_by)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           on conflict (tenant_id, journal_entry_id) do nothing`,
        )
        .bind(
          tenantId,
          entry.id,
          entry.date,
          entry.company,
          entry.history,
          entry.origin.type,
          entry.origin.id,
          entry.reversalOf ?? null,
          entry.createdBy,
          actorId,
        ),
    );
  for (const entry of state.journal)
    entry.lines.forEach((line, index) =>
      commands.push(
        db
          .prepare(
            `insert into private.finance_journal_lines
               (tenant_id, journal_entry_id, line_number, ledger_code, debit, credit, original_ledger_code)
             values (?, ?, ?, ?, ?, ?, ?)
             on conflict (tenant_id, journal_entry_id, line_number) do nothing`,
          )
          .bind(tenantId, entry.id, index + 1, line.ledger, line.debit, line.credit, line.originalLedger ?? null),
      ),
    );
  for (const entry of state.journal)
    if (entry.reversedBy)
      commands.push(
        db
          .prepare(
            `update private.finance_journal_entries set reversed_by = ?
             where tenant_id = ? and journal_entry_id = ? and reversed_by is null`,
          )
          .bind(entry.reversedBy, tenantId, entry.id),
      );
  for (const movement of state.movements)
    commands.push(
      db
        .prepare(
          `insert into private.finance_movements
             (tenant_id, movement_id, bank_account_id, movement_date, description, amount, kind,
              title_id, reversal_of, reconciled, journal_entry_id, match_group, payload)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
           on conflict (tenant_id, movement_id) do update set
             reconciled=excluded.reconciled, match_group=excluded.match_group, payload=excluded.payload`,
        )
        .bind(
          tenantId,
          movement.id,
          movement.accountId,
          movement.date,
          movement.description,
          movement.amount,
          movement.kind,
          movement.titleId ?? null,
          movement.reversalOf ?? null,
          movement.reconciled,
          movement.entryId ?? null,
          movement.matchGroup ?? null,
          jsonParameter(movement),
        ),
    );
  for (const movement of state.movements)
    if (movement.reversedBy)
      commands.push(
        db
          .prepare(
            `update private.finance_movements set reversed_by=? where tenant_id=? and movement_id=? and reversed_by is null`,
          )
          .bind(movement.reversedBy, tenantId, movement.id),
      );
  for (const line of state.statement ?? [])
    commands.push(
      db
        .prepare(
          `insert into private.finance_statement_lines
             (tenant_id, statement_line_id, bank_account_id, fitid, line_date, amount, memo,
              status, match_group, source_file, imported_at, imported_by)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           on conflict (tenant_id, statement_line_id) do update set
             status=excluded.status, match_group=excluded.match_group`,
        )
        .bind(
          tenantId,
          line.id,
          line.accountId,
          line.fitid,
          line.date,
          line.amount,
          line.memo,
          line.status,
          line.matchGroup ?? null,
          line.file,
          line.importedAt,
          line.importedBy,
        ),
    );
  for (const [operationId, journalEntryId] of Object.entries(state.purchasePosted))
    commands.push(
      db
        .prepare(
          `insert into private.finance_purchase_postings (tenant_id, operation_id, journal_entry_id)
           values (?, ?, ?)
           on conflict (tenant_id, operation_id) do update set journal_entry_id = excluded.journal_entry_id
           where exists (
             select 1 from private.finance_journal_entries original
             join private.finance_journal_entries replacement
               on replacement.tenant_id = original.tenant_id
              and replacement.journal_entry_id = excluded.journal_entry_id
             where original.tenant_id = private.finance_purchase_postings.tenant_id
               and original.journal_entry_id = private.finance_purchase_postings.journal_entry_id
               and original.reversed_by is not null
               and original.origin_type = 'Operação'
               and original.origin_id = private.finance_purchase_postings.operation_id
               and replacement.origin_type = 'Operação'
               and replacement.origin_id = original.origin_id
               and replacement.reversed_by is null
           )`,
        )
        .bind(tenantId, operationId, journalEntryId),
    );
  for (const closure of state.periodClosures ?? [])
    commands.push(
      db
        .prepare(
          `insert into private.finance_period_closures
             (tenant_id, closure_id, company, through_date, summary, closed_by, source_closed_by, source_closed_at)
           values (?, ?, ?, ?, ?::jsonb, ?, ?, ?)
           on conflict (tenant_id, closure_id) do nothing`,
        )
        .bind(
          tenantId,
          closure.id,
          closure.company,
          closure.throughDate,
          jsonParameter(closure.summary),
          actorId,
          closure.closedBy,
          closure.closedAt,
        ),
    );
  return commands;
}

export async function saveFinanceState(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: FinanceState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
  options: ReleaseIntegrityOptions = {},
): Promise<FinanceState | null> {
  const work = async (transaction: DecisionDatabase) => {
    const replay = await replayedFinanceCommand(transaction, tenantId, commandId, requestHash);
    if (replay) return replay;
    const previous = await loadFinanceState(transaction, tenantId);
    if ((previous?.persistenceVersion ?? 0) !== expectedVersion) return null;
    state = attributeFinanceChanges(previous, state, actorId);
    const transitionError = validateFinanceTransition(previous, state);
    if (transitionError) throw new FinanceTransitionError(transitionError);
    const releaseError = releasePaymentIntegrityError(previous, state, options);
    if (releaseError) throw new FinanceTransitionError(releaseError);
    const settlementError = settlementIntegrityError(previous, state);
    if (settlementError) throw new FinanceTransitionError(settlementError);
    const row = await saveEnvelope(transaction, tenantId, actorId, state, expectedVersion);
    if (!row) return replayedFinanceCommand(transaction, tenantId, commandId, requestHash);
    const commands = projectionStatements(transaction, tenantId, actorId, state);
    if (commands.length) await transaction.batch(commands);
    await syncOperationPaymentStatuses(transaction, tenantId, actorId, previous, state, options.returningOperationId);
    if (!row.event_id) throw new Error("Evento do comando financeiro não foi registrado.");
    await transaction
      .prepare(
        `insert into private.finance_commands
           (tenant_id, command_id, command_type, request_hash, expected_version,
            result_version, result_payload, event_id, actor_id)
         values (?, ?, 'FINANCE_STATE_CHANGE', ?, ?, ?, ?::jsonb, ?, ?)`,
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
  return inTenantFinanceTransaction(db, tenantId, work);
}
