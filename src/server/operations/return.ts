/** Devolução autorizada da operação, recebíveis, caixa e razão em uma transação auditável. */
import type { Operation } from "@/src/domain/core/types";
import { returnOperation } from "@/src/domain/finance/releases";
import { portfolioBalance, portfolioTitleFromReceivable } from "@/src/domain/portfolio/model";
import { receivablesFromOperation } from "@/src/domain/receivables/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { jsonParameter } from "@/src/server/database/postgres";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { financeRequestHash, loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { loadCurrentPortfolio, savePortfolioState, portfolioRequestHash } from "@/src/server/portfolio/repository";
import { loadOperationSnapshot, saveOperation } from "./repository";

export type OperationReturnCommand = {
  operationId: string;
  expectedVersion: number;
  targetStage: number;
  reason: string;
  cashMoved: boolean;
  date: string;
  commandId: string;
};
export type OperationReturnResult = {
  operation: Operation;
  message: string;
  commandId: string;
  purchaseEntryId: string;
};
export class OperationReturnError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
function fail(message: string, status = 409): never {
  throw new OperationReturnError(message, status);
}
async function hash(value: unknown) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)))),
    byte => byte.toString(16).padStart(2, "0"),
  ).join("");
}
function resetApprovals(operation: Operation, actor: string, date: string): Operation {
  const approval = operation.approvalReview;
  if (!approval) return operation;
  return {
    ...operation,
    approvalReview: {
      status: "Preparação",
      observation: approval.observation,
      documents: approval.documents,
      approvals: approval.approvals?.map(a => ({
        id: a.id,
        role: a.role,
        approver: "Aguardando alçada",
        status: "Pendente",
      })),
      signatures: approval.signatures?.map(s => ({
        id: s.id,
        party: s.party,
        signer: s.signer,
        status: "Não enviado",
      })),
      audit: [
        ...(approval.audit ?? []),
        {
          at: date,
          by: actor,
          action: "Aprovação invalidada por devolução",
          detail:
            "Uma nova aquisição exige nova autorização e formalização; evidências anteriores preservadas no evento de devolução.",
        },
      ],
    },
  };
}
export async function returnReleasedOperation(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: OperationReturnCommand,
): Promise<OperationReturnResult> {
  if (!principal.permissions.includes("finance:release"))
    fail("Sem permissão para devolver operações pelo financeiro.", 403);
  if (
    !command ||
    typeof command.operationId !== "string" ||
    !command.operationId.trim() ||
    !Number.isInteger(command.expectedVersion) ||
    command.expectedVersion < 1 ||
    !Number.isInteger(command.targetStage) ||
    command.targetStage < 1 ||
    command.targetStage > 5 ||
    typeof command.reason !== "string" ||
    !command.reason.trim() ||
    command.reason.length > 2000 ||
    typeof command.cashMoved !== "boolean" ||
    typeof command.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(command.date) ||
    typeof command.commandId !== "string" ||
    !/^[A-Za-z0-9._:-]{8,160}$/.test(command.commandId)
  )
    fail("Comando de devolução inválido.", 400);
  if (!db.transaction) fail("Devolução exige transação de banco.", 503);
  const requestHash = await hash([principal.id, command]);
  return inTenantFinanceTransaction(db, principal.tenantId, async tx => {
    const current = await loadOperationSnapshot(tx, principal.tenantId, command.operationId);
    if (!current || !principalHasCompanyScope(principal, current.vehicle))
      fail("Operação não encontrada no seu escopo.", 404);
    const previous = await tx
      .prepare(
        "select payload from private.domain_events where tenant_id = ? and aggregate_type = ? and aggregate_id = ?",
      )
      .bind(principal.tenantId, "OperationReturn", command.commandId)
      .first<{ payload: { requestHash: string; result: OperationReturnResult } }>();
    if (previous) {
      if (previous.payload.requestHash !== requestHash) fail("A chave de devolução já foi usada com outro conteúdo.");
      return previous.payload.result;
    }
    if (current.persistenceVersion !== command.expectedVersion) fail("A operação mudou. Atualize antes de devolver.");
    const finance = await loadFinanceState(tx, principal.tenantId);
    if (!finance) fail("A operação não possui financeiro persistido.");
    const purchaseEntryId = finance.purchasePosted[current.id],
      purchase = finance.journal.find(e => e.id === purchaseEntryId);
    if (!purchase || purchase.company !== current.vehicle || purchase.reversedBy)
      fail("A compra não existe ou já foi estornada; confira o ciclo financeiro.");
    if (command.date < purchase.date || command.date > new Date().toISOString().slice(0, 10))
      fail("A data de devolução deve estar entre a compra e a data atual.", 400);
    const portfolio = await loadCurrentPortfolio(tx, principal.tenantId),
      titles = portfolio.titles.filter(t => t.operationId === current.id);
    if (titles.some(t => ["Registrado", "Pendente de integração", "Liquidado"].includes(t.bankStatus)))
      fail(
        "Há títulos vinculados ao banco; conclua a baixa bancária e concilie o retorno antes de devolver a operação.",
      );
    const originalTitles = new Map(
      receivablesFromOperation(current).map(receivable => {
        const title = portfolioTitleFromReceivable(receivable);
        return [title.id, title] as const;
      }),
    );
    if (
      titles.some(t => {
        const source = originalTitles.get(t.id);
        return (
          !source ||
          t.payments.some(p => !p.reversalOf && !p.reversedBy) ||
          Math.round(portfolioBalance(t) * 100) !== Math.round(portfolioBalance(source) * 100)
        );
      })
    )
      fail("Há recebimentos ou alterações de saldo no ativo; regularize a carteira antes de devolver a operação.");
    const returned = returnOperation(
      finance,
      current,
      {
        targetStage: command.targetStage,
        reason: command.reason.trim(),
        cashMoved: command.cashMoved,
        date: command.date,
      },
      principal.name,
    );
    if (returned.error || !returned.operationPatch) fail(returned.error ?? "Não foi possível calcular a devolução.");
    const nextPortfolio = structuredClone(portfolio),
      at = new Date().toISOString();
    for (const title of nextPortfolio.titles.filter(t => t.operationId === current.id)) {
      title.status = "Cancelado";
      title.bankStatus = "Baixado";
      title.openAmount = 0;
      title.events.push({
        id: `operation-return:${command.commandId}:${title.id}`,
        at,
        by: principal.name,
        action: "Devolução de operação",
        detail: `${command.reason.trim()} · compra ${purchaseEntryId} estornada · ativo retirado da carteira`,
      });
    }
    const fv = finance.persistenceVersion ?? 0,
      pv = portfolio.persistenceVersion ?? 0;
    const fh = await financeRequestHash({
      tenantId: principal.tenantId,
      actorId: principal.id,
      expectedVersion: fv,
      state: returned.state,
    });
    if (
      !(await saveFinanceState(
        tx,
        principal.tenantId,
        principal.id,
        returned.state,
        fv,
        `operation-return-finance:${command.commandId}`,
        fh,
        { returningOperationId: current.id },
      ))
    )
      fail("O financeiro mudou durante a devolução.");
    if (titles.length) {
      const ph = await portfolioRequestHash({
        tenantId: principal.tenantId,
        actorId: principal.id,
        expectedVersion: pv,
        state: nextPortfolio,
      });
      if (
        !(await savePortfolioState(
          tx,
          principal.tenantId,
          principal,
          nextPortfolio,
          pv,
          `operation-return-portfolio:${command.commandId}`,
          ph,
          { financialCommand: true },
        ))
      )
        fail("A carteira mudou durante a devolução.");
    }
    const next = resetApprovals({ ...current, ...returned.operationPatch }, principal.name, at);
    if (next.releaseReview)
      next.releaseReview = {
        ...next.releaseReview,
        preparedById: undefined,
        preparedBy: undefined,
        preparedAt: undefined,
        approvedById: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
      };
    const operation = await saveOperation(tx, principal.tenantId, principal.id, next, command.expectedVersion);
    if (!operation) fail("A operação mudou durante a devolução.");
    const result: OperationReturnResult = {
      operation,
      message: returned.message ?? "Operação devolvida com trilha e contrapartidas preservadas.",
      commandId: command.commandId,
      purchaseEntryId,
    };
    await tx
      .prepare(
        `insert into private.domain_events
   (tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,payload)
   values (?, ?, ?, ?, 1, ?, ?, ?::jsonb)`,
      )
      .bind(
        principal.tenantId,
        crypto.randomUUID(),
        "OperationReturn",
        command.commandId,
        "OPERATION_RETURNED",
        principal.id,
        jsonParameter({
          requestHash,
          result,
          reason: command.reason.trim(),
          date: command.date,
          cashMoved: command.cashMoved,
          purchaseEntryId,
          registration: finance.registrations[current.id] ?? null,
          previousOperation: current,
          previousPortfolio: titles,
        }),
      )
      .run();
    return result;
  });
}
