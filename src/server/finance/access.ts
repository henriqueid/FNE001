import type { FinanceState } from "@/src/domain/finance/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";

type FinancePrincipal = Pick<ServerPrincipal, "companyScopes" | "permissions">;

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const sharedConfiguration = (state: FinanceState) => ({
  chart: state.chart,
  categories: state.categories,
  roles: state.roles,
  chartOrigin: state.chartOrigin,
  chartImports: state.chartImports,
});

const allowedOperationIds = (principal: FinancePrincipal, operationCompanies: Map<string, string>) =>
  new Set(
    [...operationCompanies]
      .filter(([, company]) => principalHasCompanyScope(principal, company))
      .map(([operationId]) => operationId),
  );

export function filterFinanceState(
  state: FinanceState | null,
  principal: FinancePrincipal,
  operationCompanies: Map<string, string>,
): FinanceState | null {
  if (!state) return null;
  const accounts = state.accounts.filter(account => principalHasCompanyScope(principal, account.company));
  const accountIds = new Set(accounts.map(account => account.id));
  const operationIds = allowedOperationIds(principal, operationCompanies);
  return {
    ...state,
    accounts,
    titles: state.titles.filter(title => principalHasCompanyScope(principal, title.company)),
    movements: state.movements.filter(movement => accountIds.has(movement.accountId)),
    journal: state.journal.filter(entry => principalHasCompanyScope(principal, entry.company)),
    registrations: Object.fromEntries(Object.entries(state.registrations).filter(([id]) => operationIds.has(id))),
    purchasePosted: Object.fromEntries(Object.entries(state.purchasePosted).filter(([id]) => operationIds.has(id))),
    statement: state.statement.filter(line => accountIds.has(line.accountId)),
    periodClosures: state.periodClosures?.filter(closure => principalHasCompanyScope(principal, closure.company)),
  };
}

export function mergeFinanceState(
  current: FinanceState,
  requested: FinanceState,
  principal: FinancePrincipal,
  operationCompanies: Map<string, string>,
): { state?: FinanceState; error?: string } {
  const operationIds = allowedOperationIds(principal, operationCompanies);
  const companyAllowed = (company: string) => principalHasCompanyScope(principal, company);
  const requestedAccountIds = new Set(requested.accounts.map(account => account.id));
  const requestedTitleIds = new Set(requested.titles.map(title => title.id));
  const requestedMovementIds = new Set(requested.movements.map(movement => movement.id));
  const requestedJournalIds = new Set(requested.journal.map(entry => entry.id));
  const requestedStatementIds = new Set(requested.statement.map(line => line.id));
  const requestedClosureIds = new Set((requested.periodClosures ?? []).map(closure => closure.id));
  const currentVisible = filterFinanceState(current, principal, operationCompanies)!;
  const preserves = <T>(values: T[], ids: Set<string>, idOf: (value: T) => string) =>
    values.every(value => ids.has(idOf(value)));

  if (
    requested.accounts.some(account => !companyAllowed(account.company)) ||
    requested.titles.some(title => !companyAllowed(title.company)) ||
    requested.journal.some(entry => !companyAllowed(entry.company)) ||
    requested.periodClosures?.some(closure => !companyAllowed(closure.company))
  )
    return { error: "O comando financeiro contém dados de uma empresa fora do seu escopo." };
  if (
    requested.movements.some(
      movement =>
        !requestedAccountIds.has(movement.accountId) ||
        (!!movement.titleId && !requestedTitleIds.has(movement.titleId)) ||
        (!!movement.entryId && !requestedJournalIds.has(movement.entryId)) ||
        (!!movement.reversalOf && !requestedMovementIds.has(movement.reversalOf)) ||
        (!!movement.reversedBy && !requestedMovementIds.has(movement.reversedBy)),
    ) ||
    requested.statement.some(line => !requestedAccountIds.has(line.accountId)) ||
    requested.titles.some(
      title =>
        (!!title.settledAccountId && !requestedAccountIds.has(title.settledAccountId)) ||
        (!!title.movementId && !requestedMovementIds.has(title.movementId)) ||
        (!!title.competenceEntryId && !requestedJournalIds.has(title.competenceEntryId)) ||
        (!!title.linkedTitleId && !requestedTitleIds.has(title.linkedTitleId)) ||
        (!!title.operationId && !operationIds.has(title.operationId)),
    ) ||
    requested.journal.some(
      entry =>
        (!!entry.reversalOf && !requestedJournalIds.has(entry.reversalOf)) ||
        (!!entry.reversedBy && !requestedJournalIds.has(entry.reversedBy)),
    )
  )
    return { error: "O comando financeiro referencia conta, título ou lançamento fora do seu escopo." };
  if (
    Object.keys(requested.registrations).some(id => !operationIds.has(id)) ||
    Object.keys(requested.purchasePosted).some(id => !operationIds.has(id)) ||
    Object.values(requested.purchasePosted).some(id => !requestedJournalIds.has(id))
  )
    return { error: "O comando financeiro referencia uma operação fora do seu escopo." };
  if (
    !preserves(currentVisible.accounts, requestedAccountIds, account => account.id) ||
    !preserves(currentVisible.titles, requestedTitleIds, title => title.id) ||
    !preserves(currentVisible.movements, requestedMovementIds, movement => movement.id) ||
    !preserves(currentVisible.journal, requestedJournalIds, entry => entry.id) ||
    !preserves(currentVisible.statement, requestedStatementIds, line => line.id) ||
    !preserves(currentVisible.periodClosures ?? [], requestedClosureIds, closure => closure.id) ||
    Object.keys(currentVisible.registrations).some(id => !(id in requested.registrations)) ||
    Object.keys(currentVisible.purchasePosted).some(id => !(id in requested.purchasePosted))
  )
    return { error: "O comando financeiro não pode remover fatos já registrados no seu escopo." };
  if (
    !principal.permissions.includes("settings:manage") &&
    !same(sharedConfiguration(current), sharedConfiguration(requested))
  )
    return { error: "Somente a gestão de configurações pode alterar o plano de contas e as categorias globais." };

  const hiddenAccounts = current.accounts.filter(account => !companyAllowed(account.company));
  const hiddenAccountIds = new Set(hiddenAccounts.map(account => account.id));
  const hiddenTitles = current.titles.filter(title => !companyAllowed(title.company));
  const hiddenJournal = current.journal.filter(entry => !companyAllowed(entry.company));
  const hiddenClosures = current.periodClosures?.filter(closure => !companyAllowed(closure.company)) ?? [];
  const hiddenRegistrations = Object.fromEntries(
    Object.entries(current.registrations).filter(([id]) => !operationIds.has(id)),
  );
  const hiddenPurchasePosted = Object.fromEntries(
    Object.entries(current.purchasePosted).filter(([id]) => !operationIds.has(id)),
  );
  const canManageShared = principal.permissions.includes("settings:manage");

  return {
    state: {
      ...current,
      ...requested,
      accounts: [...hiddenAccounts, ...requested.accounts],
      titles: [...hiddenTitles, ...requested.titles],
      movements: [
        ...current.movements.filter(movement => hiddenAccountIds.has(movement.accountId)),
        ...requested.movements,
      ],
      journal: [...hiddenJournal, ...requested.journal],
      registrations: { ...hiddenRegistrations, ...requested.registrations },
      purchasePosted: { ...hiddenPurchasePosted, ...requested.purchasePosted },
      statement: [...current.statement.filter(line => hiddenAccountIds.has(line.accountId)), ...requested.statement],
      periodClosures: [...hiddenClosures, ...(requested.periodClosures ?? [])],
      chart: canManageShared ? requested.chart : current.chart,
      categories: canManageShared ? requested.categories : current.categories,
      roles: canManageShared ? requested.roles : current.roles,
      chartOrigin: canManageShared ? requested.chartOrigin : current.chartOrigin,
      chartImports: canManageShared ? requested.chartImports : current.chartImports,
      persistenceVersion: current.persistenceVersion,
      seq: Math.max(current.seq, requested.seq),
    },
  };
}
