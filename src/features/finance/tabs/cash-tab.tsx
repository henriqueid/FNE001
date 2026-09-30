"use client";

/**
 * Caixa e fluxo: saldos por conta, projeção de 30 dias por cenário e fluxo diário/semanal/mensal.
 */
import { accountBalance, defaultAccountFor, inScope, scopedAccounts } from "@/src/domain/finance/banking";
import { addDays, todayIso } from "@/src/domain/finance/ledger";
import { type FinanceState, type FinanceTitle } from "@/src/domain/finance/model";
import { type CarteiraFlow, cashFlow } from "@/src/domain/finance/reports";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { useElementWidth } from "@/src/ui/use-element-width";
import { useState } from "react";

export function CashTab({
  state,
  scope,
  carteira,
  onGoExtract,
}: {
  state: FinanceState;
  scope: string;
  carteira: CarteiraFlow[];
  onGoExtract: (id: string) => void;
}) {
  const [chartRef, chartWidth] = useElementWidth<SVGSVGElement>(720);
  const today = todayIso();
  const [granularity, setGranularity] = useState<"dia" | "semana" | "mes">("semana");
  const [scenario, setScenario] = useState<"conservador" | "base" | "otimista">("base");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const factor = scenario === "conservador" ? 0.8 : scenario === "base" ? 0.95 : 1;
  const allScoped = scopedAccounts(state, scope);
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.filter(id => allScoped.some(a => a.id === id));
  const accounts = chosen.length ? allScoped.filter(a => chosen.includes(a.id)) : allScoped;
  const accountIds = chosen.length ? chosen : undefined;
  const partial = chosen.length > 0 && chosen.length < allScoped.length;
  const togglePick = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const total = accounts.reduce((s, a) => s + accountBalance(state, a.id), 0);
  const minimum = accounts.reduce((s, a) => s + a.minimumBalance, 0);
  const accountSet = new Set(accounts.map(a => a.id));
  const openTitles = state.titles.filter(
    t =>
      t.status === "Em aberto" &&
      inScope(t.company, scope) &&
      (!partial || accountSet.has(defaultAccountFor(state, t.company, t.kind)?.id ?? "")),
  );
  const sum = (list: FinanceTitle[]) => list.reduce((s, t) => s + t.amount, 0);
  const range =
    granularity === "dia"
      ? { from: addDays(today, -7), to: addDays(today, 21) }
      : granularity === "semana"
        ? { from: addDays(today, -21), to: addDays(today, 63) }
        : { from: `${addDays(today, -62).slice(0, 8)}01`, to: addDays(today, 120) };
  const flow = cashFlow(state, { scope, ...range, today, granularity, carteira, carteiraFactor: factor, accountIds });
  const projection = cashFlow(state, {
    scope,
    from: today,
    to: addDays(today, 29),
    today,
    granularity: "dia",
    carteira,
    carteiraFactor: factor,
    accountIds,
  });
  const lowest = projection.reduce((m, p) => (p.closing < m.closing ? p : m), projection[0]);
  const groups = (key: "inflows" | "outflows") => [...new Set(flow.flatMap(p => Object.keys(p[key])))].sort();
  const W = Math.max(320, chartWidth),
    H = W > 1400 ? 190 : 150,
    L = 8,
    R = 8;
  const closes = projection.map(p => p.closing);
  const maxV = Math.max(...closes, minimum) * 1.08,
    minV = Math.min(0, ...closes);
  const x = (i: number) => L + (i * (W - L - R)) / (closes.length - 1);
  const y = (v: number) => 8 + (1 - (v - minV) / (maxV - minV)) * (H - 24);
  return (
    <>
      <div className="fn-account-picker" role="group" aria-label="Contas consideradas no caixa">
        <span>Contas no fluxo</span>
        <button
          className={!chosen.length || (!partial && chosen.length === allScoped.length) ? "active" : ""}
          onClick={() => setPicked([])}
        >
          Consolidado · {allScoped.length} conta(s)
        </button>
        {allScoped.map(a => (
          <button
            key={a.id}
            className={chosen.includes(a.id) ? "active" : ""}
            aria-pressed={chosen.includes(a.id)}
            onClick={() => togglePick(a.id)}
          >
            <i>{a.bankCode}</i>
            {a.nickname}
            <small>{a.company.split(" ·")[0]}</small>
          </button>
        ))}
        {partial && (
          <em>
            Contas selecionadas: títulos em aberto entram pela conta prevista de cada empresa; a carteira de recebíveis
            só entra no consolidado.
          </em>
        )}
      </div>
      <div className="fn-kpis">
        <div>
          <span>Saldo em bancos</span>
          <strong>{compact(total)}</strong>
          <small>
            {accounts.length} conta(s) · mínimo {compact(minimum)}
          </small>
        </div>
        <div>
          <span>A receber em aberto</span>
          <strong className="good">{compact(sum(openTitles.filter(t => t.kind === "Receber")))}</strong>
          <small>{openTitles.filter(t => t.kind === "Receber").length} lançamento(s)</small>
        </div>
        <div>
          <span>A pagar em aberto</span>
          <strong className="bad">{compact(sum(openTitles.filter(t => t.kind === "Pagar")))}</strong>
          <small>
            {openTitles.filter(t => t.kind === "Pagar" && t.dueDate <= addDays(today, 7)).length} vencem em 7 dias
          </small>
        </div>
        <div>
          <span>Vencidos em aberto</span>
          <strong className={openTitles.some(t => t.dueDate < today) ? "bad" : ""}>
            {compact(sum(openTitles.filter(t => t.dueDate < today)))}
          </strong>
          <small>{openTitles.filter(t => t.dueDate < today).length} lançamento(s)</small>
        </div>
        <div>
          <span>Saldo projetado em 30 dias</span>
          <strong>{compact(projection[projection.length - 1]?.closing ?? total)}</strong>
          <small>Cenário {scenario} da carteira</small>
        </div>
        <div className={lowest && lowest.closing < minimum ? "alert" : ""}>
          <span>Menor saldo previsto</span>
          <strong className={lowest && lowest.closing < minimum ? "bad" : ""}>
            {compact(lowest?.closing ?? total)}
          </strong>
          <small>
            {lowest ? `em ${br(lowest.from).slice(0, 5)}` : ""} ·{" "}
            {lowest && lowest.closing < minimum ? "abaixo do mínimo" : "acima do mínimo"}
          </small>
        </div>
      </div>

      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Saldos por conta</h2>
            <p>Saldo atual pelo extrato do sistema · clique para abrir o extrato</p>
          </div>
        </header>
        <div className="fn-accounts">
          {accounts.map(a => {
            const bal = accountBalance(state, a.id);
            const pending = state.movements.filter(m => m.accountId === a.id && !m.reconciled).length;
            return (
              <button
                key={a.id}
                className={`fn-account ${bal < a.minimumBalance ? "low" : ""}`}
                onClick={() => onGoExtract(a.id)}
              >
                <span className="fn-bank-badge">{a.bankCode}</span>
                <div>
                  <b>{a.nickname}</b>
                  <small>
                    {a.bankName} · ag {a.agency} · cc {a.account}
                  </small>
                  <small>{a.company}</small>
                </div>
                <div className="fn-account-bal">
                  <strong>{money(bal)}</strong>
                  <small>{a.type}</small>
                  {pending > 0 ? <em className="warn">{pending} a conciliar</em> : <em className="ok">conciliado</em>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Saldo diário previsto · 30 dias</h2>
            <p>
              Saldo atual + títulos em aberto + carteira de recebíveis ({Math.round(factor * 100)}% dos vencimentos) −
              pagamentos previstos
            </p>
          </div>
          <div className="fn-seg">
            {(["conservador", "base", "otimista"] as const).map(s => (
              <button key={s} className={scenario === s ? "active" : ""} onClick={() => setScenario(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </header>
        <svg
          ref={chartRef}
          viewBox={`0 0 ${W} ${H}`}
          className="fn-mini-chart"
          role="img"
          aria-label="Saldo previsto dia a dia"
        >
          <line x1={L} x2={W - R} y1={y(minimum)} y2={y(minimum)} className="min" />
          <text x={W - R} y={y(minimum) - 4} textAnchor="end" className="min-label">
            Saldo mínimo {compact(minimum)}
          </text>
          <path
            d={`M${x(0)},${y(minV)} ${closes.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(closes.length - 1)},${y(minV)} Z`}
            className="area"
          />
          <path d={closes.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} className="line" />
          {projection.map((p, i) => (
            <g key={p.from} className="pt">
              <rect x={x(i) - 10} y={0} width={20} height={H} fill="transparent" />
              <circle cx={x(i)} cy={y(p.closing)} r={3} />
              <title>{`${br(p.from)}: ${money(p.closing)} (entradas ${compact(p.totalIn)}, saídas ${compact(p.totalOut)})`}</title>
            </g>
          ))}
          <text x={x(0)} y={H - 2} className="axis">
            Hoje
          </text>
          <text x={x(closes.length - 1)} y={H - 2} textAnchor="end" className="axis">
            +30 dias
          </text>
        </svg>
      </section>

      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Fluxo de caixa</h2>
            <p>
              Realizado (movimentos do extrato) até hoje e previsto a partir de hoje · transferências internas não
              entram
            </p>
          </div>
          <div className="fn-seg">
            {(["dia", "semana", "mes"] as const).map(g => (
              <button key={g} className={granularity === g ? "active" : ""} onClick={() => setGranularity(g)}>
                {g === "dia" ? "Diário" : g === "semana" ? "Semanal" : "Mensal"}
              </button>
            ))}
          </div>
        </header>
        <div className="fn-flow-scroll">
          <table className="fn-flow">
            <thead>
              <tr>
                <th>Período</th>
                {flow.map(p => (
                  <th key={p.from} className={p.to < today ? "real" : p.from > today ? "proj" : "now"}>
                    {p.label}
                    <small>{p.to < today ? "realizado" : p.from > today ? "previsto" : "atual"}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="opening">
                <td>Saldo inicial</td>
                {flow.map(p => (
                  <td key={p.from}>{compact(p.opening)}</td>
                ))}
              </tr>
              <tr className="group in" onClick={() => setOpen(o => ({ ...o, in: !o.in }))}>
                <td>{open.in ? "▾" : "▸"} Entradas</td>
                {flow.map(p => (
                  <td key={p.from}>{p.totalIn ? compact(p.totalIn) : "—"}</td>
                ))}
              </tr>
              {open.in &&
                groups("inflows").map(g => (
                  <tr key={g} className="detail">
                    <td>{g}</td>
                    {flow.map(p => (
                      <td key={p.from}>{p.inflows[g] ? compact(p.inflows[g]) : ""}</td>
                    ))}
                  </tr>
                ))}
              <tr className="group out" onClick={() => setOpen(o => ({ ...o, out: !o.out }))}>
                <td>{open.out ? "▾" : "▸"} Saídas</td>
                {flow.map(p => (
                  <td key={p.from}>{p.totalOut ? compact(-p.totalOut) : "—"}</td>
                ))}
              </tr>
              {open.out &&
                groups("outflows").map(g => (
                  <tr key={g} className="detail">
                    <td>{g}</td>
                    {flow.map(p => (
                      <td key={p.from}>{p.outflows[g] ? compact(-p.outflows[g]) : ""}</td>
                    ))}
                  </tr>
                ))}
              <tr className="net">
                <td>Resultado do período</td>
                {flow.map(p => (
                  <td key={p.from} className={p.totalIn - p.totalOut < 0 ? "bad" : "good"}>
                    {compact(p.totalIn - p.totalOut)}
                  </td>
                ))}
              </tr>
              <tr className="closing">
                <td>Saldo final</td>
                {flow.map(p => (
                  <td key={p.from} className={p.closing < minimum ? "bad" : ""}>
                    {compact(p.closing)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="fn-note">
          Clique em Entradas ou Saídas para abrir as categorias. Vencidos em aberto aparecem no período atual.
        </p>
      </section>
    </>
  );
}
