import type { FinanceState } from "./model";

const unique = (values: string[]) => new Set(values).size === values.length;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function validateFinanceState(state: FinanceState): string | null {
  if (state.version !== 1) return "Versão do estado financeiro não suportada.";
  if (!Number.isInteger(state.seq) || state.seq < 0) return "Sequência financeira inválida.";
  if (!unique(state.chart.map(account => account.code))) return "Há códigos duplicados no plano de contas.";
  if (!unique(state.accounts.map(account => account.id))) return "Há contas bancárias duplicadas.";
  if (!unique(state.categories.map(category => category.id))) return "Há categorias financeiras duplicadas.";
  if (!unique(state.titles.map(title => title.id))) return "Há títulos financeiros duplicados.";
  if (!unique(state.movements.map(movement => movement.id))) return "Há movimentos bancários duplicados.";
  if (!unique(state.journal.map(entry => entry.id))) return "Há lançamentos contábeis duplicados.";
  if (!unique((state.statement ?? []).map(line => line.id))) return "Há linhas de extrato duplicadas.";
  if (!unique((state.periodClosures ?? []).map(closure => closure.id))) return "Há fechamentos financeiros duplicados.";

  const accountIds = new Set(state.accounts.map(account => account.id));
  const titleIds = new Set(state.titles.map(title => title.id));
  const journalIds = new Set(state.journal.map(entry => entry.id));
  for (const movement of state.movements) {
    if (!accountIds.has(movement.accountId)) return `Conta bancária ausente no movimento ${movement.id}.`;
    if (movement.titleId && !titleIds.has(movement.titleId)) return `Título ausente no movimento ${movement.id}.`;
    if (movement.entryId && !journalIds.has(movement.entryId)) return `Lançamento ausente no movimento ${movement.id}.`;
  }
  for (const line of state.statement ?? [])
    if (!accountIds.has(line.accountId)) return `Conta bancária ausente na linha de extrato ${line.id}.`;

  for (const entry of state.journal) {
    if (entry.lines.length < 2) return `Lançamento ${entry.id} precisa de ao menos duas partidas.`;
    const debit = money(entry.lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = money(entry.lines.reduce((sum, line) => sum + line.credit, 0));
    if (debit !== credit) return `Lançamento ${entry.id} desbalanceado: débito ${debit} × crédito ${credit}.`;
    if (entry.lines.some(line => line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)))
      return `Lançamento ${entry.id} contém partida inválida.`;
    if (entry.reversalOf && !journalIds.has(entry.reversalOf)) return `Origem do estorno ${entry.id} não encontrada.`;
    if (entry.reversedBy && !journalIds.has(entry.reversedBy))
      return `Contrapartida do lançamento ${entry.id} não encontrada.`;
  }
  for (const closure of state.periodClosures ?? []) {
    if (!closure.company.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(closure.throughDate))
      return `Fechamento ${closure.id} inválido.`;
    const accountIds = new Set(
      state.accounts.filter(account => account.company === closure.company).map(account => account.id),
    );
    const pendingLines = (state.statement ?? []).filter(
      line => accountIds.has(line.accountId) && line.date <= closure.throughDate && line.status !== "Conciliado",
    );
    const pendingMovements = state.movements.filter(
      movement => accountIds.has(movement.accountId) && movement.date <= closure.throughDate && !movement.reconciled,
    );
    if (pendingLines.length || pendingMovements.length)
      return `Fechamento ${closure.id} possui itens bancários pendentes até ${closure.throughDate}.`;
  }
  return null;
}

const withoutReversalLink = <T extends { reversedBy?: string }>(value: T) => {
  const { reversedBy: _reversedBy, ...stable } = value;
  return stable;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Impede que um snapshot novo reescreva fatos já abrangidos por fechamento anterior. */
export function validateFinanceTransition(previous: FinanceState | null, next: FinanceState): string | null {
  if (!previous) return null;
  const nextClosures = new Map((next.periodClosures ?? []).map(closure => [closure.id, closure]));
  for (const closure of previous.periodClosures ?? []) {
    if (!same(closure, nextClosures.get(closure.id)))
      return `O fechamento ${closure.id} não pode ser alterado ou removido.`;
  }
  const closedByCompany = new Map<string, string>();
  for (const closure of previous.periodClosures ?? []) {
    const current = closedByCompany.get(closure.company);
    if (!current || closure.throughDate > current) closedByCompany.set(closure.company, closure.throughDate);
  }
  for (const [company, throughDate] of closedByCompany) {
    const oldEntries = previous.journal.filter(entry => entry.company === company && entry.date <= throughDate);
    const newEntries = next.journal.filter(entry => entry.company === company && entry.date <= throughDate);
    const newEntriesById = new Map(newEntries.map(entry => [entry.id, entry]));
    if (
      oldEntries.length !== newEntries.length ||
      oldEntries.some(entry => {
        const candidate = newEntriesById.get(entry.id);
        return !candidate || !same(withoutReversalLink(entry), withoutReversalLink(candidate));
      })
    )
      return `O diário de ${company} está fechado até ${throughDate}.`;

    const accountIds = new Set(
      previous.accounts.filter(account => account.company === company).map(account => account.id),
    );
    const oldMoves = previous.movements.filter(move => accountIds.has(move.accountId) && move.date <= throughDate);
    const newMoves = next.movements.filter(move => accountIds.has(move.accountId) && move.date <= throughDate);
    const newMovesById = new Map(newMoves.map(move => [move.id, move]));
    if (
      oldMoves.length !== newMoves.length ||
      oldMoves.some(move => {
        const candidate = newMovesById.get(move.id);
        return !candidate || !same(withoutReversalLink(move), withoutReversalLink(candidate));
      })
    )
      return `Os movimentos bancários de ${company} estão fechados até ${throughDate}.`;

    const oldLines = (previous.statement ?? []).filter(
      line => accountIds.has(line.accountId) && line.date <= throughDate,
    );
    const newLines = (next.statement ?? []).filter(line => accountIds.has(line.accountId) && line.date <= throughDate);
    const newLinesById = new Map(newLines.map(line => [line.id, line]));
    if (oldLines.length !== newLines.length || oldLines.some(line => !same(line, newLinesById.get(line.id))))
      return `A conciliação de ${company} está fechada até ${throughDate}.`;

    const oldAccounts = previous.accounts.filter(item => item.company === company && item.openingDate <= throughDate);
    const newAccounts = next.accounts.filter(item => item.company === company && item.openingDate <= throughDate);
    const newAccountsById = new Map(newAccounts.map(account => [account.id, account]));
    if (
      oldAccounts.length !== newAccounts.length ||
      oldAccounts.some(account => {
        const candidate = newAccountsById.get(account.id);
        return (
          !candidate ||
          candidate.openingBalance !== account.openingBalance ||
          candidate.openingDate !== account.openingDate
        );
      })
    )
      return `O saldo de abertura de ${company} está fechado até ${throughDate}.`;
  }
  return null;
}
