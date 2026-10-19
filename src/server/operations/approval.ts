/** Comando de aprovação por alçada com concorrência, idempotência e evidência atômica. */
import type { Operation } from "@/src/domain/core/types";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { hydrateOperationReceivables, receivablesFromOperation } from "@/src/domain/receivables/model";
import {
  approvalEvidenceComplete,
  approvalHash,
  operationApprovalHash,
  type OperationApprovalGrant,
  type ServerApprovalReview,
} from "./approval-evidence";
import { OperationGovernanceError } from "./governance";
import { loadOperationSnapshot, saveOperationRecord } from "./storage";
import {
  assertAuthoritativeOperation,
  assertOperationTitleTotals,
  loadOperationAuthorityContext,
  OperationApprovalAuthorityUnavailableError,
} from "./validation";

export type OperationApprovalCommand = {
  operationId: string;
  expectedVersion: number;
  commandId: string;
  slotId: string;
  decision: "APROVAR" | "REPROVAR";
  reason: string;
};
export class OperationApprovalCommandError extends OperationGovernanceError {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function validateOperationApprovalCommand(value: unknown): value is OperationApprovalCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as OperationApprovalCommand;
  return (
    typeof command.operationId === "string" &&
    command.operationId.length > 0 &&
    command.operationId.length <= 160 &&
    Number.isInteger(command.expectedVersion) &&
    command.expectedVersion > 0 &&
    typeof command.commandId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.commandId) &&
    typeof command.slotId === "string" &&
    command.slotId.length > 0 &&
    command.slotId.length <= 100 &&
    ["APROVAR", "REPROVAR"].includes(command.decision) &&
    typeof command.reason === "string" &&
    command.reason.trim().length >= 10 &&
    command.reason.length <= 2000 &&
    Object.keys(command).every(key =>
      ["operationId", "expectedVersion", "commandId", "slotId", "decision", "reason"].includes(key),
    )
  );
}

export async function decideOperationApproval(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: OperationApprovalCommand,
): Promise<Operation> {
  if (!validateOperationApprovalCommand(command))
    throw new OperationApprovalCommandError("Comando de aprovação inválido.", 400);
  if (!db.transaction) throw new OperationApprovalCommandError("A aprovação exige transação de banco.", 503);
  return db.transaction(async transaction => {
    await transaction
      .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
      .bind(`strato.finance:${principal.tenantId}`)
      .run();
    const owner = await transaction
      .prepare("select created_by from private.operations where tenant_id = ? and operation_id = ? for update")
      .bind(principal.tenantId, command.operationId)
      .first<{ created_by: string }>();
    const current = await loadOperationSnapshot(transaction, principal.tenantId, command.operationId);
    if (!current || !owner || !principalHasCompanyScope(principal, current.vehicle))
      throw new OperationApprovalCommandError("Operação não localizada no seu escopo.", 404);
    const requestHash = approvalHash({ ...command, actorId: principal.id, tenantId: principal.tenantId });
    const eventId = `operation-approval:${command.commandId}`;
    const replay = await transaction
      .prepare(
        "select actor_id, payload from private.domain_events where tenant_id = ? and event_id = ? and aggregate_type = 'OperationApproval'",
      )
      .bind(principal.tenantId, eventId)
      .first<{ actor_id: string; payload: { requestHash: string; operation: Operation } }>();
    if (replay) {
      if (replay.actor_id !== principal.id || replay.payload.requestHash !== requestHash)
        throw new OperationApprovalCommandError("A chave do comando já foi usada com outro conteúdo.");
      return replay.payload.operation;
    }
    if (current.persistenceVersion !== command.expectedVersion)
      throw new OperationApprovalCommandError("A operação mudou. Atualize a tela antes de decidir.");
    if (current.stage !== 5 || ["Cancelada", "Liberada ao financeiro"].includes(current.status))
      throw new OperationApprovalCommandError("A decisão formal exige operação aberta na etapa Aprovação.");
    const context = await loadOperationAuthorityContext(transaction, principal.tenantId, current);
    const policy = context.approvalPolicy;
    if (!policy)
      throw new OperationApprovalAuthorityUnavailableError(
        "Configure e aprove a regra de alçadas da empresa em Configurações antes de decidir a operação.",
      );
    const slot = policy.slots.find(item => item.id === command.slotId);
    if (!slot || !principal.authorityIds.includes(slot.authorityId) || !principal.permissions.includes(slot.permission))
      throw new OperationApprovalCommandError("Sem alçada e permissão para este item da aprovação.", 403);
    const assignment = await transaction
      .prepare(
        `select a.authority_id from private.authority_assignments a join private.access_users u on u.user_id = a.user_id and u.status = 'active' join private.access_permissions p on p.tenant_id = a.tenant_id and p.user_id = a.user_id and p.permission = ? where a.tenant_id = ? and a.user_id = ? and a.authority_id = ? and a.valid_from <= now() and (a.valid_until is null or a.valid_until >= now())`,
      )
      .bind(slot.permission, principal.tenantId, principal.id, slot.authorityId)
      .first<{ authority_id: string }>();
    if (!assignment) throw new OperationApprovalCommandError("A atribuição formal da alçada não está vigente.", 403);
    assertOperationTitleTotals(current);
    if (command.decision === "APROVAR")
      assertAuthoritativeOperation(current, { ...current, approvalReview: { status: "Em aprovação" } }, context);
    const snapshotHash = operationApprovalHash(current, context.policies, policy);
    const previous = (context.approvalGrants ?? []).filter(
      grant => grant.snapshotHash === snapshotHash && grant.policyEventId === policy.eventId,
    );
    if (previous.some(grant => grant.slotId === slot.id || grant.decision === "REPROVAR"))
      throw new OperationApprovalCommandError(
        "Esta alçada já foi decidida ou o pacote foi reprovado; uma revisão material é necessária.",
      );
    const now = new Date().toISOString();
    const grant: OperationApprovalGrant = {
      eventId,
      actorId: principal.id,
      slotId: slot.id,
      authorityId: slot.authorityId,
      snapshotHash,
      policyEventId: policy.eventId,
      decidedAt: now,
      decision: command.decision,
    };
    const grants = [...previous, grant];
    const review: ServerApprovalReview = {
      ...current.approvalReview,
      status: command.decision === "REPROVAR" ? "Reprovada" : "Em aprovação",
      approvals: policy.slots.map(item => {
        const decision = grants.find(candidate => candidate.slotId === item.id);
        return {
          id: item.id,
          role: item.authorityId,
          approver: decision?.actorId ?? "Aguardando alçada",
          status: decision ? (decision.decision === "APROVAR" ? "Aprovado" : "Reprovado") : "Pendente",
          decidedAt: decision?.decidedAt,
        };
      }),
      finalDecision: undefined,
      serverApproval: { snapshotHash, eventIds: grants.map(item => item.eventId), policyEventId: policy.eventId },
      audit: [
        ...(current.approvalReview?.audit ?? []),
        {
          at: now,
          by: principal.name,
          action: command.decision === "APROVAR" ? "Alçada aprovada" : "Alçada reprovada",
          detail: `${slot.id}: ${command.reason.trim()}`,
        },
      ],
    };
    const next: Operation = { ...current, approvalReview: review };
    if (approvalEvidenceComplete(next, context.policies, policy, grants)) {
      review.status = "Aprovada";
      review.finalDecision = {
        outcome: "APROVADA",
        decidedAt: now,
        decidedBy: principal.name,
        justification: command.reason.trim(),
      };
      next.status = "Pronta para formalizar";
      next.nextAction = "Concluir documentos e assinaturas";
    } else if (command.decision === "REPROVAR")
      review.finalDecision = {
        outcome: "REPROVADA",
        decidedAt: now,
        decidedBy: principal.name,
        justification: command.reason.trim(),
      };
    if (command.decision === "REPROVAR") {
      next.status = "Em atenção";
      next.blockers = Math.max(1, current.blockers);
      next.nextAction = "Revisar reprovação registrada pela alçada";
    }
    const saved = await saveOperationRecord(
      transaction,
      principal.tenantId,
      principal.id,
      next,
      command.expectedVersion,
    );
    if (!saved) throw new OperationApprovalCommandError("A operação mudou durante a decisão. Atualize a tela.");
    const operation = hydrateOperationReceivables(saved, receivablesFromOperation(current));
    await transaction
      .prepare(
        `insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, correlation_id, payload) values (?, ?, 'OperationApproval', ?, ?, ?, ?, ?, ?::jsonb)`,
      )
      .bind(
        principal.tenantId,
        eventId,
        current.id,
        saved.persistenceVersion,
        command.decision === "APROVAR" ? "OPERATION_APPROVAL_GRANTED" : "OPERATION_APPROVAL_REJECTED",
        principal.id,
        command.commandId,
        jsonParameter({ ...grant, requestHash, reason: command.reason.trim(), operation }),
      )
      .run();
    return operation;
  });
}
