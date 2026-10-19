/** Comandos de liquidação do ativo: versão, escopo, idempotência e gravação conjunta de carteira/financeiro. */
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import { loadFinanceState, replayedFinanceCommand, saveFinanceState } from "@/src/server/finance/repository";
import { loadCurrentPortfolio, savePortfolioState } from "./repository";
import { reverseReceivableSettlement, settleReceivable } from "@/src/domain/portfolio/settlement";

export type ReceivableCommand = {
  action: "settle" | "reverse";
  titleId: string;
  commandId: string;
  expectedFinanceVersion: number;
  expectedPortfolioVersion: number;
  date: string;
  accountId?: string;
  principal?: number;
  interest?: number;
  discount?: number;
  method?: string;
  paymentId?: string;
  reason?: string;
  cashMoved?: boolean;
};
export class ReceivableCommandError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

export function parseReceivableCommand(value: unknown): ReceivableCommand {
  if (!value || typeof value !== "object") throw new ReceivableCommandError("Comando de liquidação inválido.", 400);
  const command = value as ReceivableCommand;
  if (
    !["settle", "reverse"].includes(command.action) ||
    typeof command.titleId !== "string" ||
    !command.titleId.trim() ||
    typeof command.commandId !== "string" ||
    !/^[A-Za-z0-9:_-]{8,160}$/.test(command.commandId) ||
    !Number.isInteger(command.expectedFinanceVersion) ||
    command.expectedFinanceVersion < 0 ||
    !Number.isInteger(command.expectedPortfolioVersion) ||
    command.expectedPortfolioVersion < 0 ||
    typeof command.date !== "string"
  )
    throw new ReceivableCommandError("Comando, identificador ou versão de liquidação inválidos.", 400);
  if (
    command.action === "settle" &&
    (typeof command.accountId !== "string" ||
      typeof command.method !== "string" ||
      [command.principal, command.interest, command.discount].some(
        amount => typeof amount !== "number" || !Number.isFinite(amount),
      ))
  )
    throw new ReceivableCommandError("Dados de recebimento inválidos.", 400);
  if (
    command.action === "reverse" &&
    (typeof command.paymentId !== "string" ||
      typeof command.reason !== "string" ||
      typeof command.cashMoved !== "boolean")
  )
    throw new ReceivableCommandError("Dados de estorno inválidos.", 400);
  return command;
}

export async function executeReceivableCommand(db: DecisionDatabase, principal: ServerPrincipal, rawCommand: unknown) {
  if (!db.transaction) throw new ReceivableCommandError("Transação financeira indisponível.", 503);
  if (!principal.permissions.includes("finance:release"))
    throw new ReceivableCommandError("Sem permissão para liquidar recebíveis.", 403);
  const command = parseReceivableCommand(rawCommand);
  const serialized = JSON.stringify([
    principal.tenantId,
    principal.id,
    command.action,
    command.titleId,
    command.commandId,
    command.expectedFinanceVersion,
    command.expectedPortfolioVersion,
    command.date,
    command.accountId ?? null,
    command.principal ?? null,
    command.interest ?? null,
    command.discount ?? null,
    command.method ?? null,
    command.paymentId ?? null,
    command.reason ?? null,
    command.cashMoved ?? null,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const commandId = `receivable:${command.commandId}`;
  return inTenantFinanceTransaction(db, principal.tenantId, async transaction => {
    const [finance, portfolio] = await Promise.all([
      loadFinanceState(transaction, principal.tenantId),
      loadCurrentPortfolio(transaction, principal.tenantId),
    ]);
    const title = portfolio.titles.find(candidate => candidate.id === command.titleId);
    if (!title?.company || !principalHasCompanyScope(principal, title.company))
      throw new ReceivableCommandError("Recebível não encontrado no seu escopo de empresa.", 403);
    const replay = await replayedFinanceCommand(transaction, principal.tenantId, commandId, requestHash);
    if (replay) return { finance: finance ?? replay, portfolio, replayed: true };
    if (!finance) throw new ReceivableCommandError("Inicialize o Financeiro antes de liquidar recebíveis.");
    if (
      (finance.persistenceVersion ?? 0) !== command.expectedFinanceVersion ||
      (portfolio.persistenceVersion ?? 0) !== command.expectedPortfolioVersion
    )
      throw new ReceivableCommandError(
        "Financeiro ou Carteira alterados por outra pessoa. Atualize a posição antes de tentar novamente.",
      );
    const result =
      command.action === "settle"
        ? settleReceivable(
            finance,
            portfolio,
            command.titleId,
            {
              accountId: command.accountId!,
              date: command.date,
              principal: command.principal!,
              interest: command.interest!,
              discount: command.discount!,
              method: command.method!,
            },
            principal.name,
            command.commandId,
          )
        : reverseReceivableSettlement(
            finance,
            portfolio,
            command.titleId,
            command.paymentId!,
            {
              date: command.date,
              reason: command.reason!,
              cashMoved: command.cashMoved!,
            },
            principal.name,
            command.commandId,
          );
    if (result.error) throw new ReceivableCommandError(result.error);
    const savedFinance = await saveFinanceState(
      transaction,
      principal.tenantId,
      principal.id,
      result.finance,
      command.expectedFinanceVersion,
      commandId,
      requestHash,
    );
    if (!savedFinance) throw new ReceivableCommandError("Conflito ao gravar a liquidação financeira.");
    const savedPortfolio = await savePortfolioState(
      transaction,
      principal.tenantId,
      { id: principal.id, name: principal.name },
      result.portfolio,
      command.expectedPortfolioVersion,
      commandId,
      requestHash,
      { financialCommand: true },
    );
    if (!savedPortfolio) throw new ReceivableCommandError("Conflito ao gravar a liquidação da carteira.");
    return { finance: savedFinance, portfolio: savedPortfolio, replayed: false };
  });
}
