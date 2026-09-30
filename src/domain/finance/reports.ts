/**
 * Relatórios do financeiro: fluxo de caixa (realizado e previsto), projeção diária, balancete e DRE.
 */
import { accountBalance, defaultAccountFor, inScope, scopedAccounts } from "./banking";
import { addDays, isoDate, round2 } from "./ledger";
import { type FinanceState, type FinanceTitle } from "./model";

export type FlowPeriod = {
  label: string;
  from: string;
  to: string;
  opening: number;
  inflows: Record<string, number>;
  outflows: Record<string, number>;
  totalIn: number;
  totalOut: number;
  closing: number;
  realized: boolean;
  projected: boolean;
};

export type CarteiraFlow = { date: string; amount: number; company?: string };

export function titleGroup(state: FinanceState, t: FinanceTitle) {
  if (t.origin === "Liberação de operação") return "Liberações de operações";
  if (t.origin === "Recuperação de pagamento") return "Recuperações";
  if (t.origin === "Devolução de recebimento") return "Devoluções";
  return (
    state.categories.find(c => c.id === t.categoryId)?.name ??
    (t.kind === "Pagar" ? "Outras saídas" : "Outras entradas")
  );
}

export function cashFlow(
  state: FinanceState,
  opts: {
    scope: string;
    from: string;
    to: string;
    today: string;
    granularity: "dia" | "semana" | "mes";
    carteira: CarteiraFlow[];
    carteiraFactor: number;
    accountIds?: string[];
  },
): FlowPeriod[] {
  const scoped = scopedAccounts(state, opts.scope);
  const filtered = opts.accountIds?.length ? scoped.filter(a => opts.accountIds!.includes(a.id)) : scoped;
  const accounts = filtered.length ? filtered : scoped;
  const ids = new Set(accounts.map(a => a.id));
  const allAccounts = accounts.length === scoped.length;
  // título em aberto entra na conta prevista para ele (conta padrão da empresa para pagar/receber)
  const plannedIn = (t: FinanceTitle) => allAccounts || ids.has(defaultAccountFor(state, t.company, t.kind)?.id ?? "");
  const periods: { label: string; from: string; to: string }[] = [];
  let cursor = opts.from;
  while (cursor <= opts.to) {
    const d = new Date(`${cursor}T12:00:00`);
    let end = cursor,
      label = `${cursor.slice(8)}/${cursor.slice(5, 7)}`;
    if (opts.granularity === "semana") {
      const wd = (d.getDay() + 6) % 7;
      end = addDays(cursor, 6 - wd);
      label = `${cursor.slice(8)}/${cursor.slice(5, 7)}–${end.slice(8)}/${end.slice(5, 7)}`;
    }
    if (opts.granularity === "mes") {
      end = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    }
    if (end > opts.to) end = opts.to;
    periods.push({ label, from: cursor, to: end });
    cursor = addDays(end, 1);
  }
  const balanceBefore = (date: string) =>
    accounts.reduce((s, a) => s + accountBalance(state, a.id, addDays(date, -1)), 0);
  const openTitles = state.titles.filter(t => t.status === "Em aberto" && inScope(t.company, opts.scope));
  let running = round2(balanceBefore(opts.from));
  return periods.map(p => {
    const inflows: Record<string, number> = {},
      outflows: Record<string, number> = {};
    const add = (bag: Record<string, number>, key: string, v: number) => {
      bag[key] = round2((bag[key] ?? 0) + v);
    };
    // realizado: movimentos das contas no período (transferências internas não contam)
    state.movements
      .filter(
        m =>
          ids.has(m.accountId) &&
          m.date >= p.from &&
          m.date <= p.to &&
          m.date <= opts.today &&
          m.kind !== "Transferência",
      )
      .forEach(m => {
        const t = state.titles.find(x => x.id === m.titleId);
        const group = m.kind === "Estorno" ? "Estornos" : t ? titleGroup(state, t) : "Outros";
        if (m.amount >= 0) add(inflows, group, m.amount);
        else add(outflows, group, -m.amount);
      });
    // previsto: títulos em aberto (vencidos entram no período de hoje) e vencimentos da carteira
    const containsToday = opts.today >= p.from && opts.today <= p.to;
    openTitles.filter(plannedIn).forEach(t => {
      const due = t.dueDate < opts.today ? opts.today : t.dueDate;
      if (due < p.from || due > p.to || due < opts.today) return;
      const group =
        t.dueDate < opts.today
          ? t.kind === "Pagar"
            ? "Pagamentos vencidos em aberto"
            : "Recebimentos vencidos em aberto"
          : titleGroup(state, t);
      if (t.kind === "Receber") add(inflows, group, t.amount);
      else add(outflows, group, t.amount);
    });
    opts.carteira
      .filter(
        c =>
          allAccounts &&
          (!c.company || inScope(c.company, opts.scope)) &&
          c.date >= p.from &&
          c.date <= p.to &&
          c.date >= opts.today,
      )
      .forEach(c => add(inflows, "Carteira a receber", c.amount * opts.carteiraFactor));
    const totalIn = round2(Object.values(inflows).reduce((s, v) => s + v, 0));
    const totalOut = round2(Object.values(outflows).reduce((s, v) => s + v, 0));
    const opening = running;
    running = round2(opening + totalIn - totalOut);
    return {
      ...p,
      opening,
      inflows,
      outflows,
      totalIn,
      totalOut,
      closing: running,
      realized: p.from <= opts.today,
      projected: p.to >= opts.today || containsToday,
    };
  });
}

export function dailyProjection(
  state: FinanceState,
  scope: string,
  today: string,
  carteira: CarteiraFlow[],
  factor: number,
  days = 31,
  accountIds?: string[],
) {
  return cashFlow(state, {
    scope,
    from: today,
    to: addDays(today, days - 1),
    today,
    granularity: "dia",
    carteira,
    carteiraFactor: factor,
    accountIds,
  }).map(p => p.closing);
}

export function trialBalance(state: FinanceState, scope: string, from: string, to: string) {
  const rows = new Map<string, { previous: number; debit: number; credit: number }>();
  state.journal
    .filter(j => inScope(j.company, scope) && j.date <= to)
    .forEach(j =>
      j.lines.forEach(l => {
        const r = rows.get(l.ledger) ?? { previous: 0, debit: 0, credit: 0 };
        if (j.date < from) r.previous = round2(r.previous + l.debit - l.credit);
        else {
          r.debit = round2(r.debit + l.debit);
          r.credit = round2(r.credit + l.credit);
        }
        rows.set(l.ledger, r);
      }),
    );
  return state.chart
    .filter(c => c.analytic && rows.has(c.code))
    .map(c => {
      const r = rows.get(c.code)!;
      return { ...c, ...r, balance: round2(r.previous + r.debit - r.credit) };
    });
}

export function incomeStatement(state: FinanceState, scope: string, from: string, to: string) {
  const tb = trialBalance(state, scope, from, to);
  const revenues = tb
    .filter(r => r.nature === "Receita")
    .map(r => ({ code: r.code, name: r.name, value: round2(r.credit - r.debit) }));
  const expenses = tb
    .filter(r => r.nature === "Despesa")
    .map(r => ({ code: r.code, name: r.name, value: round2(r.debit - r.credit) }));
  const totalRevenue = revenues.reduce((s, r) => s + r.value, 0),
    totalExpense = expenses.reduce((s, r) => s + r.value, 0);
  return { revenues, expenses, totalRevenue, totalExpense, result: round2(totalRevenue - totalExpense) };
}
