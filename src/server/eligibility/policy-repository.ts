import type { EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import {
  governEligibilityPolicyTransition,
  validateEligibilityPolicyState,
  validateEligibilityPolicyTransition,
} from "@/src/domain/eligibility/policy-persistence";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";

type PolicyStateRow = { payload: EligibilityPolicyState; aggregate_version: number; event_id?: string };
type PolicyCommandRow = { request_hash: string; result_payload: EligibilityPolicyState; result_version: number };

export class PolicyCommandConflictError extends Error {}
export class PolicyTransitionError extends Error {}

const snapshot = (state: EligibilityPolicyState): EligibilityPolicyState => {
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

export async function policyRequestHash(input: {
  tenantId: string;
  actorId: string;
  expectedVersion: number;
  state: EligibilityPolicyState;
}) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(input))));
  return hex(new Uint8Array(digest));
}

async function replayedPolicyCommand(db: DecisionDatabase, tenantId: string, commandId: string, requestHash: string) {
  const row = await db
    .prepare(
      `select request_hash, result_payload, result_version
       from private.policy_commands where tenant_id = ? and command_id = ?`,
    )
    .bind(tenantId, commandId)
    .first<PolicyCommandRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw new PolicyCommandConflictError("A chave deste comando de política já foi usada com outro conteúdo.");
  return { ...row.result_payload, persistenceVersion: row.result_version };
}

export async function loadEligibilityPolicyState(
  db: DecisionDatabase,
  tenantId: string,
): Promise<EligibilityPolicyState | null> {
  const row = await db
    .prepare(`select payload, aggregate_version from private.policy_states where tenant_id = ?`)
    .bind(tenantId)
    .first<PolicyStateRow>();
  return row ? { ...row.payload, persistenceVersion: row.aggregate_version } : null;
}

async function saveEnvelope(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  state: EligibilityPolicyState,
  expectedVersion: number,
) {
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  return db
    .prepare(
      `with saved as (
         insert into private.policy_states
           (tenant_id, aggregate_version, payload, created_by, updated_by)
         values (?, 1, ?::jsonb, ?, ?)
         on conflict (tenant_id) do update set
           aggregate_version = private.policy_states.aggregate_version + 1,
           payload = excluded.payload,
           updated_by = excluded.updated_by,
           updated_at = now()
         where private.policy_states.aggregate_version = ?
         returning payload, aggregate_version
       ), recorded as (
         insert into private.domain_events
           (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, payload)
         select ?, ?, 'EligibilityPolicyState', ?, saved.aggregate_version,
           case when saved.aggregate_version = 1 then 'POLICY_STATE_CREATED' else 'POLICY_STATE_UPDATED' end,
           ?, jsonb_build_object(
             'policies', ?::integer,
             'drafts', ?::integer,
             'active', ?::integer,
             'closed', ?::integer
           )
         from saved
         returning event_id, aggregate_version, event_type
       ), enqueued as (
         insert into private.domain_outbox
           (tenant_id, outbox_id, event_id, topic, aggregate_type, aggregate_id, aggregate_version, payload)
         select ?, ?, event_id, 'strato.eligibility-policies', 'EligibilityPolicyState', ?, aggregate_version,
           jsonb_build_object(
             'eventId', event_id,
             'eventType', event_type,
             'tenantId', ?::text,
             'aggregateVersion', aggregate_version
           )
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
      state.policies.length,
      state.policies.filter(policy => policy.status === "RASCUNHO").length,
      state.policies.filter(policy => policy.status === "ATIVA").length,
      state.policies.filter(policy => policy.status === "ENCERRADA").length,
      tenantId,
      outboxId,
      tenantId,
      tenantId,
    )
    .first<PolicyStateRow>();
}

function projectionStatements(db: DecisionDatabase, tenantId: string, state: EligibilityPolicyState) {
  const statements: DecisionStatement[] = [];
  for (const policy of state.policies) {
    statements.push(
      db
        .prepare(
          `insert into private.eligibility_policies
             (tenant_id, policy_id, name, version_label, layer, modality, company, product,
              effective_from, effective_to, status, snapshot)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?::date, ?::date, ?, ?::jsonb)
           on conflict (tenant_id, policy_id) do update set
             name = excluded.name,
             version_label = excluded.version_label,
             layer = excluded.layer,
             modality = excluded.modality,
             company = excluded.company,
             product = excluded.product,
             effective_from = excluded.effective_from,
             effective_to = excluded.effective_to,
             status = excluded.status,
             snapshot = excluded.snapshot,
             updated_at = now()`,
        )
        .bind(
          tenantId,
          policy.id,
          policy.name,
          policy.version,
          policy.layer,
          policy.modality ?? null,
          policy.company ?? null,
          policy.product ?? null,
          policy.effectiveFrom,
          policy.effectiveTo ?? null,
          policy.status,
          jsonParameter(policy),
        ),
    );
    for (const binding of policy.bindings)
      statements.push(
        db
          .prepare(
            `insert into private.eligibility_policy_bindings
               (tenant_id, policy_id, rule_id, enabled, operator, parameter, failure_outcome,
                action, override_allowed, override_authority)
             values (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
             on conflict (tenant_id, policy_id, rule_id) do update set
               enabled = excluded.enabled,
               operator = excluded.operator,
               parameter = excluded.parameter,
               failure_outcome = excluded.failure_outcome,
               action = excluded.action,
               override_allowed = excluded.override_allowed,
               override_authority = excluded.override_authority`,
          )
          .bind(
            tenantId,
            policy.id,
            binding.ruleId,
            binding.enabled,
            binding.operator ?? null,
            jsonParameter(binding.parameter),
            binding.failureOutcome,
            binding.action,
            binding.overrideAllowed,
            binding.overrideAuthority ?? null,
          ),
      );
    if (policy.approval)
      statements.push(
        db
          .prepare(
            `insert into private.policy_approvals
               (tenant_id, policy_id, approved_by, approved_by_name, approved_at, justification)
             values (?, ?, ?, ?, ?::timestamptz, ?)
             on conflict (tenant_id, policy_id) do nothing`,
          )
          .bind(
            tenantId,
            policy.id,
            policy.approval.approvedById,
            policy.approval.approvedBy,
            policy.approval.approvedAt,
            policy.approval.justification,
          ),
      );
  }
  return statements;
}

export async function saveEligibilityPolicyState(
  db: DecisionDatabase,
  tenantId: string,
  actor: { id: string; name: string },
  state: EligibilityPolicyState,
  expectedVersion: number,
  commandId: string,
  requestHash: string,
): Promise<EligibilityPolicyState | null> {
  const replay = await replayedPolicyCommand(db, tenantId, commandId, requestHash);
  if (replay) return replay;
  const work = async (transaction: DecisionDatabase) => {
    const repeated = await replayedPolicyCommand(transaction, tenantId, commandId, requestHash);
    if (repeated) return repeated;
    const previous = await loadEligibilityPolicyState(transaction, tenantId);
    if ((previous?.persistenceVersion ?? 0) !== expectedVersion) return null;
    const governed = governEligibilityPolicyTransition(previous, state, actor);
    const stateError = validateEligibilityPolicyState(governed);
    if (stateError) throw new PolicyTransitionError(stateError);
    const transitionError = validateEligibilityPolicyTransition(previous, governed, actor);
    if (transitionError) throw new PolicyTransitionError(transitionError);
    const saved = await saveEnvelope(transaction, tenantId, actor.id, governed, expectedVersion);
    if (!saved) return replayedPolicyCommand(transaction, tenantId, commandId, requestHash);
    const projections = projectionStatements(transaction, tenantId, governed);
    if (projections.length) await transaction.batch(projections);
    await transaction
      .prepare(
        `insert into private.policy_commands
           (tenant_id, command_id, request_hash, expected_version, result_version,
            result_payload, event_id, actor_id)
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
