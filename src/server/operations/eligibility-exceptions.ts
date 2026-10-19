/** Executa a política e delibera uma avaliação com alçada vigente e evidência selada no servidor. */
import type { Operation } from "@/src/domain/core/types";
import { replaceEligibilityRun } from "@/src/domain/eligibility/decision";
import type { EligibilityOverrideDecision } from "@/src/domain/eligibility/model";
import { withEligibilityRoute } from "@/src/domain/eligibility/orchestration";
import { hydrateOperationReceivables, receivablesFromOperation } from "@/src/domain/receivables/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { approvalHash } from "./approval-evidence";
import { OperationApprovalCommandError } from "./approval";
import {
  eligibilityExceptionHash,
  verifiedEligibilityOverrides,
  type EligibilityExceptionGrant,
} from "./exception-evidence";
import { loadOperationSnapshot, saveOperationRecord } from "./storage";
import { assertOperationTitleTotals, authoritativeEligibilityRun, loadOperationAuthorityContext } from "./validation";

type CommandBase = { operationId: string; expectedVersion: number; commandId: string; reason: string };
export type EligibilityDecisionCommand = CommandBase &
  (
    | { action: "EXECUTAR" }
    | { action: "DECIDIR"; runHash: string; evaluationId: string; decision: EligibilityOverrideDecision }
  );
export function validEligibilityDecisionCommand(value: unknown): value is EligibilityDecisionCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as EligibilityDecisionCommand;
  const common =
    typeof command.operationId === "string" &&
    command.operationId.length > 0 &&
    command.operationId.length <= 160 &&
    Number.isInteger(command.expectedVersion) &&
    command.expectedVersion > 0 &&
    typeof command.commandId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.commandId) &&
    typeof command.reason === "string" &&
    command.reason.trim().length >= 10 &&
    command.reason.length <= 2000;
  const allowed = [
    "action",
    "operationId",
    "expectedVersion",
    "commandId",
    "reason",
    ...(command.action === "DECIDIR" ? ["runHash", "evaluationId", "decision"] : []),
  ];
  return (
    common &&
    Object.keys(command).every(key => allowed.includes(key)) &&
    (command.action === "EXECUTAR" ||
      (command.action === "DECIDIR" &&
        /^[a-f0-9]{64}$/.test(command.runHash) &&
        typeof command.evaluationId === "string" &&
        command.evaluationId.length > 0 &&
        command.evaluationId.length <= 300 &&
        ["APROVAR_EXCECAO", "REJEITAR_EXCECAO"].includes(command.decision)))
  );
}

export async function readAuthoritativeEligibility(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  operationId: string,
) {
  const operation = await loadOperationSnapshot(db, principal.tenantId, operationId);
  if (!operation || !principalHasCompanyScope(principal, operation.vehicle))
    throw new OperationApprovalCommandError("Operação fora do seu escopo.", 404);
  assertOperationTitleTotals(operation);
  const context = await loadOperationAuthorityContext(db, principal.tenantId, operation);
  const run = authoritativeEligibilityRun(operation, context);
  if (!run.evaluations.length)
    throw new OperationApprovalCommandError("Não há política ativa aplicável persistida para executar a análise.");
  return {
    operation,
    context,
    run,
    runHash: eligibilityExceptionHash(operation, run),
    overrides: verifiedEligibilityOverrides(operation, run, context.exceptionGrants ?? []),
  };
}

export async function executeEligibilityDecision(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: EligibilityDecisionCommand,
): Promise<Operation> {
  if (!validEligibilityDecisionCommand(command))
    throw new OperationApprovalCommandError("Comando de elegibilidade inválido.", 400);
  if (!principal.permissions.includes("risk:decide"))
    throw new OperationApprovalCommandError("Somente Risco pode executar a política ou decidir uma exceção.", 403);
  if (!db.transaction) throw new OperationApprovalCommandError("A decisão exige transação de banco.", 503);
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
      throw new OperationApprovalCommandError("Operação fora do seu escopo.", 404);
    const eventId = `eligibility:${command.commandId}`;
    const requestHash = approvalHash({ command, actorId: principal.id, tenantId: principal.tenantId });
    const replay = await transaction
      .prepare(
        "select payload from private.domain_events where tenant_id = ? and event_id = ? and aggregate_type in ('EligibilityException', 'EligibilityExecution')",
      )
      .bind(principal.tenantId, eventId)
      .first<{ payload: { requestHash: string; operation: Operation } }>();
    if (replay) {
      if (replay.payload.requestHash !== requestHash)
        throw new OperationApprovalCommandError("A chave do comando já foi usada com outro conteúdo.");
      return replay.payload.operation;
    }
    if (current.persistenceVersion !== command.expectedVersion)
      throw new OperationApprovalCommandError("A operação mudou. Atualize os fatos antes de decidir.");
    if (current.stage !== 2 || ["Cancelada", "Liberada ao financeiro"].includes(current.status))
      throw new OperationApprovalCommandError("A execução ou exceção exige operação aberta na etapa Risco.");
    const { context, run, runHash } = await readAuthoritativeEligibility(transaction, principal, command.operationId);
    let grant: EligibilityExceptionGrant | undefined;
    if (command.action === "DECIDIR") {
      if (command.runHash !== runHash)
        throw new OperationApprovalCommandError(
          "Os fatos ou a política mudaram. Reexecute antes de decidir a exceção.",
        );
      const evaluation = run.evaluations.find(item => item.id === command.evaluationId);
      if (
        !evaluation?.overrideAllowed ||
        !evaluation.overrideAuthority ||
        ["APROVADO", "ALERTA"].includes(evaluation.outcome)
      )
        throw new OperationApprovalCommandError("A avaliação não permite exceção pela política vigente.", 403);
      if (!principal.authorityIds.includes(evaluation.overrideAuthority))
        throw new OperationApprovalCommandError("Sem a alçada exata da regra para deliberar esta avaliação.", 403);
      const assignment = await transaction
        .prepare(
          `select a.authority_id from private.authority_assignments a join private.access_users u on u.user_id = a.user_id and u.status = 'active' join private.access_permissions p on p.tenant_id = a.tenant_id and p.user_id = a.user_id and p.permission = 'risk:decide' where a.tenant_id = ? and a.user_id = ? and a.authority_id = ? and a.valid_from <= now() and (a.valid_until is null or a.valid_until >= now())`,
        )
        .bind(principal.tenantId, principal.id, evaluation.overrideAuthority)
        .first();
      if (!assignment) throw new OperationApprovalCommandError("A atribuição formal da alçada não está vigente.", 403);
      grant = {
        id: eventId,
        eventId,
        operationId: current.id,
        actorId: principal.id,
        runHash,
        evaluationId: evaluation.id,
        ruleId: evaluation.ruleId,
        subjectId: evaluation.subjectId,
        originalOutcome: evaluation.outcome,
        observed: evaluation.observed,
        parameter: evaluation.parameter,
        decision: command.decision,
        justification: command.reason.trim(),
        authority: evaluation.overrideAuthority,
        decidedBy: principal.name,
        decidedAt: new Date().toISOString(),
        evidence: evaluation.evidence,
      };
    }
    const overrides = verifiedEligibilityOverrides(current, run, [
      ...(context.exceptionGrants ?? []),
      ...(grant ? [grant] : []),
    ]);
    const previous = current.eligibilityReview;
    const review =
      previous && previous.run.inputFingerprint !== run.inputFingerprint
        ? replaceEligibilityRun(previous, run, {
            at: new Date().toISOString(),
            by: principal.name,
            reason: command.reason.trim(),
          })
        : { run, overrides: [], history: previous?.history };
    const next = withEligibilityRoute({ ...current, eligibilityReview: { ...review, overrides } });
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
        "insert into private.domain_events (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type, actor_id, correlation_id, payload) values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)",
      )
      .bind(
        principal.tenantId,
        eventId,
        grant ? "EligibilityException" : "EligibilityExecution",
        current.id,
        saved.persistenceVersion,
        grant
          ? grant.decision === "APROVAR_EXCECAO"
            ? "ELIGIBILITY_EXCEPTION_APPROVED"
            : "ELIGIBILITY_EXCEPTION_REJECTED"
          : "ELIGIBILITY_EXECUTED",
        principal.id,
        command.commandId,
        jsonParameter({ ...grant, requestHash, runHash, operation, reason: command.reason.trim() }),
      )
      .run();
    return operation;
  });
}
