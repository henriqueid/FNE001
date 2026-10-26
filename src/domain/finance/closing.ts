import { isFinanceDate } from "./date";
import { inScope } from "./banking";
import { hist, nextId, run, type Result } from "./ledger";
import { nowStamp, type FinanceState } from "./model";

export function closedThrough(state: FinanceState, company: string) {
  return (state.periodClosures ?? [])
    .filter(closure => closure.company === company)
    .map(closure => closure.throughDate)
    .sort()
    .at(-1);
}

export function assertDateOpen(state: FinanceState, company: string, date: string) {
  const closed = closedThrough(state, company);
  if (closed && date <= closed)
    throw new Error(`O período de ${company} está fechado até ${closed}. Use uma data posterior ou reabra o período.`);
}

export function closeFinancePeriod(state: FinanceState, scope: string, throughDate: string, by: string): Result {
  return run(state, draft => {
    if (!isFinanceDate(throughDate)) throw new Error("Informe uma data-base válida.");
    const companies = [
      ...new Set([
        ...draft.accounts.map(account => account.company),
        ...draft.journal.map(entry => entry.company),
        ...draft.titles.map(title => title.company),
      ]),
    ].filter(company => inScope(company, scope));
    if (!companies.length) throw new Error("Nenhuma empresa encontrada neste escopo.");

    for (const company of companies) {
      const previous = closedThrough(draft, company);
      if (previous && throughDate <= previous)
        throw new Error(`${company} já está fechada até ${previous}. Escolha uma data posterior.`);
      const accountIds = new Set(
        draft.accounts.filter(account => account.company === company).map(account => account.id),
      );
      const pendingStatement = (draft.statement ?? []).filter(
        line => accountIds.has(line.accountId) && line.date <= throughDate && line.status !== "Conciliado",
      );
      const pendingMovements = draft.movements.filter(
        movement => accountIds.has(movement.accountId) && movement.date <= throughDate && !movement.reconciled,
      );
      if (pendingStatement.length || pendingMovements.length)
        throw new Error(
          `${company} possui ${pendingStatement.length} linha(s) de extrato e ${pendingMovements.length} movimento(s) pendentes até ${throughDate}.`,
        );
      const entries = draft.journal.filter(entry => entry.company === company && entry.date <= throughDate);
      draft.periodClosures ??= [];
      draft.periodClosures.push({
        id: nextId(draft, "FC"),
        company,
        throughDate,
        closedAt: nowStamp(),
        closedBy: by,
        summary: {
          bankAccounts: accountIds.size,
          movements: draft.movements.filter(
            movement => accountIds.has(movement.accountId) && movement.date <= throughDate,
          ).length,
          journalEntries: entries.length,
          statementLines: (draft.statement ?? []).filter(
            line => accountIds.has(line.accountId) && line.date <= throughDate,
          ).length,
        },
      });
    }
    return {
      message: `${companies.length} empresa(s) fechada(s) até ${throughDate}. Lançamentos retroativos ficaram bloqueados.`,
    };
  });
}

export function closureHistory(state: FinanceState) {
  return [...(state.periodClosures ?? [])].sort(
    (left, right) => right.throughDate.localeCompare(left.throughDate) || right.id.localeCompare(left.id),
  );
}

// Mantém a mesma forma de histórico usada nos demais comandos para futuros eventos de reabertura.
export const closureAudit = (by: string, detail: string) => hist(by, "Fechamento financeiro", detail);
