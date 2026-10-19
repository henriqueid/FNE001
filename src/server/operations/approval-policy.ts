/** Configuração das alçadas por empresa com proposta e aprovação por pessoas distintas. */
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { approvalHash, loadApprovalAuthorityPolicy, type ApprovalSlot } from "./approval-evidence";
import { OperationApprovalCommandError } from "./approval";

export type ApprovalPolicyCommand = { company: string; expectedVersion: number; commandId: string; reason: string } & (
  { action: "PROPOR"; slots: ApprovalSlot[] } | { action: "APROVAR" | "REJEITAR"; proposalId: string }
);
export type ApprovalPolicyProposal = {
  eventId: string;
  actorId: string;
  company: string;
  slots: ApprovalSlot[];
  reason: string;
};
export function validApprovalSlots(slots: unknown): slots is ApprovalSlot[] {
  return (
    Array.isArray(slots) &&
    slots.length > 0 &&
    slots.length <= 20 &&
    new Set(slots.map(slot => slot?.id)).size === slots.length &&
    slots.every(
      slot =>
        slot &&
        typeof slot.id === "string" &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(slot.id) &&
        typeof slot.authorityId === "string" &&
        slot.authorityId.length > 0 &&
        slot.authorityId.length <= 100 &&
        ["risk:decide", "controlleria:formalize"].includes(slot.permission),
    )
  );
}
export function validateApprovalPolicyCommand(value: unknown): value is ApprovalPolicyCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as ApprovalPolicyCommand;
  return (
    typeof command.company === "string" &&
    command.company.trim().length > 0 &&
    command.company.length <= 200 &&
    Number.isInteger(command.expectedVersion) &&
    command.expectedVersion >= 0 &&
    typeof command.reason === "string" &&
    command.reason.trim().length >= 10 &&
    command.reason.length <= 2000 &&
    typeof command.commandId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.commandId) &&
    (command.action === "PROPOR"
      ? validApprovalSlots(command.slots)
      : ["APROVAR", "REJEITAR"].includes(command.action) &&
        typeof command.proposalId === "string" &&
        command.proposalId.length > 0)
  );
}
async function authorize(db: DecisionDatabase, principal: ServerPrincipal, company: string) {
  if (!principal.permissions.includes("settings:manage") || !principalHasCompanyScope(principal, company))
    throw new OperationApprovalCommandError("Sem permissão para configurar alçadas desta empresa.", 403);
  const destination = await db
    .prepare(
      "select destination_id from private.company_destinations where tenant_id = ? and trade_name = ? and status = 'ACTIVE'",
    )
    .bind(principal.tenantId, company)
    .first();
  if (!destination) throw new OperationApprovalCommandError("Empresa ativa não localizada.", 404);
}
export async function readApprovalPolicyConfiguration(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  company: string,
) {
  await authorize(db, principal, company);
  const events = await db
    .prepare(
      "select event_id, actor_id, aggregate_version, event_type, payload from private.domain_events where tenant_id = ? and aggregate_type = 'OperationApprovalPolicy' and aggregate_id = ? order by aggregate_version",
    )
    .bind(principal.tenantId, company)
    .all<{
      event_id: string;
      actor_id: string;
      aggregate_version: number;
      event_type: string;
      payload: { proposalId?: string; slots: ApprovalSlot[]; reason: string };
    }>();
  const authorities = await db
    .prepare(
      "select distinct authority_id from private.authority_assignments where tenant_id = ? and valid_from <= now() and (valid_until is null or valid_until >= now()) order by authority_id",
    )
    .bind(principal.tenantId)
    .all<{ authority_id: string }>();
  const decided = new Set(
    events.results
      .filter(event => event.event_type !== "OPERATION_APPROVAL_POLICY_PROPOSED")
      .map(event => event.payload.proposalId),
  );
  return {
    policy: await loadApprovalAuthorityPolicy(db, principal.tenantId, company),
    version: events.results.at(-1)?.aggregate_version ?? 0,
    authorities: authorities.results.map(row => row.authority_id),
    proposals: events.results
      .filter(event => event.event_type === "OPERATION_APPROVAL_POLICY_PROPOSED" && !decided.has(event.event_id))
      .map(event => ({
        eventId: event.event_id,
        actorId: event.actor_id,
        company,
        slots: event.payload.slots,
        reason: event.payload.reason,
      })),
  };
}
export async function configureApprovalPolicy(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: ApprovalPolicyCommand,
) {
  if (!validateApprovalPolicyCommand(command))
    throw new OperationApprovalCommandError("Comando de regra de alçadas inválido.", 400);
  if (!db.transaction) throw new OperationApprovalCommandError("A configuração exige transação.", 503);
  return db.transaction(async transaction => {
    await transaction
      .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
      .bind(`strato.finance:${principal.tenantId}`)
      .run();
    const state = await readApprovalPolicyConfiguration(transaction, principal, command.company);
    const eventId = `operation-approval-policy:${command.commandId}`;
    const requestHash = approvalHash({ command, actorId: principal.id });
    const replay = await transaction
      .prepare(
        "select payload from private.domain_events where tenant_id = ? and event_id = ? and aggregate_type = 'OperationApprovalPolicy'",
      )
      .bind(principal.tenantId, eventId)
      .first<{ payload: { requestHash: string } }>();
    if (replay) {
      if (replay.payload.requestHash !== requestHash)
        throw new OperationApprovalCommandError("A chave do comando já foi usada com outro conteúdo.");
      return state;
    }
    if (state.version !== command.expectedVersion)
      throw new OperationApprovalCommandError("A regra foi alterada. Atualize antes de continuar.");
    let slots: ApprovalSlot[];
    if (command.action === "PROPOR") slots = command.slots;
    else {
      const proposal = state.proposals.find(item => item.eventId === command.proposalId);
      if (!proposal) throw new OperationApprovalCommandError("Proposta pendente não localizada.");
      if (proposal.actorId === principal.id)
        throw new OperationApprovalCommandError("Quem propôs a regra não pode aprová-la ou rejeitá-la.", 403);
      slots = proposal.slots;
    }
    if (!validApprovalSlots(slots) || slots.some(slot => !state.authorities.includes(slot.authorityId)))
      throw new OperationApprovalCommandError("As alçadas devem existir e possuir atribuição formal vigente.");
    const eventType =
      command.action === "PROPOR"
        ? "OPERATION_APPROVAL_POLICY_PROPOSED"
        : command.action === "APROVAR"
          ? "OPERATION_APPROVAL_POLICY_CONFIGURED"
          : "OPERATION_APPROVAL_POLICY_REJECTED";
    await transaction
      .prepare(
        "insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, correlation_id, payload) values (?, ?, 'OperationApprovalPolicy', ?, ?, ?, ?, ?, ?::jsonb)",
      )
      .bind(
        principal.tenantId,
        eventId,
        command.company,
        state.version + 1,
        eventType,
        principal.id,
        command.commandId,
        jsonParameter({
          company: command.company,
          slots,
          reason: command.reason.trim(),
          proposalId: command.action === "PROPOR" ? undefined : command.proposalId,
          requestHash,
        }),
      )
      .run();
    return readApprovalPolicyConfiguration(transaction, principal, command.company);
  });
}
