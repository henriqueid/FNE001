"use client";

/**
 * Contábil: balancete, DRE, diário, plano de contas e categorias.
 */
import { inScope } from "@/src/domain/finance/banking";
import { chartToCsv } from "@/src/domain/finance/chart-import";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import { type FinanceState } from "@/src/domain/finance/model";
import { incomeStatement, trialBalance } from "@/src/domain/finance/reports";
import { addCategory, addChartAccount } from "@/src/domain/finance/setup";
import { ChartImportModal, downloadCsv } from "@/src/features/finance/chart-import-modal";
import { Field, br, money } from "@/src/features/finance/finance-ui";
import { useMemo, useState } from "react";

export function AccountingTab({
  state,
  scope,
  onApply,
}: {
  state: FinanceState;
  scope: string;
  onApply: (r: Result) => void;
}) {
  const today = todayIso();
  const [view, setView] = useState<"diario" | "balancete" | "dre" | "plano">("balancete");
  const [importing, setImporting] = useState(false);
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [newAcc, setNewAcc] = useState({
    code: "",
    name: "",
    nature: "Despesa" as FinanceState["chart"][number]["nature"],
  });
  const [newCat, setNewCat] = useState({
    name: "",
    kind: "Despesa" as "Receita" | "Despesa",
    ledgerCode: "",
    group: "",
  });
  const tb = useMemo(() => trialBalance(state, scope, from, to), [state, scope, from, to]);
  const dre = useMemo(() => incomeStatement(state, scope, from, to), [state, scope, from, to]);
  const entries = state.journal
    .filter(j => inScope(j.company, scope) && j.date >= from && j.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const name = (code: string) => state.chart.find(c => c.code === code)?.name ?? code;
  const totalD = tb.reduce((s, r) => s + r.debit, 0),
    totalC = tb.reduce((s, r) => s + r.credit, 0);
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Contabilidade</h2>
          <p>
            Partidas dobradas geradas pelos títulos, baixas, transferências e operações · estornos por contrapartida
          </p>
        </div>
        <div className="fn-seg">
          {(
            [
              ["balancete", "Balancete"],
              ["dre", "DRE"],
              ["diario", "Diário"],
              ["plano", "Plano de contas"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {view !== "plano" && (
        <div className="fn-toolbar">
          <Field label="De">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
        </div>
      )}
      {view === "balancete" && (
        <>
          <div className="fn-table-scroll">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Natureza</th>
                  <th className="num">Saldo anterior</th>
                  <th className="num">Débitos</th>
                  <th className="num">Créditos</th>
                  <th className="num">Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {tb.map(r => (
                  <tr key={r.code}>
                    <td>
                      <b>{r.code}</b> {r.name}
                    </td>
                    <td>
                      <small>{r.nature}</small>
                    </td>
                    <td className="num">{money(r.previous)}</td>
                    <td className="num">{money(r.debit)}</td>
                    <td className="num">{money(r.credit)}</td>
                    <td className="num">
                      <b>
                        {money(Math.abs(r.balance))} {r.balance >= 0 ? "D" : "C"}
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Totais do período</td>
                  <td className="num">{money(totalD)}</td>
                  <td className="num">{money(totalC)}</td>
                  <td className={Math.abs(totalD - totalC) < 0.01 ? "good" : "bad"}>
                    {Math.abs(totalD - totalC) < 0.01 ? "Débitos = créditos" : "Divergência!"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      {view === "dre" && (
        <div className="fn-dre">
          <div>
            <h4>Receitas</h4>
            {dre.revenues.map(r => (
              <p key={r.code}>
                <span>
                  {r.code} {r.name}
                </span>
                <b>{money(r.value)}</b>
              </p>
            ))}
            <p className="total">
              <span>Total de receitas</span>
              <b className="good">{money(dre.totalRevenue)}</b>
            </p>
          </div>
          <div>
            <h4>Despesas</h4>
            {dre.expenses.map(r => (
              <p key={r.code}>
                <span>
                  {r.code} {r.name}
                </span>
                <b>{money(r.value)}</b>
              </p>
            ))}
            <p className="total">
              <span>Total de despesas</span>
              <b className="bad">{money(dre.totalExpense)}</b>
            </p>
          </div>
          <p className="fn-dre-result">
            <span>Resultado do período (competência)</span>
            <b className={dre.result >= 0 ? "good" : "bad"}>{money(dre.result)}</b>
          </p>
          <p className="fn-note">
            Receita de deságio fica em “Deságio a apropriar” (2.1.5.01) até a apropriação por competência ao longo do
            prazo dos títulos (próxima fase).
          </p>
        </div>
      )}
      {view === "diario" && (
        <div className="fn-journal">
          {entries.map(j => (
            <article key={j.id} className={j.reversedBy ? "reversed" : j.reversalOf ? "reversal" : ""}>
              <header>
                <b>{j.id}</b>
                <span>{br(j.date)}</span>
                <span>{j.history}</span>
                {j.reversalOf && <em className="fn-chip warn">Estorno de {j.reversalOf}</em>}
                {j.reversedBy && <em className="fn-chip muted">Estornado por {j.reversedBy}</em>}
                <small>
                  {j.company} · {j.createdBy} · {j.createdAt}
                </small>
              </header>
              <table>
                <tbody>
                  {j.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.ledger}</td>
                      <td>{name(l.ledger)}</td>
                      <td className="num">{l.debit ? money(l.debit) : ""}</td>
                      <td className="num">{l.credit ? money(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
          {entries.length === 0 && <div className="fn-empty">Nenhum lançamento no período.</div>}
        </div>
      )}
      {view === "plano" && (
        <div className="fn-chart-bar">
          <div>
            <b>{state.chartOrigin === "importado" ? "Plano importado" : "Plano modelo Strato"}</b>
            <small>
              {state.chart.length} contas · {state.chart.filter(c => c.analytic).length} analíticas
              {state.chartImports?.length
                ? ` · última importação ${state.chartImports[state.chartImports.length - 1].file} em ${state.chartImports[state.chartImports.length - 1].at} por ${state.chartImports[state.chartImports.length - 1].by}`
                : ""}
            </small>
          </div>
          <div className="fn-head-actions">
            <button
              className="fn-btn ghost"
              onClick={() => downloadCsv("plano-de-contas.csv", chartToCsv(state.chart))}
            >
              Exportar CSV
            </button>
            <button className="fn-btn primary" onClick={() => setImporting(true)}>
              Importar plano de contas
            </button>
          </div>
        </div>
      )}
      {importing && <ChartImportModal state={state} onClose={() => setImporting(false)} onApply={onApply} />}
      {view === "plano" && (
        <div className="fn-chart">
          <div className="fn-chart-list">
            {state.chart.map(c => (
              <p
                key={c.code}
                className={c.analytic ? "analytic" : "synthetic"}
                style={{ paddingLeft: `${(c.code.split(".").length - 1) * 16 + 8}px` }}
              >
                <b>{c.code}</b>
                <span>{c.name}</span>
                <small>
                  {c.nature}
                  {c.analytic ? " · analítica" : ""}
                </small>
              </p>
            ))}
          </div>
          <aside>
            <h4>Nova conta analítica</h4>
            <div className="fn-form single">
              <Field label="Código">
                <input
                  value={newAcc.code}
                  onChange={e => setNewAcc({ ...newAcc, code: e.target.value })}
                  placeholder="5.1.10"
                />
              </Field>
              <Field label="Nome">
                <input value={newAcc.name} onChange={e => setNewAcc({ ...newAcc, name: e.target.value })} />
              </Field>
              <Field label="Natureza">
                <select
                  value={newAcc.nature}
                  onChange={e => setNewAcc({ ...newAcc, nature: e.target.value as typeof newAcc.nature })}
                >
                  {["Ativo", "Passivo", "Patrimônio líquido", "Receita", "Despesa"].map(n => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <button
                className="fn-btn primary"
                onClick={() => {
                  const r = addChartAccount(state, newAcc);
                  onApply(r);
                  if (!r.error) setNewAcc({ code: "", name: "", nature: newAcc.nature });
                }}
              >
                Criar conta
              </button>
            </div>
            <h4>Categorias gerenciais</h4>
            <ul className="fn-cats">
              {state.categories.map(c => (
                <li key={c.id}>
                  <span className={`fn-kind-dot ${c.kind === "Despesa" ? "pay" : "receive"}`}>{c.name}</span>
                  <small>
                    {c.group} → {c.ledgerCode}
                  </small>
                </li>
              ))}
            </ul>
            <div className="fn-form single">
              <Field label="Nova categoria">
                <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
              </Field>
              <Field label="Tipo">
                <select
                  value={newCat.kind}
                  onChange={e =>
                    setNewCat({ ...newCat, kind: e.target.value as "Receita" | "Despesa", ledgerCode: "" })
                  }
                >
                  <option>Despesa</option>
                  <option>Receita</option>
                </select>
              </Field>
              <Field label="Conta contábil">
                <select value={newCat.ledgerCode} onChange={e => setNewCat({ ...newCat, ledgerCode: e.target.value })}>
                  <option value="">Escolha</option>
                  {state.chart
                    .filter(c => c.analytic && c.nature === newCat.kind)
                    .map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Grupo">
                <input
                  value={newCat.group}
                  onChange={e => setNewCat({ ...newCat, group: e.target.value })}
                  placeholder="Estrutura"
                />
              </Field>
              <button
                className="fn-btn ghost"
                onClick={() => {
                  const r = addCategory(state, newCat);
                  onApply(r);
                  if (!r.error) setNewCat({ name: "", kind: newCat.kind, ledgerCode: "", group: "" });
                }}
              >
                Criar categoria
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
