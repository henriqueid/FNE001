/** Relatórios contábeis usam exclusivamente as funções determinísticas do razão. */
import type { FinanceState } from "@/src/domain/finance/model";
import { inScope } from "@/src/domain/finance/banking";
import { round2 } from "@/src/domain/finance/ledger";
import { incomeStatement, trialBalance } from "@/src/domain/finance/reports";
import type { ExportReport } from "./model";
export type AccountingReportView = "balancete" | "dre" | "diario";
export function buildAccountingReport(
  state: FinanceState,
  scope: string,
  from: string,
  to: string,
  view: AccountingReportView,
  generatedAt = new Date().toISOString(),
): ExportReport {
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(from) || !validDate(to) || from > to) throw new Error("Informe um período válido para exportar.");
  const report: ExportReport = {
    title: view === "balancete" ? "Balancete" : view === "dre" ? "DRE por competência" : "Diário contábil",
    scope,
    from,
    to,
    generatedAt,
    sections: [],
  };
  if (view === "balancete") {
    const rows = trialBalance(state, scope, from, to);
    report.sections = [
      {
        title: "Saldos e movimentos em BRL (saldo positivo devedor; negativo credor)",
        columns: [
          { label: "Conta", width: 3 },
          { label: "Natureza", width: 1.5 },
          { label: "Saldo anterior", format: "money" },
          { label: "Débitos", format: "money" },
          { label: "Créditos", format: "money" },
          { label: "Saldo atual", format: "money" },
        ],
        rows: [
          ...rows.map(row => [`${row.code} ${row.name}`, row.nature, row.previous, row.debit, row.credit, row.balance]),
          [
            "Totais do período",
            "",
            round2(rows.reduce((s, r) => s + r.previous, 0)),
            round2(rows.reduce((s, r) => s + r.debit, 0)),
            round2(rows.reduce((s, r) => s + r.credit, 0)),
            round2(rows.reduce((s, r) => s + r.balance, 0)),
          ],
        ],
      },
    ];
  } else if (view === "dre") {
    const dre = incomeStatement(state, scope, from, to);
    const columns = [
      { label: "Conta", width: 3 },
      { label: "Valor (BRL)", format: "money" as const },
    ];
    report.sections = [
      {
        title: "Receitas",
        columns,
        rows: [...dre.revenues.map(r => [`${r.code} ${r.name}`, r.value]), ["Total de receitas", dre.totalRevenue]],
      },
      {
        title: "Despesas",
        columns,
        rows: [...dre.expenses.map(r => [`${r.code} ${r.name}`, r.value]), ["Total de despesas", dre.totalExpense]],
      },
      { title: "Resultado por competência", columns, rows: [["Receitas menos despesas", dre.result]] },
    ];
  } else {
    const entries = state.journal
      .filter(entry => inScope(entry.company, scope) && entry.date >= from && entry.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const rows = entries.flatMap(entry =>
      entry.lines.map(line => [
        entry.id,
        entry.date,
        entry.company,
        `${entry.history}${entry.reversalOf ? ` - Estorno de ${entry.reversalOf}` : ""}${entry.reversedBy ? ` - Estornado por ${entry.reversedBy}` : ""}`,
        `${line.ledger} ${state.chart.find(account => account.code === line.ledger)?.name ?? "Conta não localizada"}`,
        line.debit,
        line.credit,
      ]),
    );
    report.sections = [
      {
        title: "Partidas do diário em BRL",
        columns: [
          { label: "Lançamento", width: 1 },
          { label: "Data", format: "date", width: 1.1 },
          { label: "Empresa", width: 1.8 },
          { label: "Histórico", width: 2.8 },
          { label: "Conta", width: 2.5 },
          { label: "Débito", format: "money", width: 1.3 },
          { label: "Crédito", format: "money", width: 1.3 },
        ],
        rows: [
          ...rows,
          [
            "Totais do período",
            "",
            "",
            "",
            "",
            round2(entries.reduce((s, entry) => s + entry.lines.reduce((sum, line) => sum + line.debit, 0), 0)),
            round2(entries.reduce((s, entry) => s + entry.lines.reduce((sum, line) => sum + line.credit, 0), 0)),
          ],
        ],
      },
    ];
  }
  return report;
}
