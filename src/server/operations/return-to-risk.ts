/** Retorno pré-liberação por intenção, com versão, escopo e evento imutável na mesma transação. */
import type { Operation } from "@/src/domain/core/types";
import { operationReturnedToRisk } from "@/src/domain/operations/return-to-risk";
import { hydrateOperationReceivables, receivablesFromOperation } from "@/src/domain/receivables/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { OperationApprovalCommandError } from "./approval";
import { approvalHash } from "./approval-evidence";
import { loadOperationSnapshot, saveOperationRecord } from "./storage";

export type ReturnToRiskCommand = { operationId: string; expectedVersion: number; commandId: string; reason: string };

export function validReturnToRiskCommand(value: unknown): value is ReturnToRiskCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const command = value as ReturnToRiskCommand;
  return (
    typeof command.operationId === "string" &&
    command.operationId.trim().length > 0 &&
    command.operationId.length <= 160 &&
    Number.isInteger(command.expectedVersion) &&
    command.expectedVersion > 0 &&
    typeof command.commandId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.commandId) &&
    typeof command.reason === "string" &&
    command.reason.trim().length >= 8 &&
    command.reason.length <= 2000 &&
    Object.keys(command).every(key => ["operationId", "expectedVersion", "commandId", "reason"].includes(key))
  );
}

export async function returnOperationToRisk(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: ReturnToRiskCommand,
): Promise<Operation> {
  if (!validReturnToRiskCommand(command))
    throw new OperationApprovalCommandError("Comando de devolução ao Risco inválido.", 400);
  if (principal.status !== "active" || !principal.permissions.includes("controlleria:formalize"))
    throw new OperationApprovalCommandError(
      "Somente Controladoria pode devolver a operação da Aprovação ao Risco.",
      403,
    );
  if (!db.transaction) throw new OperationApprovalCommandError("A devolução exige transação de banco.", 503);
  return db.transaction(async transaction => {
    await transaction
      .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
      .bind(`strato.finance:${principal.tenantId}`)
      .run();
    await transaction
      .prepare("select operation_id from private.operations where tenant_id = ? and operation_id = ? for update")
      .bind(principal.tenantId, command.operationId)
      .first();
    const current = await loadOperationSnapshot(transaction, principal.tenantId, command.operationId);
    if (!current || !principalHasCompanyScope(principal, current.vehicle))
      throw new OperationApprovalCommandError("Operação não localizada no seu escopo.", 404);
    const eventId = `operation-risk-return:${command.commandId}`;
    const requestHash = approvalHash({ command, actorId: principal.id, tenantId: principal.tenantId });
    const replay = await transaction
      .prepare(
        "select payload from private.domain_events where tenant_id = ? and event_id = ? and aggregate_type = 'OperationRiskReturn'",
      )
      .bind(principal.tenantId, eventId)
      .first<{ payload: { requestHash: string; result: { operation: Operation } } }>();
    if (replay) {
      if (replay.payload.requestHash !== requestHash)
        throw new OperationApprovalCommandError("A chave do comando já foi usada com outro conteúdo.");
      return replay.payload.result.operation;
    }
    if (current.persistenceVersion !== command.expectedVersion)
      throw new OperationApprovalCommandError("A operação mudou. Atualize a tela antes de devolver.");
    if (
      current.stage !== 5 ||
      ["Cancelada", "Liberada ao financeiro"].includes(current.status) ||
      current.releaseReview
    )
      throw new OperationApprovalCommandError(
        "A devolução ao Risco exige operação aberta na Aprovação, antes da liberação.",
      );
    const at = new Date().toISOString();
    const next = operationReturnedToRisk(current, command.reason, principal.name, at);
    const saved = await saveOperationRecord(
      transaction,
      principal.tenantId,
      principal.id,
      next,
      command.expectedVersion,
    );
    if (!saved) throw new OperationApprovalCommandError("A operação mudou durante a devolução. Atualize a tela.");
    const operation = hydrateOperationReceivables(saved, receivablesFromOperation(current));
    await transaction
      .prepare(
        "insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, correlation_id, payload) values (?, ?, 'OperationRiskReturn', ?, ?, 'OPERATION_RETURNED_TO_RISK', ?, ?, ?::jsonb)",
      )
      .bind(
        principal.tenantId,
        eventId,
        current.id,
        operation.persistenceVersion,
        principal.id,
        command.commandId,
        jsonParameter({
          requestHash,
          reason: command.reason.trim(),
          previousApprovalReview: current.approvalReview,
          previousStageCompletions: current.stageCompletions,
          result: { operation },
        }),
      )
      .run();
    return operation;
  });
}
