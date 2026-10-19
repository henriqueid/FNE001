import type { FinanceState } from "@/src/domain/finance/model";
import type { Permission } from "@/src/domain/access/model";

/** Restrições do PUT genérico; comandos especializados têm validação e transação próprias. */
export function genericFinanceCommandError(previous: FinanceState, next: FinanceState, permissions: Permission[]) {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!same(previous.purchasePosted, next.purchasePosted) || !same(previous.registrations, next.registrations))
    return "Compras e registros de cobrança exigem comandos próprios da operação ou do banco.";
  if (!same(previous.accounts, next.accounts) && !permissions.includes("settings:manage"))
    return "Alterar contas bancárias ou convênios exige permissão para administrar configurações.";
  for (const account of previous.accounts) {
    const candidate = next.accounts.find(item => item.id === account.id);
    if (
      account.collection &&
      (!candidate?.collection ||
        candidate.collection.nextOurNumber < account.collection.nextOurNumber ||
        (candidate.collection.nextRemittanceSequence ?? 1) < (account.collection.nextRemittanceSequence ?? 1))
    )
      return "A numeração bancária reservada não pode retroceder nem ser removida.";
  }
  const linked = new Set(
    [...previous.titles, ...next.titles].filter(title => title.portfolioTitleId).map(title => title.id),
  );
  for (const id of linked) {
    if (
      !same(
        previous.titles.find(title => title.id === id),
        next.titles.find(title => title.id === id),
      )
    )
      return "Recebimentos da Carteira exigem o comando integrado de liquidação ou estorno.";
  }
  const linkedMovements = (state: FinanceState) =>
    state.movements.filter(movement => movement.titleId && linked.has(movement.titleId));
  if (!same(linkedMovements(previous), linkedMovements(next)))
    return "Movimentos de recebimentos da Carteira exigem o comando integrado.";
  return null;
}
