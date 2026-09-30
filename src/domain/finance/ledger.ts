// Motor financeiro e contábil. Funções puras: recebem o estado e devolvem um novo estado.
// Nada é removido: excluir = cancelar com estorno do lançamento de competência;
// estornar = lançar a contrapartida (movimento e contábil) e registrar no histórico.
import {
  chartWithBanks,
  modelCategories,
  nowStamp,
  roleLedger,
  seedAccounts,
  type FinanceState,
  type FinanceTitle,
  type HistoryEntry,
  type JournalLine,
  type Movement,
} from "./model";

export type OpFin = { face: number; discount: number; fees: number; revenue: number; rate: number; net: number };
export type Effect = {
  operationId: string;
  payableKey: string;
  status: "Pendente de pagamento" | "Pago" | "Cancelado";
  paidAt?: string;
};
export type Result = { state: FinanceState; error?: string; message?: string; effects?: Effect[] };

export const DAY = 86_400_000;
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number) {
  return isoDate(new Date(new Date(`${iso}T12:00:00`).getTime() + n * DAY));
}
export const todayIso = () => isoDate(new Date());

export { roleLedger };

export type Draft = FinanceState;
export function draftOf(s: FinanceState): Draft {
  return {
    ...s,
    accounts: [...s.accounts],
    titles: [...s.titles],
    movements: [...s.movements],
    journal: [...s.journal],
    registrations: { ...s.registrations },
    purchasePosted: { ...s.purchasePosted },
    statement: [...(s.statement ?? [])],
    chart: [...s.chart],
    categories: [...s.categories],
    roles: { ...s.roles },
    chartImports: [...(s.chartImports ?? [])],
  };
}
export function nextId(d: Draft, prefix: string) {
  d.seq += 1;
  return `${prefix}-${String(d.seq).padStart(5, "0")}`;
}
export const hist = (by: string, action: string, detail: string): HistoryEntry => ({
  at: nowStamp(),
  by,
  action,
  detail,
});
export function patchTitle(d: Draft, id: string, change: Partial<FinanceTitle>, entry?: HistoryEntry) {
  const i = d.titles.findIndex(t => t.id === id);
  if (i < 0) return;
  d.titles[i] = { ...d.titles[i], ...change, history: entry ? [...d.titles[i].history, entry] : d.titles[i].history };
}
export function patchMovement(d: Draft, id: string, change: Partial<Movement>, entry?: HistoryEntry) {
  const i = d.movements.findIndex(m => m.id === id);
  if (i < 0) return;
  d.movements[i] = {
    ...d.movements[i],
    ...change,
    history: entry ? [...d.movements[i].history, entry] : d.movements[i].history,
  };
}

export function post(
  d: Draft,
  input: {
    date: string;
    company: string;
    history: string;
    lines: JournalLine[];
    origin: FinanceState["journal"][number]["origin"];
    reversalOf?: string;
  },
  by: string,
) {
  const lines = input.lines
    .filter(l => Math.abs(l.debit) > 0.004 || Math.abs(l.credit) > 0.004)
    .map(l => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) }));
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debit - credit) > 0.01) throw new Error(`Lançamento desbalanceado: débito ${debit} × crédito ${credit}`);
  const id = nextId(d, "LC");
  d.journal.push({
    id,
    date: input.date,
    company: input.company,
    history: input.history,
    lines,
    origin: input.origin,
    reversalOf: input.reversalOf,
    createdAt: nowStamp(),
    createdBy: by,
  });
  if (input.reversalOf) {
    const i = d.journal.findIndex(j => j.id === input.reversalOf);
    if (i >= 0) d.journal[i] = { ...d.journal[i], reversedBy: id };
  }
  return id;
}
export function reverseEntry(d: Draft, entryId: string | undefined, date: string, reason: string, by: string) {
  if (!entryId) return undefined;
  const entry = d.journal.find(j => j.id === entryId);
  if (!entry || entry.reversedBy) return undefined;
  return post(
    d,
    {
      date,
      company: entry.company,
      history: `Estorno de ${entry.id}: ${reason}`,
      lines: entry.lines.map(l => ({ ledger: l.ledger, debit: l.credit, credit: l.debit })),
      origin: entry.origin,
      reversalOf: entry.id,
    },
    by,
  );
}

export function emptyState(openingDate: string): FinanceState {
  const accounts = seedAccounts(openingDate);
  return {
    version: 1,
    accounts,
    chart: chartWithBanks(accounts),
    categories: modelCategories,
    titles: [],
    movements: [],
    journal: [],
    registrations: {},
    purchasePosted: {},
    statement: [],
    seq: 0,
  };
}

export function openingEntries(state: FinanceState, by = "Implantação"): FinanceState {
  const d = draftOf(state);
  d.accounts.forEach(a => {
    if (!d.journal.some(j => j.origin.type === "Abertura" && j.origin.id === a.id))
      post(
        d,
        {
          date: a.openingDate,
          company: a.company,
          history: `Saldo de abertura ${a.nickname}`,
          lines: [
            { ledger: a.ledgerCode, debit: a.openingBalance, credit: 0 },
            { ledger: roleLedger(d, "capital"), debit: 0, credit: a.openingBalance },
          ],
          origin: { type: "Abertura", id: a.id },
        },
        by,
      );
  });
  return d;
}

export function run(state: FinanceState, fn: (d: Draft) => { message?: string; effects?: Effect[] }): Result {
  const d = draftOf(state);
  try {
    const out = fn(d);
    return { state: d, message: out.message, effects: out.effects };
  } catch (error) {
    return { state, error: error instanceof Error ? error.message : String(error) };
  }
}
