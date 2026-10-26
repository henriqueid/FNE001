/** Comissões usam agregado persistido, lock do tenant e transação única com o Financeiro. */
import { prepareCommissionTransfer } from "@/src/domain/commercial/finance-transfer";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadFinanceState, saveFinanceState } from "@/src/server/finance/repository";
import { hasFullCommercialScope } from "./access";
import { commercialRequestHash, loadCommercialState, saveCommercialState } from "./repository";

export class CommissionCommandError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export type CommissionCommand = {
  month: string;
  expectedCommercialVersion: number;
  expectedFinanceVersion: number;
};
function parseCommand(value: unknown): CommissionCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CommissionCommandError("Comando de comissão inválido.", 400);
  const input = value as CommissionCommand;
  if (
    Object.keys(input).some(key => !["month", "expectedCommercialVersion", "expectedFinanceVersion"].includes(key)) ||
    typeof input.month !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) ||
    !Number.isInteger(input.expectedCommercialVersion) ||
    input.expectedCommercialVersion < 0 ||
    !Number.isInteger(input.expectedFinanceVersion) ||
    input.expectedFinanceVersion < 0
  )
    throw new CommissionCommandError("Competência ou versões inválidas.", 400);
  return input;
}

export async function executeCommissionCommand(db: DecisionDatabase, principal: ServerPrincipal, rawCommand: unknown) {
  if (
    !principal.permissions.includes("portfolio:manage") ||
    !principal.permissions.includes("finance:release") ||
    !hasFullCommercialScope(principal)
  )
    throw new CommissionCommandError("Sem permissão para enviar comissões ao Financeiro.", 403);
  if (!db.transaction) throw new CommissionCommandError("Transação financeira indisponível.", 503);
  const command = parseCommand(rawCommand);
  return inTenantFinanceTransaction(db, principal.tenantId, async transaction => {
    const [finance, commercial] = await Promise.all([
      loadFinanceState(transaction, principal.tenantId),
      loadCommercialState(transaction, principal.tenantId),
    ]);
    if (!finance || !commercial) throw new CommissionCommandError("Inicialize Comercial e Financeiro antes do envio.");
    const closing = commercial.closings[command.month];
    if (!closing) throw new CommissionCommandError("Competência fechada não encontrada.");
    for (const line of closing.lines) {
      const rep = commercial.reps.find(item => item.id === line.repId);
      if (!rep || !principalHasCompanyScope(principal, rep.company))
        throw new CommissionCommandError("O fechamento contém representante fora do seu escopo de empresa.", 403);
    }
    // Replay precede versões: a resposta pode ter se perdido após o commit.
    const sent = closing.status === "Enviada ao financeiro";
    if (
      !sent &&
      ((finance.persistenceVersion ?? 0) !== command.expectedFinanceVersion ||
        (commercial.persistenceVersion ?? 0) !== command.expectedCommercialVersion)
    )
      throw new CommissionCommandError("Comercial ou Financeiro alterados. Atualize a posição antes de enviar.");
    let result;
    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      result = prepareCommissionTransfer(finance, commercial, command.month, today, principal.name);
    } catch (error) {
      throw new CommissionCommandError(error instanceof Error ? error.message : "Fechamento inválido.");
    }
    if (result.replayed) return result;
    const commandId = `commission:${command.month}`;
    const requestHash = await commercialRequestHash({
      tenantId: principal.tenantId,
      actorId: principal.id,
      expectedVersion: command.expectedCommercialVersion,
      state: result.commercial,
    });
    const savedFinance = await saveFinanceState(
      transaction,
      principal.tenantId,
      principal.id,
      result.finance,
      command.expectedFinanceVersion,
      commandId,
      requestHash,
    );
    if (!savedFinance) throw new CommissionCommandError("Conflito ao gravar as obrigações da comissão.");
    const savedCommercial = await saveCommercialState(
      transaction,
      principal.tenantId,
      principal.id,
      principal.name,
      result.commercial,
      command.expectedCommercialVersion,
      commandId,
      requestHash,
    );
    if (!savedCommercial) throw new CommissionCommandError("Conflito ao gravar o fechamento da comissão.");
    return { finance: savedFinance, commercial: savedCommercial, replayed: false };
  });
}
